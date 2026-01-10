import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, History, AlertTriangle, Edit2, Trash2, X, Check, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { useData } from '../../src/shared/contexts/DataContext';
import { stockService } from '../../src/shared/services/stockService';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { CustomerStock, CustomerStockItem, StockTransaction, Customer } from '../../src/shared/types';

interface DepositForm {
    customerId: string;
    customerName: string;
    items: {
        productName: string;
        quantity: number;
        sku?: string;
        unitPrice?: number;
        unitPriceCurrency?: 'USD' | 'KHR';
        description?: string;
        image?: string; // Base64 or URL
    }[];
    notes?: string;
}

interface AdjustmentForm {
    stockId: string;
    itemId: string;
    productName: string;
    currentQty: number;
    adjustment: number;
    reason: string;
}

export const StockManagement: React.FC = () => {
    const { user } = useAuth();
    const { branches, customers } = useData();

    // State
    const [stocks, setStocks] = useState<CustomerStock[]>([]);
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'inventory' | 'deposit' | 'history'>('inventory');
    const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());

    // Modal states
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [depositForm, setDepositForm] = useState<DepositForm>({
        customerId: '',
        customerName: '',
        items: [{ productName: '', quantity: 1 }],
        notes: ''
    });
    const [adjustForm, setAdjustForm] = useState<AdjustmentForm | null>(null);
    const [saving, setSaving] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
    }, [selectedBranchId, branches, customers]); // Added branches and customers to dependencies

    const loadData = async () => {
        setLoading(true);
        try {
            // Load branches from data context (already loaded)
            // Set default branch (user's managed branch or first branch)
            if (!selectedBranchId && branches.length > 0) {
                const defaultBranch = user?.managedBranchId || branches[0].id;
                setSelectedBranchId(defaultBranch);
                return; // Will reload with branch set
            }

            // Load stocks for branch
            if (selectedBranchId) {
                const stockList = await stockService.getStocksByBranch(selectedBranchId);
                setStocks(stockList);

                const txnList = await stockService.getStockTransactions(undefined, selectedBranchId, 50);
                setTransactions(txnList);
            }

            // Customers are already available from useData, no need to fetch again
        } catch (error) {
            console.error('Error loading stock data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter stocks by search
    const filteredStocks = useMemo(() => {
        if (!searchTerm) return stocks;
        const term = searchTerm.toLowerCase();
        return stocks.filter(s =>
            s.customerName.toLowerCase().includes(term) ||
            s.items.some(i => i.productName.toLowerCase().includes(term) || i.sku?.toLowerCase().includes(term))
        );
    }, [stocks, searchTerm]);

    // Toggle expanded stock
    const toggleExpand = (stockId: string) => {
        setExpandedStocks(prev => {
            const next = new Set(prev);
            if (next.has(stockId)) next.delete(stockId);
            else next.add(stockId);
            return next;
        });
    };

    // Handle deposit
    const handleDeposit = async () => {
        if (!depositForm.customerId || depositForm.items.some(i => !i.productName || i.quantity < 1)) {
            toast.warning('Please fill in all required fields');
            return;
        }

        const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';

        setSaving(true);
        try {
            // Upload images first if any
            const itemsWithImages = await Promise.all(
                depositForm.items
                    .filter(i => i.productName && i.quantity > 0)
                    .map(async (item) => {
                        let imageUrl = item.image;
                        // If image is base64, upload it
                        if (item.image && item.image.startsWith('data:')) {
                            imageUrl = await stockService.uploadImage(item.image);
                        }
                        return {
                            productName: item.productName,
                            quantity: item.quantity,
                            sku: item.sku,
                            unitPrice: item.unitPrice,
                            unitPriceCurrency: item.unitPriceCurrency,
                            description: item.description,
                            image: imageUrl
                        };
                    })
            );

            await stockService.depositStock(
                depositForm.customerId,
                depositForm.customerName,
                selectedBranchId,
                branchName,
                itemsWithImages,
                user?.uid || '',
                user?.name || '',
                depositForm.notes
            );

            setShowDepositModal(false);
            setDepositForm({ customerId: '', customerName: '', items: [{ productName: '', quantity: 1 }], notes: '' });
            toast.success('Stock received successfully!');
            loadData();
        } catch (error) {
            console.error('Error depositing stock:', error);
            toast.error('Failed to deposit stock. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Handle image upload for deposit item
    const handleImageUpload = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            updateDepositItem(index, 'image', base64);
        };
        reader.readAsDataURL(file);
    };

    // Handle adjustment
    const handleAdjust = async () => {
        if (!adjustForm || !adjustForm.reason.trim()) {
            toast.warning('Please provide a reason for the adjustment');
            return;
        }

        const stock = stocks.find(s => s.id === adjustForm.stockId);
        if (!stock) return;

        try {
            const result = await stockService.adjustStock(
                stock.customerId,
                stock.branchId,
                adjustForm.itemId,
                adjustForm.adjustment,
                adjustForm.reason,
                user?.uid || '',
                user?.name || ''
            );

            if (!result.success) {
                toast.error(result.error || 'Adjustment failed');
                return;
            }

            setShowAdjustModal(false);
            setAdjustForm(null);
            toast.success('Stock adjusted successfully!');
            loadData();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            toast.error('Failed to adjust stock. Please try again.');
        }
    };

    // Add item to deposit form
    const addDepositItem = () => {
        setDepositForm(prev => ({
            ...prev,
            items: [...prev.items, { productName: '', quantity: 1 }]
        }));
    };

    // Remove item from deposit form
    const removeDepositItem = (index: number) => {
        setDepositForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    // Update deposit item
    const updateDepositItem = (index: number, field: string, value: any) => {
        setDepositForm(prev => ({
            ...prev,
            items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
        }));
    };

    // Format date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    // Get transaction type color
    const getTxnTypeColor = (type: string) => {
        switch (type) {
            case 'DEPOSIT': return 'bg-green-100 text-green-800';
            case 'BOOKING_RESERVE': return 'bg-blue-100 text-blue-800';
            case 'BOOKING_DELIVERED': return 'bg-purple-100 text-purple-800';
            case 'BOOKING_CANCELLED': return 'bg-orange-100 text-orange-800';
            case 'ADJUSTMENT': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
                        <p className="text-gray-500">Manage customer product inventory</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowDepositModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Receive Stock
                </button>
            </div>

            {/* Branch Selector & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex gap-2">
                    {['inventory', 'history'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${activeTab === tab
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {tab === 'inventory' ? 'Inventory' : 'Transaction History'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={selectedBranchId}
                        onChange={e => setSelectedBranchId(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search customer or product..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    {filteredStocks.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">No stock found at this location</p>
                        </div>
                    ) : (
                        filteredStocks.map(stock => (
                            <div key={stock.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                                {/* Customer Header */}
                                <button
                                    onClick={() => toggleExpand(stock.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <span className="text-blue-600 font-semibold">{stock.customerName[0]}</span>
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900">{stock.customerName}</h3>
                                            <p className="text-sm text-gray-500">{stock.items.length} products • {stock.totalItemCount} total units</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500">
                                            Updated {formatDate(stock.lastUpdated)}
                                        </span>
                                        {expandedStocks.has(stock.id) ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Items Table */}
                                {expandedStocks.has(stock.id) && (
                                    <div className="border-t border-gray-200">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reserved</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {stock.items.map(item => {
                                                    const available = item.quantity - item.reservedQuantity;
                                                    const isLow = available <= 10;
                                                    return (
                                                        <tr key={item.id} className={isLow ? 'bg-red-50' : ''}>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    {isLow && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                                                    <span className="font-medium text-gray-900">{item.productName}</span>
                                                                </div>
                                                                {item.description && (
                                                                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-gray-500">{item.sku || '-'}</td>
                                                            <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right text-orange-600">{item.reservedQuantity}</td>
                                                            <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                                                                {available}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                {item.unitPrice ? `${item.unitPrice} ${item.unitPriceCurrency || 'USD'}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => {
                                                                        setAdjustForm({
                                                                            stockId: stock.id,
                                                                            itemId: item.id,
                                                                            productName: item.productName,
                                                                            currentQty: item.quantity,
                                                                            adjustment: 0,
                                                                            reason: ''
                                                                        });
                                                                        setShowAdjustModal(true);
                                                                    }}
                                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                                    title="Adjust Stock"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No transactions found
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(txn => (
                                    <tr key={txn.id}>
                                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(txn.createdAt)}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{txn.customerName}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTxnTypeColor(txn.type)}`}>
                                                {txn.type.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {txn.items.map((item, i) => (
                                                <div key={i} className="text-sm">
                                                    <span className="font-medium">{item.productName}</span>
                                                    <span className={item.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {' '}({item.quantityChange >= 0 ? '+' : ''}{item.quantityChange})
                                                    </span>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{txn.createdByName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{txn.notes || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Deposit Modal */}
            {showDepositModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Receive Stock Deposit</h2>
                            <button onClick={() => setShowDepositModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Customer Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                <select
                                    value={depositForm.customerId}
                                    onChange={e => {
                                        const customer = customers.find(c => c.id === e.target.value);
                                        setDepositForm(prev => ({
                                            ...prev,
                                            customerId: e.target.value,
                                            customerName: customer?.name || ''
                                        }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select customer...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">Items *</label>
                                    <button
                                        onClick={addDepositItem}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add Item
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {depositForm.items.map((item, index) => (
                                        <div key={index} className="flex gap-3 items-start">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Product name *"
                                                    value={item.productName}
                                                    onChange={e => updateDepositItem(index, 'productName', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    placeholder="Qty *"
                                                    value={item.quantity}
                                                    min={1}
                                                    onChange={e => updateDepositItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="w-28">
                                                <input
                                                    type="text"
                                                    placeholder="SKU"
                                                    value={item.sku || ''}
                                                    onChange={e => updateDepositItem(index, 'sku', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    type="number"
                                                    placeholder="Price"
                                                    value={item.unitPrice || ''}
                                                    onChange={e => updateDepositItem(index, 'unitPrice', parseFloat(e.target.value) || undefined)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            {/* Image Upload */}
                                            <div className="flex items-center gap-2">
                                                <label className="cursor-pointer p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                                    <Camera className="w-4 h-4 text-gray-600" />
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={e => handleImageUpload(index, e)}
                                                    />
                                                </label>
                                                {item.image && (
                                                    <img
                                                        src={item.image}
                                                        alt="Preview"
                                                        className="w-8 h-8 rounded object-cover border border-gray-300"
                                                    />
                                                )}
                                            </div>
                                            {depositForm.items.length > 1 && (
                                                <button
                                                    onClick={() => removeDepositItem(index)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={depositForm.notes || ''}
                                    onChange={e => setDepositForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Optional notes..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setShowDepositModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeposit}
                                disabled={saving}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Receive Stock
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjustment Modal */}
            {showAdjustModal && adjustForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">Adjust Stock</h2>
                            <button onClick={() => { setShowAdjustModal(false); setAdjustForm(null); }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="font-medium text-gray-900">{adjustForm.productName}</p>
                                <p className="text-sm text-gray-500">Current quantity: {adjustForm.currentQty}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount *</label>
                                <input
                                    type="number"
                                    value={adjustForm.adjustment}
                                    onChange={e => setAdjustForm(prev => prev ? { ...prev, adjustment: parseInt(e.target.value) || 0 } : null)}
                                    placeholder="Enter + to add, - to subtract"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    New quantity: {adjustForm.currentQty + adjustForm.adjustment}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                                <textarea
                                    value={adjustForm.reason}
                                    onChange={e => setAdjustForm(prev => prev ? { ...prev, reason: e.target.value } : null)}
                                    placeholder="Explain the reason for adjustment..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => { setShowAdjustModal(false); setAdjustForm(null); }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdjust}
                                disabled={!adjustForm.reason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Apply Adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManagement;
