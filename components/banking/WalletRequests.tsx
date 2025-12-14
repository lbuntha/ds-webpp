
import React, { useState, useEffect } from 'react';
import { WalletTransaction, Account, JournalEntry, Invoice, ParcelBooking, ParcelServiceType, DriverCommissionRule, Employee, AccountType, AccountSubType, AppNotification, CurrencyConfig, TaxRate, Branch } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SettlementReportModal } from '../ui/SettlementReportModal';

export const WalletRequests: React.FC = () => {
  const [requests, setRequests] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [viewTransaction, setViewTransaction] = useState<WalletTransaction | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'APPROVE' | 'REJECT', txn: WalletTransaction } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Data for JE creation context
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bookings, setBookings] = useState<ParcelBooking[]>([]);
  const [services, setServices] = useState<ParcelServiceType[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Commission Data
  const [commissionRules, setCommissionRules] = useState<DriverCommissionRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const loadRequests = async () => {
      setLoading(true);
      try {
          const [data, accData, bookingsData, servicesData, settingsData, rulesData, empData, currencyData, taxData, branchData] = await Promise.all([
              firebaseService.getPendingWalletTransactions(),
              firebaseService.getAccounts(),
              firebaseService.getParcelBookings(),
              firebaseService.getParcelServices(),
              firebaseService.getSettings(),
              firebaseService.logisticsService.getDriverCommissionRules(),
              firebaseService.getEmployees(),
              firebaseService.getCurrencies(),
              firebaseService.getTaxRates(),
              firebaseService.getBranches()
          ]);
          setRequests(data);
          setAccounts(accData);
          setBookings(bookingsData);
          setServices(servicesData);
          setSettings(settingsData);
          setCommissionRules(rulesData);
          setEmployees(empData);
          setCurrencies(currencyData);
          setTaxRates(taxData);
          setBranches(branchData);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadRequests();
  }, []);

  const initiateApprove = (txn: WalletTransaction) => {
    // Show preview for Settlements, Withdrawals, AND Deposits to verify accounting
    setViewTransaction(txn);
  };

  const confirmApprovalFromModal = () => {
      if (viewTransaction) {
          setConfirmAction({ type: 'APPROVE', txn: viewTransaction });
          setViewTransaction(null);
      }
  };

  const initiateReject = (txn: WalletTransaction) => {
      setConfirmAction({ type: 'REJECT', txn });
      setRejectReason(''); 
  };

  const executeApprove = async () => {
    if (!confirmAction || confirmAction.type !== 'APPROVE') return;
    const { txn } = confirmAction;

    setProcessingId(txn.id);
    try {
        const currentUser = await firebaseService.getCurrentUser();
        
        const jeId = `je-wtxn-${Date.now()}`;
        
        // --- 1. GET DYNAMIC EXCHANGE RATE ---
        const currencyCode = (txn.currency || 'USD').toUpperCase();
        const isUSD = currencyCode === 'USD';
        
        let rate = 1;
        if (!isUSD) {
            const currencyConfig = currencies.find(c => c.code === currencyCode);
            // Robust check for rate
            if (currencyConfig && currencyConfig.exchangeRate > 0) {
                rate = currencyConfig.exchangeRate;
            } else {
                rate = 4100; // Safe fallback for KHR
            }
        }

        const safeAmount = Number(txn.amount);
        if (isNaN(safeAmount) || safeAmount <= 0) {
             throw new Error(`Invalid transaction amount: ${txn.amount}`);
        }

        const branchId = branches.length > 0 ? branches[0].id : 'b1'; 
        
        // --- 2. DETERMINE ACCOUNTS (PRIORITIZE MAPPED RULES) ---
        
        // Rule 4: Settle to Company
        const rule4AccId = settings.transactionRules ? settings.transactionRules['4'] : null;
        
        let settlementBankId = txn.bankAccountId;
        
        // If txn bank is generic 'system', try to use rule map or fallback settings
        if (!settlementBankId || settlementBankId === 'system' || settlementBankId === 'system-payout') {
             if (rule4AccId) {
                 settlementBankId = rule4AccId;
             } else {
                 settlementBankId = isUSD 
                    ? (settings.defaultDriverSettlementBankIdUSD || settings.defaultDriverSettlementBankId)
                    : (settings.defaultDriverSettlementBankIdKHR || settings.defaultDriverSettlementBankId);
             }
        }

        if (!settlementBankId) {
            throw new Error(`Master Settlement Account for ${txn.currency} is not configured (Rule 4 or Settings).`);
        }
        
        // Verify bank account exists
        const bankAcc = accounts.find(a => a.id === settlementBankId);
        if (!bankAcc) throw new Error(`Bank Account ID ${settlementBankId} not found in Chart of Accounts.`);

        // Determine Wallet Liability Account based on currency settings
        // Rule 5: Settle to Customer (Wallet Liability)
        const rule5AccId = settings.transactionRules ? settings.transactionRules['5'] : null;

        let defaultDriverAccId = isUSD 
            ? (settings.driverWalletAccountUSD || settings.defaultDriverWalletAccountId)
            : (settings.driverWalletAccountKHR || settings.defaultDriverWalletAccountId);

        let defaultCustAccId = rule5AccId 
            ? rule5AccId 
            : (isUSD ? (settings.customerWalletAccountUSD || settings.defaultCustomerWalletAccountId) : (settings.customerWalletAccountKHR || settings.defaultCustomerWalletAccountId));

        // Fallback to User Profile override if exists (Legacy support)
        const userProfile = await firebaseService.getDocument('users', txn.userId) as any;
        if (userProfile && userProfile.walletAccountId) {
            if (userProfile.role === 'driver') defaultDriverAccId = userProfile.walletAccountId;
            if (userProfile.role === 'customer') defaultCustAccId = userProfile.walletAccountId;
        }

        // Final Fallback to hardcoded codes if completely missing
        if (!defaultCustAccId) defaultCustAccId = accounts.find(a => a.code === (isUSD ? '3200002' : '3200001'))?.id;
        if (!defaultDriverAccId) defaultDriverAccId = accounts.find(a => a.code === (isUSD ? '3210102' : '3210101'))?.id;
        
        // Rule 13: VAT Output
        const rule13AccId = settings.transactionRules ? settings.transactionRules['13'] : null;
        const defaultTaxAccId = rule13AccId || accounts.find(a => a.code === (isUSD ? '3333002' : '3333001'))?.id;

        // Rule 10: Commission Expense
        const rule10AccId = settings.transactionRules ? settings.transactionRules['10'] : null;

        let jeLines: any[] = [];
        
        // Calculate Base Amount safely
        const baseAmountRaw = safeAmount / rate;
        const baseAmount = Number(baseAmountRaw.toFixed(2)); // Round to 2 decimals

        if (isNaN(baseAmount)) {
             throw new Error("Calculated base amount is NaN. Check exchange rate.");
        }

        // --- 3. BUILD ACCOUNTING ENTRIES ---
        
        if (txn.type === 'WITHDRAWAL') {
            if (!defaultCustAccId) throw new Error("Customer Wallet Liability account is not configured.");

            jeLines.push({ 
                accountId: defaultCustAccId, 
                debit: baseAmount, 
                credit: 0,
                originalCurrency: txn.currency,
                originalExchangeRate: rate,
                originalDebit: safeAmount,
                originalCredit: 0,
                description: `Payout to ${txn.userName}`
            });

            jeLines.push({
                accountId: settlementBankId,
                debit: 0,
                credit: baseAmount,
                originalCurrency: txn.currency,
                originalExchangeRate: rate,
                originalDebit: 0,
                originalCredit: safeAmount,
                description: `Withdrawal via ${txn.currency}`
            });

        } 
        else if (txn.type === 'SETTLEMENT') {
             if (!defaultCustAccId) throw new Error("Customer Wallet Liability account is missing.");
             
             let totalRevenueUSD = 0;
             let totalTaxUSD = 0;
             let totalCommissionUSD = 0;
             
             const revenueByAccount: Record<string, number> = {};
             const taxByAccount: Record<string, number> = {};
             
             const driverEmp = employees.find(e => e.linkedUserId === txn.userId);
             const driverZone = driverEmp?.zone;
             const defaultRule = commissionRules.find(r => r.isDefault);
             const rule = commissionRules.find(r => r.zoneName === driverZone) || defaultRule || { type: 'PERCENTAGE', value: 70 };

             if (txn.relatedItems && txn.relatedItems.length > 0) {
                 txn.relatedItems.forEach(rel => {
                     const booking = bookings.find(b => b.id === rel.bookingId);
                     if (booking) {
                         // SAFEGUARD: Check booking.items
                         const totalItems = (booking.items && booking.items.length > 0) ? booking.items.length : 1;
                         const bookingFee = booking.totalDeliveryFee || 0;
                         const bookingTax = booking.taxAmount || 0;
                         const bookingRevenue = bookingFee - bookingTax;
                         
                         let bookingComm = 0;
                         if (rule.type === 'FIXED_AMOUNT') bookingComm = rule.value; 
                         else bookingComm = bookingFee * (rule.value / 100);
                         totalCommissionUSD += (bookingComm / totalItems);

                         const service = services.find(s => s.id === booking.serviceTypeId);
                         // Revenue Logic: Keep in base USD unless specific KHR revenue account exists (rare)
                         // Rule 9 (Service Fee) -> Mapped per service usually
                         const revAccId = service?.revenueAccountUSD || service?.revenueAccountId;
                         
                         if (revAccId) {
                             const itemRev = bookingRevenue / totalItems;
                             revenueByAccount[revAccId] = (revenueByAccount[revAccId] || 0) + itemRev;
                             totalRevenueUSD += itemRev;
                         }

                         // Tax Logic
                         if (bookingTax > 0) {
                             const taxAccId = service?.taxAccountUSD || defaultTaxAccId;
                             if (taxAccId) {
                                 const itemTax = bookingTax / totalItems;
                                 taxByAccount[taxAccId] = (taxByAccount[taxAccId] || 0) + itemTax;
                                 totalTaxUSD += itemTax;
                             }
                         }
                     }
                 });
             }

             const cashInBase = baseAmount;

             // 1. Debit Cash (Asset)
             jeLines.push({ 
                 accountId: settlementBankId, 
                 debit: cashInBase, 
                 credit: 0, 
                 originalCurrency: txn.currency,
                 originalExchangeRate: rate,
                 originalDebit: safeAmount,
                 originalCredit: 0,
                 description: `Settlement from ${txn.userName}`
             });

             // 2. Credit Revenue (Income)
             Object.entries(revenueByAccount).forEach(([accId, amountUSD]) => {
                 if (amountUSD > 0) {
                     jeLines.push({
                         accountId: accId,
                         debit: 0,
                         credit: Number(amountUSD.toFixed(2)),
                         originalCurrency: 'USD',
                         originalExchangeRate: 1,
                         originalDebit: 0,
                         originalCredit: Number(amountUSD.toFixed(2)),
                         description: 'Delivery Income'
                     });
                 }
             });

             // 3. Credit Tax (Liability)
             Object.entries(taxByAccount).forEach(([accId, amountUSD]) => {
                 if (amountUSD > 0) {
                     jeLines.push({
                         accountId: accId,
                         debit: 0,
                         credit: Number(amountUSD.toFixed(2)),
                         originalCurrency: 'USD',
                         originalExchangeRate: 1,
                         originalDebit: 0,
                         originalCredit: Number(amountUSD.toFixed(2)),
                         description: 'Tax Payable'
                     });
                 }
             });

             // 4. Credit Customer Wallet (Liability)
             // Amount = Cash Collected - (Revenue + Tax)
             const netCustomerLiabilityBase = Number((cashInBase - totalRevenueUSD - totalTaxUSD).toFixed(2));

             if (netCustomerLiabilityBase > 0) {
                 let creditAmountNative = netCustomerLiabilityBase;
                 let creditCurrency = 'USD';
                 let creditRate = 1;

                 // If settling in KHR, try to book liability in KHR account if possible
                 if (isUSD === false && settings.customerWalletAccountKHR) {
                     creditCurrency = 'KHR';
                     creditRate = rate;
                     creditAmountNative = (txn.amount - ((totalRevenueUSD + totalTaxUSD) * rate)); // Approx
                 } else {
                     creditAmountNative = netCustomerLiabilityBase;
                 }

                 jeLines.push({ 
                     accountId: defaultCustAccId, 
                     debit: 0, 
                     credit: netCustomerLiabilityBase,
                     originalCurrency: creditCurrency,
                     originalExchangeRate: creditRate,
                     originalDebit: 0,
                     originalCredit: Number(creditAmountNative.toFixed(2)),
                     description: 'Net COD Payable'
                 });

             } else if (netCustomerLiabilityBase < 0) {
                 // Fee exceeded COD collected
                 jeLines.push({ 
                     accountId: defaultCustAccId, 
                     debit: Math.abs(netCustomerLiabilityBase), 
                     credit: 0,
                     originalCurrency: 'USD',
                     originalExchangeRate: 1,
                     originalDebit: Math.abs(netCustomerLiabilityBase),
                     originalCredit: 0,
                     description: 'Fee Charge (Exceeds COD)'
                 });
             }

             // 5. Driver Commission (Expense & Liability)
             if (totalCommissionUSD > 0 && defaultDriverAccId) {
                 const commBase = Number(totalCommissionUSD.toFixed(2));
                 
                 // Determine correct Expense Account from rule mapping OR settings
                 let expAccId = rule10AccId;
                 
                 if (!expAccId) {
                     // Fallback to currency specific settings
                     expAccId = isUSD ? settings.driverCommissionExpenseAccountUSD : settings.driverCommissionExpenseAccountKHR;
                 }
                 
                 // Fallback to finding by code if settings missing
                 let expAcc = null;
                 if (expAccId) {
                     expAcc = accounts.find(a => a.id === expAccId);
                 } else {
                     // Try to find by standard code
                     const targetCode = isUSD ? '6501002' : '6501001';
                     expAcc = accounts.find(a => a.code === targetCode || a.name.includes('Commission'));
                 }
                 
                 if (expAcc) {
                     // If using a KHR expense account, convert the commission amount
                     const isExpKHR = expAcc.currency === 'KHR';
                     const expAmountNative = Number((isExpKHR ? (commBase * rate) : commBase).toFixed(2));
                     const expCurrency = isExpKHR ? 'KHR' : 'USD';
                     const expRate = isExpKHR ? rate : 1;

                     jeLines.push({
                         accountId: expAcc.id,
                         debit: commBase, // Base Amount
                         credit: 0,
                         originalCurrency: expCurrency,
                         originalExchangeRate: expRate,
                         originalDebit: expAmountNative,
                         originalCredit: 0,
                         description: `Driver Fee`
                     });
                     
                     jeLines.push({
                         accountId: defaultDriverAccId,
                         debit: 0,
                         credit: commBase,
                         originalCurrency: 'USD', 
                         originalExchangeRate: 1,
                         originalDebit: 0,
                         originalCredit: commBase,
                         description: `Commission Payable`
                     });
                 }
             }
        }
        else if (txn.type === 'DEPOSIT') {
             if (!defaultCustAccId) throw new Error("Customer Wallet Account is not configured in Settings.");
             
             jeLines.push({ 
                 accountId: settlementBankId, 
                 debit: baseAmount, 
                 credit: 0, 
                 originalCurrency: txn.currency,
                 originalExchangeRate: rate,
                 originalDebit: safeAmount,
                 originalCredit: 0,
                 description: 'Deposit Received' 
             });
             
             jeLines.push({ 
                 accountId: defaultCustAccId, 
                 debit: 0, 
                 credit: baseAmount, 
                 originalCurrency: txn.currency,
                 originalExchangeRate: rate,
                 originalDebit: 0,
                 originalCredit: safeAmount,
                 description: 'Wallet Credit' 
             });
        }

        // Final Line Sanitization
        const finalJeLines = jeLines.map(l => ({
            ...l,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            originalDebit: Number(l.originalDebit) || 0,
            originalCredit: Number(l.originalCredit) || 0
        })).filter(l => l.debit > 0.001 || l.credit > 0.001);

        if (finalJeLines.length === 0) {
            throw new Error(`Accounting Logic Error: Transaction amount is ${safeAmount} but Journal Entry lines are empty/zero.`);
        }

        const entry: JournalEntry = {
            id: jeId,
            date: new Date().toISOString().split('T')[0],
            description: `${txn.type}: ${txn.userName}`,
            reference: `WTX-${(txn.id || '').slice(-6)}`,
            branchId,
            currency: txn.currency,
            exchangeRate: rate,
            originalTotal: safeAmount,
            createdAt: Date.now(),
            lines: finalJeLines
        };
        await firebaseService.addTransaction(entry);

        const linkedJeId = finalJeLines.length > 0 ? jeId : undefined;
        await firebaseService.approveWalletTransaction(txn.id, currentUser?.uid || 'system', linkedJeId);

        if (txn.relatedItems && txn.relatedItems.length > 0) {
            const parcelItems = txn.relatedItems.filter(i => i.itemId !== 'invoice');
            if (parcelItems.length > 0) {
                await firebaseService.settleParcelItems(parcelItems);
            }
        }
        
        const notif: AppNotification = {
            id: `notif-wallet-${Date.now()}`,
            targetAudience: txn.userId,
            title: 'Wallet Request Approved',
            message: `Your ${txn.type.toLowerCase()} request for ${txn.amount} ${txn.currency} has been approved.`,
            type: 'SUCCESS',
            read: false,
            createdAt: Date.now()
        };
        await firebaseService.sendNotification(notif);

        setConfirmAction(null);
        await loadRequests();
    } catch(e: any) {
        console.error(e);
        alert("Transaction Failed: " + e.message);
    } finally {
        setProcessingId(null);
    }
  };

  const executeReject = async () => {
      if (!confirmAction || confirmAction.type !== 'REJECT') return;
      const { txn } = confirmAction;

      if (!rejectReason.trim()) {
          alert("Please provide a reason for rejection.");
          return;
      }

      setProcessingId(txn.id);
      try {
          const currentUser = await firebaseService.getCurrentUser();
          const finalReason = `${rejectReason} (Rejected by ${currentUser?.name || 'Admin'})`;
          
          await firebaseService.rejectWalletTransaction(txn.id, finalReason);
          
          const notif: AppNotification = {
              id: `notif-wallet-rej-${Date.now()}`,
              targetAudience: txn.userId,
              title: 'Wallet Request Rejected',
              message: `Your ${txn.type.toLowerCase()} request was rejected. Reason: ${rejectReason}`,
              type: 'ERROR',
              read: false,
              createdAt: Date.now()
          };
          await firebaseService.sendNotification(notif);

          setConfirmAction(null);
          await loadRequests();
      } catch(e: any) {
          alert("Rejection Failed: " + e.message);
      } finally {
          setProcessingId(null);
      }
  };

  const getBankName = (id: string) => {
      const acc = accounts.find(a => a.id === id);
      return acc ? `${acc.name} (${acc.code})` : 'Unknown Bank';
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Pending Wallet Requests</h3>
            <Button variant="outline" onClick={loadRequests} isLoading={loading} className="text-xs">Refresh</Button>
        </div>

        <Card>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested Bank</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {requests.map(txn => (
                            <tr key={txn.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-500">{txn.date}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{txn.userName}</td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        txn.type === 'DEPOSIT' ? 'bg-green-100 text-green-800' : 
                                        txn.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                                    }`}>
                                        {txn.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">
                                    {txn.amount.toLocaleString()} {txn.currency}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                                    {txn.bankAccountId ? getBankName(txn.bankAccountId) : '-'}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                    <button onClick={() => initiateReject(txn)} className="text-red-600 hover:text-red-900">Reject</button>
                                    <button onClick={() => initiateApprove(txn)} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Approve</button>
                                </td>
                            </tr>
                        ))}
                        {requests.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-500">No pending requests.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>

        {viewTransaction && (
            <SettlementReportModal 
                transaction={viewTransaction} 
                onClose={() => setViewTransaction(null)}
                isApproving={true}
                onConfirm={confirmApprovalFromModal}
                bookings={bookings}
                commissionRules={commissionRules}
                employees={employees}
                accounts={accounts}
                settings={settings}
                currencies={currencies}
                taxRates={taxRates}
            />
        )}

        {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                    <h3 className="text-lg font-bold mb-4">{confirmAction.type === 'APPROVE' ? 'Confirm Approval' : 'Reject Request'}</h3>
                    {confirmAction.type === 'REJECT' ? (
                        <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection" />
                    ) : (
                        <div className="text-sm text-gray-600 mb-4 space-y-2">
                            <p>Approve {confirmAction.txn.type} of {confirmAction.txn.amount} {confirmAction.txn.currency}?</p>
                            <p className="text-xs bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-100">
                                <strong>Accounting Action:</strong> 
                                {confirmAction.txn.type === 'SETTLEMENT' 
                                    ? " Creates Journal Entry for Cash Receipt, Revenue Recognition, Tax, and Customer Liability Adjustment."
                                    : " Creates Journal Entry for Cash Movement."}
                            </p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
                        <Button 
                            onClick={confirmAction.type === 'APPROVE' ? executeApprove : executeReject} 
                            isLoading={!!processingId}
                            className={confirmAction.type === 'APPROVE' ? 'bg-green-600' : 'bg-red-600'}
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
