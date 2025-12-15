
import React, { useState } from 'react';
import { CurrencyConfig } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    initialData?: CurrencyConfig;
    onSave: (currency: CurrencyConfig) => Promise<void>;
    onCancel: () => void;
}

export const CurrencyForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [name, setName] = useState(initialData?.name || '');
    const [symbol, setSymbol] = useState(initialData?.symbol || '');
    const [exchangeRate, setExchangeRate] = useState(initialData?.exchangeRate || 1);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !name || !symbol) return;

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id || `curr-${code.toLowerCase()}`,
                code,
                name,
                symbol,
                exchangeRate,
                isBase: initialData?.isBase || false
            });
        } catch (e) {
            console.error(e);
            toast.error('Failed to save currency');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={initialData ? 'Edit Currency' : 'Add New Currency'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Currency Code"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. EUR"
                        required
                        disabled={initialData?.isBase}
                    />
                    <Input
                        label="Symbol"
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                        placeholder="e.g. €"
                        required
                    />
                </div>
                <Input
                    label="Currency Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Euro"
                    required
                />
                <Input
                    label="Exchange Rate (vs Base USD)"
                    type="number"
                    step="any"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(parseFloat(e.target.value))}
                    required
                    disabled={initialData?.isBase}
                />
                {initialData?.isBase && (
                    <p className="text-xs text-gray-500">Base currency (USD) cannot have its code or rate changed.</p>
                )}
                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>Save Currency</Button>
                </div>
            </form>
        </Card>
    );
};
