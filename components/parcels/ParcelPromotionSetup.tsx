import React, { useState, useEffect } from 'react';
import { ParcelPromotion, Customer, ParcelServiceType } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

const ELIGIBILITY_OPTIONS = [
    { value: 'ALL', label: 'All Users', description: 'No restrictions' },
    { value: 'REGISTERED_LAST_7_DAYS', label: 'New Users (Last 7 Days)', description: 'Registered within the last 7 days' },
    { value: 'REGISTERED_LAST_MONTH', label: 'Recent Users (Last Month)', description: 'Registered within the last 30 days' },
    { value: 'REGISTERED_LAST_YEAR', label: 'Users (Last Year)', description: 'Registered within the last 12 months' },
    { value: 'SPECIFIC_USERS', label: 'Specific Users', description: 'Select up to 10 users' },
];

export const ParcelPromotionSetup: React.FC = () => {
    const [promotions, setPromotions] = useState<ParcelPromotion[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(false);

    // Form
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
    const [value, setValue] = useState(0);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [eligibility, setEligibility] = useState<'ALL' | 'REGISTERED_LAST_7_DAYS' | 'REGISTERED_LAST_MONTH' | 'REGISTERED_LAST_YEAR' | 'SPECIFIC_USERS'>('ALL');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState('');

    // Product Scope
    const [productScope, setProductScope] = useState<'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS'>('ALL_PRODUCTS');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    // Deletion confirm state
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadPromotions = async () => {
        const data = await firebaseService.getParcelPromotions();
        setPromotions(data);
    };

    useEffect(() => {
        loadPromotions();
        firebaseService.getCustomers().then(setCustomers);
        firebaseService.getParcelServices().then(setServices);
    }, []);

    const handleAddUser = (userId: string) => {
        if (!userId) return;
        if (selectedUserIds.length >= 10) {
            toast.warning("Maximum 10 users per promotion.");
            return;
        }
        if (!selectedUserIds.includes(userId)) {
            setSelectedUserIds([...selectedUserIds, userId]);
        }
    };

    const handleRemoveUser = (userId: string) => {
        setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    };

    const toggleProduct = (productId: string) => {
        if (selectedProductIds.includes(productId)) {
            setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
        } else {
            setSelectedProductIds([...selectedProductIds, productId]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !name || !startDate || !endDate) return;

        if (eligibility === 'SPECIFIC_USERS' && selectedUserIds.length === 0) {
            toast.warning("Please select at least one user.");
            return;
        }

        if (productScope === 'SPECIFIC_PRODUCTS' && selectedProductIds.length === 0) {
            toast.warning("Please select at least one product.");
            return;
        }

        setLoading(true);
        try {
            const promo: ParcelPromotion = {
                id: `promo-${Date.now()}`,
                code: code.toUpperCase(),
                name,
                type,
                value,
                startDate,
                endDate,
                isActive: true,
                eligibility,
                productScope,
                ...(eligibility === 'SPECIFIC_USERS' ? { allowedUserIds: selectedUserIds } : {}),
                ...(productScope === 'SPECIFIC_PRODUCTS' ? { allowedProductIds: selectedProductIds } : {})
            };
            await firebaseService.saveParcelPromotion(promo);
            setCode('');
            setName('');
            setValue(0);
            setEndDate('');
            setEligibility('ALL');
            setSelectedUserIds([]);
            setUserSearch('');
            setProductScope('ALL_PRODUCTS');
            setSelectedProductIds([]);
            await loadPromotions();
            toast.success("Promotion created.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save promotion.");
        } finally {
            setLoading(false);
        }
    };

    const executeDelete = async (id: string) => {
        try {
            await firebaseService.deleteParcelPromotion(id);
            await loadPromotions();
            toast.success("Promotion deleted.");
        } catch (e) {
            toast.error("Failed to delete promotion.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const getEligibilityLabel = (promo: ParcelPromotion) => {
        if (promo.eligibility === 'SPECIFIC_USERS') {
            return `Specific Users (${promo.allowedUserIds?.length || 0})`;
        }
        const option = ELIGIBILITY_OPTIONS.find(o => o.value === promo.eligibility);
        return option?.label || 'All Users';
    };

    const getProductScopeLabel = (promo: ParcelPromotion) => {
        if (promo.productScope === 'SPECIFIC_PRODUCTS') {
            const productNames = promo.allowedProductIds?.map(id => {
                const svc = services.find(s => s.id === id);
                return svc?.name || id;
            }).join(', ');
            return productNames || 'Specific Products';
        }
        return 'All Products';
    };

    const getCustomerName = (userId: string) => {
        const customer = customers.find(c => c.id === userId);
        return customer?.name || userId;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Create Promotion">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Promo Code" value={code} onChange={e => setCode(e.target.value)} placeholder="SUMMER25" required />
                        <Input label="Campaign Name" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Sale" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                            >
                                <option value="PERCENTAGE">Percentage (%)</option>
                                <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                            </select>
                        </div>
                        <Input
                            label="Discount Value"
                            type="number"
                            value={value}
                            onChange={e => setValue(parseFloat(e.target.value))}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                        <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                    </div>

                    {/* Product Scope */}
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                        <label className="block text-sm font-medium text-green-800 mb-2">
                            📦 Applies To
                        </label>
                        <div className="flex gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => { setProductScope('ALL_PRODUCTS'); setSelectedProductIds([]); }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${productScope === 'ALL_PRODUCTS'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'
                                    }`}
                            >
                                All Products
                            </button>
                            <button
                                type="button"
                                onClick={() => setProductScope('SPECIFIC_PRODUCTS')}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${productScope === 'SPECIFIC_PRODUCTS'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'
                                    }`}
                            >
                                Specific Products
                            </button>
                        </div>

                        {productScope === 'SPECIFIC_PRODUCTS' && (
                            <div className="mt-2 space-y-1">
                                {services.map(svc => (
                                    <label
                                        key={svc.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedProductIds.includes(svc.id)
                                                ? 'bg-green-100 border border-green-300'
                                                : 'bg-white border border-gray-200 hover:bg-green-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProductIds.includes(svc.id)}
                                            onChange={() => toggleProduct(svc.id)}
                                            className="rounded text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm font-medium text-gray-900">{svc.name}</span>
                                        <span className="text-xs text-gray-500 ml-auto">${svc.defaultPrice}</span>
                                    </label>
                                ))}
                                {services.length === 0 && (
                                    <p className="text-xs text-gray-500 text-center py-2">No services configured</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Eligibility Rules */}
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <label className="block text-sm font-medium text-indigo-800 mb-2">
                            🎯 Target Audience
                        </label>
                        <select
                            className="block w-full px-3 py-2 border border-indigo-200 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm bg-white"
                            value={eligibility}
                            onChange={e => {
                                setEligibility(e.target.value as any);
                                if (e.target.value !== 'SPECIFIC_USERS') {
                                    setSelectedUserIds([]);
                                    setUserSearch('');
                                }
                            }}
                        >
                            {ELIGIBILITY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label} — {opt.description}
                                </option>
                            ))}
                        </select>

                        {/* Specific Users Selector */}
                        {eligibility === 'SPECIFIC_USERS' && (
                            <div className="mt-3 space-y-2">
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-indigo-200 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm bg-white"
                                        placeholder="🔍 Search by name or phone..."
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                    />

                                    {/* Search Results Dropdown */}
                                    {userSearch.length >= 2 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-indigo-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                            {customers
                                                .filter(c =>
                                                    !selectedUserIds.includes(c.id) &&
                                                    (c.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                        c.phone?.includes(userSearch))
                                                )
                                                .slice(0, 6)
                                                .map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 flex justify-between items-center border-b border-gray-100 last:border-0"
                                                        onClick={() => {
                                                            handleAddUser(c.id);
                                                            setUserSearch('');
                                                        }}
                                                    >
                                                        <span className="font-medium text-gray-900">{c.name}</span>
                                                        <span className="text-xs text-gray-500">{c.phone}</span>
                                                    </button>
                                                ))
                                            }
                                            {customers.filter(c =>
                                                !selectedUserIds.includes(c.id) &&
                                                (c.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                    c.phone?.includes(userSearch))
                                            ).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                                                        No customers found
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {selectedUserIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {selectedUserIds.map(userId => (
                                            <span
                                                key={userId}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-indigo-200 rounded-full text-xs font-medium text-indigo-700"
                                            >
                                                {getCustomerName(userId)}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveUser(userId)}
                                                    className="text-indigo-400 hover:text-red-500"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <p className="text-[10px] text-indigo-600">
                                    {selectedUserIds.length}/10 users selected
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-2">
                        <Button type="submit" isLoading={loading}>Create Promotion</Button>
                    </div>
                </form>
            </Card>

            <Card title="Active Promotions">
                <div className="space-y-3">
                    {promotions.map(p => (
                        <div key={p.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-indigo-600">{p.code}</span>
                                        <span className="text-sm font-medium text-gray-900">{p.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`} | Valid: {p.startDate} to {p.endDate}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                            🎯 {getEligibilityLabel(p)}
                                        </span>
                                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                            📦 {getProductScopeLabel(p)}
                                        </span>
                                    </div>
                                </div>
                                {confirmDeleteId === p.id ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => executeDelete(p.id)} className="text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs font-bold">Confirm</button>
                                        <button onClick={() => setConfirmDeleteId(null)} className="text-gray-500 text-xs">Cancel</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setConfirmDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                                )}
                            </div>
                        </div>
                    ))}
                    {promotions.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No promotions active.</p>}
                </div>
            </Card>
        </div>
    );
};
