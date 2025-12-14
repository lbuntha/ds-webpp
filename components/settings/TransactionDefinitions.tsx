
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TRANSACTION_DEFINITIONS } from '../../constants';
import { SystemSettings, Account } from '../../types';

interface Props {
  settings?: SystemSettings;
  accounts?: Account[];
  onUpdateSettings?: (settings: SystemSettings) => Promise<void>;
}

export const TransactionDefinitions: React.FC<Props> = ({ settings, accounts = [], onUpdateSettings }) => {
    const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (settings?.transactionRules) {
            setLocalMappings(settings.transactionRules);
        }
    }, [settings]);

    const handleMappingChange = (ruleId: number, accountId: string) => {
        setLocalMappings(prev => ({
            ...prev,
            [ruleId]: accountId
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!onUpdateSettings || !settings) return;
        setSaving(true);
        try {
            await onUpdateSettings({
                ...settings,
                transactionRules: localMappings
            });
            setIsDirty(false);
            alert("Posting rules updated successfully.");
        } catch (e) {
            alert("Failed to save rules.");
        } finally {
            setSaving(false);
        }
    };

    // Helper to see if a rule should be configurable
    const isConfigurable = (ruleId: number) => {
        // Rules that map to global accounts:
        // 4: Settle to Company (Bank/Cash)
        // 5: Settle to Customer (Wallet Liability)
        // 10: Commission Expense (Expense)
        // 12: Collection Fee (Revenue)
        // 13: VAT Output (Liability)
        // 14: VAT Input (Asset)
        return [4, 5, 10, 12, 13, 14].includes(ruleId);
    };
    
    // Helper to get rule hint
    const getRuleHint = (ruleId: number) => {
        switch(ruleId) {
            case 1: return "Defined in Parcel Status Config";
            case 7: return "Defined in Parcel Status Config";
            case 9: return "Defined per Service Type";
            default: return "";
        }
    };

    return (
        <Card title="Posting Rules & Account Mapping" action={
            <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500 italic hidden md:block">
                    Map standard system events to GL accounts
                </div>
                {isDirty && (
                    <Button onClick={handleSave} isLoading={saving} className="text-xs">Save Mappings</Button>
                )}
            </div>
        }>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mapped Account</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Auto</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {TRANSACTION_DEFINITIONS.map((def) => {
                            const configurable = isConfigurable(def.id);
                            const hint = getRuleHint(def.id);
                            
                            return (
                                <tr key={def.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                        {def.id}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {def.description}
                                        {hint && <span className="block text-xs text-gray-400 font-normal mt-0.5">{hint}</span>}
                                    </td>
                                    <td className="px-6 py-3">
                                        {configurable ? (
                                            <select 
                                                className="block w-full max-w-sm px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                                value={localMappings[def.id] || ''}
                                                onChange={(e) => handleMappingChange(def.id, e.target.value)}
                                            >
                                                <option value="">-- Select Default Account --</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.code} - {acc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">
                                                {hint ? 'Dynamic / Contextual' : 'System Managed'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            def.auto === 'Y' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {def.auto === 'Y' ? 'Yes' : 'No'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-200">
                <p className="font-bold mb-1">About Transaction Rules:</p>
                <p>
                    These definitions control which General Ledger accounts are used when the system automatically creates Journal Entries.
                    <br/>
                    <strong>Note:</strong> Some rules (like "Service Fee") are mapped dynamically within other configurations (e.g., inside Service Type settings) to allow for granular control.
                    Rules exposed here are global defaults.
                </p>
            </div>
        </Card>
    );
};
