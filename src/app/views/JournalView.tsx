import { useState } from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { usePermission } from '../../shared/hooks/usePermissions';
import { JournalEntryList } from '../../components/JournalEntryList';
import { JournalEntryForm } from '../../components/JournalEntryForm';
import { firebaseService } from '../../services/firebaseService';
import { JournalEntry } from '../../types';

export default function JournalView() {
    const { transactions, accounts, branches, currencies, refreshData } = useData();
    const canCreate = usePermission('CREATE_JOURNAL');

    const [editingTransaction, setEditingTransaction] = useState<JournalEntry | undefined>(undefined);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const handleSubmit = async (entry: JournalEntry) => {
        if (editingTransaction) {
            await firebaseService.updateTransaction(entry);
        } else {
            await firebaseService.addTransaction(entry);
        }
        await refreshData();
        setIsFormOpen(false);
        setEditingTransaction(undefined);
    };

    const handleEdit = (transaction: JournalEntry) => {
        setEditingTransaction(transaction);
        setIsFormOpen(true);
    };

    const handleDelete = async (ids: string[]) => {
        await firebaseService.deleteTransactions(ids);
        await refreshData();
    };

    const handleNew = () => {
        setEditingTransaction(undefined);
        setIsFormOpen(true);
    };

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">General Journal</h1>
                {canCreate && (
                    <button
                        onClick={handleNew}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                        + New Entry
                    </button>
                )}
            </div>

            {isFormOpen ? (
                <JournalEntryForm
                    accounts={accounts}
                    branches={branches}
                    currencies={currencies}
                    initialData={editingTransaction}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                        setIsFormOpen(false);
                        setEditingTransaction(undefined);
                    }}
                />
            ) : (
                <JournalEntryList
                    transactions={transactions}
                    accounts={accounts}
                    branches={branches}
                    onEdit={handleEdit}
                    onDeleteBatch={handleDelete}
                    onViewRelated={(id) => alert('Navigate to source module: ' + id)}
                />
            )}
        </>
    );
}
