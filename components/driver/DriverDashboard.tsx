
import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, UserProfile, ParcelItem, Account, Branch, AccountType, AccountSubType, WalletTransaction, SystemSettings, AppNotification, CurrencyConfig } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { ImageUpload } from '../ui/ImageUpload';
import { useLanguage } from '../../contexts/LanguageContext';
import { ChatModal } from '../ui/ChatModal';
import { SettlementReportModal } from '../ui/SettlementReportModal';
import { toast } from '../../src/shared/utils/toast';

// Imported Components
import { DriverJobCard } from './DriverJobCard';
import { DriverDeliveryCard } from './DriverDeliveryCard';
import { DriverPickupProcessor } from './DriverPickupProcessor';
import { ActionConfirmationModal, TransferModal } from './DriverActionModals';

interface Props {
    user: UserProfile;
}

export const DriverDashboard: React.FC<Props> = ({ user }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'MY_PICKUPS' | 'MY_PARCELS' | 'WAREHOUSE' | 'AVAILABLE' | 'SETTLEMENT'>('MY_PICKUPS');
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    // States
    const [isFleetDriver, setIsFleetDriver] = useState<boolean>(false);
    const [isDeactivated, setIsDeactivated] = useState<boolean>(false);

    // Processing Job (Digitization)
    const [processingJob, setProcessingJob] = useState<ParcelBooking | null>(null);

    // Modals
    const [actionModal, setActionModal] = useState<{ isOpen: boolean; bookingId: string; itemId: string; action: 'TRANSIT' | 'DELIVER' | 'RETURN' } | null>(null);
    const [transferModal, setTransferModal] = useState<{ isOpen: boolean; bookingId: string; itemId: string } | null>(null);
    const [confirmJob, setConfirmJob] = useState<ParcelBooking | null>(null);
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [activeChat, setActiveChat] = useState<{ itemId: string, itemName: string, customerName: string, bookingId?: string, customerUid?: string } | null>(null);
    const [viewHistoryTxn, setViewHistoryTxn] = useState<WalletTransaction | null>(null);

    // Settlement
    const [isSettling, setIsSettling] = useState(false);

    // Multi-Currency Inputs
    const [payAmountUSD, setPayAmountUSD] = useState<number | ''>('');
    const [payAmountKHR, setPayAmountKHR] = useState<number | ''>('');

    const [settleProof, setSettleProof] = useState('');
    const [companyBanks, setCompanyBanks] = useState<Account[]>([]);
    const [settings, setSettings] = useState<SystemSettings>({});
    const [settlementHistory, setSettlementHistory] = useState<WalletTransaction[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const loadJobs = async () => {
        setLoading(true);
        try {
            // Use getDriverJobs instead of getParcelBookings to satisfy security rules
            const [myJobs, allBranches, allEmployees, allAccounts, walletTxns, sysSettings, allCurrencies] = await Promise.all([
                firebaseService.getDriverJobs(user.uid),
                firebaseService.getBranches(),
                firebaseService.getEmployees(),
                firebaseService.getAccounts(),
                firebaseService.getWalletTransactions(user.uid),
                firebaseService.getSettings(),
                firebaseService.getCurrencies()
            ]);

            setSettings(sysSettings);
            setCurrencies(allCurrencies);

            const myEmployeeRecord = allEmployees.find(e => e.linkedUserId === user.uid && e.isDriver);

            if (myEmployeeRecord) {
                setIsFleetDriver(true);
                if (myEmployeeRecord.status === 'INACTIVE') {
                    setIsDeactivated(true);
                } else {
                    setBookings(myJobs); // Use filtered jobs
                    setBranches(allBranches);
                    setSettlementHistory(walletTxns.filter(t => t.type === 'SETTLEMENT').sort((a, b) => b.id.localeCompare(a.id)));

                    // Fetch Company Banks (Nostro) from COA
                    const banks = allAccounts.filter(a =>
                        a.type === AccountType.ASSET &&
                        (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) &&
                        !a.isHeader
                    );
                    setCompanyBanks(banks);
                }
            } else {
                setIsFleetDriver(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, [user]);

    // Derived Data
    const availablePickups = bookings.filter(b => !b.driverId && b.status === 'PENDING');
    const myPickups = bookings.filter(b => b.driverId === user.uid && b.status !== 'CANCELLED' && (b.items || []).some(i => i.status === 'PENDING'));
    const myActiveJobs = bookings.map(b => ({
        ...b,
        activeItems: (b.items || []).filter(i => i.driverId === user.uid && (i.status === 'PICKED_UP' || (i.status === 'IN_TRANSIT' && !i.targetBranchId)))
    })).filter(b => b.activeItems.length > 0);

    const pendingHubHandover = bookings.flatMap(b => (b.items || []).map(i => ({ ...i, bookingId: b.id, senderName: b.senderName })))
        .filter(i => i.driverId === user.uid && i.status === 'IN_TRANSIT' && i.targetBranchId);

    // Flatten items with sender context for settlement calculation
    const unsettledItems = bookings.flatMap(b => (b.items || []).map(i => ({ ...i, bookingId: b.id, sender: b.senderName }))).filter(i =>
        i.driverId === user.uid && i.status === 'DELIVERED' && (!i.settlementStatus || i.settlementStatus === 'UNSETTLED')
    );

    const cashInHand = useMemo(() => {
        let usd = 0, khr = 0;
        unsettledItems.forEach(i => {
            const amt = Number(i.productPrice) || 0;
            if (i.codCurrency === 'KHR') khr += amt; else usd += amt;
        });
        return { usd, khr };
    }, [unsettledItems]);

    // Determine Default Settlement Banks
    const defaultBankUSD = companyBanks.find(b => b.id === (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId));
    const defaultBankKHR = companyBanks.find(b => b.id === (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId));

    // --- SETTLEMENT CALCULATION LOGIC ---
    const settlementCalc = useMemo(() => {
        // Find dynamic rate from collection, fallback to 4100
        const khrCurrency = currencies.find(c => c.code === 'KHR');
        const exchangeRate = khrCurrency ? khrCurrency.exchangeRate : 4100;

        const debtUSD = cashInHand.usd;
        const debtKHR = cashInHand.khr;

        // Total Debt in Base USD for comparison
        const totalDebtBase = debtUSD + (debtKHR / exchangeRate);

        // User Inputs
        const inputUSD = Number(payAmountUSD) || 0;
        const inputKHR = Number(payAmountKHR) || 0;

        // Total Provided in Base USD
        const totalProvidedBase = inputUSD + (inputKHR / exchangeRate);

        const difference = totalProvidedBase - totalDebtBase;
        const isBalanced = Math.abs(difference) < 0.05; // 5 cent buffer for rounding

        return {
            totalDebtBase,
            totalProvidedBase,
            difference,
            isBalanced,
            inputUSD,
            inputKHR,
            exchangeRate
        };
    }, [cashInHand, payAmountUSD, payAmountKHR, currencies]);

    // Handlers
    const handleParcelAction = async (bookingId: string, itemId: string, action: 'TRANSIT' | 'DELIVER' | 'RETURN' | 'TRANSFER', branchId?: string, proof?: string, updatedCOD?: { amount: number, currency: 'USD' | 'KHR' }) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const updatedItems = (booking.items || []).map(item => {
            if (item.id === itemId) {
                if (action === 'TRANSIT') return { ...item, status: 'IN_TRANSIT' as const };
                if (action === 'DELIVER') {
                    const newItem = { ...item, status: 'DELIVERED' as const, settlementStatus: 'UNSETTLED' as const, proofOfDelivery: proof };
                    if (updatedCOD) {
                        newItem.productPrice = updatedCOD.amount;
                        newItem.codCurrency = updatedCOD.currency;
                    }
                    return newItem;
                }
                if (action === 'TRANSFER') return { ...item, status: 'IN_TRANSIT' as const, targetBranchId: branchId, driverId: user.uid, driverName: user.name };
                if (action === 'RETURN') return { ...item, status: 'RETURN_TO_SENDER' as const };
            }
            return item;
        });

        const allDone = updatedItems.every(i => i.status === 'DELIVERED' || i.status === 'RETURN_TO_SENDER');
        const bookingStatus = allDone ? 'COMPLETED' : booking.status;

        await firebaseService.saveParcelBooking({ ...booking, items: updatedItems, status: bookingStatus });

        // NOTIFICATION TRIGGER: If action is DELIVER, notify Customer
        if (action === 'DELIVER' && booking.senderId) {
            const custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
            if (custUid) {
                const notif: AppNotification = {
                    id: `notif-dlv-${Date.now()}`,
                    targetAudience: custUid,
                    title: 'Parcel Delivered',
                    message: `Your parcel to ${booking.items.find(i => i.id === itemId)?.receiverName} has been delivered.`,
                    type: 'SUCCESS',
                    read: false,
                    createdAt: Date.now(),
                    metadata: { type: 'BOOKING', bookingId: booking.id }
                };
                await firebaseService.sendNotification(notif);
            }
        }

        loadJobs();
    };

    const handleCodUpdate = async (bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        const updatedItems = (booking.items || []).map(i => i.id === itemId ? { ...i, productPrice: amount, codCurrency: currency } : i);
        await firebaseService.saveParcelBooking({ ...booking, items: updatedItems });
        loadJobs();
    };

    const handleSettlement = async () => {
        if (unsettledItems.length === 0) return;

        // Full settlement is generally required, unless exact 0 balance check is passed
        if (!settlementCalc.isBalanced) {
            toast.warning("Total provided amount must match the total COD collected.");
            return;
        }

        // Ensure Banks are Configured
        if (settlementCalc.inputUSD > 0 && !defaultBankUSD) {
            return toast.error("System Error: No default USD settlement bank configured.");
        }
        if (settlementCalc.inputKHR > 0 && !defaultBankKHR) {
            return toast.error("System Error: No default KHR settlement bank configured.");
        }

        if (!settleProof && (settlementCalc.inputUSD > 0 || settlementCalc.inputKHR > 0)) {
            toast.warning("Please upload proof of transfer.");
            return;
        }

        setIsSaving(true);
        try {
            // Prepare shared items list
            const itemsToSettle = unsettledItems.map(i => ({ bookingId: i.bookingId, itemId: i.id }));

            const requestsToMake = [];

            // 1. Make USD Request if applicable
            if (settlementCalc.inputUSD > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid,
                        user.name,
                        settlementCalc.inputUSD,
                        'USD',
                        defaultBankUSD!.id,
                        settleProof || '',
                        `Partial Settlement (USD Portion)`,
                        itemsToSettle // Attach items to both for record, backend handles idempotency
                    )
                );
            }

            // 2. Make KHR Request if applicable
            if (settlementCalc.inputKHR > 0) {
                requestsToMake.push(
                    firebaseService.requestSettlement(
                        user.uid,
                        user.name,
                        settlementCalc.inputKHR,
                        'KHR',
                        defaultBankKHR!.id,
                        settleProof || '',
                        `Partial Settlement (KHR Portion)`,
                        itemsToSettle
                    )
                );
            }

            if (requestsToMake.length > 0) {
                await Promise.all(requestsToMake);
                toast.success("Settlement requested successfully. " + (requestsToMake.length > 1 ? "(Split into 2 requests)" : ""));
                setIsSettling(false);
                setSettleProof('');
                setPayAmountUSD('');
                setPayAmountKHR('');
                loadJobs(); // Refresh history
            } else {
                // Edge case: 0 amount settlement (Prepaid items only)
                await firebaseService.requestSettlement(
                    user.uid, user.name, 0, 'USD', defaultBankUSD?.id || 'system', '', 'Zero-Value Settlement', itemsToSettle
                );
                toast.success("Items cleared.");
                setIsSettling(false);
                loadJobs();
            }

        } catch (e) { toast.error("Failed to submit settlement request."); } finally { setIsSaving(false); }
    };

    const handleAcceptJob = async () => {
        if (!confirmJob) return;
        try {
            // Explicitly set fields to ensure clean update
            const acceptedJob: ParcelBooking = {
                ...confirmJob,
                driverId: user.uid,
                driverName: user.name,
                status: 'CONFIRMED',
                statusId: 'ps-pickup' // Set workflow status to pickup
            };
            await firebaseService.saveParcelBooking(acceptedJob);
            await loadJobs();
            setConfirmJob(null);
            setActiveTab('MY_PICKUPS');
            toast.success("Job accepted!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to accept job. Please try again.");
        }
    };

    const openChat = async (bookingId: string, item: ParcelItem) => {
        let custUid = undefined;
        const booking = bookings.find(b => b.id === bookingId);
        if (booking?.senderId) {
            custUid = await firebaseService.getUserUidByCustomerId(booking.senderId);
        }
        setActiveChat({ itemId: item.id, bookingId, itemName: item.receiverName, customerName: booking?.senderName || 'Customer', customerUid: custUid });
    };

    const getStatusLabel = (status: string) => {
        // @ts-ignore
        const label = t(`status_${status}`);
        return label === `status_${status}` ? status : label;
    };

    const renderStatusBadge = (status: string) => {
        const label = getStatusLabel(status);
        switch (status) {
            case 'PENDING': return <span className="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            case 'APPROVED': return <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            case 'REJECTED': return <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
            default: return <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">{label}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
                <p>Loading Dashboard...</p>
            </div>
        );
    }

    if (!isFleetDriver) {
        return (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-200 m-4">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Access Restricted</h3>
                <p className="text-gray-500 mt-2 px-6 text-sm">
                    Your account is created, but it is not linked to an active <strong>Driver Profile</strong> in the system.
                </p>
                <p className="text-gray-400 mt-4 text-xs">Please contact the administrator to add you to the Fleet.</p>
            </div>
        );
    }

    if (isDeactivated) {
        return (
            <div className="text-center py-10 bg-red-50 text-red-800 rounded-xl m-4 border border-red-200">
                <h3 className="font-bold text-lg">Account Deactivated</h3>
                <p className="text-sm mt-2">Please contact support.</p>
            </div>
        );
    }

    if (processingJob) {
        return (
            <DriverPickupProcessor
                job={processingJob}
                user={user}
                onSave={async (updatedJob) => {
                    // Background save, update local state only
                    await firebaseService.saveParcelBooking(updatedJob);
                    setProcessingJob(updatedJob);
                }}
                onFinish={async () => {
                    // Done with batch, close and reload dashboard
                    setProcessingJob(null);
                    await loadJobs();
                }}
                onCancel={() => {
                    // Cancel without reload if nothing changed, or reload if safer
                    setProcessingJob(null);
                    loadJobs();
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                    { id: 'MY_PICKUPS', label: `Pickups (${myPickups.length})` },
                    { id: 'MY_PARCELS', label: `Deliveries (${myActiveJobs.reduce((s, j) => s + j.activeItems.length, 0)})` },
                    { id: 'WAREHOUSE', label: `Hub (${pendingHubHandover.length})` },
                    { id: 'AVAILABLE', label: `New (${availablePickups.length})` },
                    { id: 'SETTLEMENT', label: 'Wallet' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-red-50 text-red-700' : 'text-gray-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'AVAILABLE' && (
                <div className="space-y-4 animate-fade-in-up">
                    {availablePickups.map(job => (
                        <DriverJobCard key={job.id} job={job} type="AVAILABLE" onAction={setConfirmJob} />
                    ))}
                    {availablePickups.length === 0 && <p className="text-center text-gray-400 py-10">No new jobs available.</p>}
                </div>
            )}

            {activeTab === 'MY_PICKUPS' && (
                <div className="space-y-4 animate-fade-in-up">
                    {myPickups.map(job => (
                        <DriverJobCard
                            key={job.id}
                            job={job}
                            type="PICKUP"
                            onAction={setProcessingJob}
                            onMapClick={(addr) => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank')}
                            onChatClick={(j) => openChat(j.id, (j.items || [])[0])}
                        />
                    ))}
                    {myPickups.length === 0 && <p className="text-center text-gray-400 py-10">No pending pickups.</p>}
                </div>
            )}

            {activeTab === 'MY_PARCELS' && (
                <div className="space-y-4 animate-fade-in-up">
                    {myActiveJobs.map(job => (
                        <DriverDeliveryCard
                            key={job.id}
                            job={job}
                            onZoomImage={setZoomImage}
                            onUpdateCod={handleCodUpdate}
                            onChatClick={(bid, item) => openChat(bid, item)}
                            hasBranches={branches.length > 0}
                            onAction={(bid, itemId, action) => {
                                if (action === 'TRANSFER') setTransferModal({ isOpen: true, bookingId: bid, itemId });
                                else setActionModal({ isOpen: true, bookingId: bid, itemId, action });
                            }}
                        />
                    ))}
                    {myActiveJobs.length === 0 && <p className="text-center text-gray-400 py-10">No active parcels to deliver.</p>}
                </div>
            )}

            {activeTab === 'WAREHOUSE' && (
                <div className="space-y-4 animate-fade-in-up">
                    {pendingHubHandover.length > 0 ? (
                        pendingHubHandover.map((item, idx) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm opacity-80 flex items-center gap-3">
                                <img src={item.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" alt="Parcel" />
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-sm text-gray-800">{item.receiverName}</h4>
                                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold uppercase animate-pulse">Confirming...</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">To: {branches.find(b => b.id === item.targetBranchId)?.name || 'Hub'}</p>
                                </div>
                            </div>
                        ))
                    ) : <div className="text-center py-10 text-gray-500">No items waiting for hub confirmation.</div>}
                </div>
            )}

            {/* --- SETTLEMENT --- */}
            {activeTab === 'SETTLEMENT' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-800 rounded-2xl p-6 text-white shadow-lg">
                        <h3 className="text-sm font-medium text-indigo-200 mb-2">{t('floating_cash')}</h3>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-bold">${cashInHand.usd.toFixed(2)}</span>
                            {cashInHand.khr > 0 && <span className="text-xl text-indigo-300">+ {cashInHand.khr.toLocaleString()} ៛</span>}
                        </div>
                        <button onClick={() => setIsSettling(true)} className="w-full mt-6 bg-white text-indigo-900 font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-50">{t('request_settlement')}</button>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-gray-800">{t('settlement_history')}</h4>
                        {settlementHistory.length > 0 ? (
                            settlementHistory.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setViewHistoryTxn(t)}
                                    className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-500">{t.date}</span>
                                        {renderStatusBadge(t.status)}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-900">{t.description || 'Settlement'}</span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {t.amount.toLocaleString()} {t.currency}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-indigo-500 mt-1">Tap to view details</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 text-xs py-4">No settlement history.</p>
                        )}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}

            {viewHistoryTxn && (
                <SettlementReportModal
                    transaction={viewHistoryTxn}
                    onClose={() => setViewHistoryTxn(null)}
                    accounts={companyBanks}
                />
            )}

            <ActionConfirmationModal
                isOpen={!!actionModal}
                action={actionModal?.action || 'DELIVER'}
                onCancel={() => setActionModal(null)}
                onConfirm={(proof, cod) => {
                    if (actionModal) handleParcelAction(actionModal.bookingId, actionModal.itemId, actionModal.action, undefined, proof, cod);
                    setActionModal(null);
                }}
            />

            <TransferModal
                isOpen={!!transferModal}
                branches={branches}
                onCancel={() => setTransferModal(null)}
                onConfirm={(branchId) => {
                    if (transferModal) handleParcelAction(transferModal.bookingId, transferModal.itemId, 'TRANSFER', branchId);
                    setTransferModal(null);
                }}
            />

            {confirmJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-2">{t('accept_job')}?</h3>
                        <p className="text-gray-600 mb-4 text-sm">{confirmJob.pickupAddress}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setConfirmJob(null)} className="flex-1">{t('cancel')}</Button>
                            <Button onClick={handleAcceptJob} className="flex-1">{t('confirm')}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlement Request Form */}
            {isSettling && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[95vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{t('request_settlement')}</h3>

                        <div className="space-y-4">

                            {/* Summary of Debt */}
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                <p className="text-xs font-bold text-red-800 uppercase mb-2">Total Outstanding Debt</p>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm text-red-700">USD: <span className="font-bold">${cashInHand.usd.toLocaleString()}</span></p>
                                        <p className="text-sm text-red-700">KHR: <span className="font-bold">{cashInHand.khr.toLocaleString()} ៛</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500">Total in Base (USD)</p>
                                        <p className="text-lg font-bold text-gray-900">${settlementCalc.totalDebtBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Multi-Currency Inputs */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs font-bold text-gray-500 uppercase">I am paying:</p>
                                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        Rate: 1 USD = {settlementCalc.exchangeRate.toLocaleString()} KHR
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Amount in USD</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-900"
                                            placeholder="0.00"
                                            value={payAmountUSD}
                                            onChange={e => setPayAmountUSD(parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Amount in KHR</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-900"
                                            placeholder="0"
                                            value={payAmountKHR}
                                            onChange={e => setPayAmountKHR(parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Balance Check */}
                            <div className={`p-3 rounded-lg border flex justify-between items-center ${settlementCalc.isBalanced ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div>
                                    <p className="text-xs text-gray-500">Total Value Provided (Est.)</p>
                                    <p className={`font-bold ${settlementCalc.isBalanced ? 'text-green-700' : 'text-gray-900'}`}>
                                        ${settlementCalc.totalProvidedBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Difference</p>
                                    <p className={`font-bold ${Math.abs(settlementCalc.difference) < 0.05 ? 'text-green-600' : 'text-red-600'}`}>
                                        {settlementCalc.difference > 0 ? '+' : ''}{settlementCalc.difference.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Banking Info Display */}
                            {(settlementCalc.inputUSD > 0 || settlementCalc.inputKHR > 0) && (
                                <div className="mt-2 space-y-2">
                                    {settlementCalc.inputUSD > 0 && defaultBankUSD && (
                                        <div className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                                            {defaultBankUSD.qrCode && <img src={defaultBankUSD.qrCode} className="w-10 h-10 object-contain bg-white rounded" alt="QR" />}
                                            <div className="flex-1">
                                                <p className="text-xs text-blue-800 font-bold">Transfer USD to: {defaultBankUSD.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">{defaultBankUSD.code}</p>
                                            </div>
                                        </div>
                                    )}
                                    {settlementCalc.inputKHR > 0 && defaultBankKHR && (
                                        <div className="flex items-center gap-3 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                                            {defaultBankKHR.qrCode && <img src={defaultBankKHR.qrCode} className="w-10 h-10 object-contain bg-white rounded" alt="QR" />}
                                            <div className="flex-1">
                                                <p className="text-xs text-orange-800 font-bold">Transfer KHR to: {defaultBankKHR.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">{defaultBankKHR.code}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(settlementCalc.inputUSD > 0 || settlementCalc.inputKHR > 0) && (
                                <ImageUpload label={t('proof_of_transfer')} value={settleProof} onChange={setSettleProof} />
                            )}

                            <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                                <Button variant="outline" onClick={() => setIsSettling(false)} className="flex-1">{t('cancel')}</Button>
                                <Button
                                    onClick={handleSettlement}
                                    isLoading={isSaving}
                                    disabled={!settlementCalc.isBalanced || (settlementCalc.totalProvidedBase > 0 && !settleProof)}
                                    className={`flex-1 ${settlementCalc.isBalanced ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                >
                                    {t('submit_request')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeChat && (
                <ChatModal
                    itemId={activeChat.itemId}
                    bookingId={activeChat.bookingId}
                    itemName={activeChat.itemName}
                    currentUser={user}
                    recipientName={activeChat.customerName}
                    recipientId={activeChat.customerUid}
                    onClose={() => setActiveChat(null)}
                />
            )}

            {zoomImage && (
                <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full rounded-lg" />
                </div>
            )}
        </div>
    );
};
