import { useState, useEffect } from 'react';
import { CustomerList } from '../../../components/CustomerList';
import { firebaseService } from '../../shared/services/firebaseService';
import { Customer, UserProfile } from '../../shared/types';
import { toast } from '../../shared/utils/toast';
import { Button } from '../../../components/ui/Button';

export default function CustomersView() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [fetchedCustomers, fetchedUsers] = await Promise.all([
                firebaseService.getCustomers(),
                firebaseService.getUsers()
            ]);
            setCustomers(fetchedCustomers);
            setUsers(fetchedUsers);
        } catch (error) {
            console.error('Failed to load customers:', error);
            toast.error('Failed to load customer data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            const result = await firebaseService.syncService.syncAllUsersToCustomers();
            toast.success(`Synced ${result.synced} customer(s)`);
            if (result.errors.length > 0) {
                console.warn('Sync errors:', result.errors);
            }
            await loadData(); // Refresh list
        } catch (error) {
            console.error('Sync failed:', error);
            toast.error('Failed to sync customer data');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Sync All Action Bar */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-blue-900">Data Sync</h3>
                    <p className="text-sm text-blue-700">Sync customer data from user profiles to ensure consistency.</p>
                </div>
                <Button onClick={handleSyncAll} isLoading={isSyncing} variant="primary">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync All
                </Button>
            </div>

            <CustomerList
                customers={customers}
                users={users}
                onRefresh={loadData}
            />
        </div>
    );
}
