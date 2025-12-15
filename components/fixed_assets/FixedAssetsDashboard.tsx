import React, { useState, useEffect, useMemo } from 'react';
import { Account, Branch, FixedAsset, AccountType, AccountSubType, FixedAssetCategory, JournalEntry } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AssetList } from './AssetList';
import { AssetForm } from './AssetForm';
import { FixedAssetsSettings } from './FixedAssetsSettings';
import { DepreciationScheduleReport } from './DepreciationScheduleReport';
import { firebaseService } from '../../services/firebaseService';
import { useLanguage } from '../../contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    accounts: Account[];
    branches: Branch[];
}

export const FixedAssetsDashboard: React.FC<Props> = ({ accounts, branches }) => {
    const { t } = useLanguage();
    const [view, setView] = useState<'LIST' | 'NEW' | 'SETTINGS' | 'SCHEDULE'>('LIST');
    const [assets, setAssets] = useState<FixedAsset[]>([]);
    const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);

    // Action Modals
    const [depreciateModal, setDepreciateModal] = useState<{ open: boolean, asset: FixedAsset | null }>({ open: false, asset: null });
    const [disposalModal, setDisposalModal] = useState<{ open: boolean, asset: FixedAsset | null }>({ open: false, asset: null });

    // Inputs for Modals
    const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
    const [txnAmount, setTxnAmount] = useState(0);
    const [depositAccount, setDepositAccount] = useState('');
    const [gainLossAccount, setGainLossAccount] = useState('');
    const [disposalType, setDisposalType] = useState<'SALE' | 'WRITEOFF'>('SALE');

    // Accounts for dropdowns
    const cashAccounts = accounts.filter(a => a.type === AccountType.ASSET && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
    const otherIncomeExpenseAccounts = accounts.filter(a => a.subType === AccountSubType.OTHER_REVENUE || a.subType === AccountSubType.OTHER_EXPENSE);

    const loadData = async () => {
        setLoading(true);
        try {
            const [assetsData, catsData] = await Promise.all([
                firebaseService.getFixedAssets ? firebaseService.getFixedAssets() : [],
                firebaseService.getFixedAssetCategories ? firebaseService.getFixedAssetCategories() : []
            ]);
            setAssets(assetsData);
            setCategories(catsData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadData();
    }, []);

    // --- HANDLERS ---

    const handleSaveAsset = async (asset: FixedAsset, purchaseDetails?: { paymentAccountId: string, reference: string }) => {
        if (firebaseService.addFixedAsset && firebaseService.updateFixedAsset) {
            if (editingAsset) {
                await firebaseService.updateFixedAsset(asset);
            } else {
                await firebaseService.addFixedAsset(asset);

                // Handle Purchase Transaction (Journal Entry)
                if (purchaseDetails && firebaseService.addTransaction) {
                    const jeId = `je-fa-${Date.now()}`;
                    const purchaseEntry: JournalEntry = {
                        id: jeId,
                        date: asset.purchaseDate,
                        description: `Purchase of Asset: ${asset.assetName} (${asset.assetCode})`,
                        reference: purchaseDetails.reference || '',
                        branchId: asset.branchId,
                        currency: 'USD', // Default to Base for FA simplicity
                        exchangeRate: 1,
                        createdAt: Date.now(),
                        lines: [
                            {
                                accountId: asset.assetAccountId, // Debit Asset Cost
                                debit: asset.cost,
                                credit: 0
                            },
                            {
                                accountId: purchaseDetails.paymentAccountId, // Credit Cash/Bank
                                debit: 0,
                                credit: asset.cost
                            }
                        ]
                    };
                    try {
                        await firebaseService.addTransaction(purchaseEntry);
                    } catch (jeError) {
                        console.error("Failed to create purchase journal entry", jeError);
                        toast.warning("Asset registered, but failed to record financial transaction.");
                    }
                }
            }

            await loadData();
            setView('LIST');
            setEditingAsset(null);
        }
    };

    const openDepreciate = (asset: FixedAsset) => {
        const yearly = (asset.cost - asset.salvageValue) / asset.usefulLifeYears;
        const monthly = yearly / 12;
        setTxnDate(new Date().toISOString().split('T')[0]);
        setTxnAmount(parseFloat(monthly.toFixed(2)));
        setDepreciateModal({ open: true, asset });
    };

    const handleRunDepreciation = async () => {
        if (depreciateModal.asset && firebaseService.depreciateAsset) {
            await firebaseService.depreciateAsset(depreciateModal.asset.id, txnDate, txnAmount);
            setDepreciateModal({ open: false, asset: null });
            loadData();
        }
    };

    const openDispose = (asset: FixedAsset) => {
        setTxnDate(new Date().toISOString().split('T')[0]);
        setTxnAmount(0);
        setDepositAccount(cashAccounts[0]?.id || '');
        setDisposalType('SALE'); // Default to sale initially, let effect update account
        updateDisposalAccount('SALE', asset);
        setDisposalModal({ open: true, asset });
    };

    const updateDisposalAccount = (type: 'SALE' | 'WRITEOFF', asset: FixedAsset) => {
        setDisposalType(type);
        let defAcc = '';

        if (asset.categoryId) {
            const cat = categories.find(c => c.id === asset.categoryId);
            if (cat) {
                if (type === 'SALE' && cat.gainLossAccountId) defAcc = cat.gainLossAccountId;
                if (type === 'WRITEOFF' && cat.writeOffAccountId) defAcc = cat.writeOffAccountId;
            }
        }

        if (!defAcc) {
            if (type === 'SALE') {
                defAcc = otherIncomeExpenseAccounts.find(a => a.code === '8000')?.id || '';
            } else {
                // Try standard write-off or loss account
                defAcc = otherIncomeExpenseAccounts.find(a => a.code === '8110')?.id || otherIncomeExpenseAccounts.find(a => a.code === '8100')?.id || '';
            }
        }

        if (defAcc) setGainLossAccount(defAcc);

        // Auto-set amount to 0 if writeoff
        if (type === 'WRITEOFF') setTxnAmount(0);
    };

    const handleRunDisposal = async () => {
        if (disposalModal.asset && firebaseService.disposeAsset) {
            await firebaseService.disposeAsset(disposalModal.asset.id, txnDate, txnAmount, depositAccount, gainLossAccount);
            setDisposalModal({ open: false, asset: null });
            loadData();
        }
    };

    const stats = useMemo(() => {
        const totalCost = assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + a.cost, 0);
        const totalBV = assets.filter(a => a.status === 'ACTIVE').reduce((s, a) => s + a.bookValue, 0);
        return { totalCost, totalBV };
    }, [assets]);

    if (view === 'NEW') {
        return <AssetForm
            initialData={editingAsset || undefined}
            accounts={accounts}
            branches={branches}
            categories={categories}
            onSave={handleSaveAsset}
            onCancel={() => { setView('LIST'); setEditingAsset(null); }}
        />;
    }

    if (view === 'SETTINGS') {
        return <FixedAssetsSettings accounts={accounts} onClose={() => setView('LIST')} />;
    }

    if (view === 'SCHEDULE') {
        return <DepreciationScheduleReport
            assets={assets}
            categories={categories}
            branches={branches}
            onClose={() => setView('LIST')}
        />;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-blue-50 border-blue-100">
                    <div className="text-blue-800 text-sm font-medium">{t('total_asset_cost')} (Active)</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">
                        ${stats.totalCost.toLocaleString()}
                    </div>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <div className="text-green-800 text-sm font-medium">{t('net_book_value')}</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                        ${stats.totalBV.toLocaleString()}
                    </div>
                </Card>
            </div>

            <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setView('SCHEDULE')} className="text-indigo-600 border-indigo-200 bg-indigo-50">{t('depreciation_schedule')}</Button>
                <Button variant="secondary" onClick={() => setView('SETTINGS')}>{t('configuration')}</Button>
                <Button onClick={() => { setEditingAsset(null); setView('NEW'); }}>+ {t('register_asset')}</Button>
            </div>

            <AssetList
                assets={assets}
                onEdit={(a) => { setEditingAsset(a); setView('NEW'); }}
                onDepreciate={openDepreciate}
                onDispose={openDispose}
            />

            {/* Depreciation Modal */}
            {depreciateModal.open && depreciateModal.asset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">{t('depreciate')}</h3>
                        <p className="text-sm text-gray-500">
                            Recording depreciation for <strong>{depreciateModal.asset.assetName}</strong>.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('date')}</label>
                            <input type="date" className="w-full border rounded-lg p-2" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('amount')}</label>
                            <input type="number" step="0.01" className="w-full border rounded-lg p-2" value={txnAmount} onChange={e => setTxnAmount(parseFloat(e.target.value))} />
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <Button variant="outline" onClick={() => setDepreciateModal({ open: false, asset: null })}>{t('cancel')}</Button>
                            <Button onClick={handleRunDepreciation}>{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Disposal Modal */}
            {disposalModal.open && disposalModal.asset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">{t('dispose')}</h3>
                        <p className="text-sm text-gray-500">
                            Processing disposal for <strong>{disposalModal.asset.assetName}</strong>.
                        </p>

                        <div className="flex space-x-2 mb-2">
                            <button
                                onClick={() => updateDisposalAccount('WRITEOFF', disposalModal.asset!)}
                                className={`px-3 py-1 text-xs rounded border font-medium transition-colors ${disposalType === 'WRITEOFF' ? 'bg-red-100 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            >
                                Write Off (Scrap)
                            </button>
                            <button
                                onClick={() => updateDisposalAccount('SALE', disposalModal.asset!)}
                                className={`px-3 py-1 text-xs rounded border font-medium transition-colors ${disposalType === 'SALE' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                            >
                                Sell (Record Revenue)
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Disposal Date</label>
                            <input type="date" className="w-full border rounded-lg p-2" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
                        </div>

                        {disposalType === 'SALE' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                                <input type="number" step="0.01" className="w-full border rounded-lg p-2" value={txnAmount} onChange={e => setTxnAmount(parseFloat(e.target.value))} />
                            </div>
                        )}

                        {disposalType === 'SALE' && txnAmount > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Proceeds To</label>
                                <select className="w-full border rounded-lg p-2" value={depositAccount} onChange={e => setDepositAccount(e.target.value)}>
                                    {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {disposalType === 'SALE' ? 'Gain/Loss Account' : 'Write-Off Expense Account'}
                            </label>
                            <select className="w-full border rounded-lg p-2" value={gainLossAccount} onChange={e => setGainLossAccount(e.target.value)}>
                                {otherIncomeExpenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                                {disposalType === 'SALE' ? 'Books difference between BV and Price.' : 'Full Book Value is expensed here.'}
                            </p>
                        </div>

                        <div className="bg-gray-100 p-3 rounded text-sm space-y-1">
                            <div className="flex justify-between text-gray-600">
                                <span>Current Book Value:</span>
                                <span>${disposalModal.asset.bookValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-bold text-indigo-700 mt-2 pt-2 border-t border-gray-200">
                                <span>Est. {disposalType === 'SALE' ? 'Gain/Loss' : 'Loss'}:</span>
                                <span>${(txnAmount - disposalModal.asset.bookValue).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                            <Button variant="outline" onClick={() => setDisposalModal({ open: false, asset: null })}>{t('cancel')}</Button>
                            <Button variant="danger" onClick={handleRunDisposal}>{t('confirm')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};