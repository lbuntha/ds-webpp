import { useState, useEffect, useMemo } from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { useAuth } from '../../shared/contexts/AuthContext';
import { usePermission } from '../../shared/hooks/usePermissions';
import { JournalEntryList } from '../../../components/JournalEntryList';
import { JournalEntryForm } from '../../../components/JournalEntryForm';
import { firebaseService } from '../../shared/services/firebaseService';
import { JournalEntry, JournalEntryStatus } from '../../shared/types';
import { toast } from '../../shared/utils/toast';

type ViewTab = 'POSTED' | 'PENDING' | 'DRAFTS' | 'REJECTED';

export default function JournalView() {
    const { transactions, accounts, branches, currencies, refreshData } = useData();
    const { user } = useAuth();
    const canCreate = usePermission('CREATE_JOURNAL');
    const canApprove = usePermission('APPROVE_JOURNAL');

    const [activeTab, setActiveTab] = useState<ViewTab>('POSTED');
    const [editingTransaction, setEditingTransaction] = useState<JournalEntry | undefined>(undefined);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [rejectModalData, setRejectModalData] = useState<{ id: string; description: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Filter transactions by status
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const status = t.status || 'POSTED'; // Legacy entries are POSTED
            switch (activeTab) {
                case 'POSTED': return status === 'POSTED' || !t.status; // Include legacy
                case 'PENDING': return status === 'PENDING_APPROVAL';
                case 'DRAFTS': return status === 'DRAFT' && t.createdBy === user?.uid;
                case 'REJECTED': return status === 'REJECTED';
                default: return true;
            }
        });
    }, [transactions, activeTab, user?.uid]);

    // Counts for tab badges
    const pendingCount = transactions.filter(t => t.status === 'PENDING_APPROVAL').length;
    const draftCount = transactions.filter(t => t.status === 'DRAFT' && t.createdBy === user?.uid).length;
    const rejectedCount = transactions.filter(t => t.status === 'REJECTED').length;

    const handleSubmit = async (entry: JournalEntry) => {
        if (!user) return;

        if (editingTransaction) {
            // If editing a rejected entry, resubmit for approval
            if (editingTransaction.status === 'REJECTED') {
                await firebaseService.submitForApproval(entry, user.uid, user.name);
                toast.success('Entry resubmitted for approval');
            } else {
                await firebaseService.updateTransaction(entry);
                toast.success('Entry updated');
            }
        } else {
            // New entry: submit for approval
            await firebaseService.submitForApproval(entry, user.uid, user.name);
            toast.success('Entry submitted for approval');
        }

        await refreshData();
        setIsFormOpen(false);
        setEditingTransaction(undefined);
    };

    const handleSaveAsDraft = async (entry: JournalEntry) => {
        if (!user) return;
        await firebaseService.saveAsDraft(entry, user.uid, user.name);
        toast.success('Entry saved as draft');
        await refreshData();
        setIsFormOpen(false);
        setEditingTransaction(undefined);
    };

    const handleApprove = async (entryId: string) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await firebaseService.approveJournalEntry(entryId, user.uid, user.name);
            toast.success('Entry approved and posted');
            await refreshData();
        } catch (e: any) {
            toast.error(`Failed to approve: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!user || !rejectModalData) return;
        if (!rejectReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        setIsProcessing(true);
        try {
            await firebaseService.rejectJournalEntry(rejectModalData.id, rejectReason, user.uid, user.name);
            toast.success('Entry rejected');
            setRejectModalData(null);
            setRejectReason('');
            await refreshData();
        } catch (e: any) {
            toast.error(`Failed to reject: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
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

    const tabClass = (tab: ViewTab) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-50'
        }`;

    return (
        <>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">General Journal</h1>
                {canCreate && !isFormOpen && (
                    <button
                        onClick={handleNew}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        + New Entry
                    </button>
                )}
            </div>

            {isFormOpen ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <JournalEntryForm
                        accounts={accounts}
                        branches={branches}
                        currencies={currencies}
                        initialData={editingTransaction}
                        onSubmit={handleSubmit}
                        onSaveDraft={handleSaveAsDraft}
                        onCancel={() => {
                            setIsFormOpen(false);
                            setEditingTransaction(undefined);
                        }}
                    />
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit mb-6">
                        <button onClick={() => setActiveTab('POSTED')} className={tabClass('POSTED')}>
                            Posted
                        </button>
                        <button onClick={() => setActiveTab('PENDING')} className={tabClass('PENDING')}>
                            Pending Approval
                            {pendingCount > 0 && (
                                <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                        {canCreate && (
                            <button onClick={() => setActiveTab('DRAFTS')} className={tabClass('DRAFTS')}>
                                My Drafts
                                {draftCount > 0 && (
                                    <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                        {draftCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {rejectedCount > 0 && (
                            <button onClick={() => setActiveTab('REJECTED')} className={tabClass('REJECTED')}>
                                Rejected
                                <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                    {rejectedCount}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'PENDING' && canApprove && filteredTransactions.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Approval Queue:</strong> Review entries below. You cannot approve your own entries.
                            </p>
                        </div>
                    )}

                    <JournalEntryList
                        transactions={filteredTransactions}
                        accounts={accounts}
                        branches={branches}
                        onEdit={handleEdit}
                        onDeleteBatch={handleDelete}
                        onViewRelated={(id) => toast.info('Navigate to source module: ' + id)}
                        // Approval actions for pending tab
                        showApprovalActions={activeTab === 'PENDING' && canApprove}
                        onApprove={handleApprove}
                        onReject={(id, desc) => setRejectModalData({ id, description: desc })}
                        currentUserId={user?.uid}
                        isProcessing={isProcessing}
                    />

                    {filteredTransactions.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            {activeTab === 'PENDING' && 'No entries pending approval'}
                            {activeTab === 'DRAFTS' && 'No draft entries'}
                            {activeTab === 'REJECTED' && 'No rejected entries'}
                            {activeTab === 'POSTED' && 'No posted entries'}
                        </div>
                    )}
                </>
            )}

            {/* Rejection Modal */}
            {rejectModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Entry</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Rejecting: <strong>{rejectModalData.description}</strong>
                        </p>
                        <textarea
                            className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            rows={3}
                            placeholder="Enter rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex space-x-3 mt-4">
                            <button
                                onClick={() => { setRejectModalData(null); setRejectReason(''); }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
