import React, { useState } from 'react';
import { Branch } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    initialData?: Branch;
    onSave: (branch: Branch) => Promise<void>;
    onCancel: () => void;
}

export const BranchForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [code, setCode] = useState(initialData?.code || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !code) return;

        setLoading(true);
        try {
            await onSave({
                id: initialData?.id || `br-${Date.now()}`,
                name,
                code
            });
        } catch (e) {
            console.error(e);
            toast.error('Failed to save branch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={initialData ? 'Edit Branch / Warehouse' : 'Add New Branch / Warehouse'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Name (Warehouse/Branch)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. West Side Warehouse"
                    required
                />
                <Input
                    label="Code"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="e.g. WH-01"
                    required
                />
                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>Save Location</Button>
                </div>
            </form>
        </Card>
    );
};
