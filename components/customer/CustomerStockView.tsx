import React, { useState, useEffect } from 'react';
import { Package, History, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { stockService } from '../../src/shared/services/stockService';
import { CustomerStock, StockTransaction } from '../../src/shared/types';

export const CustomerStockView: React.FC = () => {
    const { user } = useAuth();

    // State
    const [stocks, setStocks] = useState<CustomerStock[]>([]);
    const [transactions, setTransactions] = useState<StockTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
    const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());

    // Load data
    useEffect(() => {
        if (user?.uid) {
            loadData();
        }
    }, [user?.uid]);

    const loadData = async () => {
        if (!user?.uid) return;

        setLoading(true);
        try {
            // Get customer ID - either from linkedCustomerId or user uid
            const customerId = user.linkedCustomerId || user.uid;

            // Load all stocks for this customer (across all branches)
            const stockList = await stockService.getCustomerStock(customerId);
            setStocks(stockList);

            // Load recent transactions
            const txnList = await stockService.getStockTransactions(customerId, undefined, 50);
            setTransactions(txnList);
        } catch (error) {
            console.error('Error loading stock data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Toggle expanded stock
    const toggleExpand = (stockId: string) => {
        setExpandedStocks(prev => {
            const next = new Set(prev);
            if (next.has(stockId)) next.delete(stockId);
            else next.add(stockId);
            return next;
        });
    };

    // Format date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    // Get transaction type display
    const getTxnTypeDisplay = (type: string) => {
        switch (type) {
            case 'DEPOSIT': return { label: 'Deposited', color: 'bg-green-100 text-green-800' };
            case 'BOOKING_RESERVE': return { label: 'Reserved', color: 'bg-blue-100 text-blue-800' };
            case 'BOOKING_DELIVERED': return { label: 'Delivered', color: 'bg-purple-100 text-purple-800' };
            case 'BOOKING_CANCELLED': return { label: 'Released', color: 'bg-orange-100 text-orange-800' };
            case 'ADJUSTMENT': return { label: 'Adjusted', color: 'bg-yellow-100 text-yellow-800' };
            default: return { label: type, color: 'bg-gray-100 text-gray-800' };
        }
    };

    // Calculate totals
    const totalProducts = stocks.reduce((sum, s) => sum + s.items.length, 0);
    const totalUnits = stocks.reduce((sum, s) => sum + s.totalItemCount, 0);
    const totalReserved = stocks.reduce((sum, s) =>
        sum + s.items.reduce((iSum, i) => iSum + i.reservedQuantity, 0), 0);

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
            <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Stock</h1>
                    <p className="text-gray-500">View your product inventory at doorstep locations</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">Locations</p>
                    <p className="text-2xl font-bold text-gray-900">{stocks.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">Total Units</p>
                    <p className="text-2xl font-bold text-green-600">{totalUnits}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">Reserved</p>
                    <p className="text-2xl font-bold text-orange-600">{totalReserved}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'inventory'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <Package className="w-4 h-4" />
                    Inventory
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'history'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <History className="w-4 h-4" />
                    History
                </button>
            </div>

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    {stocks.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">You don't have any stock at doorstep locations</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Bring your products to a doorstep location to get started
                            </p>
                        </div>
                    ) : (
                        stocks.map(stock => (
                            <div key={stock.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                                {/* Location Header */}
                                <button
                                    onClick={() => toggleExpand(stock.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-gray-900">{stock.branchName}</h3>
                                            <p className="text-sm text-gray-500">
                                                {stock.items.length} products • {stock.totalItemCount} units
                                            </p>
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
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reserved</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {stock.items.map(item => {
                                                    const available = item.quantity - item.reservedQuantity;
                                                    return (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3">
                                                                <span className="font-medium text-gray-900">{item.productName}</span>
                                                                {item.sku && (
                                                                    <span className="text-xs text-gray-400 ml-2">({item.sku})</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium">{item.quantity}</td>
                                                            <td className="px-4 py-3 text-right text-orange-600">{item.reservedQuantity}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-green-600">{available}</td>
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

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    {transactions.length === 0 ? (
                        <div className="text-center py-12">
                            <History className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">No transaction history yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {transactions.map(txn => {
                                const typeDisplay = getTxnTypeDisplay(txn.type);
                                return (
                                    <div key={txn.id} className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeDisplay.color}`}>
                                                        {typeDisplay.label}
                                                    </span>
                                                    <span className="text-sm text-gray-500">{txn.branchName}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {txn.items.map((item, i) => (
                                                        <div key={i} className="text-sm">
                                                            <span className="font-medium">{item.productName}</span>
                                                            <span className={item.quantityChange >= 0 ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                                                                {item.quantityChange >= 0 ? '+' : ''}{item.quantityChange} units
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {txn.notes && (
                                                    <p className="text-sm text-gray-500 mt-1">{txn.notes}</p>
                                                )}
                                            </div>
                                            <div className="text-right text-sm text-gray-500">
                                                {formatDate(txn.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomerStockView;
