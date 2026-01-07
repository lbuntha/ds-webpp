import React from 'react';
import { CashbackRulesSetup } from '../../../components/parcels/CashbackRulesSetup';

const CashbackPage: React.FC = () => {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Customer Cashback</h1>
                    <p className="text-sm text-gray-500">Configure volume-based cashback rewards for customers</p>
                </div>
            </div>

            <CashbackRulesSetup />
        </div>
    );
};

export default CashbackPage;
