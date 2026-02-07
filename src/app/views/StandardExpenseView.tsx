import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useData } from '../../shared/contexts/DataContext';
import { useAuth } from '../../shared/contexts/AuthContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { ExpenseTemplate, JournalEntry } from '../../shared/types';
import { Save, AlertCircle, ArrowRight } from 'lucide-react';
import { getFriendlyErrorMessage } from '../../shared/utils/errorUtils';
import { useNavigate } from 'react-router-dom';

export default function StandardExpenseView() {
    const { accounts, taxRates } = useData();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form State
    const [amount, setAmount] = useState<number>(0);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [taxRateId, setTaxRateId] = useState('');

    // Calculated State
    const [template, setTemplate] = useState<ExpenseTemplate | null>(null);
    const [currency, setCurrency] = useState('USD');

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

    // Update form when template changes
    useEffect(() => {
        if (selectedTemplateId) {
            const t = templates.find(temp => temp.id === selectedTemplateId);
            if (t) {
                setTemplate(t);
                setCurrency(t.currency || 'USD');
                setTaxRateId(t.taxRateId || '');
                if (t.fixedAmount) setAmount(t.fixedAmount);
            }
        } else {
            setTemplate(null);
        }
    }, [selectedTemplateId, templates]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!template || !user) return;
        if (amount <= 0) {
            setError('Amount must be greater than 0');
            return;
        }

        try {
            setSubmitting(true);

            // Calculate tax if applicable
            let taxAmount = 0;
            let netAmount = amount;

            if (taxRateId) {
                const taxRate = taxRates.find(tr => tr.id === taxRateId);
                if (taxRate) {
                    // Assuming price includes tax? Or excludes? 
                    // Standard practice: Input is usually the invoice total.
                    // If we want to be simple, let's assume input = net expense, tax is added?
                    // Actually, usually users enter the Bill Total. 
                    // Let's assume Amount is the TOTAL PAYMENT.
                    // So we back-calculate tax.
                    // Net = Total / (1 + rate/100)
                    netAmount = amount / (1 + taxRate.rate / 100);
                    taxAmount = amount - netAmount;
                }
            }

            const debitLine = {
                accountId: template.debitAccountId,
                debit: netAmount,
                credit: 0
            };

            const creditLine = {
                accountId: template.creditAccountId,
                debit: 0,
                credit: amount
            };

            const lines = [debitLine, creditLine];

            // Add Tax Line if exists
            if (taxAmount > 0 && taxRateId) {
                // We need a Tax Input account. For now, assuming standard tax account from settings or hardcoded? 
                // Ideally template sets this or we pick from tax rate config.
                // Let's check if TaxRate has an account linked?
                const taxRate = taxRates.find(tr => tr.id === taxRateId);
                // In this system TaxRate is simple. We might need a default tax account.
                // For now, let's use a generic 'VAT-Input' account logic or look for one.
                const taxAccount = accounts.find(a => a.name === 'VAT-Input' && a.currency === currency);

                if (taxAccount) {
                    lines.push({
                        accountId: taxAccount.id,
                        debit: taxAmount,
                        credit: 0
                    });
                } else {
                    // Fallback: Add tax back to expense or warn? 
                    // For simplicity in this iteration, if no tax account, just debit full amount to expense.
                    debitLine.debit = amount;
                    // Remove tax line attempt
                    console.warn('No tax account found, posting full amount to expense');
                }
            }

            const entry: JournalEntry = {
                id: `je-exp-${Date.now()}`,
                date,
                description: `${template.name} - ${notes || 'Standard Expense'}`,
                reference: reference || `EXP-${Date.now().toString().slice(-6)}`,
                branchId: user.branchId || accounts[0]?.branchId || 'b1', // Default to user branch or HQ
                currency,
                exchangeRate: 1, // Simplified for same-currency
                originalTotal: amount,
                createdAt: Date.now(),
                lines: lines.map(line => ({
                    ...line,
                    originalCurrency: currency,
                    originalExchangeRate: 1,
                    originalDebit: line.debit,
                    originalCredit: line.credit
                }))
            };

            // SUBMIT FOR APPROVAL
            await firebaseService.financeService.submitForApproval(entry, user.uid, user.name);

            setSuccess('Expense submitted for approval successfully!');
            // Reset form
            setAmount(0);
            setReference('');
            setNotes('');
            // Optional: navigate to list or stay
            setTimeout(() => navigate('/app/banking'), 1500);

        } catch (err) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    const debitAccount = template ? accounts.find(a => a.id === template.debitAccountId) : null;
    const creditAccount = template ? accounts.find(a => a.id === template.creditAccountId) : null;
    const selectedTax = taxRates.find(t => t.id === taxRateId);

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Post Standard Expense</h1>

            {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">{success}</div>}
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">{error}</div>}

            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Expense Template</label>
                        <select
                            className="w-full text-lg border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-3"
                            value={selectedTemplateId}
                            onChange={e => setSelectedTemplateId(e.target.value)}
                            required
                        >
                            <option value="">-- Choose an Expense Type --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {template && <p className="text-sm text-gray-500 mt-1">{template.description}</p>}
                    </div>

                    {template && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Date"
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                />
                                <Input
                                    label="Reference #"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                    placeholder="Invoice/Receipt #"
                                />
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Total Amount ({currency})</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={e => setAmount(parseFloat(e.target.value))}
                                            required
                                            className="text-2xl font-bold text-gray-900"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax?</label>
                                        <select
                                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                            value={taxRateId}
                                            onChange={e => setTaxRateId(e.target.value)}
                                        >
                                            <option value="">No Tax</option>
                                            {taxRates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <Input
                                    label="Notes / Description"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="mt-4"
                                    placeholder="Details about this expense..."
                                />
                            </div>

                            {/* Preview */}
                            <div className="border border-indigo-100 bg-indigo-50/50 rounded-lg p-4 text-sm">
                                <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Accounting Preview
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-gray-500 text-xs">Debit (Expense)</span>
                                        <span className="font-medium text-gray-800">{debitAccount?.name || 'Loading...'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500 text-xs">Credit (Payment)</span>
                                        <span className="font-medium text-gray-800">{creditAccount?.name || 'Loading...'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button size="lg" type="submit" isLoading={submitting} icon={<Save className="w-5 h-5" />}>
                                    Submit Expense
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            </Card>
        </div>
    );
}
