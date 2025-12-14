
import React, { useState } from 'react';
import { FixedAsset, Account } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  assets: FixedAsset[];
  onEdit: (asset: FixedAsset) => void;
  onDepreciate: (asset: FixedAsset) => void;
  onDispose: (asset: FixedAsset) => void;
}

export const AssetList: React.FC<Props> = ({ assets, onEdit, onDepreciate, onDispose }) => {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DISPOSED'>('ACTIVE');

  const filteredAssets = assets.filter(a => filter === 'ALL' || a.status === filter);

  const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

  return (
    <Card title="Asset Registry" action={
        <div className="flex space-x-2">
            <select 
                className="block w-32 pl-3 pr-8 py-1 text-xs border border-gray-300 rounded-md focus:ring-indigo-500"
                value={filter}
                onChange={e => setFilter(e.target.value as any)}
            >
                <option value="ACTIVE">Active</option>
                <option value="DISPOSED">Disposed</option>
                <option value="ALL">All</option>
            </select>
        </div>
    }>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code/Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orig. Cost</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accum. Dep.</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Book Value</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAssets.map(asset => (
                        <tr key={asset.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{asset.assetName}</div>
                                <div className="text-xs text-gray-500 font-mono">{asset.assetCode}</div>
                                {asset.status === 'DISPOSED' && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 rounded">DISPOSED</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{asset.purchaseDate}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(asset.cost)}</td>
                            <td className="px-6 py-4 text-sm text-right text-orange-600">{formatCurrency(asset.accumulatedDepreciation)}</td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{formatCurrency(asset.bookValue)}</td>
                            <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                {asset.status === 'ACTIVE' && (
                                    <>
                                        <button onClick={() => onEdit(asset)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                        <button onClick={() => onDepreciate(asset)} className="text-blue-600 hover:text-blue-900">Depreciate</button>
                                        <button onClick={() => onDispose(asset)} className="text-red-600 hover:text-red-900">Dispose</button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredAssets.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-500">No assets found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </Card>
  );
};
