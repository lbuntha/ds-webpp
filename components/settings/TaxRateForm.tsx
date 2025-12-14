import React, { useState } from 'react';
import { TaxRate } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface Props {
  initialData?: TaxRate;
  onSave: (taxRate: TaxRate) => Promise<void>;
  onCancel: () => void;
}

export const TaxRateForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [rate, setRate] = useState(initialData?.rate || 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    
    setLoading(true);
    try {
        await onSave({
            id: initialData?.id || `tax-${Date.now()}`,
            name,
            code,
            rate
        });
    } catch (e) {
        console.error(e);
        alert('Failed to save tax rate');
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card title={initialData ? 'Edit Tax Rate' : 'Add New Tax Rate'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
                label="Tax Name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. VAT 10%"
                required 
            />
            <div className="grid grid-cols-2 gap-4">
                 <Input 
                    label="Tax Code" 
                    value={code} 
                    onChange={e => setCode(e.target.value.toUpperCase())} 
                    placeholder="e.g. VAT-10"
                    required 
                />
                <Input 
                    label="Rate (%)" 
                    type="number"
                    step="0.01"
                    value={rate} 
                    onChange={e => setRate(parseFloat(e.target.value))} 
                    required 
                />
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" isLoading={loading}>Save Tax Rate</Button>
            </div>
        </form>
    </Card>
  );
};