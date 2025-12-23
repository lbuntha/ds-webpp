import React, { useState, useEffect } from 'react';
import { ParcelBooking, ParcelItem, UserProfile, ParcelModification } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { ChatModal } from '../ui/ChatModal';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    booking: ParcelBooking;
    currentUser?: UserProfile;
    initialChatItemId?: string;
    onClose: () => void;
    onUpdate?: () => void;
    hideCloseButton?: boolean;
}

export const TrackingTimeline: React.FC<Props> = ({ booking, currentUser, initialChatItemId, onClose, onUpdate, hideCloseButton }) => {
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // COD Editing State
    const [editingCodItem, setEditingCodItem] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState<number>(0);
    const [editCurrency, setEditCurrency] = useState<'USD' | 'KHR'>('USD');
    const [isSaving, setIsSaving] = useState(false);

    // Chat State
    const [activeChat, setActiveChat] = useState<{ itemId: string, itemName: string, driverName: string, driverId?: string } | null>(null);

    // Helper to determine step index (0-4)
    const getStepStatus = (status: string) => {
        const s = (status || 'PENDING').toUpperCase();
        if (s === 'CANCELLED' || s === 'RETURN_TO_SENDER') return -1; // Special states
        if (s === 'DELIVERED' || s === 'COMPLETED') return 4;
        if (s === 'IN_TRANSIT' || s === 'AT_WAREHOUSE') return 3;
        if (s === 'PICKED_UP') return 2;
        if (s === 'CONFIRMED') return 1;
        return 0; // PENDING
    };

    const steps = [
        { label: 'Placed', icon: '📝' },
        { label: 'Confirmed', icon: '👍' },
        { label: 'Picked Up', icon: '📦' },
        { label: 'In Transit', icon: '🚚' },
        { label: 'Delivered', icon: '🏡' }
    ];

    // --- COD EDIT HANDLERS ---
    const startEditingCod = (item: ParcelItem) => {
        setEditingCodItem(item.id);
        setEditAmount(item.productPrice || 0);
        setEditCurrency(item.codCurrency || (Number(item.productPrice) >= 1000 ? 'KHR' : 'USD'));
    };

    const saveCod = async () => {
        if (!editingCodItem) return;
        setIsSaving(true);
        try {
            const updatedItems = booking.items.map(i => {
                if (i.id === editingCodItem) {
                    return {
                        ...i,
                        productPrice: editAmount,
                        codCurrency: editCurrency,
                        // Track modification
                        modifications: [
                            ...(i.modifications || []),
                            {
                                timestamp: Date.now(),
                                userId: currentUser?.uid || 'customer',
                                userName: currentUser?.name || 'Customer',
                                field: 'COD Amount',
                                oldValue: `${i.productPrice} ${i.codCurrency}`,
                                newValue: `${editAmount} ${editCurrency}`
                            }
                        ]
                    };
                }
                return i;
            });

            await firebaseService.saveParcelBooking({
                ...booking,
                items: updatedItems
            });

            setEditingCodItem(null);
            if (onUpdate) onUpdate();
        } catch (e) {
            console.error(e);
            toast.error("Failed to update COD.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderProgressBar = (item: ParcelItem) => {
        const currentStep = getStepStatus(item.status || booking.status);
        const isCancelled = item.status === 'CANCELLED' || item.status === 'RETURN_TO_SENDER';

        if (isCancelled) {
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center mb-4">
                    <p className="text-red-700 font-bold text-sm uppercase">
                        {item.status === 'RETURN_TO_SENDER' ? 'Returned to Sender' : 'Booking Cancelled'}
                    </p>
                </div>
            );
        }

        return (
            <div className="mb-6 px-1 sm:px-2">
                <div className="relative flex justify-between items-center">
                    {/* Background Line */}
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -z-10 rounded"></div>
                    {/* Active Line */}
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-green-500 -z-10 rounded transition-all duration-500"
                        style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                    ></div>

                    {steps.map((step, idx) => {
                        const isActive = idx <= currentStep;
                        const isCurrent = idx === currentStep;

                        return (
                            <div key={idx} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 transition-all duration-300 z-10 ${isActive ? 'bg-green-500 border-green-500 text-white shadow-md' : 'bg-white border-gray-300 text-gray-400'
                                    } ${isCurrent ? 'ring-4 ring-green-100 scale-110' : ''}`}>
                                    {isActive ? (idx < currentStep ? '✓' : step.icon) : step.icon}
                                </div>
                                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-green-700' : 'text-gray-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const getCombinedHistory = (item: ParcelItem) => {
        // Combine booking-level status history with item-level modifications
        const timeline: { date: number, label: string, desc?: string, type: 'STATUS' | 'MOD' }[] = [];

        // 1. Booking History (Global steps)
        booking.statusHistory?.forEach(h => {
            timeline.push({
                date: h.timestamp,
                label: h.statusLabel,
                desc: h.notes,
                type: 'STATUS'
            });
        });

        // 2. Item Modifications (Specifics like Driver assignment, Pickup verification)
        if (item.modifications) {
            item.modifications.forEach(m => {
                if (m.field === 'Status' || m.field === 'Driver Assigned' || m.field === 'COD Amount') {
                    timeline.push({
                        date: m.timestamp,
                        label: m.field === 'Status' ? m.newValue : 'Update',
                        desc: `${m.field}: ${m.newValue}`,
                        type: 'MOD'
                    });
                }
            });
        }

        // 3. Creation
        if (booking.createdAt) {
            timeline.push({ date: booking.createdAt, label: 'Booking Created', type: 'STATUS' });
        }

        return timeline.sort((a, b) => b.date - a.date); // Newest first
    };

    return (
        <div className={hideCloseButton ? "" : "fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4"} onClick={hideCloseButton ? undefined : onClose}>
            <div className={`bg-white w-full ${hideCloseButton ? '' : 'rounded-2xl shadow-2xl max-w-2xl max-h-[90vh]'} overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>

                {/* Header */}
                {!hideCloseButton && (
                    <div className="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Shipment Details</h3>
                            <div className="flex items-center text-xs text-gray-500 gap-2">
                                <span className="font-mono bg-gray-100 px-1 rounded">Ref: {booking.id}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors text-gray-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-6">

                    {/* Booking Summary */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">From</p>
                            <p className="font-medium text-gray-900">{booking.senderName}</p>
                            <p className="text-sm text-gray-600">{booking.senderPhone}</p>
                        </div>
                        <div className="md:text-right">
                            <p className="text-xs text-gray-500 uppercase font-bold">Service</p>
                            <p className="font-medium text-indigo-600">{booking.serviceTypeName}</p>
                            <p className="text-sm text-gray-600">{booking.items.length} Parcel(s)</p>
                        </div>
                        {booking.driverName && (
                            <div className="bg-indigo-50 p-3 rounded-lg flex items-center gap-3">
                                <div className="bg-indigo-200 p-2 rounded-full text-indigo-700">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <p className="text--[10px] uppercase font-bold text-indigo-800">Driver</p>
                                    <p className="text-sm font-bold text-indigo-900">{booking.driverName}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Individual Parcel Tracking */}
                    {booking.items.map((item, idx) => {
                        const history = getCombinedHistory(item);
                        const isHighlighted = initialChatItemId === item.id;

                        // Calculate Estimated KHR if needed
                        const showDualCurrency = item.codCurrency !== 'KHR' && item.productPrice > 0 && booking.exchangeRateForCOD;
                        const estimatedKHR = showDualCurrency ? item.productPrice * (booking.exchangeRateForCOD || 4100) : 0;

                        return (
                            <div
                                key={item.id}
                                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-500 ${isHighlighted ? 'ring-2 ring-red-500 border-red-500' : 'border-gray-200'}`}
                                id={`item-${item.id}`}
                            >
                                {/* Item Header */}
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">#{idx + 1}</span>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{item.receiverName || 'Receiver'}</p>
                                            <p className="text-[10px] text-gray-500 font-mono">{item.trackingCode}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-500 uppercase">COD</p>

                                        {editingCodItem === item.id ? (
                                            <div className="flex flex-col gap-1 mt-1 animate-fade-in-up">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-24 px-2 py-1 border border-indigo-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-gray-900"
                                                        value={editAmount}
                                                        onChange={e => setEditAmount(parseFloat(e.target.value))}
                                                        onClick={e => e.stopPropagation()}
                                                        autoFocus
                                                        placeholder="0.00"
                                                    />
                                                    <select
                                                        className="px-1 py-1 border border-indigo-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-gray-700"
                                                        value={editCurrency}
                                                        onChange={e => setEditCurrency(e.target.value as any)}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <option value="USD">$</option>
                                                        <option value="KHR">៛</option>
                                                    </select>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); saveCod(); }}
                                                        disabled={isSaving}
                                                        className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200 transition-colors"
                                                        title="Save"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingCodItem(null); }}
                                                        className="bg-red-100 text-red-700 p-1 rounded hover:bg-red-200 transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                                {editAmount > 0 && booking.exchangeRateForCOD && (
                                                    <span className="text-[10px] text-gray-500 text-right">
                                                        {editCurrency === 'KHR'
                                                            ? `≈ $${(editAmount / booking.exchangeRateForCOD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                            : `≈ ${(editAmount * booking.exchangeRateForCOD).toLocaleString()} KHR`
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-end group">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-red-600">
                                                        {item.productPrice > 0 ? (item.codCurrency === 'KHR' ? `${item.productPrice.toLocaleString()} ៛` : `$${item.productPrice}`) : 'Paid'}
                                                    </p>
                                                    {/* Allow editing only if PENDING and user is authorized, and item is not finalized */}
                                                    {booking.status === 'PENDING' && item.status !== 'DELIVERED' && item.status !== 'RETURN_TO_SENDER' && currentUser && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEditingCod(item); }}
                                                            className="text-gray-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                                            title="Edit COD Amount"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Show conversion for both USD and KHR */}
                                                {item.productPrice > 0 && booking.exchangeRateForCOD && (
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.codCurrency === 'KHR'
                                                            ? `≈ $${(item.productPrice / booking.exchangeRateForCOD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                            : `≈ ${(item.productPrice * booking.exchangeRateForCOD).toLocaleString()} ៛`
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5">
                                    {/* Visual Progress Bar */}
                                    {renderProgressBar(item)}

                                    {/* Details Grid */}
                                    <div className="flex gap-4 mb-6">
                                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 cursor-pointer" onClick={() => setZoomImage(item.image)}>
                                            <img src={item.image} alt="Parcel" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 space-y-1 min-w-0">
                                            <div className="flex items-start text-sm text-gray-700">
                                                <svg className="w-4 h-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="break-words">{item.destinationAddress}</span>
                                            </div>
                                            {item.receiverPhone && (
                                                <div className="flex items-center text-sm text-gray-600">
                                                    <svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    {item.receiverPhone}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Activity Log */}
                                    <div className="border-t border-gray-100 pt-4">
                                        <p className="text-xs font-bold text-gray-500 mb-3 uppercase">Activity Log</p>
                                        <div className="space-y-4 pl-2 border-l-2 border-gray-100">
                                            {history.map((h, hIdx) => (
                                                <div key={hIdx} className="relative pl-4">
                                                    <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${hIdx === 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                                                    <p className="text-xs text-gray-400">{new Date(h.date).toLocaleString()}</p>
                                                    <p className={`text-sm ${hIdx === 0 ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                                                        {h.label}
                                                    </p>
                                                    {h.desc && <p className="text-xs text-gray-500 italic mt-0.5">{h.desc}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Zoom Modal */}
                {zoomImage && (
                    <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4" onClick={() => setZoomImage(null)}>
                        <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                        <button className="absolute top-4 right-4 text-white p-2" onClick={() => setZoomImage(null)}>
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};