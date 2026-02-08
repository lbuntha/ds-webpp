import React, { useState, useEffect } from 'react';
import { NavigationItem, UserRole } from '../../src/shared/types';
import { Modal } from '../ui/Modal';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { MenuIcon } from '../ui/MenuIcon'; // Assuming this component exists based on Sidebar usage

interface MenuItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: NavigationItem) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    initialData?: NavigationItem | null;
}

const AVAILABLE_ICONS = [
    'dashboard', 'analytics', 'journal', 'banking', 'receipt', 'settings',
    'users', 'manual', 'reports', 'retention', 'aging', 'alert', 'places',
    'driver', 'fleet', 'jobs', 'wallet', 'user', 'plus', 'operations',
    'warehouse', 'dispatch', 'chat-delay', 'package', 'inbox', 'products',
    'gift', 'money', 'checkCircle', 'closing', 'calendar', 'staff', 'telegram',
    'inventory', 'fileText'
];

const AVAILABLE_ROLES: { value: UserRole; label: string }[] = [
    { value: 'system-admin', label: 'System Admin' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'finance-manager', label: 'Finance Manager' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'driver', label: 'Driver' },
    { value: 'customer', label: 'Customer' },
    { value: 'sales', label: 'Sales' },
    { value: 'fleet-driver', label: 'Fleet Driver' }
];

export const MenuItemModal: React.FC<MenuItemModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<NavigationItem>>({
        label: '',
        viewId: '',
        iconKey: 'dashboard',
        order: 0,
        section: '',
        allowedRoles: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                label: '',
                viewId: '',
                iconKey: 'dashboard',
                order: 0,
                section: '',
                allowedRoles: []
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRoleToggle = (role: UserRole) => {
        setFormData(prev => {
            const currentRoles = prev.allowedRoles || [];
            if (currentRoles.includes(role)) {
                return { ...prev, allowedRoles: currentRoles.filter(r => r !== role) };
            } else {
                return { ...prev, allowedRoles: [...currentRoles, role] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.label || !formData.viewId) return;

        setIsSubmitting(true);
        try {
            // Generate ID if new
            const itemToSave: NavigationItem = {
                id: initialData?.id || `nav-${Date.now()}`,
                label: formData.label,
                viewId: formData.viewId,
                iconKey: formData.iconKey || 'dashboard',
                order: Number(formData.order) || 0,
                section: formData.section || undefined,
                allowedRoles: formData.allowedRoles || [],
                // Preserve existing fields if editing, but ensure type safety
                ...((initialData || {}) as any),
                ...formData
            } as NavigationItem;

            await onSave(itemToSave);
            onClose();
        } catch (error) {
            console.error("Failed to save menu item", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData?.id || !onDelete) return;
        if (window.confirm('Are you sure you want to delete this menu item?')) {
            setIsSubmitting(true);
            try {
                await onDelete(initialData.id);
                onClose();
            } catch (error) {
                console.error("Failed to delete menu item", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Menu Item' : 'Add New Menu Item'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Label (Display Name)</label>
                    <input
                        type="text"
                        name="label"
                        value={formData.label}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">View ID (Internal Route Key)</label>
                    <input
                        type="text"
                        name="viewId"
                        value={formData.viewId}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        required
                        placeholder="e.g. ANALYTICS"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must match route configuration (e.g. starts with DRIVER_ or CUSTOMER_ for portals)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Order</label>
                        <input
                            type="number"
                            name="order"
                            value={formData.order}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Icon</label>
                        <div className="flex items-center gap-2 mt-1">
                            {formData.iconKey && <MenuIcon iconKey={formData.iconKey} className="w-5 h-5 text-gray-500" />}
                            <select
                                name="iconKey"
                                value={formData.iconKey}
                                onChange={handleChange}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                            >
                                {AVAILABLE_ICONS.map(icon => (
                                    <option key={icon} value={icon}>{icon}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Section (Group)</label>
                    <input
                        type="text"
                        name="section"
                        value={formData.section}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        placeholder="e.g. logistics, finance, system"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                    <label className="flex items-center space-x-2 cursor-pointer bg-gray-50 p-2 rounded border border-gray-200">
                        <input
                            type="checkbox"
                            name="hidden"
                            checked={formData.hidden || false}
                            onChange={(e) => setFormData(prev => ({ ...prev, hidden: e.target.checked }))}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Hide from Sidebar (even if allowed)</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Useful for disabling items without deleting them, or for sub-views.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visible To Roles</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                        {AVAILABLE_ROLES.map(role => (
                            <label key={role.value} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(formData.allowedRoles || []).includes(role.value)}
                                    onChange={() => handleRoleToggle(role.value)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">{role.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between pt-4 border-t mt-6">
                    <div>
                        {initialData && onDelete && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="bg-red-50 text-red-700 px-4 py-2 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
                                disabled={isSubmitting}
                            >
                                Delete Item
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};
