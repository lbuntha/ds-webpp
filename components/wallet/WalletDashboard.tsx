
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, WalletTransaction, Account, AccountType, AccountSubType, ParcelBooking, SystemSettings, DriverCommissionRule, Employee, CurrencyConfig } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../services/firebaseService';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageUpload } from '../ui/ImageUpload'; 
import { SettlementReportModal } from '../ui/SettlementReportModal';

interface Props {
  user: UserProfile;
}

// Helper type for the unified view
interface LedgerItem {
    id: string;
    date: string;
    description: string;
    type: 'FEE' | 'COD' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTLEMENT' | 'EARNING' | 'REFUND';
    amount: number;
    currency: string;
    status: string;
    reference?: string;
    isCredit: boolean; // true = adds to balance (Asset/Deposit), false = deducts (Liability/Withdrawal)
}

export const WalletDashboard: React.FC<Props> = ({ user }) => {
  const { t } = useLanguage();
  
  // Data State
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [bookings, setBookings] = useState<ParcelBooking[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [commissionRules, setCommissionRules] = useState<DriverCommissionRule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]); 
  
  // UI State
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'KHR'>('USD');
  const [modalOpen, setModalOpen] = useState<'DEPOSIT' | 'WITHDRAWAL' | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewTransaction, setViewTransaction] = useState<WalletTransaction | null>(null);
  
  // Form State
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(''); 

  // Initial Load
  useEffect(() => {
      const fetchData = async () => {
          try {
              // Use getUserBookings to fetch only allowed data for the specific user
              const [txns, myBookings, accs, sysSettings, commRules, allEmployees, allCurrencies] = await Promise.all([
                  firebaseService.getWalletTransactions(user.uid),
                  firebaseService.getUserBookings(user),
                  firebaseService.getAccounts(),
                  firebaseService.getSettings(),
                  firebaseService.logisticsService.getDriverCommissionRules(),
                  firebaseService.getEmployees(),
                  firebaseService.getCurrencies()
              ]);

              setTransactions(txns);
              setSettings(sysSettings);
              setCommissionRules(commRules);
              setEmployees(allEmployees);
              setBookings(myBookings); // Already filtered securely by service

              // Fetch Nostro Accounts (Company Assets: Cash & Bank)
              const banks = accs.filter(a => 
                  a.type === AccountType.ASSET && 
                  (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash')) && 
                  !a.isHeader
              );
              setBankAccounts(banks);

          } catch (e) {
              console.error("Failed to load wallet data", e);
          }
      };
      fetchData();
  }, [user]);

  // Real-time Balance Listener
  useEffect(() => {
      const unsubscribe = firebaseService.subscribeToUser(user.uid, (updatedUser: UserProfile) => {
          // Listener ensures profile is fresh
      });
      return () => unsubscribe();
  }, [user.uid]);

  // --- UNIFIED LEDGER CALCULATION ---
  const unifiedLedger = useMemo(() => {
      const ledger: LedgerItem[] = [];

      // 1. Financial Transactions (Explicit)
      transactions.forEach(t => {
          let isCredit = false;
          
          // Logic for Wallet Direction:
          // DEPOSIT: Money IN to Wallet (Credit)
          // EARNING: Money IN to Wallet (Credit)
          // REFUND: Money IN to Wallet (Credit)
          // SETTLEMENT: Driver paying company -> Reduces Driver Debt -> Treated as Credit to Wallet Balance (restoring it to 0)
          if (t.type === 'DEPOSIT' || t.type === 'EARNING' || t.type === 'REFUND' || t.type === 'SETTLEMENT') {
              isCredit = true;
          }
          
          // WITHDRAWAL: Money OUT of Wallet (Debit)
          if (t.type === 'WITHDRAWAL') {
              isCredit = false;
          }

          ledger.push({
              id: t.id,
              date: t.date,
              description: t.description || t.type,
              type: t.type,
              amount: t.amount,
              currency: t.currency,
              status: t.status,
              reference: (t.id || '').slice(-6),
              isCredit
          });
      });

      // 2. Operational Transactions (Implicit from Bookings)
      
      const defaultRule = commissionRules.find(r => r.isDefault);
      const myEmployeeRecord = employees.find(e => e.linkedUserId === user.uid);
      const myZone = myEmployeeRecord?.zone;
      const activeRule = commissionRules.find(r => r.zoneName === myZone) || defaultRule || { type: 'PERCENTAGE', value: 70 };

      bookings.forEach(b => {
          const isSender = (user.linkedCustomerId && b.senderId === user.linkedCustomerId) || b.senderName === user.name;
          const isDriver = b.driverId === user.uid;
          const bItems = b.items || [];

          // A. If User is Sender (Customer)
          if (isSender) {
              // 1. COD Collection (Credit to Customer Wallet)
              let hasKHR = false;
              bItems.forEach(item => {
                  if (item.status === 'DELIVERED') {
                      if (item.codCurrency === 'KHR') hasKHR = true;
                      ledger.push({
                          id: `cod-${item.id}`,
                          date: b.bookingDate,
                          description: `COD Collected: ${item.receiverName}`,
                          type: 'COD',
                          amount: item.productPrice || 0,
                          currency: item.codCurrency || 'USD',
                          status: 'COLLECTED',
                          reference: item.trackingCode || 'N/A',
                          isCredit: true
                      });
                  }
              });

              // 2. Service Fee Deduction (Debit from Customer Wallet)
              if (b.status !== 'CANCELLED') {
                  const itemsDelivered = bItems.filter(i => i.status === 'DELIVERED').length;
                  // Deduct fee if items are delivered or booking is completed
                  if (itemsDelivered > 0 || b.status === 'COMPLETED' || b.status === 'CONFIRMED') {
                        // SMART CURRENCY ADJUSTMENT:
                        // If the collected COD is in KHR, we should display the fee in KHR to allow clean netting
                        // The actual revenue is still booked in USD in the backend, but for the customer's wallet view,
                        // we convert it to match the currency they are holding.
                        let feeAmount = b.totalDeliveryFee;
                        let feeCurrency = 'USD';

                        if (hasKHR) {
                            feeAmount = b.totalDeliveryFee * 4100; // Convert to KHR
                            feeCurrency = 'KHR';
                        }

                        ledger.push({
                            id: `fee-${b.id}`,
                            date: b.bookingDate,
                            description: `Service Fee: ${b.serviceTypeName}`,
                            type: 'FEE',
                            amount: feeAmount,
                            currency: feeCurrency,
                            status: 'APPLIED',
                            reference: (b.id || '').slice(-6),
                            isCredit: false // Deducts from balance
                        });
                  }
              }
          }

          // B. If User is Driver
          if (isDriver) {
              // Commission Earning (Credit to Driver Wallet)
              // UPDATED: Accrue commission pro-rata based on completed items (Delivered or Returned)
              if (b.status !== 'CANCELLED') {
                  const totalItems = bItems.length;
                  const processedItems = bItems.filter(i => i.status === 'DELIVERED' || i.status === 'RETURN_TO_SENDER').length;
                  
                  if (totalItems > 0 && processedItems > 0) {
                      let totalCommission = 0;
                      if (activeRule.type === 'FIXED_AMOUNT') {
                          totalCommission = activeRule.value;
                      } else {
                          totalCommission = b.totalDeliveryFee * (activeRule.value / 100);
                      }

                      // Pro-rate commission based on progress
                      const earnedCommission = totalCommission * (processedItems / totalItems);

                      if (earnedCommission > 0) {
                          ledger.push({
                              id: `earn-${b.id}`,
                              date: b.bookingDate,
                              description: `Commission: Booking #${(b.id || '').slice(-6)} (${processedItems}/${totalItems})`,
                              type: 'EARNING',
                              amount: earnedCommission,
                              currency: 'USD',
                              status: 'EARNED',
                              reference: (b.id || '').slice(-6),
                              isCredit: true
                          });
                      }
                  }
              }

              // Cash Held Liability (Debit from Driver Wallet)
              // Drivers owe this money to company until Settled.
              bItems.forEach(item => {
                  // Include ALL delivered items regardless of settlement status to maintain history.
                  // 'SETTLED' items are offset by the 'SETTLEMENT' transaction above.
                  if (item.status === 'DELIVERED') {
                      ledger.push({
                          id: `held-${item.id}`,
                          date: b.bookingDate,
                          description: `Cash Collected: ${item.receiverName}`,
                          type: 'COD',
                          amount: item.productPrice || 0,
                          currency: item.codCurrency || 'USD',
                          status: item.settlementStatus || 'HELD',
                          reference: item.trackingCode || 'N/A',
                          isCredit: false // Driver OWES this (Negative balance impact)
                      });
                  }
              });
          }
      });

      return ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, bookings, user, commissionRules, employees]);

  // Calculate Net Balance
  const calculatedBalance = useMemo(() => {
      let usd = 0;
      let khr = 0;

      unifiedLedger.forEach(item => {
          // Only include finalized statuses
          if (item.status === 'APPROVED' || item.status === 'APPLIED' || item.status === 'COLLECTED' || item.status === 'EARNED' || item.status === 'HELD' || item.status === 'SETTLED') {
              const val = item.amount;
              if (item.currency === 'KHR') {
                  if (item.isCredit) khr += val; else khr -= val;
              } else {
                  if (item.isCredit) usd += val; else usd -= val;
              }
          }
      });

      return { usd, khr };
  }, [unifiedLedger]);

  // Balance Breakdown for Payout Logic (Customer Context)
  const balanceBreakdown = useMemo(() => {
      if (modalOpen !== 'WITHDRAWAL') return null;
      
      const currencyFilter = activeCurrency;
      let codTotal = 0;
      let feeTotal = 0;
      let paidOut = 0;
      let deposits = 0;
      
      const relatedItems: { bookingId: string, itemId: string }[] = [];

      unifiedLedger.forEach(item => {
          if (item.status === 'PENDING' || item.status === 'REJECTED') return;
          if (item.currency !== currencyFilter) return; 

          if (item.type === 'COD' && item.isCredit) {
              codTotal += item.amount;
              const itemId = item.id.replace('cod-', '');
              const parentBooking = bookings.find(b => (b.items || []).some(i => i.id === itemId));
              if (parentBooking) {
                  relatedItems.push({ bookingId: parentBooking.id, itemId });
              }
          } else if (item.type === 'FEE') {
              feeTotal += item.amount;
          } else if (item.type === 'WITHDRAWAL') {
              paidOut += item.amount;
          } else if (item.type === 'DEPOSIT' || item.type === 'EARNING' || item.type === 'SETTLEMENT') {
              deposits += item.amount;
          }
      });

      const net = (codTotal + deposits) - feeTotal - paidOut;
      return { codTotal, feeTotal, paidOut, deposits, net, relatedItems };
  }, [unifiedLedger, modalOpen, activeCurrency, bookings]);

  const currentBalance = activeCurrency === 'USD' ? calculatedBalance.usd : calculatedBalance.khr;
  
  const defaultBankId = activeCurrency === 'KHR'
      ? (settings.defaultCustomerSettlementBankIdKHR || settings.defaultCustomerSettlementBankId)
      : (settings.defaultCustomerSettlementBankIdUSD || settings.defaultCustomerSettlementBankId);
      
  const defaultBank = bankAccounts.find(b => b.id === defaultBankId);

  useEffect(() => {
      if (modalOpen === 'WITHDRAWAL' && balanceBreakdown) {
          // Auto-fill max amount
          const maxWithdraw = Math.max(0, balanceBreakdown.net);
          setAmount(parseFloat(maxWithdraw.toFixed(2)));
      } else {
          setAmount(0);
      }
  }, [modalOpen, balanceBreakdown, activeCurrency]);

  const handleTransaction = async () => {
      if (!amount || amount <= 0) return;
      if (modalOpen === 'DEPOSIT' && !defaultBankId) return alert(`System Error: No default ${activeCurrency} company bank configured. Please contact support.`);
      
      setLoading(true);
      try {
          if (modalOpen === 'DEPOSIT') {
              await firebaseService.requestWalletTopUp(
                  user.uid,
                  amount,
                  activeCurrency,
                  defaultBankId!,
                  attachment,
                  description || 'Wallet Top Up'
              );
              alert("Payment submitted! Please wait for approval.");
          } else {
              // WITHDRAWAL: Include related items so Finance can do Net Settlement
              await firebaseService.requestWithdrawal(
                  user.uid,
                  user.name,
                  amount,
                  activeCurrency,
                  defaultBankId || 'system-payout',
                  description || 'Net Payout Request',
                  balanceBreakdown?.relatedItems
              );
              alert("Payout request submitted for approval.");
          }
          
          // Refresh
          const updatedTxns = await firebaseService.getWalletTransactions(user.uid);
          setTransactions(updatedTxns);
          setModalOpen(null);
          setAmount(0);
          setDescription('');
          setAttachment('');
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const displayLedger = unifiedLedger.filter(t => t.currency === activeCurrency);

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">{user.name}'s {t('my_wallet')}</h2>
            <div className="flex space-x-2 bg-white p-1 rounded-lg border">
                <button 
                    onClick={() => setActiveCurrency('USD')}
                    className={`px-3 py-1 rounded text-sm font-bold transition-all ${activeCurrency === 'USD' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    $ USD
                </button>
                <button 
                    onClick={() => setActiveCurrency('KHR')}
                    className={`px-3 py-1 rounded text-sm font-bold transition-all ${activeCurrency === 'KHR' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    ៛ KHR
                </button>
            </div>
        </div>

        {/* Balance Card */}
        <div className={`p-6 rounded-2xl text-white shadow-xl bg-gradient-to-br ${activeCurrency === 'USD' ? 'from-green-600 to-emerald-800' : 'from-blue-600 to-indigo-800'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-blue-100 text-sm font-medium opacity-80">{t('net_balance')}</p>
                    <h1 className="text-4xl font-bold mt-2">
                        {activeCurrency === 'USD' ? '$' : ''}
                        {calculatedBalance[activeCurrency === 'USD' ? 'usd' : 'khr'].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        {activeCurrency === 'KHR' ? ' ៛' : ''}
                    </h1>
                    <p className="text-xs text-white/60 mt-1">
                        {user.role === 'driver' ? 'Earnings - Cash Held + Settlements' : 'COD Collected - Service Fees'}
                    </p>
                </div>
                <div className="bg-white/20 p-2 rounded-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
            </div>
            
            <div className="mt-8 flex gap-3">
                <button 
                    onClick={() => setModalOpen('DEPOSIT')}
                    className="flex-1 bg-white text-gray-900 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    {t('top_up')}
                </button>
                <button 
                    onClick={() => setModalOpen('WITHDRAWAL')}
                    className="flex-1 bg-black/20 text-white py-2 rounded-xl font-bold text-sm hover:bg-black/30 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {t('request_payout')}
                </button>
            </div>
        </div>

        {/* Detailed Statement */}
        <Card title={t('detailed_statement')}>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('description')}</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('transaction_type')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('amount')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayLedger.map((txn) => (
                            <tr key={txn.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{txn.date}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <div className="font-medium">{txn.description}</div>
                                    {txn.status === 'PENDING' && <div className="text-xs text-orange-500 italic mt-0.5">{t('pending_approval')}</div>}
                                    {txn.status === 'SETTLED' && <div className="text-xs text-green-500 italic mt-0.5">Settled</div>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                        txn.type === 'FEE' ? 'bg-red-50 text-red-600 border border-red-100' :
                                        txn.type === 'COD' && txn.isCredit ? 'bg-green-50 text-green-600 border border-green-100' :
                                        txn.type === 'DEPOSIT' || txn.type === 'SETTLEMENT' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                        'bg-gray-50 text-gray-600 border border-gray-200'
                                    }`}>
                                        {txn.type}
                                    </span>
                                </td>
                                <td className={`px-6 py-4 text-right text-sm font-bold ${
                                    txn.isCredit ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {txn.isCredit ? '+' : '-'} {txn.currency === 'USD' ? '$' : ''}{txn.amount.toLocaleString()}{txn.currency === 'KHR' ? '៛' : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>

        {/* Withdrawal/Deposit Modal */}
        {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                        {modalOpen === 'DEPOSIT' ? t('top_up') : t('request_payout')}
                    </h3>
                    
                    {modalOpen === 'WITHDRAWAL' && balanceBreakdown && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-2 text-sm">
                            <div className="flex justify-between text-green-700">
                                <span>Total COD Collected</span>
                                <span className="font-bold">+ {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.codTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-indigo-600">
                                <span>Deposits/Credits</span>
                                <span className="font-bold">+ {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.deposits.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-red-600 border-b border-gray-200 pb-2">
                                <span>Less: Service Fees</span>
                                <span className="font-bold">- {activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.feeTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-bold text-gray-900 pt-1 text-base">
                                <span>Net Available Payout</span>
                                <span>{activeCurrency === 'USD' ? '$' : ''}{balanceBreakdown.net.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('amount')} ({activeCurrency})</label>
                            <input 
                                type="number" 
                                className="w-full border rounded-lg px-3 py-2 text-lg font-bold" 
                                value={amount}
                                onChange={e => setAmount(parseFloat(e.target.value))}
                                readOnly={modalOpen === 'WITHDRAWAL'}
                            />
                        </div>
                        
                        {modalOpen === 'DEPOSIT' && (
                            <>
                                {defaultBank ? (
                                    <div className="flex flex-col items-center bg-blue-50 p-4 rounded-xl border border-blue-200">
                                        <p className="text-xs text-blue-700 mb-2 uppercase font-bold">{t('pay_to_company')}</p>
                                        {defaultBank.qrCode && <img src={defaultBank.qrCode} alt="QR" className="w-32 h-32 object-contain mb-2" />}
                                        <p className="font-bold">{defaultBank.name}</p>
                                        <p className="text-xs font-mono">{defaultBank.code}</p>
                                    </div>
                                ) : <div className="text-red-500 text-sm">No company bank configured.</div>}
                                
                                <ImageUpload value={attachment} onChange={setAttachment} label={t('proof_of_transfer')} />
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
                            <input 
                                className="w-full border rounded-lg px-3 py-2 text-sm" 
                                placeholder={modalOpen === 'WITHDRAWAL' ? "Payout Request" : "Reference ID"}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setModalOpen(null)}>{t('cancel')}</Button>
                        <Button onClick={handleTransaction} isLoading={loading}>{t('submit_request')}</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
