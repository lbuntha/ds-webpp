import React, { useState, useEffect } from 'react';
import { Inbox, Check, X, Package, Clock, CheckCircle, Truck, Filter, User, Calendar, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { useData } from '../../src/shared/contexts/DataContext';
import { stockService } from '../../src/shared/services/stockService';
import { toast } from '../../src/shared/utils/toast';
import { StockRequest, StockRequestStatus, StockRequestItem } from '../../src/shared/types';

export const IncomingRequests: React.FC = () => {
    const { user } = useAuth();
    const { branches } = useData();

    // State
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'ALL'>('ALL');
    const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'LAST_WEEK' | 'LAST_MONTH' | 'CUSTOM' | 'ALL'>('TODAY');
    const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [rejectModal, setRejectModal] = useState<{ requestId: string; reason: string } | null>(null);
    const [approveModal, setApproveModal] = useState<{ request: StockRequest; items: StockRequestItem[] } | null>(null);
    const [receiveConfirm, setReceiveConfirm] = useState<StockRequest | null>(null);

    // Load requests
    useEffect(() => {
        loadRequests();
    }, [selectedBranchId]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const list = await stockService.getPendingRequests(selectedBranchId || undefined);
            setRequests(list);
        } catch (error) {
            console.error('Error loading requests:', error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    // Filtered requests
    const filteredRequests = requests.filter(r => {
        const matchesStatus = statusFilter === 'ALL' ? true : r.status === statusFilter;

        let matchesDate = true;
        const requestDate = new Date(r.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (dateFilter === 'TODAY') {
            matchesDate = requestDate >= today;
        } else if (dateFilter === 'YESTERDAY') {
            matchesDate = requestDate >= yesterday && requestDate < today;
        } else if (dateFilter === 'LAST_WEEK') {
            const lastWeek = new Date(today);
            lastWeek.setDate(lastWeek.getDate() - 7);
            matchesDate = requestDate >= lastWeek;
        } else if (dateFilter === 'LAST_MONTH') {
            const lastMonth = new Date(today);
            lastMonth.setDate(lastMonth.getDate() - 30);
            matchesDate = requestDate >= lastMonth;
        } else if (dateFilter === 'CUSTOM') {
            if (customRange.start && customRange.end) {
                const start = new Date(customRange.start);
                start.setHours(0, 0, 0, 0);
                const end = new Date(customRange.end);
                end.setHours(23, 59, 59, 999);
                matchesDate = requestDate >= start && requestDate <= end;
            }
        }

        return matchesStatus && matchesDate;
    });

    // Open approve modal
    const handleApproveClick = (request: StockRequest) => {
        setApproveModal({
            request,
            items: request.items.map(item => ({ ...item, actualQuantity: item.quantity }))
        });
    };

    // Confirm approval
    const handleConfirmApprove = async () => {
        if (!approveModal) return;

        setProcessing(approveModal.request.id);
        try {
            await stockService.approveRequest(
                approveModal.request.id,
                approveModal.request.customerId,
                user?.uid || '',
                user?.name || '',
                approveModal.items
            );
            toast.success('Request approved and notification sent!');
            setApproveModal(null);
            loadRequests();
        } catch (error) {
            console.error('Error approving request:', error);
            toast.error('Failed to approve request');
        } finally {
            setProcessing(null);
        }
    };

    // Update item quantity in modal
    const updateActualQuantity = (index: number, qty: number) => {
        if (!approveModal) return;
        const newItems = [...approveModal.items];
        newItems[index] = { ...newItems[index], actualQuantity: qty };
        setApproveModal({ ...approveModal, items: newItems });
    };

    // Reject request
    const handleReject = async () => {
        if (!rejectModal || !rejectModal.reason.trim()) {
            toast.warning('Please provide a rejection reason');
            return;
        }

        setProcessing(rejectModal.requestId);
        try {
            await stockService.rejectRequest(
                rejectModal.requestId,
                rejectModal.reason,
                user?.uid || '',
                user?.name || ''
            );
            toast.success('Request rejected');
            setRejectModal(null);
            loadRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
            toast.error('Failed to reject request');
        } finally {
            setProcessing(null);
        }
    };

    // Receive stock - open modal
    const handleReceiveClick = (request: StockRequest) => {
        setReceiveConfirm(request);
    };

    // Confirm receive
    const handleConfirmReceive = async () => {
        if (!receiveConfirm) return;

        setProcessing(receiveConfirm.id);
        try {
            await stockService.receiveRequest(receiveConfirm, user?.uid || '', user?.name || '');
            toast.success('Stock received and added to inventory!');
            setReceiveConfirm(null);
            loadRequests();
        } catch (error) {
            console.error('Error receiving stock:', error);
            toast.error('Failed to receive stock');
        } finally {
            setProcessing(null);
        }
    };

    // Status badge
    const getStatusBadge = (status: StockRequestStatus) => {
        const styles: Record<string, { bg: string; text: string }> = {
            PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
            APPROVED: { bg: 'bg-blue-100', text: 'text-blue-800' },
        };
        const style = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                {status === 'PENDING' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Inbox className="w-8 h-8 text-red-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Incoming Stock Requests</h1>
                    <p className="text-gray-500">Review and process customer stock requests</p>
                </div>
            </div>

            {/* Filters Dashboard */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
                {/* Top Row: Branch & Status */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Branch Select */}
                        <div className="relative min-w-[200px]">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={selectedBranchId}
                                onChange={e => setSelectedBranchId(e.target.value)}
                                className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 text-sm bg-gray-50 bg-white"
                            >
                                <option value="">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>

                        {/* Status Filters */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {(['ALL', 'PENDING', 'APPROVED'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === status
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {status === 'ALL' ? 'All Status' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                        {filteredRequests.length} results
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 mr-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Time Period:
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {(['TODAY', 'YESTERDAY', 'LAST_WEEK', 'LAST_MONTH', 'ALL'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setDateFilter(filter)}
                                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${dateFilter === filter
                                        ? 'bg-red-100 text-red-700 border border-red-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {filter.replace('_', ' ')}
                                </button>
                            ))}
                            <button
                                onClick={() => setDateFilter('CUSTOM')}
                                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${dateFilter === 'CUSTOM'
                                        ? 'bg-red-100 text-red-700 border border-red-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                CUSTOM
                            </button>
                        </div>
                    </div>

                    {dateFilter === 'CUSTOM' && (
                        <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 animate-slide-down">
                            <span className="text-sm text-gray-600">Select Range:</span>
                            <input
                                type="date"
                                value={customRange.start}
                                onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                                type="date"
                                value={customRange.end}
                                onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Inbox className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No incoming requests</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(request => (
                        <div key={request.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                            {/* Header */}
                            <div className="p-4 bg-gray-50 border-b">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="w-4 h-4 text-gray-500" />
                                            <span className="font-semibold text-gray-900">{request.customerName}</span>
                                            {getStatusBadge(request.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Package className="w-4 h-4" />
                                                {request.branchName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(request.createdAt).toLocaleDateString()}
                                            </span>
                                            {request.expectedDate && (
                                                <span>Expected: {request.expectedDate}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {request.pickupPreference === 'REQUEST_PICKUP' && (
                                            <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                <Truck className="w-3 h-3" />
                                                Pickup: {request.pickupAddress || 'Address needed'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {request.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                            {item.image ? (
                                                <img src={item.image} alt={item.productName} className="w-12 h-12 rounded object-cover" />
                                            ) : (
                                                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                                                    <Package className="w-6 h-6 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{item.productName}</p>
                                                <p className="text-sm text-gray-500">
                                                    {item.sku && `SKU: ${item.sku} • `}
                                                    Qty: {item.quantity}
                                                    {item.unitPrice && ` • ${item.unitPrice} USD`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Notes */}
                                {request.notes && (
                                    <p className="mt-3 text-sm text-gray-600 p-2 bg-yellow-50 rounded">
                                        <strong>Notes:</strong> {request.notes}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                                {request.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => setRejectModal({ requestId: request.id, reason: '' })}
                                            disabled={processing === request.id}
                                            className="flex items-center gap-1 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <X className="w-4 h-4" />
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApproveClick(request)}
                                            disabled={processing === request.id}
                                            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            <Check className="w-4 h-4" />
                                            Approve
                                        </button>
                                    </>
                                )}
                                {request.status === 'APPROVED' && (
                                    <button
                                        onClick={() => handleReceiveClick(request)}
                                        disabled={processing === request.id}
                                        className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    >
                                        <Package className="w-4 h-4" />
                                        Receive Stock
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-4 border-b">
                            <h2 className="text-lg font-semibold">Reject Request</h2>
                        </div>
                        <div className="p-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rejection Reason *
                            </label>
                            <textarea
                                value={rejectModal.reason}
                                onChange={e => setRejectModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                placeholder="Explain why this request is being rejected..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setRejectModal(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processing !== null}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                Reject Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Modal */}
            {approveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b">
                            <h2 className="text-lg font-semibold">Approve Request</h2>
                            <p className="text-sm text-gray-500">Verify quantities before approving. Notification will be sent to customer.</p>
                        </div>
                        <div className="p-4">
                            <div className="space-y-4">
                                {approveModal.items.map((item, idx) => {
                                    const isDifferent = item.actualQuantity !== item.quantity;
                                    return (
                                        <div key={idx} className={`flex items-start gap-4 p-3 rounded-lg border ${isDifferent ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                                            {item.image ? (
                                                <img src={item.image} alt={item.productName} className="w-16 h-16 rounded object-cover" />
                                            ) : (
                                                <div className="w-16 h-16 bg-white rounded flex items-center justify-center border">
                                                    <Package className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <h3 className="font-medium text-gray-900">{item.productName}</h3>
                                                {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                                                <div className="mt-2 flex items-center gap-4">
                                                    <div className="text-sm">
                                                        <span className="text-gray-500">Requested:</span>
                                                        <span className="ml-1 font-semibold">{item.quantity}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-700">Actual:</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.actualQuantity}
                                                            onChange={e => updateActualQuantity(idx, parseInt(e.target.value) || 0)}
                                                            className={`w-20 px-2 py-1 text-sm border rounded focus:ring-2 ${isDifferent ? 'border-yellow-400 focus:ring-yellow-500' : 'border-gray-300 focus:ring-blue-500'}`}
                                                        />
                                                    </div>
                                                </div>
                                                {isDifferent && (
                                                    <div className="mt-2 flex items-center gap-1 text-xs text-yellow-700">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Quantity differs from request
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {approveModal.items.some(i => i.actualQuantity !== i.quantity) && (
                                <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>Since verified quantities are different, a warning notification will be sent to the customer.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setApproveModal(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmApprove}
                                disabled={processing !== null}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {processing === approveModal.request.id ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Confirm Approval
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Receive Confirmation Modal */}
            {receiveConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Receive Stock?</h3>
                        <p className="text-gray-600 mb-6">
                            Confirm that you have received the physical stock. This will add the items to the main inventory.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setReceiveConfirm(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReceive}
                                disabled={processing !== null}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {processing === receiveConfirm.id ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <Package className="w-4 h-4" />
                                )}
                                Confirm Receive
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncomingRequests;
