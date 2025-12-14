
import React, { useState, useEffect } from 'react';
import { NavigationItem, UserRole } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DEFAULT_NAVIGATION } from '../../constants';

export const MenuManagement: React.FC = () => {
    const [items, setItems] = useState<NavigationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);

    const loadItems = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getMenuItems();
            // Defensive check: Ensure data is an array
            setItems(Array.isArray(data) && data.length > 0 ? data : DEFAULT_NAVIGATION);
        } catch (e) {
            console.error(e);
            setItems(DEFAULT_NAVIGATION);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const handleReset = async () => {
        if(!confirm("Reset menu to system defaults? Custom changes will be lost.")) return;
        setLoading(true);
        await firebaseService.seedDefaultMenu();
        await loadItems();
        setLoading(false);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        
        try {
            await firebaseService.saveMenuItem(editingItem);
            setEditingItem(null);
            loadItems();
        } catch(e) {
            alert("Failed to save menu item.");
        }
    };

    const toggleRole = (role: UserRole) => {
        if (!editingItem) return;
        const currentRoles = editingItem.allowedRoles;
        const newRoles = currentRoles.includes(role) 
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        setEditingItem({ ...editingItem, allowedRoles: newRoles });
    };

    return (
        <Card title="Menu & Navigation" action={<Button variant="outline" onClick={handleReset} isLoading={loading}>Reset to Defaults</Button>}>
            <div className="space-y-6">
                {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gray-100 rounded text-gray-500">
                                {/* Simple icon placeholder as we can't dynamic import icons easily here without mapping */}
                                <span className="text-xs uppercase font-bold">{item.iconKey ? item.iconKey.substring(0,2) : '??'}</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900">{item.label}</h4>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                    {item.allowedRoles.map(role => (
                                        <span key={role} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                                            {role}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Button variant="secondary" onClick={() => setEditingItem(item)} className="text-xs">Edit</Button>
                    </div>
                ))}
            </div>

            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Edit Menu Item</h3>
                        <form onSubmit={handleSaveItem} className="space-y-4">
                            <Input 
                                label="Label" 
                                value={editingItem.label} 
                                onChange={e => setEditingItem({...editingItem, label: e.target.value})} 
                            />
                            <Input 
                                label="Order" 
                                type="number" 
                                value={editingItem.order} 
                                onChange={e => setEditingItem({...editingItem, order: parseInt(e.target.value)})} 
                            />
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Visible To</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['system-admin', 'accountant', 'finance-manager', 'warehouse', 'driver', 'customer'].map((role: any) => (
                                        <label key={role} className="flex items-center space-x-2 text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={editingItem.allowedRoles.includes(role)} 
                                                onChange={() => toggleRole(role)}
                                                className="rounded text-indigo-600"
                                            />
                                            <span className="capitalize">{role.replace('-', ' ')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" type="button" onClick={() => setEditingItem(null)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Card>
    );
};
