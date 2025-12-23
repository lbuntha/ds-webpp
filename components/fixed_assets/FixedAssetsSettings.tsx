
import React, { useState, useEffect } from 'react';
import { FixedAssetCategory, Account } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AssetCategoryForm } from './AssetCategoryForm';
import { firebaseService } from '../../src/shared/services/firebaseService';

interface Props {
  accounts: Account[];
  onClose: () => void;
}

export const FixedAssetsSettings: React.FC<Props> = ({ accounts, onClose }) => {
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FixedAssetCategory | undefined>(undefined);

  const loadCategories = async () => {
      if(firebaseService.getFixedAssetCategories) {
          const data = await firebaseService.getFixedAssetCategories();
          setCategories(data);
      }
  };

  useEffect(() => {
      loadCategories();
  }, []);

  const handleSave = async (cat: FixedAssetCategory) => {
      if(firebaseService.addFixedAssetCategory && firebaseService.updateFixedAssetCategory) {
          if (editingCategory) await firebaseService.updateFixedAssetCategory(cat);
          else await firebaseService.addFixedAssetCategory(cat);
          await loadCategories();
          setIsFormOpen(false);
          setEditingCategory(undefined);
      }
  };

  const handleDelete = async (id: string) => {
      if(confirm("Are you sure? This will not affect existing assets linked to this category.")) {
          if(firebaseService.deleteFixedAssetCategory) {
              await firebaseService.deleteFixedAssetCategory(id);
              loadCategories();
          }
      }
  };

  if (isFormOpen) {
      return <AssetCategoryForm 
        initialData={editingCategory} 
        accounts={accounts} 
        onSave={handleSave} 
        onCancel={() => { setIsFormOpen(false); setEditingCategory(undefined); }}
      />;
  }

  return (
    <div className="space-y-4">
        <div className="mb-4">
            <button onClick={onClose} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Back to Assets
            </button>
        </div>

        <Card title="Asset Categories & Accounting Types" action={
            <Button onClick={() => setIsFormOpen(true)} className="text-xs">+ New Category</Button>
        }>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Useful Life</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map(cat => (
                            <tr key={cat.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{cat.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{cat.usefulLifeYears} Years</td>
                                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{(cat.method || '').replace('_', ' ').toLowerCase()}</td>
                                <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                    <button onClick={() => { setEditingCategory(cat); setIsFormOpen(true); }} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-gray-500">No categories defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
  );
};
