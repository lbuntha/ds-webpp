
import React, { useState, useMemo } from 'react';
import { JournalEntry, Account, Branch } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface Props {
    transactions: JournalEntry[];
    accounts: Account[];
    branches: Branch[];
    onEdit?: (entry: JournalEntry) => void;
    onDeleteBatch?: (ids: string[]) => Promise<void>;
    onReverseBatch?: (ids: string[]) => Promise<void>;
    onViewRelated?: (id: string) => void;
}

export const JournalEntryList: React.FC<Props> = ({
    transactions, accounts, branches, onEdit, onDeleteBatch, onReverseBatch, onViewRelated
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [viewAttachment, setViewAttachment] = useState<string | null>(null);

    const getAccountName = (id: string) => {
        const acc = accounts.find(a => a.id === id);
        return acc ? `${acc.code} - ${acc.name}` : 'Unknown Account';
    };

    const getBranchName = (id: string) => {
        return branches.find(b => b.id === id)?.name || 'Unknown Branch';
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t =>
            (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.id && t.id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [transactions, searchTerm]);

    // Selection Handlers
    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(filteredTransactions.map(t => t.id));
            setSelectedIds(allIds);
        }
    };

    // Action Handlers
    const handleDelete = async () => {
        if (!onDeleteBatch || selectedIds.size === 0) return;
        if (confirm(`Are you sure you want to DELETE ${selectedIds.size} transaction(s)? This cannot be undone.`)) {
            setProcessing(true);
            try {
                await onDeleteBatch(Array.from(selectedIds));
                setSelectedIds(new Set());
            } finally {
                setProcessing(false);
            }
        }
    };

    const handleReverse = async () => {
        if (!onReverseBatch || selectedIds.size === 0) return;
        if (confirm(`Are you sure you want to REVERSE ${selectedIds.size} transaction(s)? This will create offsetting entries.`)) {
            setProcessing(true);
            try {
                await onReverseBatch(Array.from(selectedIds));
                setSelectedIds(new Set());
            } finally {
                setProcessing(false);
            }
        }
    };

    return (
        <div className="space-y-6 pb-24 relative">
            <div className="flex justify-between items-center sticky top-0 z-10 bg-gray-50 py-2">
                <div className="flex items-center gap-4 w-full max-w-xl">
                    {/* Select All Checkbox */}
                    <div className="flex items-center bg-white px-3 py-2 rounded-xl border border-gray-300 shadow-sm h-[42px]">
                        <input
                            type="checkbox"
                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                            checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                            onChange={handleSelectAll}
                            title="Select All Filtered"
                        />
                    </div>

                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="Search by description, reference, or ID..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                <div className="text-sm text-gray-500 hidden md:block">
                    Showing {filteredTransactions.length} entries
                </div>
            </div>

            <div className="space-y-4">
                {filteredTransactions.map((txn) => {
                    const isSelected = selectedIds.has(txn.id);
                    const isForeign = txn.currency && txn.currency !== 'USD';

                    return (
                        <Card
                            key={txn.id}
                            className={`hover:shadow-md transition-all duration-200 border ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-gray-100'}`}
                        >
                            <div className="border-b border-gray-100 pb-3 mb-3 flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                <div className="flex items-start gap-3">
                                    {/* Row Selection Checkbox */}
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelect(txn.id)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-bold text-gray-900 text-lg">{new Date(txn.date).toLocaleDateString()}</span>
                                            {txn.reference && (
                                                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-mono border border-gray-200">
                                                    Ref: {txn.reference}
                                                </span>
                                            )}
                                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100">
                                                {getBranchName(txn.branchId)}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono" title="System ID">
                                                {txn.id}
                                            </span>
                                        </div>
                                        <p className="text-gray-800 mt-2 font-medium">{txn.description}</p>
                                        {isForeign && (
                                            <div className="mt-1 text-xs font-medium text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100">
                                                Global Rate: {txn.currency} @ {txn.exchangeRate}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end space-y-2 pl-8 md:pl-0">
                                    {onEdit && !txn.relatedDocumentId && (
                                        <Button
                                            variant="outline"
                                            className="text-xs px-3 py-1 h-8"
                                            onClick={() => onEdit(txn)}
                                        >
                                            Edit Entry
                                        </Button>
                                    )}
                                    {txn.relatedDocumentId && (
                                        <div className="flex items-center gap-1">
                                            {onViewRelated && (txn.relatedDocumentId.startsWith('inv-') || txn.relatedDocumentId.startsWith('bill-') || txn.relatedDocumentId.startsWith('loan-')) ? (
                                                <button
                                                    onClick={() => onViewRelated && onViewRelated(txn.relatedDocumentId!)}
                                                    className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                                    title="View Related Record"
                                                >
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    Link: {txn.relatedDocumentId}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center font-mono" title={`Linked Document: ${txn.relatedDocumentId}`}>
                                                    <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                                    Ref: {txn.relatedDocumentId}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {txn.attachment && (
                                        <button
                                            onClick={() => setViewAttachment(txn.attachment || null)}
                                            className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center hover:bg-indigo-100 transition-colors"
                                        >
                                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                            View Attachment
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto pl-8 md:pl-0">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-gray-100 bg-gray-50/50 text-xs uppercase">
                                            <th className="text-left font-semibold py-2 pl-2 w-1/4">Account</th>
                                            <th className="text-left font-semibold py-2 w-1/4">Description</th>
                                            <th className="text-right font-semibold py-2 w-1/6">Trans. Amt (FCY)</th>
                                            <th className="text-right font-semibold py-2">Debit (LCY)</th>
                                            <th className="text-right font-semibold py-2 pr-2">Credit (LCY)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {txn.lines.map((line, idx) => {
                                            const lineHasForeign = line.originalCurrency && line.originalCurrency !== 'USD';
                                            const showForeign = isForeign || lineHasForeign;
                                            const fcyAmount = line.originalDebit > 0 ? line.originalDebit : line.originalCredit > 0 ? line.originalCredit : 0;
                                            const fcyRate = line.originalExchangeRate || txn.exchangeRate;

                                            return (
                                                <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-2 pl-2 text-gray-700 font-mono align-top">{getAccountName(line.accountId)}</td>
                                                    <td className="py-2 text-gray-500 italic truncate max-w-xs align-top" title={line.description}>{line.description || '-'}</td>

                                                    {/* FCY Column */}
                                                    <td className="py-2 text-right text-gray-600 align-top">
                                                        {showForeign && fcyAmount > 0 && (
                                                            <div>
                                                                <span className="font-bold text-blue-700">
                                                                    {fcyAmount.toLocaleString()} {line.originalCurrency || txn.currency}
                                                                </span>
                                                                <div className="text-[9px] text-gray-400">@ {fcyRate}</div>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Debit Column (LCY) */}
                                                    <td className="py-2 text-right text-gray-800 align-top font-medium">
                                                        {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                                    </td>

                                                    {/* Credit Column (LCY) */}
                                                    <td className="py-2 pr-2 text-right text-gray-800 align-top font-medium">
                                                        {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-gray-50 font-semibold">
                                            <td className="py-2 pl-2 text-gray-500 text-xs uppercase tracking-wider">Totals (Base)</td>
                                            <td colSpan={2}></td>
                                            <td className="py-2 text-right text-indigo-700">
                                                {txn.lines.reduce((sum, l) => sum + l.debit, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2 pr-2 text-right text-indigo-700">
                                                {txn.lines.reduce((sum, l) => sum + l.credit, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )
                })}
                {filteredTransactions.length === 0 && (
                    <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your search terms or create a new journal entry.</p>
                    </div>
                )}
            </div>

            {/* Batch Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-fade-in-up max-w-[90vw]">
                    <span className="font-bold text-sm whitespace-nowrap">{selectedIds.size} Selected</span>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <div className="flex gap-3">
                        {onReverseBatch && (
                            <button
                                onClick={handleReverse}
                                disabled={processing}
                                className="text-sm font-medium hover:text-indigo-300 transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                Reverse
                            </button>
                        )}
                        {onDeleteBatch && (
                            <button
                                onClick={handleDelete}
                                disabled={processing}
                                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            )}

            {/* Attachment Modal */}
            {viewAttachment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4" onClick={() => setViewAttachment(null)}>
                    <div className="bg-white p-4 rounded-xl max-w-3xl w-full flex flex-col items-center max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between w-full mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold">Attachment</h3>
                            <button onClick={() => setViewAttachment(null)} className="text-gray-500 hover:text-gray-700">Close</button>
                        </div>
                        <img src={viewAttachment} alt="Document Attachment" className="w-full h-auto rounded-lg border border-gray-200" />
                        <div className="mt-4 w-full flex justify-end">
                            <Button onClick={() => window.open(viewAttachment, '_blank')}>Open Full Size</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
