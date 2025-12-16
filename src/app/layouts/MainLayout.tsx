import { Outlet } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';
import { NotificationBell } from '../../components/ui/NotificationBell';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import { Sidebar } from './Sidebar';

/**
 * Main application layout with sidebar and header
 * Used for internal users (non-customer, non-driver)
 */
export default function MainLayout() {
    const { user, logout } = useAuth();
    const { menuItems } = useData();
    const { t } = useLanguage();

    if (!user) return null;

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar
                menuItems={menuItems}
                user={user}
                onLogout={logout}
            />

            <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
                <header className="bg-white border-b border-gray-200 px-8 py-3 flex justify-between items-center shadow-sm">
                    <h2 className="text-lg font-bold text-gray-800 capitalize">
                        {/* Page title will be set by individual routes */}
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
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
