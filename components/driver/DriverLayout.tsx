
import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { DriverDashboard } from './DriverDashboard';
import { CustomerProfile } from '../customer/CustomerProfile';
import { NotificationBell } from '../ui/NotificationBell';
import { useLanguage } from '../../contexts/LanguageContext';
import { WalletDashboard } from '../wallet/WalletDashboard';
import { PublicTracker } from '../tracking/PublicTracker';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

interface Props {
  user: UserProfile;
  onLogout: () => void;
}

export const DriverLayout: React.FC<Props> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'JOBS' | 'PROFILE' | 'WALLET'>('JOBS');
  const [showTracker, setShowTracker] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
        {/* Driver Header */}
        <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10 border-b border-gray-200">
            <div className="font-bold text-xl text-red-600 flex items-center gap-2">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Doorstep Driver
            </div>
            <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <button 
                    onClick={() => setShowTracker(true)}
                    className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    title="Track Parcel"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                <NotificationBell user={user} />
                <div 
                    onClick={() => setView('PROFILE')}
                    className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold cursor-pointer shadow-sm"
                >
                    {user.name.charAt(0)}
                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 pt-6">
            {view === 'JOBS' && <DriverDashboard user={user} />}
            {view === 'WALLET' && <WalletDashboard user={user} />}
            {view === 'PROFILE' && (
                <div className="space-y-4">
                    <CustomerProfile user={user} />
                    <button onClick={onLogout} className="w-full py-3 text-red-600 font-bold bg-red-50 rounded-xl hover:bg-red-100 border border-red-200">
                        {t('signOut')}
                    </button>
                </div>
            )}
        </div>

        {/* Bottom Nav Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center text-xs font-medium text-gray-500 z-30">
            <button 
                onClick={() => setView('JOBS')}
                className={`flex flex-col items-center gap-1 ${view === 'JOBS' ? 'text-red-600' : ''}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                {t('my_jobs')}
            </button>
            <button 
                onClick={() => setView('WALLET')}
                className={`flex flex-col items-center gap-1 ${view === 'WALLET' ? 'text-red-600' : ''}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                {t('wallet')}
            </button>
            <button 
                onClick={() => setView('PROFILE')}
                className={`flex flex-col items-center gap-1 ${view === 'PROFILE' ? 'text-red-600' : ''}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {t('profile')}
            </button>
        </div>

        {/* Global Tracker Modal */}
        {showTracker && <PublicTracker onClose={() => setShowTracker(false)} />}
    </div>
  );
};
