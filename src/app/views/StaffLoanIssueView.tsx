import React from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { StaffLoanForm } from '../../../components/staff/StaffLoanForm';
import { useNavigate } from 'react-router-dom';

export default function StaffLoanIssueView() {
    const { employees, accounts, branches, refreshData } = useData();
    const navigate = useNavigate();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Issue Staff Loan</h1>
            <StaffLoanForm
                employees={employees}
                accounts={accounts}
                branches={branches}
                onSave={async (loan) => {
                    await firebaseService.createStaffLoan(loan);
                    await refreshData();
                    navigate('/app/staff'); // Redirect to Loans Overview after saving
                }}
                onCancel={() => navigate('/app/staff')}
            />
        </div>
    );
}
