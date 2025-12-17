import { Link, useLocation } from 'react-router-dom';
import { UserProfile, NavigationItem } from '../../shared/types';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';
import { useUserPermissions } from '../../shared/hooks/usePermissions';
import { MenuIcon } from '../../../components/ui/MenuIcon';
import { useMemo } from 'react';

interface SidebarProps {
    menuItems: NavigationItem[];
    user: UserProfile;
    onLogout: () => void;
}

export function Sidebar({ menuItems, user, onLogout }: SidebarProps) {
    const location = useLocation();
    const { settings } = useData();
    const { t } = useLanguage();
    const userPermissions = useUserPermissions();

    // Filter AND SORT menu items based on permissions
    const filteredMenuItems = useMemo(() => {
        const filtered = menuItems.filter(item => {
            // System admin gets everything
            if (user.role === 'system-admin') return true;

            // Strict Access Control
            const hasRole = item.allowedRoles && item.allowedRoles.length > 0 && item.allowedRoles.includes(user.role);
            const hasPermission = item.requiredPermission && userPermissions.includes(item.requiredPermission);

            // If item has NO restrictions, it's hidden (following original logic).
            // Item must match EITHER role OR permission if both are present? 
            // Original logic:
            // Check Role Constraint
            if (item.allowedRoles && item.allowedRoles.length > 0) {
                if (!item.allowedRoles.includes(user.role)) return false;
            }
            // Check Permission Constraint
            if (item.requiredPermission) {
                if (!userPermissions.includes(item.requiredPermission)) return false;
            }

            // Ensure at least one constraint existed
            const hasConstraints = (item.allowedRoles && item.allowedRoles.length > 0) || item.requiredPermission;
            if (!hasConstraints) return false;

            return true;
        });

        // SORTING LOGIC
        const getSectionPriority = (sec?: string) => {
            const s = (sec || '').toLowerCase();
            if (!s) return 0; // Finance / Dashboard
            if (s === 'logistics') return 10;
            if (s === 'reports') return 20;
            if (s === 'system') return 90;
            return 50;
        };

        return filtered.sort((a, b) => {
            const priorityA = getSectionPriority(a.section);
            const priorityB = getSectionPriority(b.section);
            if (priorityA !== priorityB) return priorityA - priorityB;
            return a.order - b.order;
        });
    }, [menuItems, user.role, userPermissions]);

    const isActive = (viewId: string) => {
        const path = location.pathname;
        const viewPath = `/app/${viewId.toLowerCase().replace(/_/g, '/')}`;
        return path.startsWith(viewPath);
    };

    const getRoutePath = (item: NavigationItem) => {
        if (item.viewId.startsWith('CUSTOMER_')) return `/app/customer/${item.viewId.replace('CUSTOMER_', '').toLowerCase()}`;
        if (item.viewId.startsWith('DRIVER_')) return `/app/driver/${item.viewId.replace('DRIVER_', '').toLowerCase()}`;
        return `/app/${item.viewId.toLowerCase().replace(/_/g, '/')}`;
    };

    return (
        <div className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 shadow-xl z-20">
            <div className="p-4 flex items-center space-x-3 border-b border-slate-800">
                <img src="/logo/DoorStep.png" alt="DoorStep Logo" className="h-8 w-8 object-contain" />
                <span className="font-bold text-lg truncate tracking-tight">{settings.companyName || 'Doorstep'}</span>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                {filteredMenuItems.map((item, index) => {
                    const routePath = getRoutePath(item);
                    const isItemActive = isActive(item.viewId);

                    const prevItem = index > 0 ? filteredMenuItems[index - 1] : null;
                    const showSectionHeader = item.section && (!prevItem || prevItem.section !== item.section);

                    return (
                        <div key={item.id}>
                            {showSectionHeader && (
                                <div className="pt-4 pb-2 px-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    {item.section?.toLowerCase() === 'system' ? t('system') : item.section}
                                </div>
                            )}
                            <Link to={routePath} className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${isItemActive ? 'bg-slate-800 border-l-4 border-red-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'} ${item.section?.toLowerCase() === 'logistics' ? 'pl-8' : ''}`}>
                                <span className="mr-3"><MenuIcon iconKey={item.iconKey} className="w-4 h-4" /></span>
                                {t(item.label)}
                            </Link>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900">
                <Link to="/app/profile" className="flex items-center w-full text-left group">
                    <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-red-500 transition-colors shadow-md">{user.name.charAt(0)}</div>
                    <div className="ml-3 flex-1 overflow-hidden">
                        <div className="text-sm font-medium truncate text-white group-hover:text-red-200 transition-colors">{user.name}</div>
                        <div className="text-xs text-slate-400 truncate">{(user.role || '').replace('-', ' ')}</div>
                    </div>
                </Link>
                <button onClick={onLogout} className="mt-3 w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-1 hover:bg-slate-800 rounded">{t('signOut')}</button>
            </div>
        </div>
    );
}
