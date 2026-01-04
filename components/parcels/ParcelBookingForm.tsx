import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ParcelBooking, ParcelItem, ParcelServiceType, Branch, Account, AccountType, Customer, TaxRate, ParcelPromotion, AccountSubType, CustomerSpecialRate, CurrencyConfig, Place } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { LocationPicker } from '../ui/LocationPicker';
import { PlaceAutocomplete } from '../ui/PlaceAutocomplete';
import { processImageForUpload } from '../../src/shared/utils/imageUtils';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    services: ParcelServiceType[];
    branches: Branch[];
    accounts: Account[];
    customers: Customer[];
    taxRates: TaxRate[];
    initialServiceTypeId?: string;
    onComplete: () => void;
}

export const ParcelBookingForm: React.FC<Props> = ({ services, branches, accounts, customers, taxRates, initialServiceTypeId, onComplete }) => {
    const { t } = useLanguage();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);

    // --- STEP 1: SENDER & ROUTE ---
    const [senderId, setSenderId] = useState('');
    const [senderName, setSenderName] = useState('');
    const [senderPhone, setSenderPhone] = useState('');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupLocation, setPickupLocation] = useState<{ lat: number, lng: number } | undefined>(undefined);
    const [bookingNotes, setBookingNotes] = useState(''); // General notes
    const [serviceTypeId, setServiceTypeId] = useState(initialServiceTypeId || '');
    const [branchId, setBranchId] = useState(branches[0]?.id || '');
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
    const [distance, setDistance] = useState(0);

    // Rate Config
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [effectiveExchangeRate, setEffectiveExchangeRate] = useState<number>(4100);

    // Special Rates State
    const [specialRates, setSpecialRates] = useState<CustomerSpecialRate[]>([]);

    // Map Picker State
    const [mapPickerTarget, setMapPickerTarget] = useState<{ type: 'PICKUP' | 'DROPOFF', index?: number } | null>(null);

    // NEW: Save Place Modal State
    const [placeToSave, setPlaceToSave] = useState<{ lat: number, lng: number, address: string } | null>(null);
    const [newPlaceName, setNewPlaceName] = useState('');
    const [newPlaceCategory, setNewPlaceCategory] = useState('');

    // --- STEP 2: ITEMS ---
    const [items, setItems] = useState<ParcelItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- STEP 3: FINANCIALS ---
    const [promotions, setPromotions] = useState<ParcelPromotion[]>([]);
    const [selectedPromoId, setSelectedPromoId] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'CONFIRMED'>('PENDING');
    const [depositAccountId, setDepositAccountId] = useState('');

    // Update service type if prop changes
    useEffect(() => {
        if (initialServiceTypeId) {
            setServiceTypeId(initialServiceTypeId);
        }
    }, [initialServiceTypeId]);

    // Load Currencies
    useEffect(() => {
        firebaseService.getCurrencies().then(setCurrencies);
    }, []);

    // Fetch Special Rates & Determine Exchange Rate when Customer Changes
    useEffect(() => {
        if (senderId) {
            firebaseService.getCustomerSpecialRates(senderId).then(setSpecialRates);
            const cust = customers.find(c => c.id === senderId);
            if (cust && cust.customExchangeRate) {
                setEffectiveExchangeRate(cust.customExchangeRate);
            } else {
                // Default to system KHR rate
                const sysKhr = currencies.find(c => c.code === 'KHR');
                setEffectiveExchangeRate(sysKhr ? sysKhr.exchangeRate : 4100);
            }
        } else {
            setSpecialRates([]);
            // Default to system KHR rate
            const sysKhr = currencies.find(c => c.code === 'KHR');
            setEffectiveExchangeRate(sysKhr ? sysKhr.exchangeRate : 4100);
        }
    }, [senderId, customers, currencies]);

    // Filter Cash/Bank Accounts for payment
    const cashAccounts = accounts.filter(a =>
        a.type === AccountType.ASSET &&
        (a.subType === AccountSubType.CURRENT_ASSET || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')) &&
        !a.isHeader
    );

    // Load Promotions (filtered by selected customer eligibility)
    useEffect(() => {
        const fetchPromos = async () => {
            const data = await firebaseService.getParcelPromotions();
            const today = new Date().toISOString().split('T')[0];
            const now = Date.now();

            // Get customer registration date if a customer is selected
            let customerRegisteredAt: number | undefined;
            if (senderId) {
                const customer = customers.find(c => c.id === senderId);
                customerRegisteredAt = customer?.createdAt;
            }

            // Helper to check eligibility
            const isCustomerEligible = (promo: ParcelPromotion): boolean => {
                if (!promo.eligibility || promo.eligibility === 'ALL') return true;

                // Handle SPECIFIC_USERS eligibility
                if (promo.eligibility === 'SPECIFIC_USERS') {
                    return senderId ? (promo.allowedUserIds?.includes(senderId) || false) : false;
                }

                if (!customerRegisteredAt) return true; // No customer selected or no date

                const daysSinceRegistration = Math.floor((now - customerRegisteredAt) / (1000 * 60 * 60 * 24));

                switch (promo.eligibility) {
                    case 'REGISTERED_LAST_7_DAYS':
                        return daysSinceRegistration <= 7;
                    case 'REGISTERED_LAST_MONTH':
                        return daysSinceRegistration <= 30;
                    case 'REGISTERED_LAST_YEAR':
                        return daysSinceRegistration <= 365;
                    default:
                        return true;
                }
            };

            const valid = data.filter(p =>
                p.isActive &&
                p.startDate <= today &&
                p.endDate >= today &&
                isCustomerEligible(p)
            );
            setPromotions(valid);
        };
        fetchPromos();
    }, [senderId, customers]);

    // Filter promotions by selected service's product scope
    const filteredPromotions = useMemo(() => {
        if (!serviceTypeId) return promotions; // Show all if no service selected

        return promotions.filter(p => {
            // If no product scope defined or ALL_PRODUCTS, it applies to all
            if (!p.productScope || p.productScope === 'ALL_PRODUCTS') return true;

            // If SPECIFIC_PRODUCTS, check if service is in the allowed list
            if (p.productScope === 'SPECIFIC_PRODUCTS') {
                return p.allowedProductIds?.includes(serviceTypeId) || false;
            }

            return true;
        });
    }, [promotions, serviceTypeId]);

    // Clear selected promo if it's no longer valid for the selected service
    useEffect(() => {
        if (selectedPromoId && !filteredPromotions.find(p => p.id === selectedPromoId)) {
            setSelectedPromoId('');
        }
    }, [filteredPromotions, selectedPromoId]);

    const handleLocationPicked = (lat: number, lng: number, address: string) => {
        if (mapPickerTarget?.type === 'PICKUP') {
            setPickupLocation({ lat, lng });
            setPickupAddress(address);

            // Trigger the Save Place Prompt
            setPlaceToSave({ lat, lng, address });
            setNewPlaceName('');
            setNewPlaceCategory('');

        } else if (mapPickerTarget?.type === 'DROPOFF' && typeof mapPickerTarget.index === 'number') {
            const idx = mapPickerTarget.index;
            setItems(prev => {
                const newItems = [...prev];
                newItems[idx] = {
                    ...newItems[idx],
                    destinationAddress: address,
                    destinationLocation: { lat, lng }
                };
                return newItems;
            });
        }
        setMapPickerTarget(null);
    };

    const handleSavePlace = async () => {
        if (!placeToSave || !newPlaceName) return;
        try {
            const place: Place = {
                id: `place-${Date.now()}`,
                name: newPlaceName,
                address: placeToSave.address,
                location: { lat: placeToSave.lat, lng: placeToSave.lng },
                category: newPlaceCategory,
                keywords: newPlaceName.toLowerCase().split(' ').concat(placeToSave.address.toLowerCase().split(' '))
            };
            await firebaseService.placeService.addPlace(place);
            setPlaceToSave(null); // Close modal
            // Optional: Show toast success
        } catch (e) {
            console.error("Failed to save place", e);
            toast.error("Failed to save place.");
        }
    };

    const handlePickupPlaceSelect = (place: Place) => {
        setPickupAddress(place.address);
        if (place.location) {
            setPickupLocation(place.location);
        }
    };

    // Handlers
    const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSenderId(id);
        const cust = customers.find(c => c.id === id);
        if (cust) {
            setSenderName(cust.name);
            setSenderPhone(cust.phone || '');
            if (cust.address) setPickupAddress(cust.address);
        } else {
            setSenderName('');
            setSenderPhone('');
            setPickupAddress('');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (items.length >= 10) {
            toast.warning("Maximum 10 parcels per booking.");
            return;
        }

        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await processImageForUpload(file);
                const newItem: ParcelItem = {
                    id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    image: base64,
                    receiverName: '',
                    receiverPhone: '',
                    destinationAddress: '',
                    productPrice: 0,
                    codCurrency: 'USD',
                    status: 'PENDING',
                    notes: ''
                };
                setItems(prevItems => [...prevItems, newItem]);
            } catch (error) {
                console.error("Error compressing image", error);
                toast.error("Failed to process image. Please try again.");
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const updateItem = (index: number, field: keyof ParcelItem, value: any) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    };

    const removeItem = (index: number) => {
        setItems(prevItems => prevItems.filter((_, i) => i !== index));
    };

    // Pricing Calculation
    const pricing = useMemo(() => {
        const service = services.find(s => s.id === serviceTypeId);
        if (!service) return { subtotal: 0, discount: 0, tax: 0, total: 0, taxRate: null, isSpecialRate: false };

        // Determine Base Price: Check for Special Rate
        const firstItem = items[0];
        const isKHR = firstItem?.codCurrency === 'KHR';

        let basePrice = isKHR ? (service.defaultPriceKHR || 0) : service.defaultPrice;
        let unitPricePerKm = isKHR ? (service.pricePerKmKHR || 0) : (service.pricePerKm || 0);

        let isSpecialRate = false;

        // Check for Special Rate (for both USD and KHR)
        if (specialRates.length > 0) {
            const today = bookingDate;
            const activeSpecial = specialRates.find(r =>
                r.serviceTypeId === serviceTypeId &&
                r.startDate.split('T')[0] <= today &&
                r.endDate.split('T')[0] >= today
            );
            if (activeSpecial) {
                // Apply special rate based on currency
                if (isKHR) {
                    // Use KHR special rate if available, otherwise convert USD rate
                    if (activeSpecial.priceKHR) {
                        basePrice = activeSpecial.priceKHR;
                    } else {
                        const rate = effectiveExchangeRate || 4100;
                        basePrice = activeSpecial.price * rate;
                    }
                } else {
                    basePrice = activeSpecial.price;
                }
                isSpecialRate = true;
            }
        }

        const safeDistance = isNaN(distance) ? 0 : distance;
        const base = basePrice * Math.max(items.length, 1);
        const distanceFee = safeDistance * unitPricePerKm;

        const subtotal = base + distanceFee;

        let discount = 0;
        if (selectedPromoId) {
            const promo = promotions.find(p => p.id === selectedPromoId);
            if (promo) {
                discount = promo.type === 'FIXED_AMOUNT' ? promo.value : subtotal * (promo.value / 100);
            }
        }
        if (discount > subtotal) discount = subtotal;

        const taxableAmount = subtotal - discount;
        let tax = 0;
        let taxRate = null;
        if (service.taxRateId) {
            taxRate = taxRates.find(t => t.id === service.taxRateId);
            if (taxRate) tax = taxableAmount * (taxRate.rate / 100);
        }

        return { subtotal, discount, tax, total: taxableAmount + tax, taxRate, isSpecialRate };
    }, [serviceTypeId, distance, selectedPromoId, services, promotions, taxRates, items.length, specialRates, bookingDate, effectiveExchangeRate]);

    const handleSubmit = async () => {
        if (!senderName || !serviceTypeId || items.length === 0) return;
        setLoading(true);
        try {
            const svc = services.find(s => s.id === serviceTypeId);

            // Import fee calculator
            const { calculateDeliveryFee } = await import('../../src/shared/utils/feeCalculator');

            // Calculate fees for each item with both currencies
            const itemsWithFees = await Promise.all(items.map(async (item, idx) => {
                const feeResult = await calculateDeliveryFee({
                    serviceTypeId,
                    customerId: senderId || '',
                    itemCount: 1,
                    codCurrency: item.codCurrency || 'USD',
                    exchangeRate: effectiveExchangeRate,
                    services,
                    specialRates
                });

                return {
                    ...item,
                    trackingCode: item.trackingCode || `TRK-${Date.now().toString().slice(-6)}-${idx + 1}`,
                    weight: item.weight || 0,
                    productPrice: typeof item.productPrice === 'number' && !isNaN(item.productPrice)
                        ? item.productPrice
                        : 0,
                    status: 'PENDING' as const,
                    deliveryFee: feeResult.pricePerItem,
                    deliveryFeeUSD: feeResult.pricePerItemUSD,
                    deliveryFeeKHR: feeResult.pricePerItemKHR
                };
            }));

            const booking: ParcelBooking = {
                id: `pb-${Date.now()}`,
                bookingDate,
                senderId: senderId || undefined,
                senderName,
                senderPhone,
                pickupAddress: pickupAddress || 'Branch Drop-off',
                pickupLocation,
                serviceTypeId,
                serviceTypeName: svc?.name || 'Unknown',
                items: itemsWithFees,
                distance: isNaN(distance) ? 0 : distance,
                subtotal: pricing.subtotal,
                discountAmount: pricing.discount,
                ...(selectedPromoId ? { promotionId: selectedPromoId } : {}),
                taxAmount: pricing.tax,
                ...(pricing.taxRate?.id ? { taxRateId: pricing.taxRate.id } : {}),
                totalDeliveryFee: pricing.total,
                currency: (items[0]?.codCurrency === 'KHR') ? 'KHR' : 'USD',
                status,
                branchId,
                notes: bookingNotes,
                createdAt: Date.now(),
                exchangeRateForCOD: effectiveExchangeRate
            };

            await firebaseService.saveParcelBooking(booking, depositAccountId || undefined);
            onComplete();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save booking.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Wizard Stepper */}
            <div className="flex items-center justify-center mb-8">
                <div className={`flex items-center ${step >= 1 ? 'text-red-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold ${step >= 1 ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>1</div>
                    <span className="ml-2 text-sm font-medium hidden sm:block">{t('step_sender')}</span>
                </div>
                <div className={`w-16 h-1 mx-4 ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`}></div>
                <div className={`flex items-center ${step >= 2 ? 'text-red-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold ${step >= 2 ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>2</div>
                    <span className="ml-2 text-sm font-medium hidden sm:block">{t('step_items')}</span>
                </div>
                <div className={`w-16 h-1 mx-4 ${step >= 3 ? 'bg-red-600' : 'bg-gray-200'}`}></div>
                <div className={`flex items-center ${step >= 3 ? 'text-red-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold ${step >= 3 ? 'border-red-600 bg-red-50' : 'border-gray-300'}`}>3</div>
                    <span className="ml-2 text-sm font-medium hidden sm:block">{t('step_review')}</span>
                </div>
            </div>

            {step === 1 && (
                <Card title={t('step_sender')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('customer')}</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={senderId}
                                onChange={handleCustomerChange}
                            >
                                <option value="">-- Walk-in / New --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                ))}
                            </select>
                            {senderId && (
                                <div className="mt-1 text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-100 inline-block">
                                    COD Exchange Rate: 1 USD = {effectiveExchangeRate} KHR
                                </div>
                            )}
                        </div>
                        <Input label={t('date')} type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required />

                        <Input label={t('sender_name')} value={senderName} onChange={e => setSenderName(e.target.value)} required />
                        <Input label={t('sender_phone')} value={senderPhone} onChange={e => setSenderPhone(e.target.value)} required />

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pickup_addr')}</label>
                            <PlaceAutocomplete
                                value={pickupAddress}
                                onChange={setPickupAddress}
                                onSelect={handlePickupPlaceSelect}
                                onPickMap={() => setMapPickerTarget({ type: 'PICKUP' })}
                                placeholder="Search place or leave blank if dropped at branch"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            />
                            {pickupLocation && <p className="text-xs text-green-600 mt-1 flex items-center"><svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> GPS Coordinates Set</p>}
                        </div>

                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('service')}</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={serviceTypeId}
                                onChange={e => setServiceTypeId(e.target.value)}
                                required
                            >
                                <option value="">Select Service</option>
                                {services.map(s => {
                                    // Check for special rate
                                    const special = specialRates.find(r => r.serviceTypeId === s.id && r.startDate.split('T')[0] <= bookingDate && r.endDate.split('T')[0] >= bookingDate);
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {s.name} (${special ? special.price : s.defaultPrice} {special ? 'SPECIAL' : 'base'})
                                        </option>
                                    );
                                })}
                            </select>
                            {pricing.isSpecialRate && <p className="text-xs text-green-600 mt-1 font-bold">Special rate applied for this customer.</p>}
                        </div>

                        <Input
                            label={t('est_distance')}
                            type="number"
                            value={distance}
                            onChange={e => setDistance(parseFloat(e.target.value))}
                            placeholder="0"
                        />

                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('branches')}</label>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                value={branchId}
                                onChange={e => setBranchId(e.target.value)}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('delivery_notes')}</label>
                            <textarea
                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                rows={2}
                                placeholder="e.g. Call before arriving, Fragile items..."
                                value={bookingNotes}
                                onChange={e => setBookingNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </Card>
            )}

            {step === 2 && (
                <Card title={t('step_items')}>
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative">
                                <button
                                    onClick={() => removeItem(idx)}
                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                >
                                    &times;
                                </button>
                                <div className="flex gap-4">
                                    <div className="h-24 w-24 bg-white rounded-lg border border-gray-300 overflow-hidden flex-shrink-0">
                                        <img src={item.image} alt="Parcel" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <Input
                                            placeholder={t('receiver_name')}
                                            value={item.receiverName}
                                            onChange={e => updateItem(idx, 'receiverName', e.target.value)}
                                        />
                                        <Input
                                            placeholder={t('receiver_phone')}
                                            value={item.receiverPhone}
                                            onChange={e => updateItem(idx, 'receiverPhone', e.target.value)}
                                        />
                                        <div className="md:col-span-2">
                                            <Input
                                                placeholder={t('tracking_id') + " (Optional)"}
                                                value={item.trackingCode || ''}
                                                onChange={e => updateItem(idx, 'trackingCode', e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <PlaceAutocomplete
                                                placeholder={t('dest_addr')}
                                                value={item.destinationAddress}
                                                onChange={(val) => updateItem(idx, 'destinationAddress', val)}
                                                onSelect={(place) => {
                                                    updateItem(idx, 'destinationAddress', place.address);
                                                    if (place.location) updateItem(idx, 'destinationLocation', place.location);
                                                }}
                                                onPickMap={() => setMapPickerTarget({ type: 'DROPOFF', index: idx })}
                                                className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                            />
                                            {item.destinationLocation && <span className="text-xs text-green-600 mt-1">GPS Set</span>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <Input
                                                placeholder={t('item_desc') + " (e.g. Box of books)"}
                                                value={item.notes || ''}
                                                onChange={e => updateItem(idx, 'notes', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">{t('cod_amount')}</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 flex flex-col">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm sm:text-sm"
                                                        value={item.productPrice || ''}
                                                        onChange={e => updateItem(idx, 'productPrice', parseFloat(e.target.value))}
                                                        placeholder="0.00"
                                                    />
                                                    {item.productPrice > 0 && effectiveExchangeRate && (
                                                        <span className="text-[10px] text-gray-500 mt-1">
                                                            {item.codCurrency === 'KHR'
                                                                ? `≈ $${(item.productPrice / effectiveExchangeRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                                : `≈ ${(item.productPrice * effectiveExchangeRate).toLocaleString()} KHR`
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                                <select
                                                    className="px-3 py-2 border border-gray-300 rounded-xl shadow-sm sm:text-sm bg-white"
                                                    value={item.codCurrency || 'USD'}
                                                    onChange={e => updateItem(idx, 'codCurrency', e.target.value as 'USD' | 'KHR')}
                                                >
                                                    <option value="USD">$</option>
                                                    <option value="KHR">៛</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="text-center">
                            <input
                                type="file"
                                ref={fileInputRef}
                                hidden
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                {t('add_parcel')} (Photo)
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {step === 3 && (
                <Card title={t('step_review')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('apply_promo')}</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    value={selectedPromoId}
                                    onChange={e => setSelectedPromoId(e.target.value)}
                                >
                                    <option value="">No Promotion</option>
                                    {filteredPromotions.map(p => (
                                        <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('booking_status')}</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                >
                                    <option value="PENDING">Pending</option>
                                    <option value="CONFIRMED">Confirmed</option>
                                </select>
                            </div>

                            {/* Deposit Account Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('deposit_to')}</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                    value={depositAccountId}
                                    onChange={e => setDepositAccountId(e.target.value)}
                                >
                                    <option value="">-- Not Paid Yet --</option>
                                    {cashAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Select account if customer pays immediately.</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-3">
                            <h4 className="text-sm font-bold text-gray-900 mb-2">{t('payment_summary')}</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal {pricing.isSpecialRate && <span className="text-xs text-green-600 font-bold bg-green-50 px-1 rounded ml-1">Special Rate</span>}</span>
                                <span className="font-medium">${pricing.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{t('discount')}</span>
                                <span className="font-medium text-green-600">-${pricing.discount.toFixed(2)}</span>
                            </div>
                            {pricing.tax > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">{t('tax')} ({pricing.taxRate?.name})</span>
                                    <span className="font-medium text-gray-600">${pricing.tax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-300">
                                <span className="text-gray-900">{t('total_fee')}</span>
                                <span className="text-indigo-600">{items[0]?.codCurrency === 'KHR' ? `${pricing.total.toLocaleString()} ៛` : `$${pricing.total.toFixed(2)}`}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="flex justify-between pt-6 border-t border-gray-200">
                {step > 1 ? <Button variant="outline" onClick={() => setStep(prev => (prev - 1) as any)}>{t('back')}</Button> : <div></div>}

                {step < 3 ? (
                    <Button onClick={() => setStep(prev => (prev + 1) as any)} disabled={step === 1 && !serviceTypeId}>{t('next')}</Button>
                ) : (
                    <Button onClick={handleSubmit} isLoading={loading}>{t('confirm_booking')}</Button>
                )}
            </div>

            {/* Map Picker Modal */}
            {mapPickerTarget && (
                <LocationPicker
                    initialLat={mapPickerTarget.type === 'PICKUP' && pickupLocation ? pickupLocation.lat : undefined}
                    initialLng={mapPickerTarget.type === 'PICKUP' && pickupLocation ? pickupLocation.lng : undefined}
                    onConfirm={handleLocationPicked}
                    onClose={() => setMapPickerTarget(null)}
                />
            )}

            {/* New Place Save Prompt */}
            {placeToSave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Save as New Place?</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Would you like to save this location to the Places directory for easier access next time?
                        </p>

                        <div className="space-y-3 mb-4">
                            <Input
                                label="Place Name"
                                value={newPlaceName}
                                onChange={e => setNewPlaceName(e.target.value)}
                                placeholder="e.g. Riverside Hotel"
                                autoFocus
                            />
                            <Input
                                label="Category (Optional)"
                                value={newPlaceCategory}
                                onChange={e => setNewPlaceCategory(e.target.value)}
                                placeholder="e.g. Hotel, Office"
                            />
                            <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">{placeToSave.address}</p>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setPlaceToSave(null)}>No, Just Use</Button>
                            <Button onClick={handleSavePlace} disabled={!newPlaceName}>Save Place</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
