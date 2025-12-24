
import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, UserProfile, ParcelItem } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { TrackingTimeline } from './TrackingTimeline';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { ChatModal } from '../ui/ChatModal';
import { toast } from '../../src/shared/utils/toast';

// Imported Components
import { CustomerStats } from './CustomerStats';
import { CustomerOrderCard } from './CustomerOrderCard';
import { CancelBookingModal } from './CustomerActionModals';

interface Props {
    user: UserProfile;
    onNewBooking: () => void;
}

export const CustomerDashboard: React.FC<Props> = ({ user, onNewBooking }) => {
    const { t } = useLanguage();
    const [bookings, setBookings] = useState<ParcelBooking[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

    // Modals & Selected Item State
    const [selectedBooking, setSelectedBooking] = useState<ParcelBooking | null>(null);
    const [bookingToCancel, setBookingToCancel] = useState<ParcelBooking | null>(null);
    const [initialChatItemId, setInitialChatItemId] = useState<string | undefined>(undefined);
    const [activeChat, setActiveChat] = useState<{ itemId: string, itemName: string, driverName: string, driverId?: string, bookingId: string } | null>(null);

    useEffect(() => {
        setLoading(true);
        // Use the secure, filtered subscription
        const unsubscribe = firebaseService.subscribeToCustomerBookings(
            user.uid,
            user.linkedCustomerId,
            user.name,
            (myBookings) => {
                myBookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setBookings(myBookings);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Update selected booking if data changes in background
    useEffect(() => {
        if (selectedBooking) {
            const updated = bookings.find(b => b.id === selectedBooking.id);
            if (updated) {
                setSelectedBooking(updated);
            }
        }
    }, [bookings, selectedBooking]);

    // Listen for navigation events from notifications
    useEffect(() => {
        const handleOpenChat = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { bookingId, itemId } = customEvent.detail;

            if (bookingId) {
                const targetBooking = bookings.find(b => b.id === bookingId);
                if (targetBooking) {
                    setSelectedBooking(targetBooking);
                    if (itemId) setInitialChatItemId(itemId);
                }
            }
        };

        window.addEventListener('open-chat-view', handleOpenChat);
        return () => window.removeEventListener('open-chat-view', handleOpenChat);
    }, [bookings]);

    // --- Logic Helpers ---
    const getDerivedStatus = (items: ParcelItem[], bookingStatus: string) => {
        // Safely default to empty array
        const safeItems = items || [];

        if (bookingStatus === 'CANCELLED') return 'CANCELLED';
        if (bookingStatus === 'PENDING') return 'PENDING';
        if (bookingStatus === 'CONFIRMED') return 'CONFIRMED';

        // Safe to access methods on safeItems array
        if (safeItems.some(i => i.status === 'OUT_FOR_DELIVERY')) return 'OUT_FOR_DELIVERY';
        if (safeItems.some(i => i.status === 'IN_TRANSIT')) return 'IN_TRANSIT';
        if (safeItems.some(i => i.status === 'PICKED_UP')) return 'PICKED_UP';
        if (safeItems.some(i => i.status === 'AT_WAREHOUSE')) return 'AT_WAREHOUSE';

        // safeItems.length > 0 check prevents empty array triggering 'DELIVERED' erroneously
        if (safeItems.length > 0 && safeItems.every(i => i.status === 'DELIVERED')) return 'DELIVERED';

        return (bookingStatus || '').replace('ps-', '').toUpperCase();
    };

    const confirmCancel = async () => {
        if (!bookingToCancel) return;

        // Strict Validation: Only PENDING allowed
        if (bookingToCancel.status !== 'PENDING') {
            toast.error("This booking cannot be cancelled as it is no longer pending.");
            setBookingToCancel(null);
            return;
        }

        try {
            const updatedBooking: ParcelBooking = {
                ...bookingToCancel,
                status: 'CANCELLED',
                statusId: 'ps-cancelled',
                items: (bookingToCancel.items || []).map(i => ({
                    ...i,
                    status: 'CANCELLED' as const
                })),
                statusHistory: [
                    ...(bookingToCancel.statusHistory || []),
                    {
                        statusId: 'ps-cancelled',
                        statusLabel: 'Cancelled',
                        timestamp: Date.now(),
                        updatedBy: user.name,
                        notes: 'Cancelled by customer'
                    }
                ]
            };
            await firebaseService.saveParcelBooking(updatedBooking);
            setBookingToCancel(null);
        } catch (e) {
            console.error(e);
            toast.error("Failed to cancel booking.");
        }
    };

    const handleOpenChat = (booking: ParcelBooking, item: ParcelItem) => {
        setActiveChat({
            itemId: item.id,
            bookingId: booking.id,
            itemName: item.receiverName,
            driverName: booking.driverName || 'Driver',
            driverId: booking.driverId
        });
    };

    const activeBookings = useMemo(() =>
        bookings.filter(b => {
            if (!b) return false;
            const derived = getDerivedStatus(b.items, b.status);
            return derived !== 'DELIVERED' && derived !== 'CANCELLED' && derived !== 'COMPLETED' && derived !== 'RETURNED';
        }),
        [bookings]);

    const historyBookings = useMemo(() =>
        bookings.filter(b => {
            if (!b) return false;
            const derived = getDerivedStatus(b.items, b.status);
            return derived === 'DELIVERED' || derived === 'CANCELLED' || derived === 'COMPLETED' || derived === 'RETURNED';
        }),
        [bookings]);

    const displayedBookings = tab === 'ACTIVE' ? activeBookings : historyBookings;

    const stats = useMemo(() => {
        let spentUSD = 0;
        let spentKHR = 0;

        bookings.forEach(b => {
            const fee = b.totalDeliveryFee || 0;
            const items = b.items || [];
            const itemCurrencies = new Set(items.map(i => i.codCurrency || 'USD'));
            const isMixed = itemCurrencies.has('USD') && itemCurrencies.has('KHR');

            if (isMixed && items.length > 0) {
                const khrCount = items.filter(i => (i.codCurrency || 'USD') === 'KHR').length;
                const usdCount = items.filter(i => (i.codCurrency || 'USD') === 'USD').length;
                const feePerItem = fee / items.length;

                // KHR Portion
                let khrPart = feePerItem * khrCount;
                if (b.currency === 'USD') khrPart = khrPart * 4000;
                spentKHR += khrPart;

                // USD Portion
                let usdPart = feePerItem * usdCount;
                if (b.currency === 'KHR') usdPart = usdPart / 4000;
                spentUSD += usdPart;

            } else {
                // Single Currency
                const isKHR = b.currency === 'KHR' || (!b.currency && items[0]?.codCurrency === 'KHR');
                if (isKHR) spentKHR += fee;
                else spentUSD += fee;
            }
        });

        return {
            activeCount: activeBookings.length,
            totalCount: bookings.length,
            spentUSD,
            spentKHR
        };
    }, [bookings, activeBookings]);

    return (
        <div className="space-y-6">

            {/* --- STATS & HEADER --- */}
            <CustomerStats
                user={user}
                onNewBooking={onNewBooking}
                stats={stats}
            />

            {/* --- TABS --- */}
            <div className="flex space-x-6 border-b border-gray-200 px-2">
                <button
                    className={`pb-3 text-sm font-medium transition-all ${tab === 'ACTIVE' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => setTab('ACTIVE')}
                >
                    {t('active_orders')}
                </button>
                <button
                    className={`pb-3 text-sm font-medium transition-all ${tab === 'HISTORY' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => setTab('HISTORY')}
                >
                    {t('history')}
                </button>
            </div>

            {/* --- LIST --- */}
            <div className="space-y-4 pb-20">
                {loading ? (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin mb-2"></div>
                        {t('loading')}
                    </div>
                ) : displayedBookings.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        </div>
                        <p className="text-gray-900 font-medium">No {tab.toLowerCase()} shipments</p>
                        <p className="text-gray-500 text-sm mt-1">Any new bookings will appear here.</p>
                    </div>
                ) : (
                    displayedBookings.map(b => (
                        <CustomerOrderCard
                            key={b.id}
                            booking={b}
                            derivedStatus={getDerivedStatus(b.items, b.status)}
                            onClick={setSelectedBooking}
                            onCancel={setBookingToCancel}
                            onChat={handleOpenChat}
                        />
                    ))
                )}
            </div>

            {/* --- MODALS --- */}
            {selectedBooking && (
                <TrackingTimeline
                    booking={selectedBooking}
                    currentUser={user}
                    initialChatItemId={initialChatItemId}
                    onClose={() => {
                        setSelectedBooking(null);
                        setInitialChatItemId(undefined);
                    }}
                />
            )}

            <CancelBookingModal
                isOpen={!!bookingToCancel}
                bookingId={bookingToCancel?.id || ''}
                onConfirm={confirmCancel}
                onCancel={() => setBookingToCancel(null)}
            />

            {activeChat && (
                <ChatModal
                    itemId={activeChat.itemId}
                    bookingId={activeChat.bookingId}
                    itemName={activeChat.itemName}
                    recipientName={activeChat.driverName}
                    recipientId={activeChat.driverId}
                    currentUser={user}
                    onClose={() => setActiveChat(null)}
                />
            )}
        </div>
    );
};
