
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserProfile, AppNotification } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { Button } from './Button';

interface Props {
    itemId: string;
    bookingId?: string;
    itemName: string;
    currentUser: UserProfile;
    recipientName: string;
    recipientId?: string; // User UID to notify
    onClose: () => void;
}

export const ChatModal: React.FC<Props> = ({ itemId, bookingId, itemName, currentUser, recipientName, recipientId, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Subscribe to chat updates
        const unsubscribe = firebaseService.subscribeToChat(itemId, (msgs) => {
            setMessages(msgs);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });
        return () => unsubscribe();
    }, [itemId]);

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        const msg: ChatMessage = {
            id: `msg-${Date.now()}`,
            itemId,
            bookingId,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            senderRole: currentUser.role === 'driver' ? 'driver' : 'customer',
            text: newMessage.trim(),
            timestamp: Date.now()
        };

        try {
            await firebaseService.sendChatMessage(msg);

            // Send Notification to the recipient
            // This ensures they get a bell alert / popup even if chat is closed
            if (recipientId) {
                const notif: AppNotification = {
                    id: `notif-chat-${Date.now()}`,
                    targetAudience: recipientId,
                    title: `New message from ${currentUser.name}`,
                    message: newMessage.trim().substring(0, 60) + (newMessage.length > 60 ? '...' : ''),
                    type: 'INFO',
                    read: false,
                    createdAt: Date.now(),
                    metadata: {
                        type: 'CHAT',
                        bookingId: bookingId,
                        itemId: itemId
                    }
                };
                await firebaseService.sendNotification(notif);
            }

            setNewMessage('');
        } catch (e) {
            console.error(e);
            toast.error("Failed to send message");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white w-full max-w-md h-[500px] rounded-2xl flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-4 py-3 bg-indigo-600 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold">
                                {recipientName.charAt(0)}
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-indigo-600 rounded-full"></div>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">{recipientName}</h3>
                            <p className="text-xs text-indigo-200 truncate max-w-[150px]">{itemName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-indigo-200 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs">
                            <svg className="w-12 h-12 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <p>Start the conversation with {recipientName}</p>
                        </div>
                    )}

                    {messages.map(msg => {
                        const isMe = msg.senderId === currentUser.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative group ${isMe
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                    }`}>
                                    {!isMe && <div className="text-[10px] font-bold text-gray-500 mb-0.5">{msg.senderName}</div>}
                                    <p className="leading-relaxed">{msg.text}</p>
                                    <div className={`text-[9px] mt-1 text-right opacity-70 ${isMe ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Footer Input */}
                <div className="p-3 bg-white border-t border-gray-200">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                className="w-full border border-gray-300 rounded-2xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none overflow-hidden"
                                placeholder="Type a message..."
                                rows={1}
                                style={{ minHeight: '44px', maxHeight: '100px' }}
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className="bg-indigo-600 text-white rounded-full p-3 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md h-11 w-11 flex items-center justify-center"
                        >
                            <svg className="w-5 h-5 translate-x-0.5 translate-y-[-1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
