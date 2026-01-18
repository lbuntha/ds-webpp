import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface Props {
    title: string;
    items: string[];
    onItemsChange: (items: string[]) => void;
    description?: string;
}

export const SuggestionListEditor: React.FC<Props> = ({ title, items, onItemsChange, description }) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (!newItem.trim()) return;
        onItemsChange([...items, newItem.trim()]);
        setNewItem('');
    };

    const handleRemove = (index: number) => {
        const updated = [...items];
        updated.splice(index, 1);
        onItemsChange(updated);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">{title}</h5>
            {description && <p className="text-[10px] text-gray-500 mb-3 italic">{description}</p>}

            <div className="space-y-2 mb-4">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 shadow-sm">
                        <span className="text-sm text-gray-700">{item}</span>
                        <button
                            onClick={() => handleRemove(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Remove"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">No suggestions added yet.</p>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a new suggestion..."
                    className="flex-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <Button onClick={handleAdd} disabled={!newItem.trim()} variant="secondary" className="whitespace-nowrap">
                    Add
                </Button>
            </div>
        </div>
    );
};
