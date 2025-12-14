
import React from 'react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  user: UserProfile;
  stats: {
    activeCount: number;
    totalCount: number;
    totalSpent: number;
  };
  onNewBooking: () => void;
}

export const CustomerStats: React.FC<Props> = ({ user, stats, onNewBooking }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('hello')}, {user.name.split(' ')[0]}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('track_shipment')}</p>
          </div>
          <button 
            onClick={onNewBooking}
            className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-red-100 hover:bg-red-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            {t('new_order')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <div className="text-xl font-bold text-gray-900">{stats.activeCount}</div>
            <div className="text-[10px] uppercase tracking-wide font-medium text-gray-400">{t('active')}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <div className="text-xl font-bold text-gray-900">{stats.totalCount}</div>
            <div className="text-[10px] uppercase tracking-wide font-medium text-gray-400">{t('total')}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
            <div className="text-xl font-bold text-gray-900">
              ${(stats.totalSpent || 0).toFixed(0)}
            </div>
            <div className="text-[10px] uppercase tracking-wide font-medium text-gray-400">{t('spent')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
