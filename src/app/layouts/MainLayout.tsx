import { Outlet } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';
import { NotificationBell } from '../../../components/ui/NotificationBell';
import { LanguageSwitcher } from '../../../components/ui/LanguageSwitcher';
import { Sidebar } from './Sidebar';
import { useState } from 'react';

/**
 * Main application layout with sidebar and header
 * Used for internal users (non-customer, non-driver)
 */
export default function MainLayout() {
    const { user, logout } = useAuth();
    const { menuItems } = useData();
    const { t } = useLanguage();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Mobile Sidebar Backdrop */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 backdrop-blur-sm md:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            <Sidebar
                menuItems={menuItems}
                user={user}
                onLogout={logout}
                isMobileOpen={isMobileSidebarOpen}
                onMobileClose={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0 bg-gray-50 transition-all duration-300">
                <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-3 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button (Mobile Only) */}
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-2 -ml-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none md:hidden"
                        >
                            <span className="sr-only">Open sidebar</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        <h2 className="text-lg font-bold text-gray-800 capitalize hidden sm:block">
                            {/* Page title will be set by individual routes */}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <NotificationBell user={user} />
                        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                        <div className="text-xs text-right hidden sm:block">
                            <div className="font-bold text-gray-900">{user.name}</div>
                            <div className="text-gray-500">{user.role}</div>
                        </div>
                    </div>
                </header>

                <div className={`flex-1 p-4 sm:p-8 ${isMobileSidebarOpen ? 'overflow-hidden' : 'overflow-auto'}`}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
