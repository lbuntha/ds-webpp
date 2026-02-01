import React from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { EmployeeList } from '../../../components/staff/EmployeeList';

export default function EmployeeManagementView() {
    const { employees, refreshData } = useData();

    return (
        <div className="p-6">
            <EmployeeList
                employees={employees}
                onAddEmployee={async (e) => {
                    await firebaseService.addEmployee(e);
                    await refreshData();
                }}
                onUpdateEmployee={async (e) => {
                    await firebaseService.updateEmployee(e);
                    await refreshData();
                }}
                onDeleteEmployee={async (id) => {
                    await firebaseService.deleteEmployee(id);
                    await refreshData();
                }}
            />
        </div>
    );
}
