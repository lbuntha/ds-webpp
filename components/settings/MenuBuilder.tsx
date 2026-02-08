import React, { useState, useEffect } from 'react';
import { useData } from '../../src/shared/contexts/DataContext';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { NavigationItem } from '../../src/shared/types';
import { MenuItemModal } from './MenuItemModal';
import { MenuIcon } from '../ui/MenuIcon';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { DEFAULT_NAVIGATION } from '../../src/shared/constants';

export const MenuBuilder: React.FC = () => {
    const { menuItems, refreshData } = useData();
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<NavigationItem | null>(null);
    const [items, setItems] = useState<NavigationItem[]>([]);

    // Draft Mode State
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        if (!isPreviewMode) {
            setItems(menuItems);
        }
    }, [menuItems, isPreviewMode]);

    const handleEdit = (item: NavigationItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedItem(null);
        setIsModalOpen(true);
    };

    const handleModalSave = async (item: NavigationItem) => {
        if (isPreviewMode) {
            // In preview mode, we only update local state
            setItems(prev => {
                const existingIndex = prev.findIndex(i => i.id === item.id);
                if (existingIndex >= 0) {
                    const newItems = [...prev];
                    newItems[existingIndex] = item;
                    return newItems;
                } else {
                    return [...prev, item];
                }
            });
            setHasUnsavedChanges(true); // Technically always unsaved in preview until committed
        } else {
            // Live mode - save directly to Firebase
            try {
                await firebaseService.saveMenuItem(item);
                await refreshData();
            } catch (error) {
                console.error("Failed to save menu item", error);
                alert("Failed to save menu item");
            }
        }
    };

    const handleModalDelete = async (id: string) => {
        if (isPreviewMode) {
            setItems(prev => prev.filter(i => i.id !== id));
            setHasUnsavedChanges(true);
        } else {
            try {
                await firebaseService.deleteMenuItem(id);
                await refreshData();
            } catch (error) {
                console.error("Failed to delete menu item", error);
                alert("Failed to delete menu item");
            }
        }
    };

    const handleLoadDefaults = () => {
        if (window.confirm("This will load the default system menu into the editor. You can customize it before saving. Proceed?")) {
            setItems([...DEFAULT_NAVIGATION]); // Clone to avoid mutating constant
            setIsPreviewMode(true);
            setHasUnsavedChanges(true);
        }
    };

    const handleCancelPreview = () => {
        if (window.confirm("Discard changes and return to current menu?")) {
            setIsPreviewMode(false);
            setItems(menuItems);
            setHasUnsavedChanges(false);
        }
    };

    const handleApplyDefaults = async () => {
        if (!window.confirm("This will OVERWRITE the entire current menu configuration with the items shown below. This cannot be undone. Are you sure?")) return;

        setIsResetting(true);
        try {
            // We need to extend the config service to support bulk overwrite or loop here
            // Since we added overwriteMenu to configService (accessed via firebaseService), we need to cast or ensure it exists on the interface
            // The firebaseService proxy might not have it exposed yet. Let's check.
            // Actually, we can just use the configService directly if needed, or update firebaseService.
            // For now, let's assume we updating firebaseService.ts or cast to any.
            // Or better, let's just use the seedDefaultMenu logic but with our custom items.

            // Note: We need to expose overwriteMenu in firebaseService.ts first? 
            // Previous step added it to ConfigService. Let's assume we can access it via firebaseService.configService.overwriteMenu

            await firebaseService.configService.overwriteMenu(items);

            await refreshData();
            setIsPreviewMode(false);
            setHasUnsavedChanges(false);
            alert("Menu configuration updated successfully!");
        } catch (error) {
            console.error("Failed to apply menu", error);
            alert("Failed to apply changes");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        Menu & Navigation
                        {isPreviewMode && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-200">
                                Draft Mode (Unsaved)
                            </span>
                        )}
                    </h2>
                    <p className="text-gray-500">Configure the sidebar menu items, visibility, and roles.</p>
                </div>
                <div className="flex gap-3">
                    {isPreviewMode ? (
                        <>
                            <button
                                onClick={handleCancelPreview}
                                disabled={isResetting}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyDefaults}
                                disabled={isResetting}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                            >
                                {isResetting ? 'Saving...' : 'Apply Overwrite'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleLoadDefaults}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Load Defaults to Edit
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                Add Item
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isPreviewMode && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-3">
                    <svg className="w-6 h-6 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <h3 className="font-semibold text-yellow-800">Previewing Default Menu</h3>
                        <p className="text-yellow-700 text-sm mt-1">
                            You are currently editing a <strong>draft</strong> of the menu based on system defaults.
                            You can hide items, change labels, or reorder them here.
                            <br />
                            <strong>Nothing is saved until you click "Apply Overwrite".</strong>
                        </p>
                    </div>
                </div>
            )}

            <div className={`space-y-4 ${isPreviewMode ? 'opacity-100' : ''}`}>
                {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow bg-white group">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <MenuIcon iconKey={item.iconKey} className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 flex items-center gap-2">
                                    {item.label}
                                    {item.section && (
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-normal uppercase tracking-wide">
                                            {item.section}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 text-xs mt-1 text-gray-500">
                                    <span className="font-mono bg-gray-50 px-1 rounded border">{item.viewId}</span>
                                    <span>•</span>
                                    <span>Order: {item.order}</span>
                                    <span>•</span>
                                    <div className="flex gap-1">
                                        {(item.allowedRoles || ['ALL']).map(r => (
                                            <span key={r} className="bg-blue-50 text-blue-700 px-1 rounded">{r}</span>
                                        ))}
                                    </div>
                                    {item.hidden && (
                                        <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 text-red-500 font-medium">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                                Hidden
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p>No menu items found.</p>
                        <button onClick={handleLoadDefaults} className="text-indigo-600 hover:underline mt-2">Load Defaults</button>
                    </div>
                )}
            </div>

            <MenuItemModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleModalSave}
                onDelete={handleModalDelete}
                initialData={selectedItem}
            />
        </div>
    );
};
