import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { logisticsService } from '../../src/shared/services/logisticsService';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { ParcelBooking, ParcelItem, ChatMessage, UserProfile } from '../../src/shared/types';
import { collection, query, where, getDocs, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../src/shared/services/firebaseInstance';
import { toast } from '../../src/shared/utils/toast';

interface DelayedSenderGroup {
    senderId: string;
    senderName: string;
    senderPhone: string;
    items: {
        booking: ParcelBooking;
        item: ParcelItem;
        chatCount: number;
        lastMessage?: ChatMessage;
        lastMessageTime?: number;
        messages: ChatMessage[];
    }[];
}

interface DelayedStatusGroup {
    status: string;
    senders: DelayedSenderGroup[];
}

const DELAY_OPTIONS = [3, 5, 10, 20];

const ImageModal: React.FC<{ src: string, onClose: () => void }> = ({ src, onClose }) => {
    if (!src) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4" onClick={onClose}>
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                <img
                    src={src}
                    alt="Parcel Full View"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                <button
                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
                    onClick={onClose}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

// Helper to chunk array
const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunked: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

export const DelayedChatReport: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [delayHours, setDelayHours] = useState<number>(20); // Default 20h
    const [showOnlyWithChats, setShowOnlyWithChats] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [reportData, setReportData] = useState<DelayedSenderGroup[]>([]);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Chat Inputs State
    const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
    const [sendingChat, setSendingChat] = useState<Record<string, boolean>>({});

    // Cache for chat data to avoid refetching too often if not needed
    const [chatCache, setChatCache] = useState<Record<string, { count: number, lastMsg?: ChatMessage, messages: ChatMessage[] }>>({});

    useEffect(() => {
        fetchDelayedParcels();
    }, [delayHours]);

    const fetchDelayedParcels = async () => {
        setLoading(true);
        try {
            const activeStatuses = ['PENDING', 'CONFIRMED', 'Picked Up', 'PICKED_UP', 'AT_WAREHOUSE', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'UPDATED'];
            const q = query(
                collection(db, 'parcel_bookings'),
                where('status', 'in', activeStatuses)
            );

            const snapshot = await getDocs(q);
            const now = Date.now();
            const thresholdTime = now - (delayHours * 60 * 60 * 1000);

            let delayedGroups: Record<string, DelayedSenderGroup> = {};
            const itemsToFetchChatFor: string[] = [];

            snapshot.docs.forEach(doc => {
                const booking = doc.data() as ParcelBooking;
                if (booking.createdAt > thresholdTime) return;

                if (booking.items) {
                    booking.items.forEach(item => {
                        if (['DELIVERED', 'CANCELLED', 'RETURN_TO_SENDER'].includes(item.status || '')) return;

                        const senderKey = booking.senderId || booking.senderName;
                        if (!delayedGroups[senderKey]) {
                            delayedGroups[senderKey] = {
                                senderId: booking.senderId || '',
                                senderName: booking.senderName,
                                senderPhone: booking.senderPhone,
                                items: []
                            };
                        }

                        delayedGroups[senderKey].items.push({
                            booking,
                            item,
                            chatCount: 0, // Will populate
                            messages: []
                        });

                        itemsToFetchChatFor.push(item.id);
                    });
                }
            });

            // Optimized Batch Fetching
            if (itemsToFetchChatFor.length > 0) {
                // Chunk IDs into groups of 30 (Firestore IN limit)
                const chunks = chunkArray(itemsToFetchChatFor, 30);

                await Promise.all(chunks.map(async (chunkIds) => {
                    const chatQ = query(collection(db, 'chat_messages'), where('itemId', 'in', chunkIds));
                    const chatSnap = await getDocs(chatQ);

                    const chunkCache: Record<string, { count: number, lastMsg?: ChatMessage, messages: ChatMessage[] }> = {};

                    if (!chatSnap.empty) {
                        chatSnap.docs.forEach(d => {
                            const msg = d.data() as ChatMessage;
                            if (!chunkCache[msg.itemId]) {
                                chunkCache[msg.itemId] = { count: 0, messages: [] };
                            }
                            chunkCache[msg.itemId].messages.push(msg);
                            chunkCache[msg.itemId].count++;
                        });
                    }

                    // Process locally aggregated messages for this chunk
                    Object.keys(chunkCache).forEach(itemId => {
                        const data = chunkCache[itemId];
                        data.messages.sort((a, b) => b.timestamp - a.timestamp);
                        data.lastMsg = data.messages[0];
                    });

                    // Merge into main cache
                    setChatCache(prev => ({
                        ...prev,
                        ...chunkCache
                    }));
                }));
            }

            setReportData(Object.values(delayedGroups));

        } catch (e: any) {
            console.error("Error fetching delayed parcels", e);
            toast.error(`Failed to load delayed parcels: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const groupedData = useMemo(() => {
        // First, process the raw data to include chat info
        let processedData = reportData.map(group => {
            const itemsWithChat = group.items.map(i => {
                const cache = chatCache[i.item.id];
                return {
                    ...i,
                    chatCount: cache?.count || 0,
                    lastMessage: cache?.lastMsg,
                    lastMessageTime: cache?.lastMsg?.timestamp,
                    messages: cache?.messages || []
                };
            });

            const filteredItems = showOnlyWithChats
                ? itemsWithChat.filter(i => i.chatCount > 0)
                : itemsWithChat;

            return {
                ...group,
                items: filteredItems
            };
        }).filter(g => g.items.length > 0);

        // Filter by Search Term
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            processedData = processedData.map(group => {
                // Check if sender matches
                const senderMatches =
                    (group.senderName || '').toLowerCase().includes(lowerSearch) ||
                    (group.senderPhone || '').toLowerCase().includes(lowerSearch);

                if (senderMatches) {
                    return group; // Return all items if sender matches
                }

                // Otherwise filter items
                const matchingItems = group.items.filter(entry =>
                    (entry.item.receiverName || '').toLowerCase().includes(lowerSearch) ||
                    (entry.item.receiverPhone || '').toLowerCase().includes(lowerSearch) ||
                    (entry.item.barcode || '').toLowerCase().includes(lowerSearch)
                );

                return {
                    ...group,
                    items: matchingItems
                };
            }).filter(g => g.items.length > 0);
        }

        // Sort senders by name
        processedData.sort((a, b) => a.senderName.localeCompare(b.senderName));


        // Now Group by Status
        const statusGroups: Record<string, DelayedSenderGroup[]> = {};

        processedData.forEach(senderGroup => {
            // A sender group might have items with DIFFERENT statuses.
            // We need to split the sender group OR list items under status.
            // Requirement: "Group parcels by their current status"
            // Re-structure: Top Level is STATUS. Under that is Send/Items.

            senderGroup.items.forEach(entry => {
                const status = entry.item.status || 'UNKNOWN';

                // We need to re-aggregate under Status -> Sender
                // This is a bit complex because a sender appears in multiple statuses

                // Let's create a flat list of (Status -> Sender -> [Items])
                if (!statusGroups[status]) {
                    statusGroups[status] = [];
                }

                // Find or create sender group within this status
                let statusSenderGroup = statusGroups[status].find(g => g.senderId === senderGroup.senderId && g.senderName === senderGroup.senderName);
                if (!statusSenderGroup) {
                    statusSenderGroup = {
                        ...senderGroup,
                        items: [] // Reset items for this slice
                    };
                    statusGroups[status].push(statusSenderGroup);
                }

                statusSenderGroup.items.push(entry);
            });
        });

        // Convert record to array
        const result: DelayedStatusGroup[] = Object.entries(statusGroups).map(([status, senders]) => ({
            status,
            senders: senders.sort((a, b) => a.senderName.localeCompare(b.senderName))
        }));

        // Sort statuses? (Maybe by logical order if possible, else alpha)
        const STATUS_ORDER = ['PENDING', 'PICKED_UP', 'AT_WAREHOUSE', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'UPDATED', 'UNKNOWN'];
        result.sort((a, b) => {
            const idxA = STATUS_ORDER.indexOf(a.status);
            const idxB = STATUS_ORDER.indexOf(b.status);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.status.localeCompare(b.status);
        });

        return result;

    }, [reportData, chatCache, showOnlyWithChats, searchTerm]);

    const handleSendChat = async (itemId: string, bookingId: string, receiverId: string) => { // receiverId is usually the customer
        const text = chatInputs[itemId];
        if (!text || !text.trim()) return;

        setSendingChat(prev => ({ ...prev, [itemId]: true }));
        try {
            const msg: ChatMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                itemId,
                senderId: user?.uid || 'warehouse-staff',
                senderName: user?.name || 'Warehouse Staff',
                text: text.trim(),
                timestamp: Date.now(),
                // isStaff: true, // Removed internal flag
                readBy: [user?.uid || 'warehouse-staff']
            };

            await logisticsService.sendChatMessage(msg);

            // Update cache immediately to reflect change
            setChatCache(prev => {
                const currentMessages = prev[itemId]?.messages || [];
                const updatedMessages = [msg, ...currentMessages]; // Prepend new message
                return {
                    ...prev,
                    [itemId]: {
                        count: (prev[itemId]?.count || 0) + 1,
                        lastMsg: msg,
                        messages: updatedMessages
                    }
                };
            });

            setChatInputs(prev => ({ ...prev, [itemId]: '' }));
            toast.success('Remark sent');

        } catch (e: any) {
            console.error(e);
            toast.error('Failed to send remark');
        } finally {
            setSendingChat(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleExportExcel = (group: DelayedSenderGroup, statusContext: string) => {
        if (!group.items || group.items.length === 0) {
            toast.error("No items to export");
            return;
        }

        const headers = ['Date', 'Barcode', 'Receiver Name', 'Receiver Phone', 'Status', 'Latest Remark/Reason'];
        const rows = group.items.map(entry => {
            const lastMsg = chatCache[entry.item.id]?.lastMsg;
            const remark = lastMsg ? `${lastMsg.senderName}: ${lastMsg.text}` : '';

            return [
                new Date(entry.booking.createdAt).toLocaleDateString() + ' ' + new Date(entry.booking.createdAt).toLocaleTimeString(),
                entry.item.barcode || entry.item.id?.slice(-8).toUpperCase() || '',
                entry.item.receiverName,
                entry.item.receiverPhone || '',
                (entry.item.status || 'UNKNOWN').replace(/_/g, ' '),
                remark
            ];
        });

        // Add BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";
        const csvContent = BOM + [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Clean filename
        const safeName = (group.senderName || 'Sender').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeStatus = statusContext.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().split('T')[0];

        const link = document.createElement('a');
        link.href = url;
        link.download = `delayed_${safeStatus}_${safeName}_${dateStr}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${group.senderName} list`);
    };

    return (
        <Card>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Delayed Chats & Remarks</h2>
                        <p className="text-sm text-gray-500">Parcels created more than {delayHours} hours ago. Grouped by Status.</p>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* Search Input */}
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search Sender/Receiver/Phone..."
                                className="pl-10 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md py-2"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="flex items-center space-x-1 bg-white border border-gray-200 p-1 rounded-md">
                            {DELAY_OPTIONS.map(h => (
                                <button
                                    key={h}
                                    onClick={() => setDelayHours(h)}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${delayHours === h ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {h}h
                                </button>
                            ))}
                        </div>

                        <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showOnlyWithChats}
                                onChange={e => setShowOnlyWithChats(e.target.checked)}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>With Chats</span>
                        </label>

                        <Button variant="outline" onClick={fetchDelayedParcels} disabled={loading} size="sm">
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-400">Loading delayed parcels...</div>
                ) : groupedData.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        No delayed parcels found &gt; {delayHours} hours {showOnlyWithChats ? 'with chats' : ''} {searchTerm ? `matching "${searchTerm}"` : ''}.
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedData.map((statusGroup, sIdx) => (
                            <CollapsibleStatusGroup
                                key={sIdx}
                                statusGroup={statusGroup}
                                handleExportExcel={handleExportExcel}
                                handleSendChat={handleSendChat}
                                chatInputs={chatInputs}
                                setChatInputs={setChatInputs}
                                sendingChat={sendingChat}
                                setExpandedImage={setExpandedImage}
                                chatCache={chatCache}
                            />
                        ))}
                    </div>
                )}
            </div>

            {expandedImage && (
                <ImageModal src={expandedImage} onClose={() => setExpandedImage(null)} />
            )}
        </Card>
    );
};

const CollapsibleStatusGroup: React.FC<{
    statusGroup: DelayedStatusGroup,
    handleExportExcel: (group: DelayedSenderGroup, status: string) => void,
    handleSendChat: (itemId: string, bookingId: string, receiverId: string) => void,
    chatInputs: Record<string, string>,
    setChatInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    sendingChat: Record<string, boolean>,
    setExpandedImage: (src: string) => void,
    chatCache: Record<string, { count: number, lastMsg?: ChatMessage, messages: ChatMessage[] }>
}> = ({ statusGroup, handleExportExcel, handleSendChat, chatInputs, setChatInputs, sendingChat, setExpandedImage, chatCache }) => {
    // Default to collapsed for performance if list is long
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

    const toggleHistory = (itemId: string) => {
        setExpandedHistory(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    return (
        <div className="space-y-4">
            {/* Status Header */}
            <div
                className="flex items-center gap-2 border-b-2 border-indigo-100 pb-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors select-none"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className={`transform transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <h3 className={`text-lg font-black uppercase tracking-wide px-3 py-1 rounded ${statusGroup.status === 'AT_WAREHOUSE' ? 'bg-purple-100 text-purple-800' :
                    statusGroup.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {statusGroup.status.replace(/_/g, ' ')}
                </h3>
                <span className="text-gray-400 text-sm font-medium">({statusGroup.senders.reduce((s, g) => s + g.items.length, 0)} Items)</span>
            </div>

            {/* Sender Groups within Status */}
            {!isCollapsed && (
                <div className="grid grid-cols-1 gap-6 pl-2 md:pl-4 transition-all duration-300">
                    {statusGroup.senders.map((group, gIdx) => (
                        <div key={gIdx} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                        {group.senderName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm md:text-base">{group.senderName}</h4>
                                        <p className="text-xs text-gray-500">{group.senderPhone} • {group.items.length} Item{group.items.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                    onClick={(e) => { e.stopPropagation(); handleExportExcel(group, statusGroup.status); }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export Excel
                                </Button>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {group.items.map((entry, itemIdx) => (
                                    <div key={itemIdx} className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4">
                                        {/* Item Details */}
                                        <div className="flex-1">
                                            <div className="flex gap-4">
                                                {/* Parcel Image Thumbnail */}
                                                <div
                                                    className="w-16 h-16 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden cursor-pointer border border-gray-200 hover:border-indigo-300 transition-all"
                                                    onClick={() => entry.item.image && setExpandedImage(entry.item.image)}
                                                >
                                                    {entry.item.image ? (
                                                        <img src={entry.item.image} alt="Parcel" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">
                                                            {entry.item.barcode || 'NO_BARCODE'}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-900">{entry.item.receiverName}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 space-y-0.5">
                                                        <div>To: {entry.item.receiverPhone}</div>
                                                        <div>Loc: {entry.item.destinationAddress}</div>
                                                        <div className="text-gray-400">Created: {new Date(entry.booking.createdAt).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            {entry.lastMessageTime && (
                                                <span className="text-xs text-gray-400">
                                                    Last chat: {new Date(entry.lastMessageTime).toLocaleString()}
                                                </span>
                                            )}

                                            {/* Chat History Section */}
                                            {entry.messages && entry.messages.length > 0 ? (
                                                <div className="mt-3">
                                                    {expandedHistory[entry.item.id] ? (
                                                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-2 max-h-60 overflow-y-auto">
                                                            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                                                                <span className="text-xs font-bold text-gray-500">History ({entry.messages.length})</span>
                                                                <button
                                                                    onClick={() => toggleHistory(entry.item.id)}
                                                                    className="text-xs text-indigo-600 hover:text-indigo-800"
                                                                >
                                                                    Hide
                                                                </button>
                                                            </div>
                                                            {entry.messages.map((msg, mIdx) => (
                                                                <div key={msg.id || mIdx} className="bg-white p-2 rounded shadow-sm text-sm">
                                                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                                        <span className="font-bold text-gray-600">{msg.senderName}</span>
                                                                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="text-gray-700">{msg.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm mt-2 relative group">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-bold text-indigo-600 text-xs">{entry.lastMessage?.senderName}</span>
                                                                <button
                                                                    onClick={() => toggleHistory(entry.item.id)}
                                                                    className="text-xs text-indigo-600 hover:text-indigo-800 underline opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    View History ({entry.messages.length})
                                                                </button>
                                                            </div>
                                                            <p className="text-gray-700">{entry.lastMessage?.text}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-400 italic pl-1 mt-2">No chat history</div>
                                            )}
                                        </div>

                                        {/* Chat Action Area */}
                                        <div className="md:w-64 flex-shrink-0 flex flex-col justify-between">
                                            <div className="text-xs font-bold text-gray-500 mb-1">Warehouse/Driver Remark</div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Reason for delay..."
                                                    className="flex-1 text-sm border-gray-300 rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                    value={chatInputs[entry.item.id] || ''}
                                                    onChange={e => setChatInputs(prev => ({ ...prev, [entry.item.id]: e.target.value }))}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSendChat(entry.item.id, entry.booking.id, entry.booking.senderId || '');
                                                    }}
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSendChat(entry.item.id, entry.booking.id, entry.booking.senderId || '')}
                                                    disabled={!chatInputs[entry.item.id] || sendingChat[entry.item.id]}
                                                    className="w-16"
                                                >
                                                    {sendingChat[entry.item.id] ? '...' : 'Send'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
