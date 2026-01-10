import React, { useState, useEffect } from 'react';
import { FileText, Plus, X, Check, Package, Clock, CheckCircle, XCircle, Truck, Filter, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { useData } from '../../src/shared/contexts/DataContext';
import { stockService } from '../../src/shared/services/stockService';
import { toast } from '../../src/shared/utils/toast';
import { Button } from '../ui/Button';
import { StockRequest, StockRequestItem, CustomerProduct, StockRequestStatus } from '../../src/shared/types';

export const StockRequestList: React.FC = () => {
    const { user } = useAuth();
    const { branches } = useData();

    // State
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [products, setProducts] = useState<CustomerProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StockRequestStatus | 'ALL'>('ALL');
    const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'LAST_WEEK' | 'LAST_MONTH' | 'CUSTOM' | 'ALL'>('TODAY');
    const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Form state
    const [form, setForm] = useState({
        branchId: '',
        expectedDate: '',
        pickupPreference: 'SELF_DROP' as 'SELF_DROP' | 'REQUEST_PICKUP',
        pickupAddress: '',
        notes: '',
        items: [] as { productId: string; quantity: number }[]
    });

    // Load data
    useEffect(() => {
        loadData();
    }, [user]);

    // Get customer ID (linked customer or user's own ID)
    const getCustomerId = () => user?.linkedCustomerId || user?.uid;

    const loadData = async () => {
        const customerId = getCustomerId();
        if (!customerId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [reqList, prodList] = await Promise.all([
                stockService.getCustomerRequests(customerId),
                stockService.getCustomerProducts(customerId)
            ]);
            setRequests(reqList);
            setProducts(prodList.filter(p => p.isActive));
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Filtered requests
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

    // Open create modal
    const handleNewRequest = () => {
        if (products.length === 0) {
            toast.warning('Please register products in My Products first');
            return;
        }
        setForm({
            branchId: branches[0]?.id || '',
            expectedDate: '',
            pickupPreference: 'SELF_DROP',
            pickupAddress: '',
            notes: '',
            items: [{ productId: products[0]?.id || '', quantity: 1 }]
        });
        setShowModal(true);
    };

    // Add item
    const addItem = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { productId: products[0]?.id || '', quantity: 1 }]
        }));
    };

    // Remove item
    const removeItem = (index: number) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    // Update item
    const updateItem = (index: number, field: string, value: any) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    // Submit request
    const handleSubmit = async () => {
        if (!form.branchId || form.items.length === 0 || form.items.some(i => !i.productId || i.quantity < 1)) {
            toast.warning('Please select a branch and add at least one product');
            return;
        }

        const customerId = getCustomerId();
        if (!customerId) {
            toast.error('Customer account not found');
            return;
        }

        setSaving(true);
        try {
            const branch = branches.find(b => b.id === form.branchId);
            const requestItems: StockRequestItem[] = form.items.map(item => {
                const prod = products.find(p => p.id === item.productId);
                return {
                    productId: item.productId,
                    productName: prod?.productName || '',
                    sku: prod?.sku,
                    quantity: item.quantity,
                    unitPrice: prod?.defaultPrice,
                    image: prod?.image
                };
            });

            const request: StockRequest = {
                id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                customerId: getCustomerId()!,
                customerName: user?.name || '',
                branchId: form.branchId,
                branchName: branch?.name || '',
                status: 'PENDING',
                items: requestItems,
                totalQuantity: requestItems.reduce((sum, i) => sum + i.quantity, 0),
                expectedDate: form.expectedDate || undefined,
                pickupPreference: form.pickupPreference,
                pickupAddress: form.pickupPreference === 'REQUEST_PICKUP' ? form.pickupAddress : undefined,
                notes: form.notes || undefined,
                createdAt: Date.now(),
                createdBy: user.uid!
            };

            await stockService.createStockRequest(request);
            toast.success('Stock request submitted!');
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error('Error creating request:', error);
            toast.error('Failed to submit request');
        } finally {
            setSaving(false);
        }
    };

    // Cancel request
    // Cancel request
    const handleCancel = async () => {
        if (!cancelConfirm) return;

        setProcessing(true);
        try {
            await stockService.cancelRequest(cancelConfirm);
            toast.success('Request cancelled');
            setCancelConfirm(null);
            loadData();
        } catch (error) {
            console.error('Error cancelling request:', error);
            toast.error('Failed to cancel request');
        } finally {
            setProcessing(false);
        }
    };

    // Status badge
    const getStatusBadge = (status: StockRequestStatus) => {
        const styles: Record<StockRequestStatus, { bg: string; text: string; Icon: typeof Clock }> = {
            PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', Icon: Clock },
            APPROVED: { bg: 'bg-blue-100', text: 'text-blue-800', Icon: CheckCircle },
            REJECTED: { bg: 'bg-red-100', text: 'text-red-800', Icon: XCircle },
            RECEIVED: { bg: 'bg-green-100', text: 'text-green-800', Icon: Package },
            CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', Icon: XCircle }
        };
        const style = styles[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <style.Icon className="w-3 h-3" />
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-red-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Stock Requests</h1>
                        <p className="text-sm text-gray-500">Request to deposit products at doorstep locations</p>
                    </div>
                </div>
                <Button onClick={handleNewRequest}>
                    <Plus className="w-5 h-5 mr-2" />
                    New Request
                </Button>
            </div>

            {/* Filters Dashboard */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 mr-2">Time Period:</span>
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
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${dateFilter === 'CUSTOM'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        CUSTOM
                    </button>
                </div>

                {dateFilter === 'CUSTOM' && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">Range:</span>
                        <input
                            type="date"
                            value={customRange.start}
                            onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                            className="px-2 py-1 text-sm border rounded"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={customRange.end}
                            onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                            className="px-2 py-1 text-sm border rounded"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
                    >
                        <option value="ALL">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="RECEIVED">Received</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No stock requests found</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(request => (
                        <div key={request.id} className="bg-white rounded-lg shadow border border-gray-200 p-4">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-gray-900">{request.branchName}</h3>
                                        {getStatusBadge(request.status)}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {new Date(request.createdAt).toLocaleDateString()} • {request.totalQuantity} items
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {request.pickupPreference === 'REQUEST_PICKUP' && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                            <Truck className="w-3 h-3" />
                                            Pickup Requested
                                        </span>
                                    )}
                                    {request.status === 'PENDING' && (
                                        <button
                                            onClick={() => setCancelConfirm(request.id)}
                                            className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border-t pt-3 space-y-2">
                                {request.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        {item.image ? (
                                            <img src={item.image} alt={item.productName} className="w-10 h-10 rounded object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                                <Package className="w-5 h-5 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{item.productName}</p>
                                            {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-gray-600 ${item.actualQuantity !== undefined && item.actualQuantity !== item.quantity ? 'line-through text-xs' : ''}`}>x{item.quantity}</p>
                                            {item.actualQuantity !== undefined && item.actualQuantity !== item.quantity && (
                                                <p className="text-yellow-600 font-medium text-sm flex items-center gap-1 justify-end">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {item.actualQuantity}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Rejection reason */}
                            {request.status === 'REJECTED' && request.rejectionReason && (
                                <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                                    <strong>Reason:</strong> {request.rejectionReason}
                                </div>
                            )}

                            {/* Notes */}
                            {request.notes && (
                                <p className="mt-3 text-sm text-gray-500">
                                    <strong>Notes:</strong> {request.notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">New Stock Request</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Branch */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Branch *</label>
                                <select
                                    value={form.branchId}
                                    onChange={e => setForm(prev => ({ ...prev, branchId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Products */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Products *</label>
                                    <button
                                        onClick={addItem}
                                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add Product
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {form.items.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <select
                                                value={item.productId}
                                                onChange={e => updateItem(idx, 'productId', e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                            >
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.sku ? `${p.sku} - ${p.productName}` : p.productName}
                                                    </option>
                                                ))}
                                            </select>

                                            <input
                                                type="number"
                                                min={1}
                                                value={item.quantity}
                                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                            />
                                            {form.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(idx)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Expected Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                                <input
                                    type="date"
                                    value={form.expectedDate}
                                    onChange={e => setForm(prev => ({ ...prev, expectedDate: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                />
                            </div>

                            {/* Pickup Preference */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Method</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="pickup"
                                            checked={form.pickupPreference === 'SELF_DROP'}
                                            onChange={() => setForm(prev => ({ ...prev, pickupPreference: 'SELF_DROP' }))}
                                            className="text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">I will drop off</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="pickup"
                                            checked={form.pickupPreference === 'REQUEST_PICKUP'}
                                            onChange={() => setForm(prev => ({ ...prev, pickupPreference: 'REQUEST_PICKUP' }))}
                                            className="text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">Request pickup</span>
                                    </label>
                                </div>
                            </div>

                            {/* Pickup Address */}
                            {form.pickupPreference === 'REQUEST_PICKUP' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
                                    <input
                                        type="text"
                                        value={form.pickupAddress}
                                        onChange={e => setForm(prev => ({ ...prev, pickupAddress: e.target.value }))}
                                        placeholder="Enter pickup address"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Optional notes..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Submit Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {cancelConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Request?</h3>
                        <p className="text-gray-600 mb-6">Are you sure you want to cancel this stock request?</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setCancelConfirm(null)}
                                disabled={processing}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                No, Keep It
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={processing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {processing && (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                )}
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockRequestList;
