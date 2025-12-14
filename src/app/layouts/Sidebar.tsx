import { Link, useLocation } from 'react-router-dom';
import { UserProfile, NavigationItem } from '../../shared/types';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';
import { MenuIcon } from '../../components/ui/MenuIcon';
import { useState } from 'react';

interface SidebarProps {
    menuItems: NavigationItem[];
    user: UserProfile;
    onLogout: () => void;
}

export function Sidebar({ menuItems, user, onLogout }: SidebarProps) {
    const location = useLocation();
    const { settings } = useData();
    const { t } = useLanguage();
    const [logisticsMenuOpen, setLogisticsMenuOpen] = useState(false);

    const isActive = (viewId: string) => {
        const path = location.pathname;
        const viewPath = `/app/${viewId.toLowerCase()}`;
        return path.startsWith(viewPath);
    };

    return (
        <div className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 shadow-xl z-20">
            <div className="p-4 flex items-center space-x-3 border-b border-slate-800">
                <img
                    src="/logo/DoorStep.png"
                    alt="DoorStep Logo"
                    className="h-8 w-8 object-contain"
                />
                <span className="font-bold text-lg truncate tracking-tight">
                    {settings.companyName || 'Doorstep'}
                </span>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                {menuItems.map((item) => {
                    if (item.viewId === 'PARCELS') {
                        return (
                            <div key={item.id}>
                                <button
                                    onClick={() => setLogisticsMenuOpen(!logisticsMenuOpen)}
                                    className={`w-full flex items-center justify-between px-6 py-3 text-sm font-medium transition-all duration-200 ${isActive('parcels')
                                        ? 'text-white'
                                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <span className="flex items-center">
                                        <span className="mr-3">
                                            <MenuIcon iconKey={item.iconKey} className="w-4 h-4" />
                                        </span>
                                        {/* @ts-ignore */}
                                        {t(item.label)}
                                    </span>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${logisticsMenuOpen ? 'rotate-180' : ''
                                            }`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {logisticsMenuOpen && (
                                    <div className="bg-slate-800/50 py-1">
                                        <Link
                                            to="/app/parcels/list"
                                            className={`w-full flex items-center pl-14 pr-6 py-2 text-xs font-medium transition-colors ${location.pathname === '/app/parcels/list'
                                                ? 'text-white bg-slate-800'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            All Bookings
                                        </Link>
                                        <Link
                                            to="/app/parcels/new"
                                            className={`w-full flex items-center pl-14 pr-6 py-2 text-xs font-medium transition-colors ${location.pathname === '/app/parcels/new'
                                                ? 'text-white bg-slate-800'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            New Booking
                                        </Link>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const routePath = `/app/${item.viewId.toLowerCase().replace('_', '-')}`;

                    return (
                        <div key={item.id}>
                            {item.section === 'system' && item.order === 90 && (
                                <div className="pt-4 pb-2 px-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    {t('system')}
                                </div>
                            )}
                            <Link
                                to={routePath}
                                className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${isActive(item.viewId)
                                    ? 'bg-slate-800 border-l-4 border-red-600 text-white'
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                            >
                                <span className="mr-3">
                                    <MenuIcon iconKey={item.iconKey} className="w-4 h-4" />
                                </span>
                                {/* @ts-ignore */}
                                {t(item.label)}
                            </Link>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900">
                <Link
                    to="/app/profile"
                    className="flex items-center w-full text-left group"
                >
                    <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white group-hover:bg-red-500 transition-colors shadow-md">
                        {user.name.charAt(0)}
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                        <div className="text-sm font-medium truncate text-white group-hover:text-red-200 transition-colors">
                            {user.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                            {(user.role || '').replace('-', ' ')}
                        </div>
                    </div>
                </Link>
                <button
                    onClick={onLogout}
                    className="mt-3 w-full text-center text-xs text-slate-400 hover:text-white transition-colors py-1 hover:bg-slate-800 rounded"
                >
                    {t('signOut')}
                </button>
            </div>
        </div >
    );
}
