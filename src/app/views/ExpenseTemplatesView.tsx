import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { ExpenseTemplate, AccountType, AccountSubType } from '../../shared/types';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { getFriendlyErrorMessage } from '../../shared/utils/errorUtils';

export default function ExpenseTemplatesView() {
    const { accounts, taxRates } = useData();
    const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [processLoading, setProcessLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<Partial<ExpenseTemplate>>({});

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await firebaseService.financeService.getExpenseTemplates();
            setTemplates(data || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (template?: ExpenseTemplate) => {
        if (template) {
            setCurrentTemplate(template);
        } else {
            setCurrentTemplate({
                currency: 'USD',
                fixedAmount: 0 // Optional default
            });
        }
        setIsEditing(true);
        setError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!currentTemplate.name || !currentTemplate.debitAccountId || !currentTemplate.creditAccountId) {
            setError('Name, Expense Account, and Payment Account are required.');
            return;
        }

        try {
            setProcessLoading(true);
            const templateToSave: ExpenseTemplate = {
                id: currentTemplate.id || `ext-${Date.now()}`,
                name: currentTemplate.name,
                description: currentTemplate.description || '',
                debitAccountId: currentTemplate.debitAccountId,
                creditAccountId: currentTemplate.creditAccountId,
                taxRateId: currentTemplate.taxRateId,
                fixedAmount: currentTemplate.fixedAmount,
                currency: currentTemplate.currency || 'USD',
                createdAt: currentTemplate.createdAt || Date.now(),
                updatedAt: Date.now()
            };

            await firebaseService.financeService.saveExpenseTemplate(templateToSave);
            await loadTemplates();
            setIsEditing(false);
        } catch (err) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setProcessLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            setProcessLoading(true);
            await firebaseService.financeService.deleteExpenseTemplate(id);
            await loadTemplates();
        } catch (err) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setProcessLoading(false);
        }
    };

    // Filter Accounts
    const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);
    const paymentAccounts = accounts.filter(a =>
        (a.type === AccountType.ASSET && (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
        && !a.isHeader
    );

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Expense Templates</h1>
                <Button onClick={() => handleEdit()} icon={<Plus className="w-4 h-4" />}>
                    New Template
                </Button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>}

            {isEditing && (
                <Card title={currentTemplate.id ? 'Edit Template' : 'New Expense Template'}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Template Name"
                                value={currentTemplate.name || ''}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                required
                            />
                            <Input
                                label="Description"
                                value={currentTemplate.description || ''}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, description: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Account (Debit)</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={currentTemplate.debitAccountId || ''}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, debitAccountId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Expense Account</option>
                                    {expenseAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Account (Credit)</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={currentTemplate.creditAccountId || ''}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, creditAccountId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Bank/Cash Account</option>
                                    {paymentAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={currentTemplate.taxRateId || ''}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, taxRateId: e.target.value })}
                                >
                                    <option value="">No Tax</option>
                                    {taxRates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
                                <select
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    value={currentTemplate.currency || 'USD'}
                                    onChange={e => setCurrentTemplate({ ...currentTemplate, currency: e.target.value as 'USD' | 'KHR' })}
                                >
                                    <option value="USD">USD</option>
                                    <option value="KHR">KHR</option>
                                </select>
                            </div>
                            {/* Optional Fixed Amount */}
                            <Input
                                label="Default Amount (Optional)"
                                type="number"
                                value={currentTemplate.fixedAmount || ''}
                                onChange={e => setCurrentTemplate({ ...currentTemplate, fixedAmount: parseFloat(e.target.value) })}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button type="submit" isLoading={processLoading} icon={<Save className="w-4 h-4" />}>Save Template</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-gray-900">{t.name}</h3>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(t)} className="p-1 text-gray-500 hover:text-indigo-600 rounded">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-500 hover:text-red-600 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{t.description || 'No description'}</p>

                        <div className="space-y-1 text-xs bg-gray-50 p-2 rounded">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Expense:</span>
                                <span className="font-medium">{accounts.find(a => a.id === t.debitAccountId)?.name || t.debitAccountId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Payment:</span>
                                <span className="font-medium">{accounts.find(a => a.id === t.creditAccountId)?.name || t.creditAccountId}</span>
                            </div>
                            {t.taxRateId && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tax:</span>
                                    <span className="font-medium">{taxRates.find(tr => tr.id === t.taxRateId)?.name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {templates.length === 0 && !isEditing && (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p>No expense templates defined yet.</p>
                        <Button variant="link" onClick={() => handleEdit()}>Create your first template</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
