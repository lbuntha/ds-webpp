import React from 'react';
import { ParcelPromotionSetup } from '../../../components/parcels/ParcelPromotionSetup';

const PromotionsPage: React.FC = () => {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a4 4 0 00-4-4H5.45a4 4 0 00-3.743 2.596L.312 7.404A1.5 1.5 0 001.5 9.5H8m4-3.5V6a4 4 0 014-4h2.55a4 4 0 013.743 2.596l1.395 2.808A1.5 1.5 0 0122.5 9.5H16" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
                    <p className="text-sm text-gray-500">Create and manage promotional campaigns</p>
                </div>
            </div>

            <ParcelPromotionSetup />
        </div>
    );
};

export default PromotionsPage;
