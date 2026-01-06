import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/shared/services/firebaseInstance';
import { toast } from '../../src/shared/utils/toast';
import { env } from '../../src/config/env';

interface LinkedUser {
    id: string;
    name: string;
    phone?: string;
    telegramChatId: string;
}

interface BroadcastJob {
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    message: string;
    totalRecipients: number;
    sent: number;
    failed: number;
    progress: number;
    createdAt: any;
}

// Icons
const SendIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const RefreshIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const CheckIcon = () => (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
);

const XIcon = () => (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const TelegramBroadcast: React.FC = () => {
    const [users, setUsers] = useState<LinkedUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<LinkedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalCount, setTotalCount] = useState(0);

    // Job tracking (for future background jobs)
    const [recentJobs, setRecentJobs] = useState<BroadcastJob[]>([]);

    const loadLinkedUsers = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, 'customers'));
            const linked = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    name: doc.data().name || doc.data().businessName || 'Unknown',
                    phone: doc.data().phone,
                    telegramChatId: doc.data().telegramChatId
                } as LinkedUser))
                .filter(u => u.telegramChatId && u.telegramChatId.trim() !== '')
                .sort((a, b) => a.name.localeCompare(b.name));

            setUsers(linked);
            setFilteredUsers(linked);
            setTotalCount(linked.length);
        } catch (e) {
            console.error('Failed to load linked users:', e);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredUsers(users);
        } else {
            const q = searchQuery.toLowerCase();
            setFilteredUsers(
                users.filter(u =>
                    u.name.toLowerCase().includes(q) ||
                    (u.phone && u.phone.includes(q))
                )
            );
        }
    }, [searchQuery, users]);

    const loadRecentJobs = useCallback(async () => {
        try {
            const q = query(
                collection(db, 'telegram_broadcast_jobs'),
                orderBy('createdAt', 'desc'),
                limit(5)
            );
            const snapshot = await getDocs(q);
            setRecentJobs(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastJob)));
        } catch (e) {
            // Jobs collection may not exist yet
        }
    }, []);

    useEffect(() => {
        loadLinkedUsers();
        loadRecentJobs();
    }, [loadRecentJobs]);

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        }
        setSelectAll(!selectAll);
    };

    // Image handling
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validate size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size must be less than 5MB');
                return;
            }

            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
    };

    const handleSend = async () => {
        if (!message.trim() && !selectedImage) {
            toast.error('Please enter a message or select an image');
            return;
        }

        if (selectedUsers.size === 0) {
            toast.error('Please select at least one recipient');
            return;
        }

        setSending(true);
        try {
            const recipients = users
                .filter(u => selectedUsers.has(u.id))
                .map(u => ({ customerId: u.id, chatId: u.telegramChatId, name: u.name }));

            // Prepare payload
            const payload: any = {
                message: message.trim(),
                recipients
            };

            if (selectedImage && imagePreview) {
                payload.image = imagePreview; // Base64 string
                payload.filename = selectedImage.name;
            }

            // Use REST API endpoint (Cloud Function)
            const response = await fetch(`${env.app.apiUrl}/telegram/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Message sent to ${data.sent} users${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
                setMessage('');
                clearImage();
                setSelectedUsers(new Set());
                setSelectAll(false);
            } else {
                toast.error(data.error || 'Failed to send messages');
            }
        } catch (e: any) {
            console.error('Broadcast error:', e);
            toast.error(e.message || 'Failed to send broadcast');
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700';
            case 'PROCESSING': return 'bg-blue-100 text-blue-700';
            case 'FAILED': return 'bg-red-100 text-red-700';
                console.log("No status change");
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            {/* Compose Message */}
            <Card title="Compose Message">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Message</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 min-h-[120px] text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your message here... (Markdown supported: *bold*, _italic_)"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Supports Markdown: *bold*, _italic_, `code`
                        </p>
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Attachment (Optional)</label>
                        {!imagePreview ? (
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> image</p>
                                        <p className="text-xs text-gray-500">PNG, JPG or GIF (MAX. 5MB)</p>
                                    </div>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                                </label>
                            </div>
                        ) : (
                            <div className="relative w-fit">
                                <img src={imagePreview} alt="Preview" className="h-32 rounded-lg border border-gray-200" />
                                <button
                                    onClick={clearImage}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                                >
                                    <XIcon />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div className="text-sm text-gray-600">
                            <span className="font-bold text-blue-600">{selectedUsers.size}</span> of {totalCount} recipients selected
                        </div>
                        <Button
                            onClick={handleSend}
                            isLoading={sending}
                            disabled={(!message.trim() && !selectedImage) || selectedUsers.size === 0 || sending}
                            className="flex items-center gap-2"
                        >
                            <SendIcon />
                            Send to {selectedUsers.size} User{selectedUsers.size !== 1 ? 's' : ''}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Recipients */}
            <Card title={`Linked Users (${totalCount})`} action={
                <Button variant="secondary" onClick={loadLinkedUsers} isLoading={loading} className="text-sm flex items-center gap-1">
                    <RefreshIcon />
                    Refresh
                </Button>
            }>
                <div className="mb-4">
                    <Input
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full"
                    />
                </div>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500 mb-2">No users with linked Telegram accounts found.</p>
                        <p className="text-xs text-gray-400">Users can link their accounts via the customer app.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectAll && selectedUsers.size === filteredUsers.length}
                                    onChange={handleSelectAll}
                                    className="rounded text-blue-600 w-5 h-5"
                                />
                                <span className="font-medium text-gray-700">
                                    Select All ({filteredUsers.length} users)
                                </span>
                            </label>
                            {selectedUsers.size > 0 && (
                                <button
                                    onClick={() => { setSelectedUsers(new Set()); setSelectAll(false); }}
                                    className="text-xs text-red-600 hover:underline"
                                >
                                    Clear Selection
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${selectedUsers.has(user.id)
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                    onClick={() => toggleUser(user.id)}
                                >
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.has(user.id)}
                                            onChange={() => toggleUser(user.id)}
                                            className="rounded text-blue-600 w-4 h-4"
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">{user.name}</div>
                                            {user.phone && (
                                                <div className="text-xs text-gray-500">{user.phone}</div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Linked
                                    </span>
                                </div>
                            ))}
                        </div>

                        {filteredUsers.length === 0 && searchQuery && (
                            <p className="text-center text-gray-500 py-4">No users match "{searchQuery}"</p>
                        )}
                    </div>
                )}
            </Card>

            {/* Recent Jobs */}
            {recentJobs.length > 0 && (
                <Card title="Recent Broadcasts">
                    <div className="space-y-2">
                        {recentJobs.map(job => (
                            <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(job.status)}`}>
                                            {job.status}
                                        </span>
                                        <span className="text-sm text-gray-600 truncate max-w-[200px]">
                                            {job.message.substring(0, 50)}{job.message.length > 50 ? '...' : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                    <div>{job.totalRecipients} recipients</div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="flex items-center gap-0.5"><CheckIcon /> {job.sent}</span>
                                        <span className="flex items-center gap-0.5"><XIcon /> {job.failed}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};
