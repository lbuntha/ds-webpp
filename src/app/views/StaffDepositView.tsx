import React from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { StaffDepositForm } from '../../../components/staff/StaffDepositForm';
import { useNavigate } from 'react-router-dom';

export default function StaffDepositView() {
    const { employees, accounts, branches, currencies, refreshData } = useData();
    const navigate = useNavigate();

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Accept Deposit</h1>
                <button onClick={() => navigate('/app/staff')} className="text-gray-500 hover:text-gray-700">Back</button>
            </div>
            <StaffDepositForm
                employees={employees}
                accounts={accounts}
                branches={branches}
                currencies={currencies}
                onSave={async (entry) => {
                    await firebaseService.addTransaction(entry);
                    await refreshData();
                    navigate('/app/staff');
                }}
                onCancel={() => navigate('/app/staff')}
            />
        </div>
    );
}
