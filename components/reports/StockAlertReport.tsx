import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, Download, RefreshCw, Filter } from 'lucide-react';
import { useData } from '../../src/shared/contexts/DataContext';
import { stockService } from '../../src/shared/services/stockService';
import { CustomerStockItem } from '../../src/shared/types';

interface LowStockItem {
    customerId: string;
    customerName: string;
    branchId: string;
    branchName: string;
    item: CustomerStockItem;
    availableQuantity: number;
}

export const StockAlertReport: React.FC = () => {
    const { branches: branchesFromContext } = useData();

    // State
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [threshold, setThreshold] = useState<number>(10);
    const [loading, setLoading] = useState(true);

    // Load data
    useEffect(() => {
        loadBranches();
    }, []);

    useEffect(() => {
        loadLowStockItems();
    }, [selectedBranchId, threshold]);

    const loadBranches = () => {
        setBranches(branchesFromContext);
    };

    const loadLowStockItems = async () => {
        setLoading(true);
        try {
            const branchId = selectedBranchId === 'all' ? undefined : selectedBranchId;
            const items = await stockService.getLowStockItems(branchId, threshold);
            setLowStockItems(items);
        } catch (error) {
            console.error('Error loading low stock items:', error);
        } finally {
            setLoading(false);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Customer', 'Branch', 'Product', 'SKU', 'Total Qty', 'Reserved', 'Available'];
        const rows = lowStockItems.map(item => [
            item.customerName,
            item.branchName,
            item.item.productName,
            item.item.sku || '',
            item.item.quantity.toString(),
            item.item.reservedQuantity.toString(),
            item.availableQuantity.toString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `low-stock-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Get severity color
    const getSeverityColor = (available: number) => {
        if (available <= 0) return 'bg-red-100 text-red-800 border-red-200';
        if (available <= 5) return 'bg-orange-100 text-orange-800 border-orange-200';
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    // Get severity label
    const getSeverityLabel = (available: number) => {
        if (available <= 0) return 'Out of Stock';
        if (available <= 5) return 'Critical';
        return 'Low';
    };

    // Stats
    const outOfStock = lowStockItems.filter(i => i.availableQuantity <= 0).length;
    const critical = lowStockItems.filter(i => i.availableQuantity > 0 && i.availableQuantity <= 5).length;
    const low = lowStockItems.filter(i => i.availableQuantity > 5).length;

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
                    <AlertTriangle className="w-8 h-8 text-orange-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Stock Alerts</h1>
                        <p className="text-gray-500">Monitor low stock levels across locations</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadLowStockItems}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={exportToCSV}
                        disabled={lowStockItems.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-700">Filters:</span>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Branch</label>
                        <select
                            value={selectedBranchId}
                            onChange={e => setSelectedBranchId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Threshold</label>
                        <select
                            value={threshold}
                            onChange={e => setThreshold(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={5}>≤ 5 units</option>
                            <option value={10}>≤ 10 units</option>
                            <option value={20}>≤ 20 units</option>
                            <option value={50}>≤ 50 units</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">Total Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">{lowStockItems.length}</p>
                </div>
                <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
                    <p className="text-sm text-red-600">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-700">{outOfStock}</p>
                </div>
                <div className="bg-orange-50 rounded-lg shadow p-4 border border-orange-200">
                    <p className="text-sm text-orange-600">Critical (1-5)</p>
                    <p className="text-2xl font-bold text-orange-700">{critical}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
                    <p className="text-sm text-yellow-600">Low ({'>'}5)</p>
                    <p className="text-2xl font-bold text-yellow-700">{low}</p>
                </div>
            </div>

            {/* Alerts Table */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                {lowStockItems.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-500">No low stock alerts</p>
                        <p className="text-sm text-gray-400 mt-1">
                            All products have sufficient inventory
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reserved</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {lowStockItems.map((item, index) => (
                                <tr key={`${item.customerId}-${item.item.id}-${index}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(item.availableQuantity)}`}>
                                            {getSeverityLabel(item.availableQuantity)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{item.customerName}</td>
                                    <td className="px-4 py-3 text-gray-500">{item.branchName}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-900">{item.item.productName}</span>
                                        {item.item.sku && (
                                            <span className="text-xs text-gray-400 ml-2">({item.item.sku})</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">{item.item.quantity}</td>
                                    <td className="px-4 py-3 text-right text-orange-600">{item.item.reservedQuantity}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${item.availableQuantity <= 0 ? 'text-red-600' :
                                        item.availableQuantity <= 5 ? 'text-orange-600' : 'text-yellow-600'
                                        }`}>
                                        {item.availableQuantity}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default StockAlertReport;
