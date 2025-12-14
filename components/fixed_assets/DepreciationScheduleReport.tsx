
import React, { useState, useMemo } from 'react';
import { FixedAsset, FixedAssetCategory, Branch } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  assets: FixedAsset[];
  categories: FixedAssetCategory[];
  branches: Branch[];
  onClose: () => void;
}

export const DepreciationScheduleReport: React.FC<Props> = ({ assets, categories, branches, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const reportData = useMemo(() => {
    return assets.filter(asset => {
        if (asset.status !== 'ACTIVE') return false;
        if (selectedCategory && asset.categoryId !== selectedCategory) return false;
        if (selectedBranch && asset.branchId !== selectedBranch) return false;
        return true;
    }).map(asset => {
        let monthlyDepreciation = 0;
        
        // Calculation logic mirroring backend service for estimation
        if (asset.depreciationMethod === 'DECLINING_BALANCE') {
            if (asset.usefulLifeYears > 0) {
                const rate = 2 / asset.usefulLifeYears;
                monthlyDepreciation = (asset.bookValue * rate) / 12;
            }
        } else {
            // Straight Line: (Cost - Salvage) / (Life * 12)
            const depreciableBase = asset.cost - (asset.salvageValue || 0);
            const totalMonths = asset.usefulLifeYears * 12;
            if (totalMonths > 0) {
                monthlyDepreciation = depreciableBase / totalMonths;
            }
        }
        
        // Cap at remaining book value (minus salvage)
        const remainingDepreciable = asset.bookValue - (asset.salvageValue || 0);
        if (monthlyDepreciation > remainingDepreciable) monthlyDepreciation = remainingDepreciable;
        if (monthlyDepreciation < 0) monthlyDepreciation = 0;

        const categoryName = categories.find(c => c.id === asset.categoryId)?.name || 'Uncategorized';
        const branchName = branches.find(b => b.id === asset.branchId)?.name || 'Unknown';

        return {
            ...asset,
            categoryName,
            branchName,
            monthlyDepreciation
        };
    });
  }, [assets, categories, branches, selectedCategory, selectedBranch]);

  const totals = reportData.reduce((acc, item) => ({
      cost: acc.cost + item.cost,
      accumDep: acc.accumDep + item.accumulatedDepreciation,
      bookValue: acc.bookValue + item.bookValue,
      monthlyDep: acc.monthlyDep + item.monthlyDepreciation
  }), { cost: 0, accumDep: 0, bookValue: 0, monthlyDep: 0 });

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center print:hidden">
            <button onClick={onClose} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Back to Dashboard
            </button>
            <Button variant="outline" onClick={() => window.print()}>Print Schedule</Button>
        </div>

        <Card title="Fixed Asset Depreciation Schedule">
            <div className="flex flex-col md:flex-row gap-4 mb-6 print:hidden bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Category</label>
                    <select 
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Branch</label>
                    <select 
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-indigo-500"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                    >
                        <option value="">All Branches</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Asset Details</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Orig. Cost</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Accum. Dep.</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Book Value</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Est. Monthly Dep.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {reportData.map(asset => (
                            <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-900">{asset.assetName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{asset.assetCode}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{asset.categoryName}</td>
                                <td className="px-4 py-3 text-gray-600">{asset.branchName}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(asset.cost)}</td>
                                <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(asset.accumulatedDepreciation)}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(asset.bookValue)}</td>
                                <td className="px-4 py-3 text-right text-blue-600 font-medium bg-blue-50/50">{formatCurrency(asset.monthlyDepreciation)}</td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-500 italic">No active assets found matching filters.</td></tr>
                        )}
                        {reportData.length > 0 && (
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                <td colSpan={3} className="px-4 py-3 text-right text-gray-800">Grand Totals</td>
                                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totals.cost)}</td>
                                <td className="px-4 py-3 text-right text-orange-700">{formatCurrency(totals.accumDep)}</td>
                                <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totals.bookValue)}</td>
                                <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(totals.monthlyDep)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
  );
};
