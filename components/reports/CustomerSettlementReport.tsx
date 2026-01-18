import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, ParcelItem, Customer, UserProfile, CurrencyConfig, Account, SystemSettings } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface CustomerSummary {
    id: string;
    name: string;
    phone: string;
    totalCodUSD: number;
    totalCodKHR: number;
    totalFeeUSD: number;
    totalFeeKHR: number;
    netUSD: number;
    netKHR: number;
    unsettledCount: number;
}

// Customer Settlement Report Component
// Handles wallet balance display and settlement payouts with GL preview
export const CustomerSettlementReport: React.FC = () => {
    // console.log('✅ CustomerSettlementReport component initialized');

    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [bookingsData, customersData, usersData, currenciesData, accountsData, settingsData] = await Promise.all([
                    firebaseService.getParcelBookings(),
                    firebaseService.getCustomers(),
                    firebaseService.getUsers(),
                    firebaseService.getCurrencies(),
                    firebaseService.getAccounts(),
                    firebaseService.getSettings()
                ]);
                setBookings(bookingsData);
                setCustomers(customersData);
                setUsers(usersData);
                setCurrencies(currenciesData);
                setAccounts(accountsData);
                setSettings(settingsData);
            } catch (e) {
                // console.error(e);
                toast.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const customerSummaries = useMemo(() => {
        const summaryMap = new Map<string, CustomerSummary>();

        // Initialize from customers list
        customers.forEach(c => {
            summaryMap.set(c.id, {
                id: c.id,
                name: c.name,
                phone: c.phone || '',
                totalCodUSD: 0,
                totalCodKHR: 0,
                totalFeeUSD: 0,
                totalFeeKHR: 0,
                netUSD: 0,
                netKHR: 0,
                unsettledCount: 0
            });
        });

        bookings.forEach(b => {
            let summary: CustomerSummary | undefined;

            if (b.senderId) {
                summary = summaryMap.get(b.senderId);
            }

            // Fallback: Try matching by phone if no ID match
            if (!summary && b.senderPhone) {
                // Normalize phone: remove non-digits. Compare last 9 digits to handle +855 vs 0 prefixes
                const cleanPhone = b.senderPhone.replace(/\D/g, '');

                for (const [_id, s] of summaryMap.entries()) {
                    if (s.phone) {
                        const custClean = s.phone.replace(/\D/g, '');
                        // Check if one ends with the other (suffix match) to handle country codes
                        if (cleanPhone.length > 5 && custClean.length > 5) { // Minimum length check
                            if (cleanPhone.endsWith(custClean) || custClean.endsWith(cleanPhone)) {
                                summary = s;
                                break;
                            }
                        }
                    }
                }
            }

            // Allow Unmatched Customers? 
            // If we can't find a customer profile, we might still want to list them as "Unknown Customer (Phone)"
            // so the admin can see there is money to pay out.
            if (!summary && b.senderName) {
                // Create a temporary summary for this unknown customer
                const tempId = `temp-${b.senderPhone || b.senderName}`;
                if (!summaryMap.has(tempId)) {
                    summaryMap.set(tempId, {
                        id: tempId, // Non-existent ID, preventing auto-payout but allowing view
                        name: `${b.senderName} (Unregistered)`,
                        phone: b.senderPhone || '',
                        totalCodUSD: 0,
                        totalCodKHR: 0,
                        totalFeeUSD: 0,
                        totalFeeKHR: 0,
                        netUSD: 0,
                        netKHR: 0,
                        unsettledCount: 0
                    });
                }
                summary = summaryMap.get(tempId);
            }

            if (!summary) return;

            (b.items || []).forEach(item => {
                if (item.status === 'DELIVERED' && item.customerSettlementStatus !== 'SETTLED') {
                    const cod = Number(item.productPrice) || 0;
                    const isKHR = item.codCurrency === 'KHR';

                    // Fee is in ONE currency matching item's codCurrency
                    if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                        if (isKHR) {
                            summary.totalCodKHR += cod;
                            summary.totalFeeKHR += item.deliveryFeeKHR || 0;
                        } else {
                            summary.totalCodUSD += cod;
                            summary.totalFeeUSD += item.deliveryFeeUSD || 0;
                        }
                    } else {
                        // Fallback for legacy items
                        const fee = Number(item.deliveryFee) || 0;
                        if (isKHR) {
                            summary.totalCodKHR += cod;
                            summary.totalFeeKHR += fee;
                        } else {
                            summary.totalCodUSD += cod;
                            summary.totalFeeUSD += fee;
                        }
                    }

                    // Taxi Fee (Deduction)
                    if (item.taxiFee && item.taxiFee > 0) {
                        if (item.taxiFeeCurrency === 'KHR') {
                            summary.totalFeeKHR += item.taxiFee;
                        } else {
                            summary.totalFeeUSD += item.taxiFee;
                        }
                    }

                    summary.unsettledCount++;
                }
            });
        });

        // Calculate Net
        summaryMap.forEach(s => {
            // Revert to calculating from Unsettled Items for the List View
            // (Since we can't efficiently fetch live wallet balances for everyone here)
            // But we keep the Phone/Name matching logic
            const linkedUser = users.find(u => u.linkedCustomerId === s.id || u.phone === s.phone);

            if (linkedUser) {
                if (s.name.includes('(Unregistered)')) {
                    s.name = linkedUser.name;
                    s.id = linkedUser.linkedCustomerId || s.id;
                }
            }
            s.netUSD = s.totalCodUSD - s.totalFeeUSD;
            s.netKHR = s.totalCodKHR - s.totalFeeKHR;
        });

        return Array.from(summaryMap.values())
            .filter(s => s.unsettledCount > 0)
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm))
            .sort((a, b) => b.unsettledCount - a.unsettledCount);
    }, [bookings, customers, searchTerm, users]);

    // --- Zoom State ---
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // --- Detail View Logic ---
    const [liveBalance, setLiveBalance] = useState<{ usd: number, khr: number } | null>(null);
    const [excludeFees, setExcludeFees] = useState(false);
    const [excludeFeesFromProfile, setExcludeFeesFromProfile] = useState(false); // Track if set from profile

    useEffect(() => {
        if (selectedCustomerId) {
            const loadBalance = async () => {
                // Find user
                const summary = customerSummaries.find(s => s.id === selectedCustomerId);
                // Try to find the linked user
                const linkedUser = users.find(u => u.linkedCustomerId === selectedCustomerId || (summary?.phone && u.phone === summary.phone));

                if (linkedUser) {
                    try {
                        const [allTxns, userBookings] = await Promise.all([
                            firebaseService.getWalletTransactions(linkedUser.uid),
                            firebaseService.getUserBookings(linkedUser)
                        ]);

                        // --- UNIFIED LEDGER CALCULATION (Replicated from WalletDashboard) ---
                        // We must duplicate this reasoning because the Wallet Balance is calculated on-the-fly, not stored.

                        let usd = 0;
                        let khr = 0;

                        // 1. Explicit Transactions
                        allTxns.forEach(t => {
                            if (t.status === 'REJECTED' || t.status === 'FAILED') return;
                            const val = t.amount;
                            if (t.type === 'DEPOSIT' || t.type === 'EARNING' || t.type === 'REFUND') {
                                // Credit (money IN to customer wallet)
                                if (t.currency === 'KHR') khr += val; else usd += val;
                            } else if (t.type === 'SETTLEMENT' || t.type === 'WITHDRAWAL') {
                                // Debit (money OUT to customer - payout)
                                if (t.currency === 'KHR') khr -= val; else usd -= val;
                            }
                        });

                        // 2. Implicit Booking Data (COD & Fees)
                        // 2. Implicit Booking Data (COD & Fees) - Logic aligned with WalletDashboard
                        userBookings.forEach(b => {
                            const bItems = b.items || [];
                            const itemsDelivered = bItems.filter(i => i.status === 'DELIVERED').length;

                            // A. COD Collection (Credit)
                            bItems.forEach(item => {
                                if (item.status === 'DELIVERED') {
                                    if (item.codCurrency === 'KHR') {
                                        khr += (item.productPrice || 0);
                                    } else {
                                        usd += (item.productPrice || 0);
                                    }
                                }
                            });

                            // B. Service Fee Deduction (Debit)
                            if (b.status !== 'CANCELLED') {
                                // Deduct fee if items are delivered or booking is completed
                                if (itemsDelivered > 0 || b.status === 'COMPLETED' || b.status === 'CONFIRMED') {
                                    // Sum fees by currency from delivered items
                                    // Each item's fee is in ONE currency matching its codCurrency
                                    let khrFeeTotal = 0;
                                    let usdFeeTotal = 0;

                                    bItems.forEach(item => {
                                        if (item.status === 'DELIVERED') {
                                            const isKHR = item.codCurrency === 'KHR';

                                            // Use dual currency fields if available, but only the one matching codCurrency
                                            if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                                                if (isKHR) {
                                                    khrFeeTotal += item.deliveryFeeKHR || 0;
                                                } else {
                                                    usdFeeTotal += item.deliveryFeeUSD || 0;
                                                }
                                            } else {
                                                // Fallback for legacy items
                                                const itemFee = Number(item.deliveryFee) || 0;
                                                if (isKHR) {
                                                    khrFeeTotal += itemFee;
                                                } else {
                                                    usdFeeTotal += itemFee;
                                                }
                                            }

                                            // Taxi Fee (Deduction - Strict Currency Separation)
                                            // WalletDashboard checks Transaction for 'TAXI_FEE' credit, but here we are checking Payout. 
                                            // Wait, taxi fee is credited to driver, but deducted from customer? 
                                            // Yes, customer pays taxi.
                                            if (item.taxiFee && item.taxiFee > 0) {
                                                if (item.taxiFeeCurrency === 'KHR') {
                                                    khr -= item.taxiFee;
                                                } else {
                                                    usd -= item.taxiFee;
                                                }
                                            }
                                        }
                                    });

                                    // Deduct consolidated fees
                                    usd -= usdFeeTotal;
                                    khr -= khrFeeTotal;
                                }
                            }
                        });

                        setLiveBalance({ usd, khr });
                    } catch (e) {
                        // console.error("Failed to load wallet balance", e);
                    }
                } else {
                    setLiveBalance(null);
                }
            };
            loadBalance();

            // Auto-set excludeFees from customer profile (admin-controlled)
            const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
            if (selectedCustomer) {
                const profileSetting = selectedCustomer.excludeFeesInSettlement || false;
                setExcludeFees(profileSetting);
                setExcludeFeesFromProfile(profileSetting); // Remember if it was set from profile
            }
        } else {
            setLiveBalance(null);
            setExcludeFees(false);
            setExcludeFeesFromProfile(false);
        }
    }, [selectedCustomerId, users, customerSummaries, customers]); // Remove bookings dependency to avoid cycle if not needed, or keep it if we want real-time updates from global bookings state.


    const selectedCustomerDetails = useMemo(() => {
        if (!selectedCustomerId) return [];
        const details: any[] = [];
        bookings.forEach(b => {
            if (b.senderId !== selectedCustomerId) return;
            (b.items || []).forEach(item => {
                if (item.status === 'DELIVERED' && item.customerSettlementStatus !== 'SETTLED') {
                    // Use pre-stored dual currency fees if available
                    let fee = 0;
                    let feeCurrency = item.codCurrency || 'USD';

                    if (item.deliveryFeeUSD !== undefined || item.deliveryFeeKHR !== undefined) {
                        // For display, use the fee matching COD currency
                        fee = feeCurrency === 'KHR'
                            ? (item.deliveryFeeKHR || 0)
                            : (item.deliveryFeeUSD || 0);
                    } else {
                        // Fallback for legacy items
                        fee = Number(item.deliveryFee) || 0;
                    }

                    // Taxi Fee Info
                    const taxiFee = item.taxiFee || 0;
                    const taxiFeeCurrency = item.taxiFeeCurrency || 'KHR';

                    // Net Calculation (Indicative only, mixed currencies might exist)
                    // If currencies match, we deduct. If not, we don't for 'Net' of this specific item row unless we want to show mixed net.
                    let net = (Number(item.productPrice) || 0) - fee;
                    if (taxiFee > 0 && taxiFeeCurrency === feeCurrency) {
                        net -= taxiFee;
                    }

                    details.push({
                        bookingId: b.id,
                        itemId: item.id,
                        trackingCode: item.trackingCode,
                        receiverName: item.receiverName,
                        receiverPhone: item.receiverPhone,
                        deliveryDate: b.bookingDate,
                        image: item.image,
                        cod: Number(item.productPrice) || 0,
                        codCurrency: item.codCurrency || 'USD',
                        fee: fee,
                        feeCurrency: feeCurrency,
                        taxiFee: taxiFee,
                        taxiFeeCurrency: taxiFeeCurrency,
                        net: net
                    });
                }
            });
        });
        return details;
    }, [bookings, selectedCustomerId]);

    // --- Gross Payment Adjustments ---
    // Calculates what needs to be added back to Net Balance to get Gross Payout
    const grossAdjustments = useMemo(() => {
        let adjUSD = 0;
        let adjKHR = 0;
        if (excludeFees) {
            selectedCustomerDetails.forEach(d => {
                // Add back Delivery Fees
                if (d.fee > 0) {
                    if (d.feeCurrency === 'KHR') adjKHR += d.fee;
                    else adjUSD += d.fee;
                }
                // Add back Taxi Fees
                if (d.taxiFee > 0) {
                    if (d.taxiFeeCurrency === 'USD') adjUSD += d.taxiFee;
                    else adjKHR += d.taxiFee; // Default to KHR
                }
            });
        }
        return { usd: adjUSD, khr: adjKHR };
    }, [excludeFees, selectedCustomerDetails]);

    // --- Confirmation Modal State ---
    const [confirmation, setConfirmation] = useState<{
        summary: CustomerSummary;
        targetCurrency: 'USD' | 'KHR';
        netAmount: number;
        itemsToSettle: any[];
    } | null>(null);

    const initiateSettle = (summary: CustomerSummary, targetCurrency: 'USD' | 'KHR') => {
        // Use Live Balance if available, else Fallback
        let netUSD = liveBalance ? liveBalance.usd : summary.netUSD;
        let netKHR = liveBalance ? liveBalance.khr : summary.netKHR;

        // Apply Add-Backs for Gross Payment
        if (excludeFees) {
            netUSD += grossAdjustments.usd;
            netKHR += grossAdjustments.khr;
        }

        const netAmount = targetCurrency === 'USD' ? netUSD : netKHR;

        // Include items where COD OR Taxi Fee matches the target currency
        const itemsToSettle = selectedCustomerDetails
            .filter(d => {
                // Primary check: COD currency matches
                if (d.codCurrency === targetCurrency) return true;

                // Secondary check: Taxi Fee matches (and is non-zero)
                // This covers mixed currency items (e.g. USD COD but KHR Taxi Fee)
                if (d.taxiFee > 0 && d.taxiFeeCurrency === targetCurrency) return true;

                return false;
            })
            .map(d => ({
                bookingId: d.bookingId,
                itemId: d.itemId
            }));

        setConfirmation({
            summary,
            targetCurrency,
            netAmount,
            itemsToSettle
        });
    };

    const executeSettle = async () => {
        if (!confirmation) return;
        const { summary, targetCurrency, netAmount, itemsToSettle } = confirmation;

        setProcessing(true);
        try {
            const linkedUser = users.find(u => u.linkedCustomerId === summary.id || u.phone === summary.phone);
            if (!linkedUser) {
                toast.error("This customer is not linked to any User account. Create a User Profile first.");
                return;
            }

            // Only process the single targeted currency
            const description = "Payout Request (" + itemsToSettle.length + " parcels)" + (excludeFees ? " - Gross Payout" : "");

            if (targetCurrency === 'USD' && Math.abs(netAmount) > 0.01) {
                await firebaseService.walletService.requestSettlement(
                    linkedUser.uid,
                    linkedUser.name,
                    Number(netAmount.toFixed(2)),
                    'USD',
                    'system',
                    '',
                    description,
                    itemsToSettle
                );
            } else if (targetCurrency === 'KHR' && Math.abs(netAmount) > 0.1) {
                await firebaseService.walletService.requestSettlement(
                    linkedUser.uid,
                    linkedUser.name,
                    Number(netAmount.toFixed(0)),
                    'KHR',
                    'system',
                    '',
                    description,
                    itemsToSettle
                );
            }

            toast.success("Payout Request Sent!");
            setConfirmation(null);
            const updatedBookings = await firebaseService.getParcelBookings();
            setBookings(updatedBookings);

        } catch (e: any) {
            // console.error(e);
            toast.error("Failed to initiate payout: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const exportToExcel = () => {
        if (selectedCustomerDetails.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = ['Date', 'Booking Code', 'Tracking Code', 'Receiver Name', 'Receiver Phone', 'COD Amount', 'COD Currency', 'Delivery Fee', 'Fee Currency', 'Net Payout'];
        const rows = selectedCustomerDetails.map(d => [
            new Date(d.deliveryDate).toLocaleDateString(),
            (d.bookingId || '').slice(-6).toUpperCase(),
            d.trackingCode,
            d.receiverName,
            d.receiverPhone || '',
            d.cod,
            d.codCurrency,
            d.fee,
            d.feeCurrency,
            d.net !== null ? d.net : 'Split Currency'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const customerName = customerSummaries.find(s => s.id === selectedCustomerId)?.name || 'customer';
        link.href = url;
        link.download = `settlement_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Exported successfully!');
    };

    if (selectedCustomerId) {
        const summary = customerSummaries.find(s => s.id === selectedCustomerId);
        return (
            <div className="space-y-6">
                {/* Image Zoom Modal */}
                {zoomedImage && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={() => setZoomedImage(null)}>
                        <div className="relative max-w-3xl max-h-full">
                            <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-[90vh] rounded shadow-2xl" />
                            <button className="absolute top-2 right-2 bg-white rounded-full p-2 text-black font-bold" onClick={() => setZoomedImage(null)}>✕</button>
                        </div>
                    </div>
                )}

                {/* Confirmation Modal */}
                {confirmation && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900">Confirm Settlement Payout</h3>
                                <button onClick={() => setConfirmation(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="text-center">
                                    <div className="text-sm text-gray-500 uppercase font-bold tracking-wide mb-1">Total Payout Amount</div>
                                    <div className="text-4xl font-black text-indigo-600">
                                        {confirmation.targetCurrency === 'USD'
                                            ? ('$' + confirmation.netAmount.toFixed(2))
                                            : (confirmation.netAmount.toLocaleString() + ' ៛')}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-2">To: <span className="font-bold text-gray-900">{confirmation.summary.name}</span></div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="text-xs font-bold text-gray-500 uppercase mb-3 border-b border-gray-200 pb-2">Proposed Accounting Entries (GL Preview)</div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 text-xs">
                                                <th className="text-left pb-1">Account</th>
                                                <th className="text-right pb-1">Dr</th>
                                                <th className="text-right pb-1">Cr</th>
                                            </tr>
                                        </thead>
                                        <tbody className="font-mono text-gray-700">
                                            {(() => {
                                                // Rule 5: Wallet Liability (AP) - Customer Wallet
                                                const isUSD = confirmation.targetCurrency === 'USD';
                                                const rule5AccId = settings?.transactionRules?.['5'];
                                                let walletAccId = rule5AccId || (isUSD
                                                    ? (settings?.customerWalletAccountUSD || settings?.defaultCustomerWalletAccountId)
                                                    : (settings?.customerWalletAccountKHR || settings?.defaultCustomerWalletAccountId));
                                                const walletAcc = accounts.find(a => a.id === walletAccId);
                                                const walletLabel = walletAcc ? `${walletAcc.code} - ${walletAcc.name}` : '3200 - Accounts Payable (Customer Wallet)';

                                                // Bank Account: Use Customer Settlement Account from settings
                                                const bankAccId = isUSD
                                                    ? (settings?.defaultCustomerSettlementBankIdUSD || settings?.defaultCustomerSettlementBankId || '')
                                                    : (settings?.defaultCustomerSettlementBankIdKHR || settings?.defaultCustomerSettlementBankId || '');
                                                const bankAcc = accounts.find(a => a.id === bankAccId);
                                                const bankLabel = bankAcc ? `${bankAcc.code} - ${bankAcc.name}` : '(Not Configured - Set in Settings)';

                                                const amountDisplay = isUSD
                                                    ? confirmation.netAmount.toFixed(2)
                                                    : confirmation.netAmount.toLocaleString();

                                                return (
                                                    <>
                                                        <tr>
                                                            <td className="py-1">{walletLabel}</td>
                                                            <td className="text-right py-1">{amountDisplay}</td>
                                                            <td className="text-right py-1 text-gray-300">-</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-1">{bankLabel}</td>
                                                            <td className="text-right py-1 text-gray-300">-</td>
                                                            <td className="text-right py-1">{amountDisplay}</td>
                                                        </tr>
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                        <tfoot className="border-t border-gray-200 mt-2 text-xs text-gray-400 italic">
                                            <tr>
                                                <td colSpan={3} className="pt-2 text-center">
                                                    (Note: Final GL booking occurs explicitly upon payout approval)
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {excludeFees && (
                                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-center gap-2">
                                        <span className="font-bold">⚠ Note:</span> Fees are excluded/deferred from this payout (Gross Payment).
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <Button className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setConfirmation(null)}>Cancel</Button>
                                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg" onClick={executeSettle} isLoading={processing}>Confirm & Pay</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" onClick={() => setSelectedCustomerId(null)}>← Back</Button>
                            <h2 className="text-xl font-bold">Settlement Details: {summary?.name}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded border ${excludeFeesFromProfile
                                ? 'bg-green-50 border-green-200'
                                : excludeFees
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-gray-200'
                                }`} title={excludeFeesFromProfile ? "Set by admin in User Management. Cannot be enabled here." : "Can be enabled for this settlement session."}>
                                <input
                                    type="checkbox"
                                    id="excludeFees"
                                    checked={excludeFees}
                                    onChange={e => {
                                        // Only allow changes if NOT set from profile, OR allow unchecking
                                        if (!excludeFeesFromProfile || !e.target.checked) {
                                            setExcludeFees(e.target.checked);
                                        }
                                    }}
                                    disabled={excludeFeesFromProfile && excludeFees} // Disable if already ticked from profile
                                    className={`w-4 h-4 text-green-600 rounded ${excludeFeesFromProfile && excludeFees ? 'cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                />
                                <label htmlFor="excludeFees" className={`text-sm font-medium select-none ${excludeFeesFromProfile && excludeFees ? 'cursor-not-allowed text-green-700' : 'cursor-pointer text-gray-700'
                                    } ${excludeFees ? 'font-bold' : ''}`}>
                                    Exclude Fees (Pay Gross) {excludeFeesFromProfile && excludeFees ? '(Admin Set)' : ''}
                                </label>
                            </div>
                            {liveBalance && (
                                <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 flex items-center gap-2">
                                    <span className="text-indigo-800 font-bold text-sm">Verified Wallet Balance:</span>
                                    <span className="text-indigo-900 font-bold">${(liveBalance.usd || 0).toFixed(2)} / {(liveBalance.khr || 0).toLocaleString()} ៛</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-green-50 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-xs font-bold text-green-800 uppercase">Wait to Pay (USD)</div>
                                    <div className="text-3xl font-bold text-green-900 mt-1">
                                        ${(liveBalance ? ((liveBalance.usd || 0) + grossAdjustments.usd) : summary?.netUSD || 0).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-green-600 mt-1">Based on {liveBalance ? 'Verified Wallet Balance' : 'Pending Bookings'}</div>
                                </div>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                    onClick={() => summary && initiateSettle(summary, 'USD')}
                                    isLoading={processing}
                                    disabled={Math.abs((liveBalance ? ((liveBalance.usd || 0) + grossAdjustments.usd) : summary?.netUSD || 0)) < 0.01}
                                >
                                    Pay USD
                                </Button>
                            </div>
                        </Card>
                        <Card className="bg-blue-50 p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-xs font-bold text-blue-800 uppercase">Wait to Pay (KHR)</div>
                                    <div className="text-3xl font-bold text-blue-900 mt-1">
                                        {(liveBalance ? ((liveBalance.khr || 0) + grossAdjustments.khr) : summary?.netKHR || 0).toLocaleString()} ៛
                                    </div>
                                    <div className="text-[10px] text-blue-600 mt-1">Based on {liveBalance ? 'Verified Wallet Balance' : 'Pending Bookings'}</div>
                                </div>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    onClick={() => summary && initiateSettle(summary, 'KHR')}
                                    isLoading={processing}
                                    disabled={Math.abs((liveBalance ? ((liveBalance.khr || 0) + grossAdjustments.khr) : summary?.netKHR || 0)) < 1}
                                >
                                    Pay KHR
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>

                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Individual Parcel Items</h3>
                        <Button
                            variant="outline"
                            onClick={exportToExcel}
                            className="flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export to Excel
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Booking Code</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Tracking Code</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500">Receiver</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">COD Amount</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Delivery Fee</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500">Taxi Fee</th>
                                    <th className="px-4 py-3 text-right font-medium text-gray-500 font-bold">Net Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {selectedCustomerDetails.map((d, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-2">{new Date(d.deliveryDate).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{(d.bookingId || '').slice(-6).toUpperCase()}</td>
                                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{d.trackingCode}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                {d.image ? (
                                                    <img
                                                        src={d.image}
                                                        alt=""
                                                        className="w-10 h-10 rounded object-cover border border-gray-200 cursor-zoom-in hover:opacity-80 transition-opacity"
                                                        onClick={() => setZoomedImage(d.image || null)}
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Img</div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-gray-900">{d.receiverName}</div>
                                                    <div className="text-xs text-indigo-600 font-mono">{d.receiverPhone || ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right">{d.cod.toLocaleString()} {d.codCurrency}</td>
                                        <td className="px-4 py-2 text-right">{d.fee.toLocaleString()} {d.feeCurrency}</td>
                                        <td className="px-4 py-2 text-right">
                                            {d.taxiFee > 0 ? (
                                                <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-100">
                                                    {d.taxiFee.toLocaleString()} {d.taxiFeeCurrency}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-green-700">
                                            {d.net !== null && d.codCurrency === d.feeCurrency && (!d.taxiFee || d.taxiFeeCurrency === d.codCurrency) ? (
                                                d.net.toLocaleString() + " " + d.codCurrency
                                            ) : (
                                                <span className=" text-amber-600 italic">Mixed Currency</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Customer Settlement Report</h2>
                <div className="w-64">
                    <Input
                        placeholder="Search customer name or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Parcels</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (USD)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Owed (KHR)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading customer data...</td></tr>
                            ) : customerSummaries.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No customers with pending settlements found.</td></tr>
                            ) : (
                                customerSummaries.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{s.name}</div>
                                            <div className="text-sm text-gray-500">{s.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-700">
                                            {s.unsettledCount}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${s.netUSD > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                ${s.netUSD.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${s.netKHR > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                {s.netKHR.toLocaleString()} ៛
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="outline" onClick={() => setSelectedCustomerId(s.id)}>
                                                View & Settle
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
