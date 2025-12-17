
import React, { useState, useEffect } from 'react';
import { UserProfile, Account, Branch, JournalEntry, Customer, Invoice, Vendor, Bill, Employee, StaffLoan, FixedAsset, CurrencyConfig, TaxRate, SystemSettings, UserRole, Permission, NavigationItem } from './types';
import { firebaseService } from './services/firebaseService';
import { AuthForms } from './components/AuthForms';
import { PendingApproval } from './components/PendingApproval';
import { OnboardingWizard } from './components/setup/OnboardingWizard';
import { Dashboard } from './components/Dashboard';
import { JournalEntryList } from './components/JournalEntryList';
import { JournalEntryForm } from './components/JournalEntryForm';
import { ReceivablesDashboard } from './components/receivables/ReceivablesDashboard';
import { PayablesDashboard } from './components/payables/PayablesDashboard';
import { BankingDashboard } from './components/banking/BankingDashboard';
import { StaffLoansDashboard } from './components/staff/StaffLoansDashboard';
import { FixedAssetsDashboard } from './components/fixed_assets/FixedAssetsDashboard';
import { ParcelsDashboard } from './components/parcels/ParcelsDashboard';
import { ParcelBookingForm } from './components/parcels/ParcelBookingForm';
import { ParcelList } from './components/parcels/ParcelList';
import { DispatchConsole } from './components/parcels/DispatchConsole';
import { WarehouseOperations } from './components/parcels/WarehouseOperations';
import { DriverManagement } from './components/parcels/DriverManagement';
import { ParcelOperations } from './components/parcels/ParcelOperations';
import { PlaceManagement } from './components/parcels/PlaceManagement';
import { ParcelServiceSetup } from './components/parcels/ParcelServiceSetup';
import { InTransitAgingReport } from './components/reports/InTransitAgingReport';
import { CustomerRetentionReport } from './components/reports/CustomerRetentionReport';
import { Reports } from './components/Reports';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { SettingsDashboard } from './components/settings/SettingsDashboard';
import { UserList } from './components/UserList';
import { UserProfileView } from './components/UserProfile';
import { UserManual } from './components/UserManual';
import { ClosingDashboard } from './components/closing/ClosingDashboard';
import { CustomerLayout } from './components/customer/CustomerLayout';
import { DriverLayout } from './components/driver/DriverLayout';
import { ROLE_PERMISSIONS, DEFAULT_NAVIGATION } from './constants';
import { NotificationBell } from './components/ui/NotificationBell';
import { useLanguage } from './contexts/LanguageContext';
import { LanguageSwitcher } from './components/ui/LanguageSwitcher';
import { LandingPage } from './components/LandingPage';
import { MenuIcon } from './components/ui/MenuIcon';
import { toast } from './src/shared/utils/toast';
import { usePermissions } from './contexts/PermissionsContext';

function App() {
    const { t } = useLanguage();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('DASHBOARD');

    // Auth & Landing State
    const [viewState, setViewState] = useState<'LANDING' | 'AUTH' | 'APP'>('LANDING');
    const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>('LOGIN');

    // Specific sub-view for Parcels
    const [parcelSubView, setParcelSubView] = useState('LIST');
    const [logisticsMenuOpen, setLogisticsMenuOpen] = useState(false);

    // Data State
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

    // Navigation Menu
    const [menuItems, setMenuItems] = useState<NavigationItem[]>([]);

    // Permission State
    const { setPermissions, hasPermission } = usePermissions();


    const [editingTransaction, setEditingTransaction] = useState<JournalEntry | undefined>(undefined);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);

    useEffect(() => {
        // Safety timer to force loading state off if auth hangs
        const safetyTimer = setTimeout(() => {
            if (loading) {
                setLoading(false);
                if (!user && viewState === 'LANDING') {
                    // Stay on landing
                }
            }
        }, 5000);

        const unsubscribe = firebaseService.subscribeToAuth((u) => {
            setUser(u);
            if (u) {
                setViewState('APP'); // User found, go to app
            } else {
                setViewState(prev => prev === 'AUTH' ? 'AUTH' : 'LANDING');
            }
            setLoading(false);
            clearTimeout(safetyTimer);
        });
        return () => {
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    const loadData = async () => {
        if (!user) return;
        if (user.role === 'customer' || user.role === 'driver') return;

        // Determine if user is allowed to see financial data
        const isFinancialUser = ['system-admin', 'accountant', 'finance-manager'].includes(user.role);

        try {
            // 1. Fetch Configuration & Shared Data (Safe for all internal roles)
            const settingsPromise = firebaseService.getSettings().catch(() => ({}));

            const [sts, accs, brs, currs, taxes, perms, emps, custs, menu] = await Promise.all([
                settingsPromise,
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
            if (perms && Object.keys(perms).length > 0) setPermissions(perms as Record<UserRole, Permission[]>);
            setEmployees(emps);
            setCustomers(custs);

            // Force re-seed menu from local constants to Firebase
            // This ensures Firebase always has the latest menu structure
            if (user.role === 'system-admin') {
                // Check if menu exists, if zero items, seed defaults
                const existingMenu = await firebaseService.getMenuItems();
                if (!existingMenu || existingMenu.length === 0) {
                    console.log('🔄 Seeding default menu (first run)...');
                    await firebaseService.seedDefaultMenu();
                    setMenuItems(DEFAULT_NAVIGATION);
                } else {
                    setMenuItems(existingMenu);
                }
            } else {
                // Non-admin: Load from Firebase or use defaults
                const menu = await firebaseService.getMenuItems();
                setMenuItems(menu.length > 0 ? menu : DEFAULT_NAVIGATION);
            }

            // 2. Fetch Financial Data (Only for authorized roles)
            if (isFinancialUser) {
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
            } else {
                // Ensure state is clear for non-finance users to avoid stale data
                setTransactions([]);
                setInvoices([]);
                setVendors([]);
                setBills([]);
                setLoans([]);
            }

        } catch (e) {
            console.error("Critical failure in loadData", e);
            // Fallback menu even in critical failure
            setMenuItems(DEFAULT_NAVIGATION);
        }
    };

    useEffect(() => {
        if (user?.status !== 'PENDING') {
            loadData();
        }
    }, [user]);

    const handleLogin = async (data: any) => {
        await firebaseService.login(data.email, data.password);
    };

    const handleRegister = async (data: any) => {
        await firebaseService.register(data.email, data.password, data.name, data);
    };

    const handleLogout = async () => {
        try {
            await firebaseService.logout();
        } catch (e) {
            console.error("Logout error", e);
        }
        setUser(null);
        setViewState('LANDING');
        setAuthMode('LOGIN');
    };

    const hasAccess = (featureKey: Permission) => {
        return hasPermission(user, featureKey);
    };

    const navigateToParcel = (subView: string) => {
        setActiveView('PARCELS');
        setParcelSubView(subView);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">{t('loading')}</div>;

    if (!user) {
        if (viewState === 'LANDING') {
            return (
                <LandingPage
                    onLogin={() => { setAuthMode('LOGIN'); setViewState('AUTH'); }}
                    onRegister={() => { setAuthMode('REGISTER'); setViewState('AUTH'); }}
                />
            );
        }

        if (viewState === 'AUTH') {
            return (
                <AuthForms
                    mode={authMode}
                    onSubmit={async (data) => {
                        if (authMode === 'LOGIN') await handleLogin(data);
                        else if (authMode === 'REGISTER') await handleRegister(data);
                        else await firebaseService.resetPassword(data.email);
                    }}
                    onModeChange={setAuthMode}
                    onBack={() => setViewState('LANDING')}
                />
            );
        }
    }

    if (!user) return null;

    if (user.status === 'PENDING') {
        return <PendingApproval onLogout={handleLogout} userName={user.name} />;
    }


    if (!settings.setupComplete && user.role === 'system-admin') {
        return <OnboardingWizard onComplete={async (s, a, b, r) => {
            await firebaseService.initializeCompanyData(s, a, b, r);
            loadData();
        }} />;
    }

    // Filter menu items for current user based on role AND permissions
    const visibleMenuItems = menuItems.filter(item => {
        // Must be in allowed roles
        if (!item.allowedRoles.includes(user.role)) return false;

        // If item requires a specific permission, check if user has it
        if (item.requiredPermission) {
            return hasPermission(user, item.requiredPermission);
        }

        // No permission required, show to all allowed roles
        return true;
    }).sort((a, b) => {
        // Sort by Section Priority first
        // Priority: undefined/null (Finance) -> Logistics -> Reports -> System -> Others
        const getSectionPriority = (sec?: string) => {
            const s = (sec || '').toLowerCase();
            if (!s) return 0; // Finance / Dashboard
            if (s === 'logistics') return 10;
            if (s === 'reports') return 20;
            if (s === 'system') return 90;
            return 50; // Other custom sections
        };

        const priorityA = getSectionPriority(a.section);
        const priorityB = getSectionPriority(b.section);

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // Secondary sort: Order
        return a.order - b.order;
    });

    return (
        <div className="flex h-screen bg-gray-100">
            <div className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 shadow-xl z-20">
                <div className="p-4 flex items-center space-x-3 border-b border-slate-800">
                    <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/50">D</div>
                    <span className="font-bold text-lg truncate tracking-tight">{settings.companyName || 'Doorstep (DEBUG)'}</span>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                    {/* DEBUG: List active sections */}
                    {/* {Array.from(new Set(visibleMenuItems.map(i => i.section))).join(', ')} */}

                    {visibleMenuItems.map((item, index) => {
                        const prevItem = index > 0 ? visibleMenuItems[index - 1] : null;
                        // Compare sections case-insensitively? No, they are IDs/keys usually.
                        // But let's assume strict equality for creating a NEW header block.
                        const showSectionHeader = item.section && (!prevItem || prevItem.section !== item.section);

                        return (
                            <React.Fragment key={item.id}>
                                {/* Section Header */}
                                {showSectionHeader && (
                                    <div className="pt-4 pb-2 px-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        {item.section?.toLowerCase() === 'system' ? t('system') : item.section}
                                    </div>
                                )}

                                {/* Menu Item */}
                                <button
                                    onClick={() => setActiveView(item.viewId)}
                                    className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${activeView === item.viewId
                                        ? 'bg-slate-800 border-l-4 border-red-600 text-white'
                                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                        } ${item.section?.toLowerCase() === 'logistics' ? 'pl-8' : ''}`}
                                >
                                    <span className="mr-3"><MenuIcon iconKey={item.iconKey} className="w-4 h-4" /></span>
                                    {
                                        // @ts-ignore
                                        t(item.label)
                                    }
                                </button>
                            </React.Fragment>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900 text-[10px] text-slate-500 font-mono h-40 overflow-y-auto">
                    <p className="font-bold text-white mb-1">Debug Info</p>
                    <p>User Role: {user.role}</p>
                    <div className="space-y-1 mt-2">
                        {visibleMenuItems.map(i => (
                            <div key={i.id} className="flex justify-between border-b border-slate-800 pb-0.5">
                                <span className="truncate w-20">{t(i.label)}</span>
                                <span className="text-yellow-500">{i.section || 'None'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <button onClick={() => setActiveView('PROFILE')} className="flex items-center w-full text-left group">
                        <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-red-500 transition-colors shadow-md">
                            {user.name.charAt(0)}
                        </div>
                        <div className="ml-3 flex-1 overflow-hidden">
                            <div className="text-sm font-medium truncate text-white group-hover:text-red-200 transition-colors">{user.name}</div>
                            <div className="text-xs text-slate-400 truncate">{(user.role || '').replace('-', ' ')}</div>
                        </div>
                    </button>
                    <button onClick={handleLogout} className="mt-3 w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-1 hover:bg-slate-800 rounded">
                        {t('signOut')}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
                <header className="bg-white border-b border-gray-200 px-8 py-3 flex justify-between items-center shadow-sm">
                    <h2 className="text-lg font-bold text-gray-800 capitalize">
                        {activeView === 'PARCELS' ? 'Logistics Management' : (activeView || 'Dashboard').replace('_', ' ').toLowerCase()}
                    </h2>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <NotificationBell user={user} />
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="text-xs text-right hidden sm:block">
                            <div className="font-bold text-gray-900">{user.name}</div>
                            <div className="text-gray-500">{user.role}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {activeView === 'DASHBOARD' && <Dashboard transactions={transactions} accounts={accounts} branches={branches} />}
                    {activeView === 'ANALYTICS' && <AnalyticsDashboard accounts={accounts} transactions={transactions} invoices={invoices} bills={bills} />}
                    {activeView === 'JOURNAL' && (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-2xl font-bold text-gray-800">General Journal</h1>
                                {hasAccess('CREATE_JOURNAL') && (
                                    <button
                                        onClick={() => { setEditingTransaction(undefined); setIsTransactionFormOpen(true); }}
                                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                                    >
                                        + New Entry
                                    </button>
                                )}
                            </div>
                            {isTransactionFormOpen ? (
                                <JournalEntryForm
                                    accounts={accounts}
                                    branches={branches}
                                    currencies={currencies}
                                    initialData={editingTransaction}
                                    onSubmit={async (entry) => {
                                        if (editingTransaction) await firebaseService.updateTransaction(entry);
                                        else await firebaseService.addTransaction(entry);
                                        await loadData();
                                        setIsTransactionFormOpen(false);
                                    }}
                                    onCancel={() => setIsTransactionFormOpen(false)}
                                />
                            ) : (
                                <JournalEntryList
                                    transactions={transactions}
                                    accounts={accounts}
                                    branches={branches}
                                    onEdit={(t) => { setEditingTransaction(t); setIsTransactionFormOpen(true); }}
                                    onDeleteBatch={async (ids) => {
                                        await firebaseService.deleteTransactions(ids);
                                        await loadData();
                                    }}
                                    onViewRelated={(id) => toast.info("Navigate to source module to view details: " + id)}
                                />
                            )}
                        </>
                    )}
                    {activeView === 'RECEIVABLES' && (
                        <ReceivablesDashboard
                            invoices={invoices}
                            customers={customers}
                            accounts={accounts}
                            branches={branches}
                            currencies={currencies}
                            taxRates={taxRates}
                            onCreateInvoice={async (inv) => { await firebaseService.createInvoice(inv); await loadData(); }}
                            onAddCustomer={async (c) => { await firebaseService.addCustomer(c); await loadData(); }}
                            onUpdateCustomer={async (c) => { await firebaseService.updateCustomer(c); await loadData(); }}
                            onReceivePayment={async (id, amt, acc) => {
                                await firebaseService.recordPayment({
                                    id: `pay-${Date.now()}`,
                                    invoiceId: id,
                                    amount: amt,
                                    date: new Date().toISOString().split('T')[0],
                                    depositAccountId: acc
                                });
                                await loadData();
                            }}
                        />
                    )}
                    {activeView === 'PAYABLES' && (
                        <PayablesDashboard
                            bills={bills}
                            vendors={vendors}
                            accounts={accounts}
                            branches={branches}
                            currencies={currencies}
                            onCreateBill={async (b) => { await firebaseService.createBill(b); await loadData(); }}
                            onAddVendor={async (v) => { await firebaseService.addVendor(v); await loadData(); }}
                            onUpdateVendor={async (v) => { await firebaseService.updateVendor(v); await loadData(); }}
                            onRecordPayment={async (bid, amt, acc, date, ref) => {
                                await firebaseService.recordBillPayment({
                                    id: `bpay-${Date.now()}`,
                                    billId: bid,
                                    amount: amt,
                                    paymentAccountId: acc,
                                    date,
                                    reference: ref
                                });
                                await loadData();
                            }}
                            onSaveTransaction={async (entry) => { await firebaseService.addTransaction(entry); await loadData(); }}
                            onGetBillPayments={(bid) => firebaseService.getBillPayments(bid)}
                        />
                    )}
                    {activeView === 'BANKING' && (
                        <BankingDashboard
                            accounts={accounts}
                            transactions={transactions}
                            branches={branches}
                            currencies={currencies}
                            onTransfer={async (entry) => { await firebaseService.addTransaction(entry); await loadData(); }}
                            onAddAccount={async (acc) => { await firebaseService.addAccount(acc); await loadData(); }}
                        />
                    )}
                    {activeView === 'STAFF' && (
                        <StaffLoansDashboard
                            loans={loans}
                            employees={employees}
                            accounts={accounts}
                            branches={branches}
                            currencies={currencies}
                            transactions={transactions}
                            onCreateLoan={async (l) => { await firebaseService.createStaffLoan(l); await loadData(); }}
                            onRepayLoan={async (r) => { await firebaseService.recordStaffLoanRepayment(r); await loadData(); }}
                            onAddEmployee={async (e) => { await firebaseService.addEmployee(e); await loadData(); }}
                            onUpdateEmployee={async (e) => { await firebaseService.updateEmployee(e); await loadData(); }}
                            onSaveTransaction={async (e) => { await firebaseService.addTransaction(e); await loadData(); }}
                        />
                    )}
                    {activeView === 'ASSETS' && <FixedAssetsDashboard accounts={accounts} branches={branches} />}

                    {/* Granular Logistics Views */}
                    {activeView === 'PARCELS_BOOKING' && (
                        <ParcelBookingForm
                            services={[]}
                            branches={branches}
                            accounts={accounts}
                            customers={customers}
                            taxRates={taxRates}
                            onComplete={() => setActiveView('PARCELS_LIST')}
                        />
                    )}
                    {activeView === 'PARCELS_LIST' && <ParcelList />}
                    {activeView === 'PARCELS_OPERATIONS' && <ParcelOperations />}
                    {activeView === 'PARCELS_DISPATCH' && <DispatchConsole />}
                    {activeView === 'PARCELS_WAREHOUSE' && <WarehouseOperations />}
                    {activeView === 'PARCELS_FLEET' && <DriverManagement branches={branches} />}
                    {activeView === 'PARCELS_PLACES' && <PlaceManagement />}
                    {activeView === 'PARCELS_CONFIG' && <ParcelServiceSetup accounts={accounts} taxRates={taxRates} onBookService={(sid) => setActiveView('PARCELS_BOOKING')} />}
                    {activeView === 'PARCELS_AGING' && <InTransitAgingReport />}
                    {activeView === 'PARCELS_RETENTION' && <CustomerRetentionReport />}

                    {/* Legacy PARCELS view - kept for backward compatibility */}
                    {activeView === 'PARCELS' && (
                        <ParcelsDashboard
                            accounts={accounts}
                            branches={branches}
                            customers={customers}
                            taxRates={taxRates}
                            initialView={parcelSubView}
                        />
                    )}
                    {activeView === 'REPORTS' && <Reports transactions={transactions} accounts={accounts} branches={branches} />}
                    {activeView === 'CLOSING' && (
                        <ClosingDashboard
                            settings={settings}
                            accounts={accounts}
                            transactions={transactions}
                            branches={branches}
                            currencies={currencies}
                            invoices={invoices}
                            bills={bills}
                            onUpdateSettings={async (s) => { await firebaseService.updateSettings(s); await loadData(); }}
                            onPostClosingEntry={async (entry) => { await firebaseService.addTransaction(entry); await loadData(); }}
                            onDeleteAccount={async (id) => { await firebaseService.deleteAccount(id); await loadData(); }}
                        />
                    )}
                    {activeView === 'SETTINGS' && (
                        <SettingsDashboard
                            settings={settings}
                            accounts={accounts}
                            branches={branches}
                            currencies={currencies}
                            taxRates={taxRates}
                            transactions={transactions}
                            onAddAccount={async (a) => { await firebaseService.addAccount(a); await loadData(); }}
                            onUpdateAccount={async (a) => { await firebaseService.updateAccount(a); await loadData(); }}
                            onDeleteAccount={async (id) => { await firebaseService.deleteAccount(id); await loadData(); }}
                            onAddBranch={async (b) => { await firebaseService.addBranch(b); await loadData(); }}
                            onUpdateBranch={async (b) => { await firebaseService.updateBranch(b); await loadData(); }}
                            onDeleteBranch={async (id) => { await firebaseService.deleteBranch(id); await loadData(); }}
                            onAddCurrency={async (c) => { await firebaseService.addCurrency(c); await loadData(); }}
                            onUpdateCurrency={async (c) => { await firebaseService.updateCurrency(c); await loadData(); }}
                            onAddTaxRate={async (t) => { await firebaseService.addTaxRate(t); await loadData(); }}
                            onUpdateTaxRate={async (t) => { await firebaseService.updateTaxRate(t); await loadData(); }}
                            onRunSetup={() => setSettings({ ...settings, setupComplete: false })}
                            onUpdateSettings={async (s) => { await firebaseService.updateSettings(s); await loadData(); }}
                            onClearData={async () => {
                                setLoading(true);
                                try {
                                    await firebaseService.clearFinancialAndLogisticsData();
                                    await loadData();
                                    toast.success("Data cleared successfully.");
                                } catch (e) {
                                    console.error(e);
                                    toast.error("Failed to clear data.");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                    )}
                    {activeView === 'USERS' && (
                        <UserListWrapper currentUser={user} branches={branches} />
                    )}
                    {activeView === 'PROFILE' && (
                        <UserProfileView
                            user={user}
                            onUpdateProfile={async (name) => { await firebaseService.updateUserProfile(name); await loadData(); }}
                        />
                    )}
                    {activeView === 'MANUAL' && <UserManual />}
                </div>
            </div>
        </div>
    );
}

const UserListWrapper = ({ currentUser, branches }: { currentUser: UserProfile, branches: Branch[] }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const { permissions, setPermissions } = usePermissions();

    useEffect(() => {
        firebaseService.getUsers().then(setUsers);
        // Permissions are loaded by Context
    }, []);

    const refreshUsers = async () => {
        const u = await firebaseService.getUsers();
        setUsers(u);
    };

    return (
        <UserList
            users={users}
            branches={branches}
            rolePermissions={permissions}
            onUpdateRole={async (uid, role) => { await firebaseService.updateUserRole(uid, role); await refreshUsers(); }}
            onUpdateStatus={async (uid, status) => { await firebaseService.updateUserStatus(uid, status); await refreshUsers(); }}
            onUpdateProfile={async (uid, name, extra) => { await firebaseService.configService.updateUserProfile(uid, name, extra); await refreshUsers(); }}
            onUpdatePermissions={async (perms) => { await firebaseService.updateRolePermissions(perms); setPermissions(perms); }}
        />
    );
};

export default App;
