
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Customer, Permission } from '../../types';
import { CustomerDashboard } from './CustomerDashboard';
import { CustomerProfile } from './CustomerProfile';
import { CustomerBooking } from './CustomerBooking';
import { CustomerSummaryReport } from './CustomerSummaryReport';
import { NotificationBell } from '../ui/NotificationBell';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { WalletDashboard } from '../wallet/WalletDashboard';
import { firebaseService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { PublicTracker } from '../tracking/PublicTracker';
import { usePermissions } from '../../contexts/PermissionsContext';

interface Props {
    user: UserProfile;
    onLogout: () => void;
}

type ViewState = 'DASHBOARD' | 'PROFILE' | 'BOOKING' | 'REPORTS' | 'WALLET';

interface NavItem {
    id: ViewState;
    permission: Permission;
    label: string;
    icon: JSX.Element;
}

export const CustomerLayout: React.FC<Props> = ({ user, onLogout }) => {
    const { t } = useLanguage();
    const { hasPermission } = usePermissions();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDeactivated, setIsDeactivated] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Tracker Modal State
    const [showTracker, setShowTracker] = useState(false);

    // Check linked customer status
    useEffect(() => {
        const checkStatus = async () => {
            if (user.linkedCustomerId) {
                try {
                    const cust = await firebaseService.getDocument('customers', user.linkedCustomerId) as Customer | null;
                    if (cust && cust.status === 'INACTIVE') {
                        setIsDeactivated(true);
                    }
                } catch (e) {
                    console.error("Failed to check customer status", e);
                }
            }
            setCheckingStatus(false);
        };
        checkStatus();
    }, [user]);

    // Define all possible nav items with their required permissions
    const allNavItems: NavItem[] = useMemo(() => [
        {
            id: 'DASHBOARD',
            permission: 'CUSTOMER_VIEW_DASHBOARD',
            label: t('dashboard'),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            id: 'WALLET',
            permission: 'CUSTOMER_ACCESS_WALLET',
            label: t('wallet'),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            )
        },
        {
            id: 'BOOKING',
            permission: 'CUSTOMER_CREATE_BOOKING',
            label: t('new_booking'),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
            )
        },
        {
            id: 'REPORTS',
            permission: 'CUSTOMER_VIEW_REPORTS',
            label: t('delivery_reports'),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        },
        {
            id: 'PROFILE',
            permission: 'CUSTOMER_MANAGE_PROFILE',
            label: t('my_profile'),
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )
        }
    ], [t]);

    // Filter nav items based on permissions
    const navItems = useMemo(() =>
        allNavItems.filter(item => hasPermission(user, item.permission)),
        [allNavItems, user, hasPermission]
    );

    // Set default view to first available item, fallback to PROFILE
    const [view, setView] = useState<ViewState>(navItems[0]?.id || 'PROFILE');

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleNavigation = (newView: ViewState) => {
        setView(newView);
        setIsSidebarOpen(false); // Close sidebar on mobile after click
    };

    if (checkingStatus) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">{t('loading')}</div>;
    }

    if (isDeactivated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full text-center border-t-4 border-red-600 shadow-xl p-8">
                    <div className="flex justify-center mb-6">
                        <div className="bg-red-50 p-6 rounded-full animate-pulse">
                            <svg className="w-16 h-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Suspended</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Your customer account has been deactivated. You cannot access the booking system or view your history.
                        <br /><br />
                        Please contact support to reactivate your account.
                    </p>
                    <button onClick={onLogout} className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium">
                        {t('signOut')}
                    </button>
                </Card>
            </div>
        );
    }

    // If no features are available, show a message
    if (navItems.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center shadow-xl p-8">
                    <div className="mb-4">
                        <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">No Access</h2>
                    <p className="text-gray-600 mb-6">
                        You don't have access to any customer features. Please contact your administrator.
                    </p>
                    <button onClick={onLogout} className="w-full py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium">
                        {t('signOut')}
                    </button>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">

            {/* --- MOBILE SIDEBAR BACKDROP --- */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* --- SIDEBAR --- */}
            <aside className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:relative md:translate-x-0
        `}>
                {/* Brand */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
                    <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/50 mr-3">D</div>
                    <span className="text-lg font-bold tracking-tight">Doorstep</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigation(item.id)}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${view === item.id
                                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <span className={`mr-3 transition-colors ${view === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                {item.icon}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950">
                    <div className="flex items-center mb-4">
                        <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white border border-slate-600">
                            {user.name.charAt(0)}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            <p className="text-xs text-slate-400 truncate">Customer Account</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className="w-full py-2 px-4 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center hover:border-slate-600"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {t('signOut')}
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT WRAPPER --- */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* --- TOP NAVBAR --- */}
                <header className="h-16 bg-white border-b border-gray-200 flex justify-between items-center px-4 sm:px-6 lg:px-8 shadow-sm z-20 relative">
                    <div className="flex items-center">
                        {/* Hamburger Button */}
                        <button
                            onClick={toggleSidebar}
                            className="p-2 -ml-2 mr-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none md:hidden"
                        >
                            <span className="sr-only">Open sidebar</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
                            {view === 'DASHBOARD' && t('dashboard')}
                            {view === 'BOOKING' && t('new_booking')}
                            {view === 'PROFILE' && t('my_profile')}
                            {view === 'REPORTS' && t('delivery_reports')}
                            {view === 'WALLET' && t('my_wallet')}
                        </h1>
                    </div>

                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <button
                            onClick={() => setShowTracker(true)}
                            className="hidden md:flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            Track Shipment
                        </button>

                        <LanguageSwitcher />
                        <NotificationBell user={user} />

                        <div className="hidden sm:flex items-center">
                            <div className="h-8 w-px bg-gray-200 mx-4"></div>
                            <div className="text-right mr-3">
                                <div className="text-xs text-gray-500">Signed in as</div>
                                <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{user.email}</div>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                                {user.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* --- SCROLLABLE CONTENT AREA --- */}
                <main className="flex-1 overflow-y-auto focus:outline-none bg-gray-50 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto">
                        {view === 'DASHBOARD' && hasPermission(user, 'CUSTOMER_VIEW_DASHBOARD') && <CustomerDashboard user={user} onNewBooking={() => handleNavigation('BOOKING')} />}
                        {view === 'PROFILE' && hasPermission(user, 'CUSTOMER_MANAGE_PROFILE') && <CustomerProfile user={user} />}
                        {view === 'BOOKING' && hasPermission(user, 'CUSTOMER_CREATE_BOOKING') && <CustomerBooking user={user} onComplete={() => handleNavigation('DASHBOARD')} />}
                        {view === 'REPORTS' && hasPermission(user, 'CUSTOMER_VIEW_REPORTS') && <CustomerSummaryReport user={user} />}
                        {view === 'WALLET' && hasPermission(user, 'CUSTOMER_ACCESS_WALLET') && <WalletDashboard user={user} />}
                    </div>
                </main>
            </div>

            {/* Global Tracker Modal */}
            {showTracker && <PublicTracker onClose={() => setShowTracker(false)} />}
        </div>
    );
};
