import React, { useState, useEffect } from 'react';
import { ParcelServiceType, Account, TaxRate } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ImageUpload } from '../ui/ImageUpload';

interface Props {
    initialData?: ParcelServiceType | null;
    taxRates: TaxRate[];
    onSave: (data: Partial<ParcelServiceType>) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const ParcelServiceForm: React.FC<Props> = ({
    initialData,
    taxRates,
    onSave,
    onCancel,
    isLoading = false
}) => {
    const [name, setName] = useState('');
    const [nameKH, setNameKH] = useState('');
    const [defaultPrice, setDefaultPrice] = useState(0);
    const [pricePerKm, setPricePerKm] = useState(0);
    const [defaultPriceKHR, setDefaultPriceKHR] = useState(0);
    const [pricePerKmKHR, setPricePerKmKHR] = useState(0);
    const [description, setDescription] = useState('');
    const [image, setImage] = useState('');
    const [taxRateId, setTaxRateId] = useState('');

    // New Rule Fields
    const [rule, setRule] = useState('');
    const [ruleKH, setRuleKH] = useState('');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setNameKH(initialData.nameKH || '');
            setDefaultPrice(initialData.defaultPrice);
            setPricePerKm(initialData.pricePerKm || 0);
            setDefaultPriceKHR(initialData.defaultPriceKHR || 0);
            setPricePerKmKHR(initialData.pricePerKmKHR || 0);
            setDescription(initialData.description || '');
            setImage(initialData.image || '');
            setTaxRateId(initialData.taxRateId || '');
            setRule(initialData.rule || '');
            setRuleKH(initialData.ruleKH || '');
        } else {
            // Reset form for new entry
            setName('');
            setNameKH('');
            setDefaultPrice(0);
            setPricePerKm(0);
            setDefaultPriceKHR(0);
            setPricePerKmKHR(0);
            setDescription('');
            setImage('');
            setTaxRateId('');
            setRule('');
            setRuleKH('');
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        await onSave({
            name,
            nameKH: nameKH || undefined,
            defaultPrice,
            pricePerKm,
            defaultPriceKHR,
            pricePerKmKHR,
            description,
            image,
            taxRateId: taxRateId || undefined,
            rule: rule || undefined,
            ruleKH: ruleKH || undefined,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {/* Image Upload Section - Top, Full Width Container, Small Input */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
                <div className="w-40 text-center">
                    <ImageUpload value={image} onChange={setImage} label="Service Icon" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        label="Service Name"
                        placeholder="e.g. Express Delivery"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                    <Input
                        label="ឈ្មោះសេវាកម្ម (Khmer)"
                        placeholder="ឧ. ដឹកជញ្ជូនរហ័ស"
                        value={nameKH}
                        onChange={e => setNameKH(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Base Price ($)"
                        type="number"
                        step="0.01"
                        value={defaultPrice}
                        onChange={e => setDefaultPrice(parseFloat(e.target.value))}
                    />
                    <Input
                        label="Price/Km ($)"
                        type="number"
                        step="0.01"
                        value={pricePerKm}
                        onChange={e => setPricePerKm(parseFloat(e.target.value))}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 bg-orange-50 p-2 rounded-lg border border-orange-100">
                    <Input
                        label="Base Price (KHR)"
                        type="number"
                        value={defaultPriceKHR}
                        onChange={e => setDefaultPriceKHR(parseFloat(e.target.value))}
                    />
                    <Input
                        label="Price/Km (KHR)"
                        type="number"
                        value={pricePerKmKHR}
                        onChange={e => setPricePerKmKHR(parseFloat(e.target.value))}
                    />
                </div>

                {/* New Rule Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rule (English)</label>
                        <textarea
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                            placeholder="e.g. Max weight 5kg..."
                            value={rule}
                            onChange={e => setRule(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rule (Khmer)</label>
                        <textarea
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                            placeholder="ឧ. ទម្ងន់អតិបរមា ៥គីឡូ..."
                            value={ruleKH}
                            onChange={e => setRuleKH(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate</label>
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm sm:text-sm"
                        value={taxRateId}
                        onChange={e => setTaxRateId(e.target.value)}
                    >
                        <option value="">No Tax Applied</option>
                        {taxRates.map(tr => (
                            <option key={tr.id} value={tr.id}>{tr.name} ({tr.rate}%)</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
                <p className="text-xs text-gray-600">
                    <strong>Note:</strong> Revenue & Tax accounting is now configured globally in <strong>Settings &gt; General</strong>.
                </p>
            </div>

            <div className="flex justify-end pt-4 gap-2 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit" isLoading={isLoading}>
                    {initialData ? 'Update Configuration' : 'Save Configuration'}
                </Button>
            </div>
        </form>
    );
};
