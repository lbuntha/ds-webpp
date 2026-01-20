import React from 'react';
import { ParcelBooking, ParcelItem } from '../../src/shared/types';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

interface Props {
    booking: ParcelBooking;
    derivedStatus: string;
    onClick: (booking: ParcelBooking) => void;
    onCancel: (booking: ParcelBooking) => void;
    onChat: (booking: ParcelBooking, item: ParcelItem) => void;
}

export const CustomerOrderCard: React.FC<Props> = ({ booking, derivedStatus, onClick, onCancel, onChat }) => {
    const { t } = useLanguage();
    const items = booking.items || [];
    const itemCount = items.length;
    const firstImage = items[0]?.image;

    const timeAgo = (timestamp: number) => {
        if (!timestamp) return '';
        const now = Date.now();
        const seconds = Math.floor((now - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        switch (s) {
            case 'PENDING': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-gray-100 text-gray-600 border border-gray-200">Pending</span>;
            case 'CONFIRMED': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-blue-50 text-blue-600 border border-blue-100">Accepted</span>;
            case 'PICKED_UP': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-blue-100 text-blue-700 border border-blue-200 animate-pulse">Picked Up</span>;
            case 'IN_TRANSIT': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span> On The Way</span>;
            case 'AT_WAREHOUSE': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">At Warehouse</span>;
            case 'OUT_FOR_DELIVERY': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span> Out for Delivery</span>;
            case 'DELIVERED': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-green-100 text-green-700 border border-green-200">Delivered</span>;
            case 'CANCELLED': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-red-100 text-red-700 border border-red-200">Cancelled</span>;
            case 'RETURNED': return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-red-100 text-red-700 border border-red-200">Returned</span>;
            default: return <span className="px-2 py-1 rounded-lg text-[10px] uppercase font-bold bg-gray-100 text-gray-800 border border-gray-200">{s}</span>;
        }
    };

    return (
        <div
            onClick={() => onClick(booking)}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-red-100 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                    {firstImage ? (
                        <div className="h-12 w-12 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                            <img src={firstImage} alt="Parcel" className="h-full w-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </div>
                    )}
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm">{booking.serviceTypeName}</h3>
                        <p className="text-xs text-gray-400">
                            {booking.createdAt ? timeAgo(booking.createdAt) : booking.bookingDate}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(derivedStatus)}

                    {/* Chat Button */}
                    {booking.driverId && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onChat(booking, items[0]); }}
                            className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors shadow-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="text-[10px] font-bold uppercase">Chat</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {items.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center text-sm">
                        <div className={`w-2 h-2 rounded-full mr-3 flex-shrink-0 ${item.status === 'DELIVERED' ? 'bg-green-500' : item.status === 'IN_TRANSIT' ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-gray-700 truncate">{item.receiverName}</span>
                                {item.status && item.status !== 'PENDING' && (
                                    <span className={`text-[10px] uppercase ${item.status === 'DELIVERED' ? 'text-green-600' : item.status === 'CANCELLED' ? 'text-red-600' : 'text-gray-500'}`}>
                                        {(item.status || '').replace('_', ' ')}
                                    </span>
                                )}
                            </div>
                            <span className="text-gray-500 truncate block text-xs">{item.destinationAddress}</span>
                        </div>
                    </div>
                ))}
                {itemCount > 2 && <p className="text-xs text-gray-400 pl-5">+ {itemCount - 2} more items</p>}
            </div>

            <div className="flex justify-between items-center text-sm border-t border-gray-50 pt-3 mt-3">
                <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-mono text-[10px] tracking-wider">#{(booking.id || '').slice(-6)}</span>

                    {/* STRICT CONDITION: Allow Cancel ONLY if PENDING. Disable once CONFIRMED or later. */}
                    {derivedStatus === 'PENDING' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel(booking); }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline z-20 relative px-2 py-0.5 rounded border border-transparent hover:border-red-100 hover:bg-red-50"
                        >
                            {t('cancel_booking')}
                        </button>
                    )}
                </div>
                <div className="flex items-center font-bold text-gray-900">
                    {(() => {
                        // Sum fees by item currency (each item has its own deliveryFee and codCurrency)
                        let usdFee = 0;
                        let khrFee = 0;

                        items.forEach(item => {
                            // Robust fallbacks for legacy/mixed data
                            const isKHR = item.codCurrency === 'KHR';

                            if (isKHR) {
                                // If KHR, prefer KHR fee, fallback to converted USD fee or standard fee
                                const val = Number(item.deliveryFeeKHR) || (Number(item.deliveryFeeUSD || item.deliveryFee) * 4100);
                                khrFee += val;
                            } else {
                                // If USD, prefer USD fee, fallback to converted KHR fee or standard fee
                                const val = Number(item.deliveryFeeUSD) || (Number(item.deliveryFeeKHR || item.deliveryFee) / 4100);
                                usdFee += val;
                            }
                        });

                        // If we have fees in both currencies
                        if (usdFee > 0 && khrFee > 0) {
                            return `$${usdFee.toFixed(2)} + ${khrFee.toLocaleString()} ៛`;
                        }

                        // Single currency display
                        if (khrFee > 0) {
                            return `${khrFee.toLocaleString()} ៛`;
                        }

                        // Fallback to booking.totalDeliveryFee if no per-item fees
                        if (usdFee === 0 && khrFee === 0) {
                            const fee = booking.totalDeliveryFee || 0;
                            const itemCurrencies = new Set(items.map(i => i.codCurrency || 'USD'));
                            const hasKHR = itemCurrencies.has('KHR') && !itemCurrencies.has('USD');
                            return hasKHR ? `${fee.toLocaleString()} ៛` : `$${fee.toFixed(2)}`;
                        }

                        return `$${usdFee.toFixed(2)}`;
                    })()}
                    <svg className="w-4 h-4 ml-1 text-gray-300 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
            </div>
        </div>
    );
};
