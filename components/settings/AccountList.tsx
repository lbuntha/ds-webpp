
import React, { useState, useMemo } from 'react';
import { Account, AccountType, JournalEntry } from '../../types';
import { Button } from '../ui/Button';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    accounts: Account[];
    transactions?: JournalEntry[];
    onEdit: (account: Account) => void;
    onDelete?: (id: string) => Promise<void>;
}

export const AccountList: React.FC<Props> = ({ accounts, transactions = [], onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<AccountType | 'ALL'>('ALL');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{ account: Account, usageCount: number } | null>(null);

    // Identify used accounts for UI hints/safety
    const usedAccountIds = useMemo(() => {
        const ids = new Set<string>();
        (transactions || []).forEach(t => {
            t.lines.forEach(l => ids.add(l.accountId));
        });
        return ids;
    }, [transactions]);

    const handleVerifyDelete = (account: Account) => {
        if (!onDelete) return;

        // 1. Check for Children (Sub-ledger safety)
        const hasChildren = accounts.some(a => a.parentAccountId === account.id);
        if (hasChildren) {
            toast.warning("Cannot delete this account because it has sub-accounts attached. Please delete or re-parent the sub-accounts first.");
            return;
        }

        // 2. Check for Usage (Transaction integrity)
        const usageCount = (transactions || []).filter(t => t.lines.some(l => l.accountId === account.id)).length;

        // Open Modal
        setConfirmModal({ account, usageCount });
    };

    const executeDelete = async () => {
        if (!confirmModal || !onDelete) return;

        const id = confirmModal.account.id;
        setDeletingId(id);
        try {
            await onDelete(id);
            setConfirmModal(null);
            toast.success("Account deleted.");
        } catch (e: any) {
            toast.error(`Failed to delete account: ${e.message}`);
        } finally {
            setDeletingId(null);
        }
    };

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => {
            const matchesSearch =
                (acc.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (acc.name || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesType = typeFilter === 'ALL' || acc.type === typeFilter;

            return matchesSearch && matchesType;
        }).sort((a, b) => a.code.localeCompare(b.code));
    }, [accounts, searchTerm, typeFilter]);

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Search code or name..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="w-full md:w-auto">
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as AccountType | 'ALL')}
                    >
                        <option value="ALL">All Account Types</option>
                        {Object.values(AccountType).map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub-Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredAccounts.map(acc => {
                            const isUsed = usedAccountIds.has(acc.id);
                            return (
                                <tr key={acc.id} className={`hover:bg-gray-50 ${acc.isHeader ? 'bg-gray-50/80' : ''}`}>
                                    <td className="px-4 py-2 text-sm font-mono text-gray-600 align-middle">
                                        {acc.code}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-900 align-middle">
                                        <div style={{ paddingLeft: acc.parentAccountId ? '20px' : '0px' }} className="flex items-center">
                                            {acc.parentAccountId && <span className="text-gray-300 mr-2">↳</span>}
                                            <span className={acc.isHeader ? 'font-semibold' : ''}>{acc.name}</span>
                                            {acc.isHeader && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300 uppercase">Header</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm align-middle">
                                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${acc.type === 'Asset' ? 'bg-green-50 text-green-700 border-green-200' :
                                            acc.type === 'Liability' ? 'bg-red-50 text-red-700 border-red-200' :
                                                acc.type === 'Equity' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    acc.type === 'Revenue' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                        'bg-orange-50 text-orange-700 border-orange-200'
                                            }`}>
                                            {acc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500 align-middle">
                                        {acc.subType}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-500 align-middle font-medium">
                                        {acc.currency || 'USD'}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-medium space-x-2 align-middle">
                                        <button
                                            onClick={() => onEdit(acc)}
                                            className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                        {onDelete && (
                                            <button
                                                onClick={() => handleVerifyDelete(acc)}
                                                className={`text-xs px-2 py-1 rounded border transition-colors ${isUsed ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'text-red-600 border-transparent hover:border-red-200 hover:bg-red-50'}`}
                                                disabled={deletingId === acc.id}
                                                title={isUsed ? "Warning: Account is used in transactions" : "Delete Account"}
                                            >
                                                {deletingId === acc.id ? '...' : 'Delete'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {filteredAccounts.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No accounts found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            <div className="bg-red-100 p-3 rounded-full">
                                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Account?</h3>
                        <p className="text-center text-gray-600 mb-4 text-sm">
                            Are you sure you want to delete <strong>{confirmModal.account.code} - {confirmModal.account.name}</strong>?
                        </p>

                        {confirmModal.usageCount > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                                <p className="text-xs font-bold text-red-800 mb-1">WARNING:</p>
                                <p className="text-xs text-red-700">
                                    This account is used in <strong>{confirmModal.usageCount} transaction(s)</strong>.
                                    Deleting it will cause reporting errors.
                                </p>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setConfirmModal(null)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={executeDelete}
                                className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                                isLoading={!!deletingId}
                            >
                                {confirmModal.usageCount > 0 ? 'Force Delete' : 'Confirm'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
