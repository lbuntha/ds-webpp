import React, { useState, useMemo } from 'react';
import { Account, Branch, CurrencyConfig, TaxRate, JournalEntry, SystemSettings, AccountType, AccountSubType } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AccountForm } from '../AccountForm';
import { AccountList } from './AccountList';
import { BranchForm } from './BranchForm';
import { CurrencyForm } from './CurrencyForm';
import { TaxRateForm } from './TaxRateForm';
import { DriverCommissionSetup } from './DriverCommissionSetup';
import { ReferralSettings } from './ReferralSettings';
import { MenuManagement } from './MenuManagement';
import { RolePermissionManagement } from './RolePermissionManagement';
import { RouteManagement } from './RouteManagement';
import { TransactionDefinitions } from './TransactionDefinitions'; // Import
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { MASTER_COA_DATA } from '../../src/shared/constants';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    settings?: SystemSettings;
    accounts: Account[];
    branches: Branch[];
    currencies: CurrencyConfig[];
    taxRates?: TaxRate[];
    transactions?: JournalEntry[];
    onAddAccount: (acc: Account) => Promise<void>;
    onUpdateAccount: (acc: Account) => Promise<void>;
    onDeleteAccount?: (id: string) => Promise<void>;
    onImportAccounts?: (accounts: Account[]) => Promise<void>;
    onAddBranch: (br: Branch) => Promise<void>;
    onUpdateBranch: (br: Branch) => Promise<void>;
    onDeleteBranch?: (id: string) => Promise<void>;
    onAddCurrency: (curr: CurrencyConfig) => Promise<void>;
    onUpdateCurrency: (curr: CurrencyConfig) => Promise<void>;
    onAddTaxRate?: (tr: TaxRate) => Promise<void>;
    onUpdateTaxRate?: (tr: TaxRate) => Promise<void>;
    onRunSetup?: () => void;
    onUpdateSettings: (settings: SystemSettings) => Promise<void>;
    onClearData?: () => Promise<void>;
    onMenuUpdate?: () => void;
}

export const SettingsDashboard: React.FC<Props> = ({
    settings, accounts, branches, currencies, taxRates = [], transactions = [],
    onAddAccount, onUpdateAccount, onDeleteAccount, onImportAccounts,
    onAddBranch, onUpdateBranch, onDeleteBranch,
    onAddCurrency, onUpdateCurrency,
    onAddTaxRate, onUpdateTaxRate,
    onRunSetup, onUpdateSettings, onClearData, onMenuUpdate
}) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'COA' | 'BRANCHES' | 'CURRENCIES' | 'TAXES' | 'COMMISSIONS' | 'REFERRAL' | 'MENU' | 'RULES' | 'PERMISSIONS' | 'ROUTES'>('GENERAL');

    // Account State
    const [accountFormOpen, setAccountFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
    const [importing, setImporting] = useState(false);

    // Branch State
    const [branchFormOpen, setBranchFormOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | undefined>(undefined);

    // Currency State
    const [currencyFormOpen, setCurrencyFormOpen] = useState(false);
    const [editingCurrency, setEditingCurrency] = useState<CurrencyConfig | undefined>(undefined);

    // Tax State
    const [taxFormOpen, setTaxFormOpen] = useState(false);
    const [editingTax, setEditingTax] = useState<TaxRate | undefined>(undefined);

    // General Config State - Customer Wallets
    const [custWalletUSD, setCustWalletUSD] = useState(settings?.customerWalletAccountUSD || settings?.defaultCustomerWalletAccountId || '');
    const [custWalletKHR, setCustWalletKHR] = useState(settings?.customerWalletAccountKHR || '');

    // General Config State - Driver Wallets (Commission Payable)
    const [driverWalletUSD, setDriverWalletUSD] = useState(settings?.driverWalletAccountUSD || settings?.defaultDriverWalletAccountId || '');
    const [driverWalletKHR, setDriverWalletKHR] = useState(settings?.driverWalletAccountKHR || '');

    // General Config State - Driver Commission Expense (COGS)
    const [driverCommExpUSD, setDriverCommExpUSD] = useState(settings?.driverCommissionExpenseAccountUSD || '');
    const [driverCommExpKHR, setDriverCommExpKHR] = useState(settings?.driverCommissionExpenseAccountKHR || '');

    // Commission Exchange Rate (USD to KHR)
    const [commissionExchangeRate, setCommissionExchangeRate] = useState(settings?.commissionExchangeRate || 4100);

    // Unified Settlement Accounts
    const [driverSettlementBankUSD, setDriverSettlementBankUSD] = useState(settings?.defaultDriverSettlementBankIdUSD || settings?.defaultSettlementBankAccountId || '');
    const [driverSettlementBankKHR, setDriverSettlementBankKHR] = useState(settings?.defaultDriverSettlementBankIdKHR || '');

    const [customerSettlementBankUSD, setCustomerSettlementBankUSD] = useState(settings?.defaultCustomerSettlementBankIdUSD || settings?.defaultSettlementBankAccountId || '');
    const [customerSettlementBankKHR, setCustomerSettlementBankKHR] = useState(settings?.defaultCustomerSettlementBankIdKHR || '');

    // NEW: Driver Cash on Hand Accounts
    const [driverCashAccUSD, setDriverCashAccUSD] = useState(settings?.defaultDriverCashAccountIdUSD || '');
    const [driverCashAccKHR, setDriverCashAccKHR] = useState(settings?.defaultDriverCashAccountIdKHR || '');

    // Revenue & Tax Defaults
    const [defaultRevenueUSD, setDefaultRevenueUSD] = useState(settings?.defaultRevenueAccountUSD || '');
    const [defaultRevenueKHR, setDefaultRevenueKHR] = useState(settings?.defaultRevenueAccountKHR || '');
    const [defaultTaxUSD, setDefaultTaxUSD] = useState(settings?.defaultTaxAccountUSD || '');
    const [defaultTaxKHR, setDefaultTaxKHR] = useState(settings?.defaultTaxAccountKHR || '');

    const [savingGeneral, setSavingGeneral] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Filter for Liability accounts (Wallets)
    const liabilityAccounts = accounts.filter(a => a.type === AccountType.LIABILITY && !a.isHeader);

    // Filter for Expense Accounts (Commissions)
    const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);

    // Filter for Asset accounts (Banks)
    const bankAccounts = accounts.filter(a =>
        a.type === AccountType.ASSET &&
        (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('bank') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('settlement')) &&
        !a.isHeader
    );

    // Helper to filter by currency
    const getAccountsByCurrency = (list: Account[], curr: 'USD' | 'KHR') => {
        return list.filter(a => !a.currency || a.currency === curr);
    };

    // ... (Existing Account Handlers maintained) ...

    const renderAccountSelect = (label: string, value: string, setValue: (val: string) => void, list: Account[]) => (
        <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={value} onChange={e => setValue(e.target.value)}>
                <option value="">-- Select Account --</option>
                {list.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
        </div>
    );
    const handleAccountSubmit = async (acc: Account) => {
        if (editingAccount) await onUpdateAccount(acc);
        else await onAddAccount(acc);
        setAccountFormOpen(false);
        setEditingAccount(undefined);
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!onImportAccounts) {
            alert("Import function not connected.");
            return;
        }

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            try {
                const lines = text.split('\n');
                const newAccounts: Account[] = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',');

                    if (parts[0].toLowerCase() === 'gl' || parts[0].toLowerCase() === 'code') continue;
                    if (parts.length < 2) continue;

                    const code = parts[0]?.trim();
                    const name = parts[1]?.trim();
                    const typeStr = parts[2]?.trim();
                    const subTypeStr = parts[3]?.trim();
                    const currency = parts[4]?.trim();

                    if (!code || !name) continue;

                    let type: AccountType = AccountType.ASSET;
                    const tUpper = (typeStr || '').toUpperCase();
                    if (tUpper.includes('ASSET')) type = AccountType.ASSET;
                    else if (tUpper.includes('LIAB')) type = AccountType.LIABILITY;
                    else if (tUpper.includes('EQUITY')) type = AccountType.EQUITY;
                    else if (tUpper.includes('REV') || tUpper.includes('INCOME')) type = AccountType.REVENUE;
                    else if (tUpper.includes('EXP')) type = AccountType.EXPENSE;

                    let subType = AccountSubType.CURRENT_ASSET;
                    const stUpper = (subTypeStr || '').toUpperCase();
                    if (stUpper.includes('NON-CURRENT') || stUpper.includes('FIXED')) subType = AccountSubType.NON_CURRENT_ASSET;
                    else if (stUpper.includes('CURRENT ASSET')) subType = AccountSubType.CURRENT_ASSET;
                    else if (stUpper.includes('CURRENT LIAB')) subType = AccountSubType.CURRENT_LIABILITY;
                    else if (stUpper.includes('LONG-TERM LIAB')) subType = AccountSubType.LONG_TERM_LIABILITY;
                    else if (stUpper.includes('EQUITY')) subType = AccountSubType.EQUITY;
                    else if (stUpper.includes('OPERATING REV')) subType = AccountSubType.OPERATING_REVENUE;
                    else if (stUpper.includes('OTHER REV')) subType = AccountSubType.OTHER_REVENUE;
                    else if (stUpper.includes('COGS')) subType = AccountSubType.COST_OF_GOODS_SOLD;
                    else if (stUpper.includes('OPERATING EXP')) subType = AccountSubType.OPERATING_EXPENSE;
                    else if (stUpper.includes('OTHER EXP')) subType = AccountSubType.OTHER_EXPENSE;

                    newAccounts.push({
                        id: code,
                        code,
                        name: name.replace(/^"|"$/g, ''),
                        type,
                        subType: subType,
                        currency: (currency || 'USD').replace(/^"|"$/g, ''),
                        description: 'Imported via CSV',
                        isHeader: false
                    });
                }

                if (newAccounts.length > 0) {
                    if (confirm(`Ready to import ${newAccounts.length} accounts? Existing accounts with same Code will be updated.`)) {
                        await onImportAccounts(newAccounts);
                        toast.success(`Successfully processed ${newAccounts.length} accounts.`);
                    }
                } else {
                    toast.warning("No valid account rows found in CSV.");
                }

            } catch (err) {
                console.error(err);
                toast.error("Failed to parse CSV.");
            } finally {
                setImporting(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleLoadMaster = async () => {
        if (!onImportAccounts) return;
        if (confirm(`This will merge ${MASTER_COA_DATA.length} accounts from the Master COA into your database. Existing accounts with matching codes will be updated. Continue?`)) {
            setImporting(true);
            try {
                await onImportAccounts(MASTER_COA_DATA);
                toast.success("Master COA loaded successfully.");
            } catch (e) {
                console.error(e);
                toast.error("Failed to load master COA.");
            } finally {
                setImporting(false);
            }
        }
    };

    // ... (Branch, Currency, Tax handlers preserved) ...
    const handleBranchSubmit = async (br: Branch) => {
        if (editingBranch) await onUpdateBranch(br);
        else await onAddBranch(br);
        setBranchFormOpen(false);
        setEditingBranch(undefined);
    };

    const handleCurrencySubmit = async (curr: CurrencyConfig) => {
        if (editingCurrency) await onUpdateCurrency(curr);
        else await onAddCurrency(curr);
        setCurrencyFormOpen(false);
        setEditingCurrency(undefined);
    };

    const handleTaxSubmit = async (tr: TaxRate) => {
        if (!onAddTaxRate || !onUpdateTaxRate) return;
        if (editingTax) await onUpdateTaxRate(tr);
        else await onAddTaxRate(tr);
        setTaxFormOpen(false);
        setEditingTax(undefined);
    };

    const handleSaveGeneral = async () => {
        setSavingGeneral(true);
        try {
            await onUpdateSettings({
                ...settings,
                // Customer Wallets
                customerWalletAccountUSD: custWalletUSD,
                customerWalletAccountKHR: custWalletKHR,
                defaultCustomerWalletAccountId: custWalletUSD, // Legacy fallback

                // Driver Wallets (Commission Payable)
                driverWalletAccountUSD: driverWalletUSD,
                driverWalletAccountKHR: driverWalletKHR,
                defaultDriverWalletAccountId: driverWalletUSD, // Legacy fallback

                // Driver Commission Expense (COGS)
                driverCommissionExpenseAccountUSD: driverCommExpUSD,
                driverCommissionExpenseAccountKHR: driverCommExpKHR,

                // Commission Exchange Rate
                commissionExchangeRate: commissionExchangeRate,

                // Settlement Accounts
                defaultDriverSettlementBankIdUSD: driverSettlementBankUSD,
                defaultDriverSettlementBankIdKHR: driverSettlementBankKHR,

                // NEW: Driver Cash
                defaultDriverCashAccountIdUSD: driverCashAccUSD,
                defaultDriverCashAccountIdKHR: driverCashAccKHR,

                defaultCustomerSettlementBankIdUSD: customerSettlementBankUSD,
                defaultCustomerSettlementBankIdKHR: customerSettlementBankKHR,

                // Fallback
                defaultDriverSettlementBankId: driverSettlementBankUSD,
                defaultCustomerSettlementBankId: customerSettlementBankUSD,
                defaultSettlementBankAccountId: driverSettlementBankUSD,

                // Revenue & Tax
                defaultRevenueAccountUSD: defaultRevenueUSD,
                defaultRevenueAccountKHR: defaultRevenueKHR,
                defaultTaxAccountUSD: defaultTaxUSD,
                defaultTaxAccountKHR: defaultTaxKHR
            });
            toast.success("Configuration saved successfully.");
        } catch (e) {
            toast.error("Failed to save settings.");
        } finally {
            setSavingGeneral(false);
        }
    };

    const executeClearData = async () => {
        if (onClearData) {
            await onClearData();
            setShowClearConfirm(false);
        }
    };

    // ... (Form renders preserved) ...
    if (accountFormOpen) {
        return <AccountForm initialData={editingAccount} accounts={accounts} onSubmit={handleAccountSubmit} onCancel={() => setAccountFormOpen(false)} />;
    }
    if (branchFormOpen) {
        return <BranchForm initialData={editingBranch} onSave={handleBranchSubmit} onCancel={() => setBranchFormOpen(false)} />;
    }
    if (currencyFormOpen) {
        return <CurrencyForm initialData={editingCurrency} onSave={handleCurrencySubmit} onCancel={() => setCurrencyFormOpen(false)} />;
    }
    if (taxFormOpen) {
        return <TaxRateForm initialData={editingTax} onSave={handleTaxSubmit} onCancel={() => setTaxFormOpen(false)} />;
    }

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit overflow-x-auto">
                <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'GENERAL' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t('general_config')}</button>
                <button onClick={() => setActiveTab('PERMISSIONS')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'PERMISSIONS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Role Permissions</button>
                <button onClick={() => setActiveTab('ROUTES')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ROUTES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Routes</button>
                <button onClick={() => setActiveTab('COA')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'COA' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t('chart_of_accounts')}</button>
                <button onClick={() => setActiveTab('RULES')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'RULES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Posting Rules</button>
                <button onClick={() => setActiveTab('BRANCHES')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'BRANCHES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t('branches')}</button>
                <button onClick={() => setActiveTab('COMMISSIONS')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'COMMISSIONS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Commissions</button>
                <button onClick={() => setActiveTab('TAXES')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'TAXES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t('taxes')}</button>
                <button onClick={() => setActiveTab('CURRENCIES')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'CURRENCIES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t('currencies')}</button>
                <button onClick={() => setActiveTab('MENU')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'MENU' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Menu Builder</button>
                <button onClick={() => setActiveTab('REFERRAL')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'REFERRAL' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>Referrals</button>
            </div>

            {/* --- GENERAL VIEW --- */}
            {activeTab === 'PERMISSIONS' && <RolePermissionManagement />}
            {activeTab === 'ROUTES' && <RouteManagement />}
            {activeTab === 'GENERAL' && (
                <Card title={t('general_config')}>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('company_name')}</label>
                            <div className="mt-1 text-lg font-semibold text-gray-900">{settings?.companyName || 'Not Configured'}</div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                            <h4 className="text-sm font-bold text-gray-900 mb-4">Financial Integration Mapping</h4>

                            <div className="space-y-6">
                                {/* Service Revenue & Tax Defaults */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Service Revenue & Tax Liability (Global)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {/* Revenue */}
                                        {renderAccountSelect("Default Revenue Account (USD)", defaultRevenueUSD, setDefaultRevenueUSD, getAccountsByCurrency(accounts.filter(a => a.type === AccountType.REVENUE), 'USD'))}
                                        {renderAccountSelect("Default Revenue Account (KHR)", defaultRevenueKHR, setDefaultRevenueKHR, getAccountsByCurrency(accounts.filter(a => a.type === AccountType.REVENUE), 'KHR'))}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-3">
                                        {/* Tax */}
                                        {renderAccountSelect("Default Tax Payable (USD)", defaultTaxUSD, setDefaultTaxUSD, getAccountsByCurrency(liabilityAccounts, 'USD'))}
                                        {renderAccountSelect("Default Tax Payable (KHR)", defaultTaxKHR, setDefaultTaxKHR, getAccountsByCurrency(liabilityAccounts, 'KHR'))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 italic">These accounts are used for all products. Tax is only applied if the customer is marked as "Taxable".</p>
                                </div>

                                {/* Customer Wallets */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Customer Wallets (Liability)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Wallet ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={custWalletUSD} onChange={e => setCustWalletUSD(e.target.value)}>
                                                <option value="">-- Select USD Liability --</option>
                                                {getAccountsByCurrency(liabilityAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Wallet (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={custWalletKHR} onChange={e => setCustWalletKHR(e.target.value)}>
                                                <option value="">-- Select KHR Liability --</option>
                                                {getAccountsByCurrency(liabilityAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Driver Wallets (Liability) */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Driver Commission Payable (Liability)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Payable ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverWalletUSD} onChange={e => setDriverWalletUSD(e.target.value)}>
                                                <option value="">-- Select USD Liability --</option>
                                                {getAccountsByCurrency(liabilityAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Payable (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverWalletKHR} onChange={e => setDriverWalletKHR(e.target.value)}>
                                                <option value="">-- Select KHR Liability --</option>
                                                {getAccountsByCurrency(liabilityAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Driver Commission Expense (COGS) */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Driver Commission Expense (COGS)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Expense ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverCommExpUSD} onChange={e => setDriverCommExpUSD(e.target.value)}>
                                                <option value="">-- Select USD Expense --</option>
                                                {getAccountsByCurrency(expenseAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Expense (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverCommExpKHR} onChange={e => setDriverCommExpKHR(e.target.value)}>
                                                <option value="">-- Select KHR Expense --</option>
                                                {getAccountsByCurrency(expenseAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Commission Exchange Rate (USD → KHR)</label>
                                            <input
                                                type="number"
                                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                value={commissionExchangeRate}
                                                onChange={e => setCommissionExchangeRate(Number(e.target.value) || 4100)}
                                                placeholder="4100"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">Used to convert USD commissions to KHR when item COD is in KHR.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Settlement Payout (Money OUT) */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Customer Settlement Payout Asset (Bank/Cash)</h5>
                                    <p className="text-[10px] text-gray-500 mb-3 italic">This is the bank account used when paying out settlements to customers (e.g., COD payouts).</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Settlement Asset ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={customerSettlementBankUSD} onChange={e => setCustomerSettlementBankUSD(e.target.value)}>
                                                <option value="">-- Select USD Asset --</option>
                                                {getAccountsByCurrency(bankAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Settlement Asset (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={customerSettlementBankKHR} onChange={e => setCustomerSettlementBankKHR(e.target.value)}>
                                                <option value="">-- Select KHR Asset --</option>
                                                {getAccountsByCurrency(bankAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Driver Settlement Assets (Clearing) */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Driver Settlement Asset (Internal/Clearing)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Settlement Asset ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverSettlementBankUSD} onChange={e => setDriverSettlementBankUSD(e.target.value)}>
                                                <option value="">-- Select USD Asset --</option>
                                                {getAccountsByCurrency(bankAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Settlement Asset (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverSettlementBankKHR} onChange={e => setDriverSettlementBankKHR(e.target.value)}>
                                                <option value="">-- Select KHR Asset --</option>
                                                {getAccountsByCurrency(bankAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    {/* NEW: Driver Cash Handover */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-xs font-bold text-green-700 mb-1">USD Cash on Hand Asset ($)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverCashAccUSD} onChange={e => setDriverCashAccUSD(e.target.value)}>
                                                <option value="">-- Select USD Cash --</option>
                                                {getAccountsByCurrency(bankAccounts, 'USD').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-700 mb-1">KHR Cash on Hand Asset (៛)</label>
                                            <select className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={driverCashAccKHR} onChange={e => setDriverCashAccKHR(e.target.value)}>
                                                <option value="">-- Select KHR Cash --</option>
                                                {getAccountsByCurrency(bankAccounts, 'KHR').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 italic">Separating Bank/Settlement from Cash Handover allows tracking where the money is currently held.</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Button onClick={handleSaveGeneral} isLoading={savingGeneral} className="text-xs">Save Configuration</Button>
                            </div>
                        </div>

                        {/* Setup & Danger Zone */}
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex justify-between">
                                <Button onClick={onRunSetup} variant="secondary">Re-run Setup Wizard</Button>
                                {onClearData && (
                                    <Button onClick={() => setShowClearConfirm(true)} variant="danger">Clear Data</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* ... (Existing Tabs content maintained: COA, BRANCHES, COMMISSIONS, etc) ... */}
            {activeTab === 'MENU' && <MenuManagement onUpdateMenuItem={onMenuUpdate} />}
            {activeTab === 'REFERRAL' && <ReferralSettings />}
            {activeTab === 'COMMISSIONS' && <DriverCommissionSetup />}

            {/* NEW: Updated Transaction Definitions with Mapping */}
            {activeTab === 'RULES' && (
                <TransactionDefinitions
                    settings={settings}
                    accounts={accounts}
                    onUpdateSettings={onUpdateSettings}
                />
            )}

            {activeTab === 'COA' && (
                <Card
                    title={t('chart_of_accounts')}
                    action={
                        <div className="flex gap-2 items-center">
                            <Button variant="secondary" onClick={() => { setEditingAccount(undefined); setAccountFormOpen(true); }} className="text-xs flex-shrink-0">
                                + {t('add_account')}
                            </Button>

                            {onImportAccounts && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={handleLoadMaster}
                                        disabled={importing}
                                        className="text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                    >
                                        Load Master Data
                                    </Button>
                                    <label className={`cursor-pointer bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        {importing ? 'Importing...' : 'Import CSV'}
                                        <input type="file" accept=".csv, .txt" className="hidden" onChange={handleCsvUpload} disabled={importing} />
                                    </label>
                                </>
                            )}
                        </div>
                    }
                >
                    <AccountList accounts={accounts} transactions={transactions} onEdit={acc => { setEditingAccount(acc); setAccountFormOpen(true); }} onDelete={onDeleteAccount} />
                </Card>
            )}

            {/* ... (Branches, Currencies, Taxes) ... */}
            {activeTab === 'BRANCHES' && (
                <Card title={t('branches')} action={
                    <Button variant="secondary" onClick={() => { setEditingBranch(undefined); setBranchFormOpen(true); }} className="text-xs">+ Add Branch</Button>
                }>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {branches.map(b => (
                                    <tr key={b.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{b.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{b.code}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                            <button onClick={() => { setEditingBranch(b); setBranchFormOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                            {onDeleteBranch && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Delete branch ${b.name}?`)) {
                                                            await onDeleteBranch(b.id);
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {branches.length === 0 && (
                                    <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No branches found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'CURRENCIES' && (
                <Card title={t('currencies')} action={
                    <Button variant="secondary" onClick={() => { setEditingCurrency(undefined); setCurrencyFormOpen(true); }} className="text-xs">+ Add Currency</Button>
                }>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currencies.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.code}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{c.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{c.symbol}</td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-900">{c.exchangeRate}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            <button onClick={() => { setEditingCurrency(c); setCurrencyFormOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'TAXES' && (
                <Card title={t('taxes')} action={
                    <Button variant="secondary" onClick={() => { setEditingTax(undefined); setTaxFormOpen(true); }} className="text-xs">+ Add Tax Rate</Button>
                }>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {taxRates.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900">{t.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{t.code}</td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">{t.rate}%</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            <button onClick={() => { setEditingTax(t); setTaxFormOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                                {taxRates.length === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No tax rates defined.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Confirmation Modal for Clear Data */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    {/* ... (Existing modal content) ... */}
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            <div className="bg-red-100 p-3 rounded-full">
                                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete All Operational Data?</h3>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            This action allows you to restart operations while keeping your system configuration intact.
                            <br />
                            <strong>This action cannot be undone.</strong>
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                                <h4 className="font-bold text-red-800 mb-2 uppercase text-xs">⚠️ Will Be Deleted</h4>
                                <ul className="space-y-1 text-red-700 list-disc list-inside text-xs">
                                    <li>All Financial Transactions</li>
                                    <li>Invoices & Bills</li>
                                    <li>Parcel Bookings & History</li>
                                    <li>Wallet Transactions</li>
                                    <li>Chat & Notifications</li>
                                </ul>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                <h4 className="font-bold text-green-800 mb-2 uppercase text-xs">✅ Will Remain Safe</h4>
                                <ul className="space-y-1 text-green-700 list-disc list-inside text-xs">
                                    <li>User Accounts (Logins)</li>
                                    <li>Customers & Vendors</li>
                                    <li>Chart of Accounts</li>
                                    <li>Employee/Driver Profiles</li>
                                    <li>Branch Configurations</li>
                                    <li>Tax & Currency Settings</li>
                                    <li>Parcel Services & Prices</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={executeClearData}
                                className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                            >
                                Confirm Reset
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
