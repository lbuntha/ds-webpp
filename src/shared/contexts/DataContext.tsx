import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    Account,
    Branch,
    JournalEntry,
    Customer,
    Invoice,
    Vendor,
    Bill,
    Employee,
    StaffLoan,
    CurrencyConfig,
    TaxRate,
    SystemSettings,
    UserRole,
    Permission,
    NavigationItem
} from '../types';
import { firebaseService } from '../services/firebaseService';
import { ROLE_PERMISSIONS, DEFAULT_NAVIGATION } from '../constants';

interface DataContextValue {
    // Settings & Config
    settings: SystemSettings;
    branches: Branch[];
    currencies: CurrencyConfig[];
    taxRates: TaxRate[];
    menuItems: NavigationItem[];
    rolePermissions: Record<UserRole, Permission[]>;

    // Financial Data
    accounts: Account[];
    transactions: JournalEntry[];
    customers: Customer[];
    invoices: Invoice[];
    vendors: Vendor[];
    bills: Bill[];
    employees: Employee[];
    loans: StaffLoan[];

    // Loading State
    loading: boolean;
    error: Error | null;

    // Actions
    refreshData: () => Promise<void>;
    refreshFinancialData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children, userRole }: { children: ReactNode; userRole?: UserRole }) {
    const [settings, setSettings] = useState<SystemSettings>({});
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [transactions, setTransactions] = useState<JournalEntry[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loans, setLoans] = useState<StaffLoan[]>([]);
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
    const [menuItems, setMenuItems] = useState<NavigationItem[]>([]);
    const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(ROLE_PERMISSIONS);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refreshFinancialData = async () => {
        if (!userRole) return;

        const isFinancialUser = ['system-admin', 'accountant', 'finance-manager'].includes(userRole);

        if (isFinancialUser) {
            try {
                const [txns, invs, vends, bls, lns] = await Promise.all([
                    firebaseService.getTransactions().catch(() => []),
                    firebaseService.getInvoices().catch(() => []),
                    firebaseService.getVendors().catch(() => []),
                    firebaseService.getBills().catch(() => []),
                    firebaseService.getStaffLoans().catch(() => [])
                ]);

                setTransactions(txns);
                setInvoices(invs);
                setVendors(vends);
                setBills(bls);
                setLoans(lns);
            } catch (e) {
                console.error('Error loading financial data:', e);
            }
        } else {
            // Clear financial data for non-finance users
            setTransactions([]);
            setInvoices([]);
            setVendors([]);
            setBills([]);
            setLoans([]);
        }
    };

    const refreshData = async () => {
        if (!userRole || userRole === 'customer' || userRole === 'driver') {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Load configuration and shared data
            const [sts, accs, brs, currs, taxes, perms, emps, custs, menu] = await Promise.all([
                firebaseService.getSettings().catch(() => ({})),
                firebaseService.getAccounts().catch(() => []),
                firebaseService.getBranches().catch(() => []),
                firebaseService.getCurrencies().catch(() => []),
                firebaseService.getTaxRates().catch(() => []),
                firebaseService.getRolePermissions().catch(() => ({})),
                firebaseService.getEmployees().catch(() => []),
                firebaseService.getCustomers().catch(() => []),
                firebaseService.getMenuItems().catch(() => [])
            ]);

            setSettings(sts as SystemSettings);
            setAccounts(accs);
            setBranches(brs);
            setCurrencies(currs);
            setTaxRates(taxes);
            if (perms && Object.keys(perms).length > 0) {
                setRolePermissions(perms as Record<UserRole, Permission[]>);
            }
            setEmployees(emps);
            setCustomers(custs);

            // Handle menu items
            if (!menu || menu.length === 0) {
                if (userRole === 'system-admin') {
                    try {
                        await firebaseService.seedDefaultMenu();
                        const seededMenu = await firebaseService.getMenuItems();
                        setMenuItems(seededMenu.length > 0 ? seededMenu : DEFAULT_NAVIGATION);
                    } catch (seedError) {
                        console.warn('Menu seeding failed, using fallback', seedError);
                        setMenuItems(DEFAULT_NAVIGATION);
                    }
                } else {
                    setMenuItems(DEFAULT_NAVIGATION);
                }
            } else {
                setMenuItems(menu);
            }

            // Load financial data if authorized
            await refreshFinancialData();

        } catch (e) {
            console.error('Critical failure in loadData', e);
            setError(e as Error);
            setMenuItems(DEFAULT_NAVIGATION);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userRole && userRole !== 'customer' && userRole !== 'driver') {
            refreshData();
        } else {
            setLoading(false);
        }
    }, [userRole]);

    const value: DataContextValue = {
        settings,
        branches,
        currencies,
        taxRates,
        menuItems,
        rolePermissions,
        accounts,
        transactions,
        customers,
        invoices,
        vendors,
        bills,
        employees,
        loans,
        loading,
        error,
        refreshData,
        refreshFinancialData,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
