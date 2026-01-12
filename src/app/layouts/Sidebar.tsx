import { Link, useLocation } from 'react-router-dom';
import { UserProfile, NavigationItem } from '../../shared/types';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';
import { useUserPermissions } from '../../shared/hooks/usePermissions';
import { MenuIcon } from '../../../components/ui/MenuIcon';
import { useMemo, useState, useEffect } from 'react';

// Inline SVG icons to avoid adding new dependencies
const ChevronLeft = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

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

    // Collapse state with localStorage persistence
    const [isCollapsed, setIsCollapsed] = useState(() => {
        // Default to collapsed on mobile (< 768px) regardless of stored preference
        if (window.innerWidth < 768) return true;

        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', String(isCollapsed));
    }, [isCollapsed]);

    // Auto-collapse on resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768 && !isCollapsed) {
                setIsCollapsed(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isCollapsed]);

    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

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
            if (!s) return 0; // Dashboard / Analytics
            if (s === 'warehouse') return 10;
            if (s === 'logistics') return 10; // Fallback
            if (s === 'driver') return 15;
            if (s === 'customer') return 18;
            if (s === 'finance') return 20;
            if (s === 'employee') return 30;
            if (s === 'reports') return 40;
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
        // Special case for Customer Settlements (finance feature, not customer-specific)
        if (item.viewId === 'CUSTOMER_SETTLEMENTS') return '/app/customer-settlements';
        if (item.viewId === 'SETTLED_PARCELS') return '/app/settled-parcels';
        if (item.viewId === 'CASHBACK') return '/app/cashback';
        if (item.viewId === 'CASHBACK_REPORT') return '/app/cashback-report';
        if (item.viewId === 'BOOKING_MAP') return '/app/reports/booking-map';

        // Stock Management routes
        if (item.viewId === 'STOCK_MANAGEMENT') return '/app/stock';
        if (item.viewId === 'STOCK_ALERTS') return '/app/stock/alerts';
        if (item.viewId === 'STOCK_REQUESTS') return '/app/stock/requests';
        if (item.viewId === 'CUSTOMER_STOCK') return '/app/customer/stock';
        if (item.viewId === 'CUSTOMER_PRODUCTS') return '/app/customer/products';
        if (item.viewId === 'CUSTOMER_STOCK_REQUESTS') return '/app/customer/stock-requests';
        if (item.viewId === 'CUSTOMER_STOCK_BOOKING') return '/app/customer/stock-booking';

        if (item.viewId.startsWith('CUSTOMER_')) return `/app/customer/${item.viewId.replace('CUSTOMER_', '').toLowerCase()}`;
        if (item.viewId.startsWith('DRIVER_')) return `/app/driver/${item.viewId.replace('DRIVER_', '').toLowerCase()}`;

        // Staff overrides
        if (item.viewId === 'STAFF_LOAN_ISSUE') return '/app/staff/issue-loan';

        return `/app/${item.viewId.toLowerCase().replace(/_/g, '/')}`;
    };

    return (
        <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out shadow-xl z-20 relative`}>
            {/* Toggle Button */}
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-6 w-6 h-6 bg-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 border-2 border-slate-900 z-30"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-white" />
                ) : (
                    <ChevronLeft className="w-3 h-3 text-white" />
                )}
            </button>

            {/* Header */}
            <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} border-b border-slate-800`}>
                <img src="/logo/icon.png" alt="DoorStep Logo" className="h-8 w-8 object-contain flex-shrink-0" />
                {!isCollapsed && (
                    <span className="font-bold text-lg truncate tracking-tight transition-opacity duration-200">
                        {settings.companyName || 'Doorstep'}
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                {filteredMenuItems.map((item, index) => {
                    const routePath = getRoutePath(item);
                    const isItemActive = isActive(item.viewId);

                    const prevItem = index > 0 ? filteredMenuItems[index - 1] : null;
                    const showSectionHeader = item.section && (!prevItem || prevItem.section !== item.section);

                    return (
                        <div key={item.id}>
                            {showSectionHeader && !isCollapsed && (
                                <div className="pt-4 pb-2 px-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    {item.section?.toLowerCase() === 'system' ? t('system') : item.section}
                                </div>
                            )}
                            {showSectionHeader && isCollapsed && (
                                <div className="pt-4 pb-1 flex justify-center">
                                    <div className="w-6 h-px bg-slate-700"></div>
                                </div>
                            )}
                            <Link
                                to={routePath}
                                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-6'} py-3 text-sm font-medium transition-all duration-200 ${isItemActive ? 'bg-slate-800 border-l-4 border-red-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                                title={isCollapsed ? t(item.label as any) : undefined}
                            >
                                <span className={isCollapsed ? '' : 'mr-3'}>
                                    <MenuIcon iconKey={item.iconKey} className="w-5 h-5" />
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate transition-opacity duration-200">{t(item.label as any)}</span>
                                )}
                            </Link>
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t border-slate-800 bg-slate-900`}>
                <Link to="/app/profile" className={`flex items-center w-full text-left group ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-red-500 transition-colors shadow-md flex-shrink-0">
                        {user.name.charAt(0)}
                    </div>
                    {!isCollapsed && (
                        <div className="ml-3 flex-1 overflow-hidden">
                            <div className="text-sm font-medium truncate text-white group-hover:text-red-200 transition-colors">{user.name}</div>
                            <div className="text-xs text-slate-400 truncate">{(user.role || '').replace('-', ' ')}</div>
                        </div>
                    )}
                </Link>
                {!isCollapsed && (
                    <button onClick={onLogout} className="mt-3 w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-1 hover:bg-slate-800 rounded">
                        {t('signOut')}
                    </button>
                )}
                {isCollapsed && (
                    <button
                        onClick={onLogout}
                        className="mt-2 w-full flex justify-center text-slate-400 hover:text-white transition-colors py-1 hover:bg-slate-800 rounded"
                        title={t('signOut')}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}

