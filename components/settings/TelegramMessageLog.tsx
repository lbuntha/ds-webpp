import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { collection, getDocs, query, orderBy, limit, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/shared/services/firebaseInstance';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { toast } from '../../src/shared/utils/toast';

interface TelegramMessage {
    updateId: string;
    messageId: string;
    chatId: string;
    chatTitle: string;
    configGroupId?: string;
    configGroupName?: string;
    from: string;
    text: string;
    date: Timestamp | Date;
    processed: boolean;
    manual?: boolean;
    transactionData?: {
        amount: number;
        currency: 'USD' | 'KHR';
        payer: string;
        driverCode: string;
        trxId: string;
        date?: any;
        originalText?: string;
    };
    createdAt: Timestamp;
    source: string;
}

interface GroupedMessages {
    [groupName: string]: {
        [date: string]: TelegramMessage[];
    };
}

const EditIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);

export const TelegramMessageLog: React.FC = () => {
    const [messages, setMessages] = useState<TelegramMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
    const [daysBack, setDaysBack] = useState(7);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

    // Editing State
    const [editingMessage, setEditingMessage] = useState<TelegramMessage | null>(null);
    const [editForm, setEditForm] = useState({
        amount: '',
        currency: 'USD',
        payer: '',
        driverCode: '',
        trxId: ''
    });
    const [saving, setSaving] = useState(false);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);

            const q = query(
                collection(db, 'telegram_messages'),
                where('date', '>=', cutoffDate),
                orderBy('date', 'desc'),
                limit(500)
            );

            const snapshot = await getDocs(q);
            const msgs = snapshot.docs.map(doc => ({
                ...doc.data(),
                updateId: doc.id
            })) as TelegramMessage[];

            setMessages(msgs);
        } catch (e) {
            console.error('Failed to load telegram messages:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, [daysBack]);

    const [configuredGroups, setConfiguredGroups] = useState<any[]>([]);

    useEffect(() => {
        const loadConfig = async () => {
            const data = await firebaseService.getTelegramGroups();
            setConfiguredGroups(data);
        };
        loadConfig();
    }, []);

    // Resolve a driver code or name to a nice Group Title if possible
    const resolveGroupName = (codeOrName: string) => {
        if (!codeOrName) return 'Unknown';
        // Try exact match
        const exact = configuredGroups.find(g => g.chatTitle === codeOrName || g.name === codeOrName);
        if (exact) return exact.chatTitle;

        // Try to match Driver Code at start of Configured Group (e.g. DS004 matches "DS004 - Sing Tola")
        const partial = configuredGroups.find(g => g.chatTitle.startsWith(codeOrName + ' ') || g.chatTitle.startsWith(codeOrName + '-'));
        if (partial) return partial.chatTitle;

        return codeOrName;
    };

    // Get unique groups for filter (Drivers prioritized & Resolved)
    const groups = useMemo(() => {
        const groupSet = new Set<string>();
        messages.forEach(m => {
            let key = m.configGroupName || m.chatTitle || 'Unknown';
            if (m.transactionData?.driverCode) {
                key = m.transactionData.driverCode;
            }
            // Resolve to nice name
            groupSet.add(resolveGroupName(key));
        });
        return Array.from(groupSet).sort();
    }, [messages, configuredGroups]);

    // Group messages: prioritize Driver Code as the top-level group
    const groupedMessages = useMemo(() => {
        const filtered = selectedGroup === 'ALL'
            ? messages
            : messages.filter(m => {
                let key = m.configGroupName || m.chatTitle || 'Unknown';
                if (m.transactionData?.driverCode) {
                    key = m.transactionData.driverCode;
                }
                const resolved = resolveGroupName(key);
                return resolved === selectedGroup;
            });

        const grouped: GroupedMessages = {};

        filtered.forEach(msg => {
            // THE CHANGE: Use Driver Code as the primary group name if available
            let primaryGroup = msg.transactionData?.driverCode;

            if (!primaryGroup) {
                // Fallback for unparsed messages or messages without driver info
                primaryGroup = msg.configGroupName || msg.chatTitle || 'Unknown';
            }

            // Resolve to nice name (e.g. DS004 -> DS004 - Sing Tola)
            const displayName = resolveGroupName(primaryGroup);

            const msgDate = msg.date instanceof Timestamp
                ? msg.date.toDate()
                : new Date(msg.date);
            const dateKey = msgDate.toISOString().split('T')[0]; // YYYY-MM-DD

            // Initialize structure
            if (!grouped[displayName]) {
                grouped[displayName] = {};
            }
            if (!grouped[displayName][dateKey]) {
                grouped[displayName][dateKey] = [];
            }
            grouped[displayName][dateKey].push(msg);
        });

        return grouped;
    }, [messages, selectedGroup, configuredGroups]);

    const toggleDate = (key: string) => {
        setExpandedDates(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const handleEditClick = (msg: TelegramMessage) => {
        setEditingMessage(msg);

        // Pre-fill with existing data if available
        if (msg.transactionData) {
            setEditForm({
                amount: msg.transactionData.amount?.toString() || '',
                currency: msg.transactionData.currency || 'USD',
                payer: msg.transactionData.payer || '',
                driverCode: msg.transactionData.driverCode || '',
                trxId: msg.transactionData.trxId || ''
            });
        } else {
            // Attempt smart extraction for pre-fill
            const text = msg.text || '';
            let amount = '';
            let currency = 'USD';
            let payer = '';
            let driverCode = '';
            let trxId = '';

            // Extract Amount & Currency
            const usdMatch = text.match(/\$\s*([0-9.]+)/);
            if (usdMatch) {
                amount = usdMatch[1];
                currency = 'USD';
            } else {
                const khrMatch = text.match(/[៛R]\s*([0-9,]+)/i);
                if (khrMatch) {
                    amount = khrMatch[1].replace(/,/g, '');
                    currency = 'KHR';
                }
            }

            // Extract Driver Code (DS followed by 3 digits)
            const driverMatch = text.match(/(DS\d{3})/i);
            if (driverMatch) driverCode = driverMatch[1].toUpperCase();

            // Extract Trx ID
            const trxMatch = text.match(/Trx\.?\s*ID:?\s*(\d+)/i);
            if (trxMatch) trxId = trxMatch[1];

            // Extract Payer (Simple heuristic: between "paid by" and "(" or "on")
            const payerMatch = text.match(/paid by\s+(.+?)\s*(\(|on)/i);
            if (payerMatch) payer = payerMatch[1].trim();

            setEditForm({
                amount,
                currency,
                payer,
                driverCode,
                trxId
            });
        }
    };

    const handleSaveManualParse = async () => {
        if (!editingMessage) return;

        setSaving(true);
        try {
            const transactionData = {
                amount: parseFloat(editForm.amount),
                currency: editForm.currency as 'USD' | 'KHR',
                payer: editForm.payer,
                driverCode: editForm.driverCode.toUpperCase(),
                trxId: editForm.trxId,
                date: editingMessage.date, // Preserve original date
                originalText: editingMessage.text,
                manual: true // Mark as manually parsed
            };

            // Update Firestore
            const msgRef = doc(db, 'telegram_messages', editingMessage.updateId);
            await updateDoc(msgRef, {
                processed: true,
                manual: true,
                transactionData
            });

            // Update local state
            setMessages(prev => prev.map(m =>
                m.updateId === editingMessage.updateId
                    ? { ...m, processed: true, manual: true, transactionData }
                    : m
            ));

            toast.success('Message updated manually');
            setEditingMessage(null);
        } catch (e) {
            console.error('Failed to update message:', e);
            toast.error('Failed to update message');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (date: Timestamp | Date) => {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const calculateDailySummary = (msgs: TelegramMessage[]) => {
        const summary: { [driver: string]: { USD: number; KHR: number } } = {};

        msgs.forEach(msg => {
            if (msg.transactionData) {
                const driver = msg.transactionData.driverCode || 'Unknown';
                const currency = msg.transactionData.currency;
                const amount = msg.transactionData.amount;

                if (!summary[driver]) {
                    summary[driver] = { USD: 0, KHR: 0 };
                }

                if (currency === 'USD') {
                    summary[driver].USD += amount;
                } else if (currency === 'KHR') {
                    summary[driver].KHR += amount;
                }
            }
        });

        return summary;
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card>
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Group</label>
                        <select
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
                            value={selectedGroup}
                            onChange={e => setSelectedGroup(e.target.value)}
                        >
                            <option value="ALL">All Groups</option>
                            {groups.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Time Range</label>
                        <select
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={daysBack}
                            onChange={e => setDaysBack(Number(e.target.value))}
                        >
                            <option value={1}>Last 24 hours</option>
                            <option value={7}>Last 7 days</option>
                            <option value={14}>Last 14 days</option>
                            <option value={30}>Last 30 days</option>
                        </select>
                    </div>

                    <div className="ml-auto">
                        <Button onClick={loadMessages} isLoading={loading} variant="secondary" className="text-sm">
                            🔄 Refresh
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex gap-4 text-sm">
                    <span className="text-gray-500">
                        Total: <span className="font-bold text-gray-900">{messages.length}</span> messages
                    </span>
                    <span className="text-gray-500">
                        Groups: <span className="font-bold text-gray-900">{groups.length}</span>
                    </span>
                </div>
            </Card>

            {/* Message Groups */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading messages...</div>
            ) : Object.keys(groupedMessages).length === 0 ? (
                <Card>
                    <div className="text-center py-12 text-gray-500">
                        No messages found for the selected filters.
                    </div>
                </Card>
            ) : (
                Object.entries(groupedMessages).map(([groupName, dateGroups]) => (
                    <Card key={groupName} title={`📱 ${groupName}`}>
                        <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {Object.values(dateGroups).reduce((sum, msgs) => sum + msgs.length, 0)} messages
                            </span>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(dateGroups)
                                .sort((a, b) => b[0].localeCompare(a[0])) // Sort dates desc
                                .map(([dateKey, msgs]) => {
                                    const expandKey = `${groupName}-${dateKey}`;
                                    const isExpanded = expandedDates.has(expandKey);
                                    const summary = calculateDailySummary(msgs);

                                    return (
                                        <div key={dateKey} className="border border-gray-100 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => toggleDate(expandKey)}
                                                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                                                    <span className="font-medium text-gray-900">{formatDate(dateKey)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {/* Quick Summary Badges if collapsed */}
                                                    {!isExpanded && Object.entries(summary).length > 0 && (
                                                        <div className="flex gap-2 text-xs text-gray-500">
                                                            {Object.entries(summary).slice(0, 2).map(([driver, sums]) => (
                                                                <span key={driver}>
                                                                    {driver}: ${sums.USD.toFixed(2)}
                                                                </span>
                                                            ))}
                                                            {Object.keys(summary).length > 2 && <span>...</span>}
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-gray-500">
                                                        {msgs.length} msg
                                                    </span>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="divide-y divide-gray-100">
                                                    {/* Daily Summary Section */}
                                                    {Object.keys(summary).length > 0 && (
                                                        <div className="p-3 bg-blue-50 border-b border-blue-100">
                                                            <h4 className="text-xs font-bold text-blue-800 uppercase mb-2">Daily Summary</h4>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                                {Object.entries(summary).map(([driver, sums]) => (
                                                                    <div key={driver} className="bg-white p-2 rounded border border-blue-100 shadow-sm">
                                                                        <div className="text-xs font-bold text-gray-700 mb-1">{driver}</div>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            {sums.USD > 0 && (
                                                                                <div className="text-xs text-green-700 font-mono">
                                                                                    USD {sums.USD.toFixed(2)}
                                                                                </div>
                                                                            )}
                                                                            {sums.KHR > 0 && (
                                                                                <div className="text-xs text-blue-700 font-mono">
                                                                                    KHR {sums.KHR.toLocaleString()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {msgs
                                                        .sort((a, b) => {
                                                            const aTime = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
                                                            const bTime = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
                                                            return bTime - aTime;
                                                        })
                                                        .map(msg => (
                                                            <div key={msg.updateId} className="p-4 hover:bg-gray-50 group">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-xs font-bold text-gray-500">
                                                                                {formatTime(msg.date)}
                                                                            </span>
                                                                            <span className="text-xs text-gray-400">from</span>
                                                                            <span className="text-xs font-medium text-blue-600">
                                                                                {msg.from}
                                                                            </span>
                                                                            {msg.processed && (
                                                                                <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${msg.manual
                                                                                    ? 'bg-purple-100 text-purple-700'
                                                                                    : 'bg-green-100 text-green-700'
                                                                                    }`}>
                                                                                    {msg.manual ? '✍️ Manual' : '✓ Parsed'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                                                            {msg.text || '(No text content)'}
                                                                        </p>
                                                                        {msg.transactionData && (
                                                                            <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-100">
                                                                                <p className="text-xs font-bold text-green-700 mb-1">Parsed Transaction:</p>
                                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-900">
                                                                                    <div><span className="font-semibold">Amount:</span> {msg.transactionData.currency} {msg.transactionData.amount}</div>
                                                                                    <div><span className="font-semibold">Driver:</span> {msg.transactionData.driverCode}</div>
                                                                                    <div><span className="font-semibold">Payer:</span> {msg.transactionData.payer}</div>
                                                                                    <div><span className="font-semibold">Trx ID:</span> {msg.transactionData.trxId}</div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Button
                                                                            variant="secondary"
                                                                            onClick={() => handleEditClick(msg)}
                                                                            className="h-8 w-8 p-0 flex items-center justify-center rounded-full"
                                                                            title="Edit parsing"
                                                                        >
                                                                            <EditIcon />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    </Card>
                ))
            )}

            {/* Manual Parse Modal */}
            <Modal
                isOpen={!!editingMessage}
                onClose={() => setEditingMessage(null)}
                title="Manual Transaction Parsing"
            >
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 mb-4 max-h-32 overflow-y-auto">
                        {editingMessage?.text}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={editForm.amount}
                                onChange={e => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                                value={editForm.currency}
                                onChange={e => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="KHR">KHR (៛)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Driver Code (e.g. DS004)</label>
                        <Input
                            placeholder="DS..."
                            value={editForm.driverCode}
                            onChange={e => setEditForm(prev => ({ ...prev, driverCode: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payer Name</label>
                        <Input
                            placeholder="Customer Name"
                            value={editForm.payer}
                            onChange={e => setEditForm(prev => ({ ...prev, payer: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                        <Input
                            placeholder="123456..."
                            value={editForm.trxId}
                            onChange={e => setEditForm(prev => ({ ...prev, trxId: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setEditingMessage(null)}>Cancel</Button>
                        <Button onClick={handleSaveManualParse} isLoading={saving}>Save & Mark Parsed</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

