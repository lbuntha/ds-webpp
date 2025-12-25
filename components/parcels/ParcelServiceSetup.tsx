import React, { useState, useEffect } from 'react';
import { ParcelServiceType, Account, AccountType, TaxRate, AccountSubType } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ImageUpload } from '../ui/ImageUpload';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    accounts: Account[];
    taxRates: TaxRate[];
    onBookService?: (serviceId: string) => void;
}

export const ParcelServiceSetup: React.FC<Props> = ({ accounts, taxRates, onBookService }) => {
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [defaultPrice, setDefaultPrice] = useState(0);
    const [pricePerKm, setPricePerKm] = useState(0);
    const [defaultPriceKHR, setDefaultPriceKHR] = useState(0);
    const [pricePerKmKHR, setPricePerKmKHR] = useState(0);
    const [description, setDescription] = useState('');
    const [image, setImage] = useState('');
    const [taxRateId, setTaxRateId] = useState('');

    // USD Config
    const [revenueAccountUSD, setRevenueAccountUSD] = useState('');
    const [taxAccountUSD, setTaxAccountUSD] = useState('');

    // KHR Config
    const [revenueAccountKHR, setRevenueAccountKHR] = useState('');
    const [taxAccountKHR, setTaxAccountKHR] = useState('');

    // Delete confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Filter Accounts - Allow broad selection but group them for UX
    const availableAccounts = accounts.filter(a => !a.isHeader);

    const loadServices = async () => {
        const data = await firebaseService.getParcelServices();
        setServices(data);
    };

    useEffect(() => {
        loadServices();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setDefaultPrice(0);
        setPricePerKm(0);
        setDefaultPriceKHR(0);
        setPricePerKmKHR(0);
        setDescription('');
        setImage('');
        setTaxRateId('');

        setRevenueAccountUSD('');
        setTaxAccountUSD('');

        setRevenueAccountKHR('');
        setTaxAccountKHR('');
    };

    const handleEdit = (s: ParcelServiceType) => {
        setEditingId(s.id);
        setName(s.name);
        setDefaultPrice(s.defaultPrice);
        setPricePerKm(s.pricePerKm || 0);
        setDefaultPriceKHR(s.defaultPriceKHR || 0);
        setPricePerKmKHR(s.pricePerKmKHR || 0);
        setTaxRateId(s.taxRateId || '');
        setDescription(s.description || '');
        setImage(s.image || '');

        // Load or Fallback
        setRevenueAccountUSD(s.revenueAccountUSD || s.revenueAccountId || '');
        setTaxAccountUSD(s.taxAccountUSD || '');

        setRevenueAccountKHR(s.revenueAccountKHR || '');
        setTaxAccountKHR(s.taxAccountKHR || '');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !revenueAccountUSD) {
            toast.warning("Name and USD Revenue Account are required.");
            return;
        }

        setLoading(true);
        try {
            const newService: ParcelServiceType = {
                id: editingId || `ps-${Date.now()}`,
                name,
                defaultPrice,
                pricePerKm,
                defaultPriceKHR,
                pricePerKmKHR,
                revenueAccountId: revenueAccountUSD, // Keep legacy field synced with USD
                description,
                image,
                taxRateId: taxRateId || undefined,

                revenueAccountUSD,
                revenueAccountKHR,
                taxAccountUSD,
                taxAccountKHR
            };
            await firebaseService.saveParcelService(newService);
            resetForm();
            await loadServices();
            toast.success(editingId ? "Service updated." : "Service created.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save service.");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteParcelService(id);
            if (editingId === id) resetForm();
            await loadServices();
            toast.success("Service deleted.");
        } catch (e) {
            toast.error("Failed to delete service.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    const renderAccountSelect = (label: string, value: string, setValue: (val: string) => void, types: AccountType[] = [AccountType.REVENUE, AccountType.LIABILITY, AccountType.ASSET]) => (
        <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <select
                className="block w-full px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-xs bg-white"
                value={value}
                onChange={e => setValue(e.target.value)}
            >
                <option value="">-- Select GL Account --</option>
                {types.includes(AccountType.ASSET) && (
                    <optgroup label="Assets (Receivables/Cash)">
                        {availableAccounts.filter(a => a.type === AccountType.ASSET).map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </optgroup>
                )}
                {types.includes(AccountType.LIABILITY) && (
                    <optgroup label="Liabilities (Payables/Wallets)">
                        {availableAccounts.filter(a => a.type === AccountType.LIABILITY).map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </optgroup>
                )}
                {types.includes(AccountType.REVENUE) && (
                    <optgroup label="Revenue">
                        {availableAccounts.filter(a => a.type === AccountType.REVENUE).map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </optgroup>
                )}
            </select>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <Card title={editingId ? "Edit Product Configuration" : "New Service Configuration"}>
                <form onSubmit={handleSave} className="space-y-6">

                    {/* Top Section: Image & Core Info */}
                    <div className="flex flex-col sm:flex-row gap-6">
                        <div className="sm:w-1/3">
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 h-full flex flex-col justify-center">
                                <ImageUpload value={image} onChange={setImage} label="Icon" />
                            </div>
                        </div>
                        <div className="sm:w-2/3 space-y-4">
                            <Input
                                label="Service Name"
                                placeholder="e.g. Express Delivery"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
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
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
                        <p className="text-xs text-gray-600">
                            <strong>Note:</strong> Revenue & Tax accounting is now configured globally in <strong>Settings &gt; General</strong>.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t border-gray-100">
                        {editingId && (
                            <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                        )}
                        <Button type="submit" isLoading={loading}>
                            {editingId ? 'Update Configuration' : 'Save Configuration'}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* List */}
            <Card title="Configured Services">
                <div className="space-y-3">
                    {services.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center space-x-4">
                                {s.image ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-white">
                                        <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                                        <span className="text-xl">📦</span>
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">{s.name}</h4>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded font-medium">
                                            Base: ${s.defaultPrice}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleEdit(s)}
                                    className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors"
                                    title="Edit Configuration"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                {confirmDeleteId === s.id ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => executeDelete(s.id)}
                                            className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-full text-xs font-bold transition-colors"
                                            title="Confirm Delete"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                            title="Cancel"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(s.id)}
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {services.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No services configured.</p>}
                </div>
            </Card>
        </div>
    );
};
