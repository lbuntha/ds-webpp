import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ParcelServiceType, ParcelItem, UserProfile, ParcelBooking, AppNotification, SavedLocation, GeoPoint, ParcelPromotion, CustomerSpecialRate, CurrencyConfig, Place, CustomerProduct, CustomerStock, CustomerStockItem } from '../../src/shared/types';
import { stockService } from '../../src/shared/services/stockService';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Toast } from '../ui/Toast';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { LocationPicker } from '../ui/LocationPicker';
import { PlaceAutocomplete } from '../ui/PlaceAutocomplete';
import { processImageForUpload } from '../../src/shared/utils/imageUtils';

interface Props {
    user: UserProfile;
    onComplete: () => void;
    initialMode?: 'PHOTO' | 'MANUAL' | 'STOCK';
}

export const CustomerBooking: React.FC<Props> = ({ user, onComplete, initialMode = 'PHOTO' }) => {
    const { t } = useLanguage();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const footerRef = useRef<HTMLDivElement>(null);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // --- STATE ---
    const [bookingType, setBookingType] = useState<'PHOTO' | 'MANUAL' | 'STOCK'>(initialMode);

    const [serviceTypeId, setServiceTypeId] = useState('');
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);

    // Pickup (Sender) State
    const [pickupLocationId, setPickupLocationId] = useState<string>('');
    const [customPickupAddress, setCustomPickupAddress] = useState('');
    const [customPickupLat, setCustomPickupLat] = useState<number | ''>('');
    const [customPickupLng, setCustomPickupLng] = useState<number | ''>('');

    // Map Picker State
    const [mapPickerTarget, setMapPickerTarget] = useState<{ type: 'PICKUP' | 'DROPOFF', index?: number } | null>(null);

    // Location Saving State
    const [saveNewLocation, setSaveNewLocation] = useState(false);
    const [newLocationLabel, setNewLocationLabel] = useState('');
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(user.savedLocations || []);

    // Items (Receiver) State
    const [items, setItems] = useState<ParcelItem[]>([]);

    // Additional Details
    const [notes, setNotes] = useState('');
    const [promotions, setPromotions] = useState<ParcelPromotion[]>([]);
    const [specialRates, setSpecialRates] = useState<CustomerSpecialRate[]>([]);
    const [selectedPromoId, setSelectedPromoId] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'CONFIRMED'>('PENDING');

    // Rate State
    const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
    const [effectiveExchangeRate, setEffectiveExchangeRate] = useState<number>(4100);
    const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
    const [customerStocks, setCustomerStocks] = useState<CustomerStock[]>([]);
    const [selectedStockBranchId, setSelectedStockBranchId] = useState<string>('');

    // Multi-Product Booking Mode State
    const [bookingMode, setBookingMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
    const [singleReceiverName, setSingleReceiverName] = useState('');
    const [singleReceiverPhone, setSingleReceiverPhone] = useState('');
    const [singleAddress, setSingleAddress] = useState('');
    const [singleLocationId, setSingleLocationId] = useState<string>('');


    // Load Services, Promotions, Rates & Defaults
    useEffect(() => {
        firebaseService.getParcelServices().then(setServices);
        firebaseService.getParcelServices().then(setServices);
        firebaseService.getCurrencies().then(setCurrencies);
        if (user.linkedCustomerId) {
            stockService.getCustomerProducts(user.linkedCustomerId).then(setCustomerProducts);
            stockService.getCustomerStock(user.linkedCustomerId).then(stocks => {
                setCustomerStocks(stocks);
                if (stocks.length > 0) {
                    setSelectedStockBranchId(stocks[0].branchId);
                }
            });
        }

        const fetchPromosAndRates = async () => {
            try {
                const data = await firebaseService.getParcelPromotions();
                const today = new Date().toISOString().split('T')[0];
                const now = Date.now();

                // Helper to check if user is eligible for a promotion
                const isUserEligible = (promo: ParcelPromotion): boolean => {
                    if (!promo.eligibility || promo.eligibility === 'ALL') return true;

                    // Handle SPECIFIC_USERS eligibility
                    if (promo.eligibility === 'SPECIFIC_USERS') {
                        return promo.allowedUserIds?.includes(user.linkedCustomerId || '') || false;
                    }

                    // Get user registration date
                    const userRegisteredAt = user.joinedAt || user.createdAt;
                    if (!userRegisteredAt) return true; // If no date, allow access

                    const registeredDate = new Date(userRegisteredAt);
                    const daysSinceRegistration = Math.floor((now - registeredDate.getTime()) / (1000 * 60 * 60 * 24));

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
                    p.startDate <= today &&
                    p.endDate >= today &&
                    p.isActive &&
                    isUserEligible(p)
                );
                setPromotions(valid);

                // Fetch Special Rates & Profile config if linked
                if (user.linkedCustomerId) {
                    const [rates, customerData] = await Promise.all([
                        firebaseService.getCustomerSpecialRates(user.linkedCustomerId),
                        firebaseService.getDocument('customers', user.linkedCustomerId)
                    ]);
                    setSpecialRates(rates);

                    // Set exchange rate from customer profile if available
                    if (customerData && (customerData as any).customExchangeRate) {
                        setEffectiveExchangeRate((customerData as any).customExchangeRate);
                    } else {
                        // Fallback to system default
                        const sysKhr = currencies.find(c => c.code === 'KHR');
                        if (sysKhr) setEffectiveExchangeRate(sysKhr.exchangeRate);
                    }

                    // Load saved locations from customer profile
                    if (customerData && (customerData as any).savedLocations && (customerData as any).savedLocations.length > 0) {
                        setSavedLocations((customerData as any).savedLocations);
                    }
                } else {
                    // Fallback to system default if no customer link yet
                    const sysKhr = currencies.find(c => c.code === 'KHR');
                    if (sysKhr) setEffectiveExchangeRate(sysKhr.exchangeRate);
                }
            } catch (e) {
                console.error("Failed to load promotions/rates", e);
            }
        };
        fetchPromosAndRates();

        // Default to primary location
        const primary = savedLocations.find(l => l.isPrimary);
        if (primary) {
            setPickupLocationId(primary.id);
        } else {
            setPickupLocationId('custom');
        }
    }, [user, currencies]);

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
            setCustomPickupLat(lat);
            setCustomPickupLng(lng);
            setCustomPickupAddress(address);
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

    const handleSelectService = (id: string) => {
        setServiceTypeId(id);
        // Smooth scroll to ensure footer is visible
        setTimeout(() => {
            footerRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const getCurrentLocation = (callback: (lat: number, lng: number) => void) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    callback(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setToast({ message: "Unable to retrieve location. Please check permissions.", type: 'error' });
                }
            );
        } else {
            setToast({ message: "Geolocation is not supported by this browser.", type: 'error' });
        }
    };

    const handlePickupPlaceSelect = (place: Place) => {
        setCustomPickupAddress(place.address);
        if (place.location) {
            setCustomPickupLat(place.location.lat);
            setCustomPickupLng(place.location.lng);
        }
    };

    // --- ITEM HANDLERS ---
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setLoading(true); // Temporarily show loading while processing

            try {
                const processedImages = await Promise.all(
                    Array.from(files).map((file) => processImageForUpload(file as File))
                );

                const newItems = processedImages.map(base64 => ({
                    id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    image: base64,
                    receiverName: 'Details in Photo',
                    receiverPhone: '',
                    destinationAddress: 'Driver to extract details',
                    productPrice: 0,
                    status: 'PENDING' as const
                }));

                setItems(prev => [...prev, ...newItems]);
            } catch (error) {
                console.error("Error processing images", error);
                setToast({ message: "Failed to process some images. Please try again.", type: 'error' });
            } finally {
                setLoading(false);
            }
        }
        e.target.value = '';
    };

    const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await processImageForUpload(file);
                setItems(prev => [...prev, {
                    id: `pi-${Date.now()}`,
                    image: base64,
                    receiverName: '',
                    receiverPhone: '',
                    destinationAddress: '',
                    productPrice: 0,
                    status: 'PENDING'
                }]);
            } catch (error) {
                console.error("Error processing image", error);
                setToast({ message: "Failed to process image.", type: 'error' });
            }
        }
        e.target.value = '';
    };

    const updateItem = (index: number, field: keyof ParcelItem, value: any) => {
        setItems(prev => {
            const newItems = [...prev];
            const updatedItem = { ...newItems[index], [field]: value };
            if (field === 'productPrice') {
                const val = Number(value);
                updatedItem.codCurrency = val >= 1000 ? 'KHR' : 'USD';
            }
            newItems[index] = updatedItem;
            return newItems;
        });
    };

    const updateItemLocation = (index: number, lat: number, lng: number) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], destinationLocation: { lat, lng } };
            return newItems;
        });
    };

    const handlePlaceSelect = (index: number, place: Place) => {
        setItems(prev => {
            const newItems = [...prev];
            newItems[index] = {
                ...newItems[index],
                destinationAddress: place.address,
                destinationLocation: place.location
            };
            return newItems;
        });
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // --- PRICING ---
    const pricing = useMemo(() => {
        const svc = services.find(s => s.id === serviceTypeId);
        if (!svc) return { subtotal: 0, discount: 0, total: 0, isSpecialRate: false };

        const firstItem = items[0];
        const isKHR = firstItem?.codCurrency === 'KHR';

        let basePrice = isKHR ? (svc.defaultPriceKHR || 0) : (svc.defaultPrice || 0);
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

        // SINGLE FEE LOGIC: Count is always 1 for the base price in SINGLE mode
        const count = (bookingMode === 'SINGLE') ? 1 : Math.max(items.length, 1);
        const subtotal = basePrice * count;


        let discount = 0;
        if (selectedPromoId) {
            const promo = promotions.find(p => p.id === selectedPromoId);
            if (promo) {
                discount = promo.type === 'FIXED_AMOUNT' ? promo.value : subtotal * (promo.value / 100);
            }
        }
        if (discount > subtotal) discount = subtotal;

        return { subtotal, discount, total: subtotal - discount, isSpecialRate };
    }, [serviceTypeId, items.length, services, selectedPromoId, promotions, specialRates, bookingDate, effectiveExchangeRate]);

    const totalCOD = useMemo(() => {
        if (bookingType === 'PHOTO') return { value: 0, display: '$0.00' };
        let usd = 0;
        let khr = 0;
        items.forEach(item => {
            const amount = Number(item.productPrice) || 0;
            const qty = item.quantity || 1;
            if (item.codCurrency === 'KHR') khr += (amount * qty);
            else usd += (amount * qty);
        });
        if (khr > 0 && usd > 0) return { value: usd + (khr / 4100), display: `$${usd.toFixed(2)} + ${khr.toLocaleString()}៛` };
        else if (khr > 0) return { value: khr / 4100, display: `${khr.toLocaleString()} ៛` };
        else return { value: usd, display: `$${usd.toFixed(2)}` };
    }, [items, bookingType]);

    // --- SUBMIT ---
    const handleSave = async () => {
        if (!serviceTypeId) {
            setToast({ message: "Please select a service.", type: 'error' });
            return;
        }
        if (items.length === 0) {
            setToast({ message: "Please add at least one parcel.", type: 'error' });
            return;
        }

        // Validation for Single Booking Mode
        if (bookingType === 'STOCK' && bookingMode === 'SINGLE') {
            if (!singleReceiverName || !singleReceiverPhone || !singleAddress) {
                setToast({ message: "Please fill in all receiver details at the top.", type: 'error' });
                return;
            }
        }


        setLoading(true);

        try {
            const service = services.find(s => s.id === serviceTypeId);
            const bookingId = `pb-${Date.now()}`;

            let finalPickupAddr = customPickupAddress;
            let finalPickupLoc: GeoPoint | undefined = (customPickupLat && customPickupLng) ? { lat: Number(customPickupLat), lng: Number(customPickupLng) } : undefined;

            if (pickupLocationId !== 'custom') {
                const saved = savedLocations.find(l => l.id === pickupLocationId);
                if (saved) {
                    finalPickupAddr = saved.address;
                    finalPickupLoc = saved.coordinates;
                }
            } else {
                if (saveNewLocation && newLocationLabel && finalPickupAddr) {
                    const newLoc: SavedLocation = {
                        id: `loc-${Date.now()}`,
                        label: newLocationLabel,
                        address: finalPickupAddr,
                        coordinates: finalPickupLoc,
                        isPrimary: false
                    };
                    const updatedLocations = [...savedLocations, newLoc];
                    setSavedLocations(updatedLocations); // Update local state
                    firebaseService.updateUserLocations(updatedLocations).catch(console.error);
                }
            }

            // Import fee calculator for dual currency support
            const { calculateDeliveryFee } = await import('../../src/shared/utils/feeCalculator');

            // 1. Calculate SINGLE FEE for the whole booking
            const singleFeeResult = await calculateDeliveryFee({
                serviceTypeId,
                customerId: user.linkedCustomerId || '',
                itemCount: 1, // Always 1 for Single Booking Mode
                codCurrency: (items[0]?.codCurrency || 'USD'), // Use first item's currency preference for fee calculation basis if needed
                exchangeRate: effectiveExchangeRate,
                services,
                specialRates
            });

            const totalDeliveryFee = singleFeeResult.pricePerItem;
            const totalDeliveryFeeUSD = singleFeeResult.pricePerItemUSD;
            const totalDeliveryFeeKHR = singleFeeResult.pricePerItemKHR;

            // Distribute fee per item for internal record consistency (so sum(items) ~ total)
            const itemCount = Math.max(items.length, 1);
            const feePerItem = totalDeliveryFee / itemCount;
            const feePerItemUSD = totalDeliveryFeeUSD / itemCount;
            const feePerItemKHR = totalDeliveryFeeKHR / itemCount;

            // Calculate fees for each item with both currencies
            const finalItems = await Promise.all(items.map(async (i) => {
                return {
                    ...i,
                    productPrice: Number(i.productPrice) || 0,
                    codCurrency: i.codCurrency || (Number(i.productPrice) >= 1000 ? 'KHR' : 'USD'),
                    receiverName: (bookingType === 'STOCK' && bookingMode === 'SINGLE') ? singleReceiverName : (i.receiverName || 'Details in Photo'),
                    receiverPhone: (bookingType === 'STOCK' && bookingMode === 'SINGLE') ? singleReceiverPhone : (i.receiverPhone || ''),
                    destinationAddress: (bookingType === 'STOCK' && bookingMode === 'SINGLE') ? singleAddress : (i.destinationAddress || 'Driver to Extract'),

                    // Distribute the single fee across items
                    deliveryFee: feePerItem,
                    deliveryFeeUSD: feePerItemUSD,
                    deliveryFeeKHR: feePerItemKHR
                };
            }));


            const booking: ParcelBooking = {
                id: bookingId,
                bookingDate,
                senderId: user.linkedCustomerId,
                senderName: user.name,
                senderPhone: user.phone || '',
                pickupAddress: finalPickupAddr || 'Unknown Address',
                pickupLocation: finalPickupLoc,
                serviceTypeId,
                serviceTypeName: service?.name || '',
                items: finalItems,
                distance: 0,
                subtotal: pricing.subtotal,
                discountAmount: pricing.discount,
                promotionId: selectedPromoId || undefined,
                taxAmount: 0,
                totalDeliveryFee: pricing.total,
                currency: (finalItems[0]?.codCurrency === 'KHR') ? 'KHR' : 'USD',
                status: status,
                statusId: status === 'PENDING' ? 'ps-pending' : 'ps-pickup',
                statusHistory: [
                    {
                        statusId: status === 'PENDING' ? 'ps-pending' : 'ps-pickup',
                        statusLabel: status === 'PENDING' ? 'Pending' : 'Confirmed',
                        timestamp: Date.now(),
                        updatedBy: user.name,
                        notes: 'Booking created by customer'
                    }
                ],
                branchId: (bookingType === 'STOCK' && selectedStockBranchId) ? selectedStockBranchId : 'b1',
                notes: notes,
                createdAt: Date.now(),
                exchangeRateForCOD: effectiveExchangeRate
            };

            await firebaseService.saveParcelBooking(booking);

            // NOTIFICATION TRIGGERS - Send to specific roles
            const notifBase = {
                type: 'INFO' as const,
                read: false,
                createdAt: Date.now(),
                metadata: { type: 'BOOKING', bookingId: booking.id }
            };

            // 1. Notify all DRIVERS - New pickup request
            const driverNotif: AppNotification = {
                ...notifBase,
                id: `notif-driver-${Date.now()}`,
                targetAudience: 'driver',
                title: 'New Pickup Request',
                message: `📦 New booking from ${user.name} at ${finalPickupAddr?.slice(0, 50) || 'Address'} - ${finalItems.length} parcel(s)`,
            };
            await firebaseService.sendNotification(driverNotif);

            // 2. Notify WAREHOUSE staff
            const warehouseNotif: AppNotification = {
                ...notifBase,
                id: `notif-warehouse-${Date.now() + 1}`,
                targetAudience: 'warehouse',
                title: 'New Booking Alert',
                message: `📋 Booking #${bookingId.slice(-6)} from ${user.name} - ${finalItems.length} parcel(s) pending pickup`,
            };
            await firebaseService.sendNotification(warehouseNotif);

            // 3. Notify ADMIN
            const adminNotif: AppNotification = {
                ...notifBase,
                id: `notif-admin-${Date.now() + 2}`,
                targetAudience: 'admin',
                title: 'New Customer Booking',
                message: `${user.name} placed order #${bookingId.slice(-6)} - ${finalItems.length} parcel(s), Fee: $${pricing.total.toFixed(2)}`,
            };
            await firebaseService.sendNotification(adminNotif);

            // 4. Notify the CUSTOMER (confirmation)
            const custNotif: AppNotification = {
                ...notifBase,
                id: `notif-cust-${Date.now() + 3}`,
                targetAudience: user.uid,
                title: 'Booking Received',
                message: `We received your booking #${bookingId.slice(-6)}. Pickup at: ${finalPickupAddr}`,
                type: 'SUCCESS',
            };
            await firebaseService.sendNotification(custNotif);

            setToast({ message: "Your booking has been placed successfully!", type: 'success' });
            setTimeout(() => onComplete(), 1500); // Delay to show toast
        } catch (e) {
            console.error(e);
            setToast({ message: "Failed to request booking. Please try again.", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6 pb-32 px-2 sm:px-0">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('new_booking')}</h2>
                    <button onClick={onComplete} className="text-gray-500 hover:text-gray-900">{t('cancel')}</button>
                </div>

                <div className="flex items-center space-x-2 mb-4">
                    <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-red-600' : 'bg-gray-200'}`}></div>
                    <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`}></div>
                </div>

                {step === 1 && (
                    <div className="space-y-6 animate-fade-in-up">

                        {/* Rate Indicator */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 flex justify-between items-center">
                            <span>Current Exchange Rate for COD:</span>
                            <span className="font-bold">1 USD = {effectiveExchangeRate} KHR</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div
                                onClick={() => { setBookingType('PHOTO'); setItems([]); }}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${bookingType === 'PHOTO' ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-full ${bookingType === 'PHOTO' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div className="text-left">
                                    <div className={`font-bold text-sm ${bookingType === 'PHOTO' ? 'text-red-900' : 'text-gray-700'}`}>{t('photo_booking')}</div>
                                    <div className="text-xs text-gray-500">Upload & Go</div>
                                </div>
                            </div>

                            <div
                                onClick={() => { setBookingType('STOCK'); setItems([]); setSelectedStockBranchId(''); }}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${bookingType === 'STOCK' ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-full ${bookingType === 'STOCK' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                </div>
                                <div className="text-left">
                                    <div className={`font-bold text-sm ${bookingType === 'STOCK' ? 'text-red-900' : 'text-gray-700'}`}>Stock Request</div>
                                    <div className="text-xs text-gray-500">From Inventory</div>
                                </div>
                            </div>
                        </div>

                        {/* Stock Location Picker (Only for STOCK mode) */}
                        {bookingType === 'STOCK' && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-lg text-gray-800">Source Location</h3>
                                    </div>
                                    <p className="text-gray-500 text-sm mb-3">Where should we pick up the stock from?</p>

                                    {customerStocks.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {customerStocks.map(stock => (
                                                <div
                                                    key={stock.id}
                                                    onClick={() => {
                                                        setSelectedStockBranchId(stock.branchId);
                                                        // Also set pickup address for display
                                                        setPickupLocationId('stock-' + stock.branchId);
                                                        // We might want to set a friendly name for pickup address
                                                        // But customer might not know the exact address of the hub, so maybe just Branch Name
                                                    }}
                                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedStockBranchId === stock.branchId ? 'border-red-600 bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <div className="font-bold text-gray-900">{stock.branchName}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{stock.items.length} unique items in stock</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                            <p className="text-gray-500">No stock found in any warehouse.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {bookingType !== 'STOCK' && (
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold text-gray-800 mb-3">1. {t('pickup_location')}</h3>
                                <div className="space-y-3">
                                    <select
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 bg-gray-50 text-sm"
                                        value={pickupLocationId}
                                        onChange={(e) => setPickupLocationId(e.target.value)}
                                    >
                                        {savedLocations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.label} - {loc.address}
                                            </option>
                                        ))}
                                        <option value="custom">+ Use a different location</option>
                                    </select>

                                    {pickupLocationId === 'custom' && (
                                        <div className="space-y-2 pl-2 border-l-2 border-red-100">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <PlaceAutocomplete
                                                        placeholder="Enter Pickup Address"
                                                        value={customPickupAddress}
                                                        onChange={setCustomPickupAddress}
                                                        onSelect={handlePickupPlaceSelect}
                                                        onPickMap={() => setMapPickerTarget({ type: 'PICKUP' })}
                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm pr-10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                <span className="text-xs text-gray-400">
                                                    {customPickupLat ? `${customPickupLat}, ${customPickupLng}` : 'No coordinates selected'}
                                                </span>
                                            </div>

                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={saveNewLocation}
                                                        onChange={e => setSaveNewLocation(e.target.checked)}
                                                        className="rounded text-red-600 focus:ring-red-500 border-gray-300"
                                                    />
                                                    <span className="text-sm text-gray-700">Save this location for next time?</span>
                                                </label>
                                                {saveNewLocation && (
                                                    <div className="mt-2 animate-fade-in-up">
                                                        <Input
                                                            placeholder="Label (e.g. Home)"
                                                            value={newLocationLabel}
                                                            onChange={e => setNewLocationLabel(e.target.value)}
                                                            className="text-sm"
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="font-bold text-lg text-gray-800 mb-2">2. {t('select_vehicle')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {services.map(s => {
                                    // Check for special rate
                                    const today = bookingDate;
                                    const activeSpecial = specialRates.find(r =>
                                        r.serviceTypeId === s.id &&
                                        r.startDate.split('T')[0] <= today &&
                                        r.endDate.split('T')[0] >= today
                                    );
                                    const displayPrice = activeSpecial ? activeSpecial.price : s.defaultPrice;

                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => handleSelectService(s.id)}
                                            className={`relative p-4 rounded-2xl cursor-pointer border-2 transition-all flex flex-col items-center text-center space-y-2 ${serviceTypeId === s.id ? 'border-red-600 bg-red-50 shadow-md scale-105' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                                        >
                                            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                                                {s.image ? <img src={s.image} className="w-full h-full object-cover rounded-full" alt={s.name} /> : <div className="text-xl">📦</div>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-sm">{s.name}</h4>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.description}</p>
                                            </div>
                                            <div className="font-bold text-red-700 text-xs flex flex-col items-center">
                                                <span>From ${displayPrice}</span>
                                                {activeSpecial && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 rounded-full mt-0.5">Special Rate</span>}
                                            </div>
                                            {serviceTypeId === s.id && (
                                                <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 animate-bounce">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 animate-fade-in-up">

                        {/* --- PHOTO MODE UI --- */}
                        {bookingType === 'PHOTO' && (
                            <div className="space-y-6">
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
                                    <div className="text-blue-500 mt-0.5">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div className="text-sm text-blue-800">
                                        <p className="font-bold">One Image = One Parcel</p>
                                        <p className="text-blue-700 mt-1">Upload a clear photo of each parcel. Our driver will read the delivery details from the image.</p>
                                    </div>
                                </div>

                                {/* Photo Upload Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {/* Upload Button */}
                                    <label
                                        htmlFor="photo-upload-input"
                                        className="aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-red-300 hover:text-red-500 text-gray-400 transition-all"
                                    >
                                        <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                        <span className="text-xs font-bold">Add Photos</span>
                                    </label>

                                    {/* Uploaded Items */}
                                    {items.map((item, idx) => (
                                        <div key={item.id} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group bg-white shadow-sm">
                                            <img src={item.image} alt={`Parcel ${idx + 1}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-90 hover:opacity-100 transition-opacity"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                                <span className="text-white text-xs font-bold">Parcel {idx + 1}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <input
                                    type="file"
                                    id="photo-upload-input"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handlePhotoUpload}
                                />

                                {/* General Info */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
                                    <h3 className="font-bold text-sm text-gray-800 border-b border-gray-100 pb-2">{t('parcel_details')}</h3>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('delivery_instructions')}</label>
                                        <textarea
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                                            rows={2}
                                            placeholder="e.g. Call 012-345-678 upon arrival at destination..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('promo_code')}</label>
                                        <select
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                                            value={selectedPromoId}
                                            onChange={e => setSelectedPromoId(e.target.value)}
                                        >
                                            <option value="">-- Select Promotion --</option>
                                            {filteredPromotions.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.code} - {p.name} ({p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* --- STOCK BOOKING MODE UI --- */}
                        {bookingType === 'STOCK' && (
                            <div className="space-y-4">
                                {/* Mode Toggle Removed - Enforced Single Mode */}


                                {/* Single Receiver Form */}
                                {bookingMode === 'SINGLE' && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Receiver Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Receiver Name</label>
                                                <input
                                                    type="text"
                                                    value={singleReceiverName}
                                                    onChange={e => setSingleReceiverName(e.target.value)}
                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Receiver Phone</label>
                                                <input
                                                    type="text"
                                                    value={singleReceiverPhone}
                                                    onChange={e => setSingleReceiverPhone(e.target.value)}
                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                                                    placeholder="Phone"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Delivery Address</label>
                                                <input
                                                    type="text"
                                                    value={singleAddress}
                                                    onChange={e => setSingleAddress(e.target.value)}
                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                                                    placeholder="Full Address"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Product / SKU</th>
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qty</th>
                                                    {bookingMode !== 'SINGLE' && (
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiver Info</th>
                                                    )}
                                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">COD & Currency</th>
                                                    {bookingMode !== 'SINGLE' && (
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                                    )}
                                                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>

                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {items.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td className="px-3 py-3 align-top">
                                                            <div className="space-y-1">
                                                                <select
                                                                    className="block w-full py-2 pl-3 pr-10 text-sm border-gray-300 bg-white rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 shadow-sm transition-colors cursor-pointer hover:border-gray-400"
                                                                    value={bookingType === 'STOCK' ? (item.stockItemId || '') : (item.productId || '')}
                                                                    onChange={(e) => {
                                                                        const selectedId = e.target.value;

                                                                        if (bookingType === 'STOCK') {
                                                                            // Find by Stock Item ID
                                                                            const currentBranchStock = customerStocks.find(s => s.branchId === selectedStockBranchId);
                                                                            const stockItem = currentBranchStock?.items.find(i => i.id === selectedId);

                                                                            if (stockItem) {
                                                                                setItems(prev => {
                                                                                    const newItems = [...prev];
                                                                                    newItems[idx] = {
                                                                                        ...newItems[idx],
                                                                                        productId: stockItem.productId,
                                                                                        stockItemId: stockItem.id,
                                                                                        sku: stockItem.sku,
                                                                                        productPrice: stockItem.unitPrice || 0,
                                                                                        codCurrency: stockItem.unitPriceCurrency || 'USD',
                                                                                        image: stockItem.image || ''
                                                                                    };
                                                                                    return newItems;
                                                                                });
                                                                            }
                                                                        } else {
                                                                            // Catalog Mode: Find by Product ID
                                                                            const prodCatalg = customerProducts.find(p => p.id === selectedId);
                                                                            if (prodCatalg) {
                                                                                setItems(prev => {
                                                                                    const newItems = [...prev];
                                                                                    newItems[idx] = {
                                                                                        ...newItems[idx],
                                                                                        productId: prodCatalg.id,
                                                                                        sku: prodCatalg.sku,
                                                                                        productPrice: prodCatalg.defaultPrice || 0,
                                                                                        codCurrency: prodCatalg.priceCurrency || 'USD',
                                                                                        image: prodCatalg.image || ''
                                                                                    };
                                                                                    return newItems;
                                                                                });
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Select Product...</option>
                                                                    {(() => {
                                                                        // Intelligent Dropdown: Show Stock Items if available in this branch
                                                                        const currentBranchStock = customerStocks.find(s => s.branchId === selectedStockBranchId);

                                                                        if (bookingType === 'STOCK' && currentBranchStock) {
                                                                            return currentBranchStock.items.map(stockItem => {
                                                                                const avail = stockItem.quantity - (stockItem.reservedQuantity || 0);
                                                                                const product = customerProducts.find(p => p.id === stockItem.productId);
                                                                                const displaySku = product?.sku || stockItem.sku;
                                                                                return (
                                                                                    <option key={stockItem.id} value={stockItem.id} disabled={avail <= 0}>
                                                                                        {displaySku ? `${displaySku} - ${stockItem.productName}` : stockItem.productName} (Avail: {avail})
                                                                                    </option>
                                                                                );
                                                                            });
                                                                        } else {
                                                                            // Fallback to full catalog
                                                                            return customerProducts.map(p => (
                                                                                <option key={p.id} value={p.id}>
                                                                                    {p.productName} ({p.sku})
                                                                                </option>
                                                                            ));
                                                                        }
                                                                    })()}
                                                                </select>
                                                                {/* Only show Stock SKU if actually selected */}
                                                                {item.sku && <div className="text-xs text-gray-500 font-mono">SKU: {item.sku}</div>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 align-top">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="block w-full py-2 px-2 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-center"
                                                                value={item.quantity || 1}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 1;
                                                                    updateItem(idx, 'quantity', val);
                                                                }}
                                                            />
                                                        </td>
                                                        {bookingMode !== 'SINGLE' && (
                                                            <td className="px-3 py-3 align-top">
                                                                <div className="space-y-2">
                                                                    <div className="relative rounded-md shadow-sm">
                                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                            </svg>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Name"
                                                                            className="block w-full pl-10 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                                            value={item.receiverName}
                                                                            onChange={(e) => updateItem(idx, 'receiverName', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="relative rounded-md shadow-sm">
                                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                            </svg>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Phone"
                                                                            className="block w-full pl-10 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                                            value={item.receiverPhone}
                                                                            onChange={(e) => updateItem(idx, 'receiverPhone', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-3 align-top">
                                                            <div className="flex items-center space-x-2">
                                                                <input
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    className="block w-full py-2 px-3 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-right"
                                                                    value={item.productPrice}
                                                                    onChange={(e) => updateItem(idx, 'productPrice', e.target.value)}
                                                                />
                                                                <select
                                                                    className="block w-24 py-2 px-2 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                                    value={item.codCurrency || 'USD'}
                                                                    onChange={(e) => updateItem(idx, 'codCurrency', e.target.value)}
                                                                >
                                                                    <option value="USD">USD</option>
                                                                    <option value="KHR">KHR</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        {bookingMode !== 'SINGLE' && (
                                                            <td className="px-3 py-3 align-top">
                                                                <div className="relative rounded-md shadow-sm">
                                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                        </svg>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Location (Free text)"
                                                                        className="block w-full pl-10 text-sm border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                                                        value={item.destinationAddress || ''}
                                                                        onChange={(e) => updateItem(idx, 'destinationAddress', e.target.value)}
                                                                    />
                                                                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                                                                        <svg className="h-3 w-3 text-gray-400 cursor-nw-resize" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}

                                                        <td className="px-3 py-3 align-top text-center">
                                                            <button
                                                                onClick={() => removeItem(idx)}
                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={bookingMode === 'SINGLE' ? 4 : 6} className="px-6 py-10 text-center text-gray-500 italic">
                                                            Use the button below to add your first package.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div
                                        onClick={() => setItems(prev => [...prev, {
                                            id: `pi-${Date.now()}-${Math.random()}`,
                                            image: '',
                                            receiverName: '',
                                            receiverPhone: '',
                                            destinationAddress: '',
                                            productPrice: 0,
                                            codCurrency: 'USD',
                                            status: 'PENDING'
                                        }])}
                                        className="w-full bg-gray-50 hover:bg-gray-100 py-3 text-center border-t border-dashed border-gray-300 cursor-pointer text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
                                    >
                                        + Add Row
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- MANUAL MODE UI --- */}
                        {bookingType === 'MANUAL' && (
                            <>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">{t('receiver_details')}</h3>
                                        <p className="text-gray-500 text-sm">Who are we delivering to?</p>
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="manual-upload-input"
                                            className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-red-700 flex items-center cursor-pointer"
                                        >
                                            + Add Parcel
                                        </label>
                                        <input type="file" id="manual-upload-input" hidden accept="image/*" onChange={handleManualImageUpload} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative">
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-1"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>

                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col sm:flex-row gap-4 border-b border-gray-100 pb-4">
                                                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 mx-auto sm:mx-0">
                                                        <img src={item.image} className="w-full h-full object-cover" alt="Item" />
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <Input
                                                            placeholder="Receiver Name"
                                                            value={item.receiverName}
                                                            onChange={e => updateItem(idx, 'receiverName', e.target.value)}
                                                        />
                                                        <Input
                                                            placeholder="Receiver Phone"
                                                            value={item.receiverPhone}
                                                            onChange={e => updateItem(idx, 'receiverPhone', e.target.value)}
                                                        />
                                                        <div className="md:col-span-2">
                                                            <Input
                                                                placeholder="Your Reference / Tracking Code (Optional)"
                                                                value={item.trackingCode || ''}
                                                                onChange={e => updateItem(idx, 'trackingCode', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location & COD */}
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">Drop-off Location</label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <PlaceAutocomplete
                                                                    value={item.destinationAddress}
                                                                    onChange={(val) => updateItem(idx, 'destinationAddress', val)}
                                                                    onSelect={(place) => handlePlaceSelect(idx, place)}
                                                                    onPickMap={() => setMapPickerTarget({ type: 'DROPOFF', index: idx })}
                                                                    placeholder="Search Place (e.g. Royal Palace) or Enter Address"
                                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-2">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => getCurrentLocation((lat, lng) => updateItemLocation(idx, lat, lng))}
                                                                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 flex items-center"
                                                                >
                                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                    GPS
                                                                </button>
                                                            </div>
                                                            {item.destinationLocation && <span className="text-[10px] text-green-600 font-mono flex items-center"><svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> GPS Set</span>}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">Collect Cash (COD)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2 text-gray-500 text-sm">
                                                                {item.codCurrency === 'KHR' ? '៛' : '$'}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                className="block w-full pl-8 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-red-900"
                                                                placeholder="0.00"
                                                                value={item.productPrice || ''}
                                                                onChange={e => updateItem(idx, 'productPrice', e.target.value)}
                                                            />
                                                            <div className="absolute right-3 top-2 text-xs text-gray-400">
                                                                {item.codCurrency || 'USD'}
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 mt-1">Amount driver collects from receiver.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <label className="block text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors" htmlFor="manual-upload-input">
                                            <p className="text-gray-500 font-medium">Tap to add your first parcel</p>
                                        </label>
                                    )}
                                </div>

                                {/* Additional Details */}
                                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('delivery_instructions')}</label>
                                        <textarea
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                                            rows={2}
                                            placeholder="e.g. Leave at front gate, Call on arrival..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{t('promo_code')}</label>
                                        <select
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                                            value={selectedPromoId}
                                            onChange={e => setSelectedPromoId(e.target.value)}
                                        >
                                            <option value="">-- Select Promotion --</option>
                                            {filteredPromotions.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.code} - {p.name} ({p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div ref={footerRef}></div>

                {/* Footer Actions */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 safe-area-pb">
                    <div className="max-w-2xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="text-center sm:text-left w-full sm:w-auto">
                            {pricing.discount > 0 && (
                                <p className="text-xs text-green-600 font-medium">Discount: -${(pricing.discount || 0).toFixed(2)}</p>
                            )}
                            <p className="text-xs text-gray-500">
                                {t('total')}: <span className="font-bold text-gray-900">${(pricing.total || 0).toFixed(2)}</span>
                                {pricing.isSpecialRate && <span className="ml-1 text-[9px] text-green-600 font-bold uppercase bg-green-50 px-1 rounded">Special Rate</span>}
                            </p>
                            {totalCOD.value > 0 && <p className="text-xs text-red-600">COD: <span className="font-bold">{totalCOD.display}</span></p>}
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            {step > 1 && <Button variant="outline" onClick={() => setStep(prev => (prev - 1) as any)} className="flex-1 sm:flex-none justify-center">{t('back')}</Button>}

                            {step === 1 && (
                                <Button
                                    disabled={!serviceTypeId}
                                    onClick={() => setStep(2)}
                                    className="flex-1 sm:flex-none justify-center px-8 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                                >
                                    {t('next')}
                                </Button>
                            )}

                            {step === 2 && (
                                <Button
                                    disabled={items.length === 0}
                                    onClick={() => setStep(3)}
                                    className="flex-1 sm:flex-none justify-center px-8 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                                >
                                    {t('next')}
                                </Button>
                            )}

                            {step === 3 && (
                                <Button
                                    onClick={handleSave}
                                    isLoading={loading}
                                    className="flex-1 sm:flex-none justify-center px-8 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
                                >
                                    {t('confirm_booking')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Map Picker Modal */}
                {mapPickerTarget && (
                    <LocationPicker
                        initialLat={mapPickerTarget.type === 'PICKUP' && customPickupLat ? Number(customPickupLat) : undefined}
                        initialLng={mapPickerTarget.type === 'PICKUP' && customPickupLng ? Number(customPickupLng) : undefined}
                        onConfirm={handleLocationPicked}
                        onClose={() => setMapPickerTarget(null)}
                    />
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                    <Card title="Review & Financials">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Apply Promotion</label>
                                    <select
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                        value={selectedPromoId}
                                        onChange={e => setSelectedPromoId(e.target.value)}
                                    >
                                        <option value="">No Promotion</option>
                                        {filteredPromotions.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.code} - {p.name} ({p.type === 'PERCENTAGE' ? `${p.value}% Off` : `$${p.value} Off`})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                                    <p className="font-bold mb-1">Estimated Pickup</p>
                                    <p>Our driver will contact you shortly after confirmation to arrange pickup at: <strong>{pickupLocationId === 'custom' ? customPickupAddress : savedLocations.find(l => l.id === pickupLocationId)?.address}</strong></p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-3">
                                <h4 className="text-sm font-bold text-gray-900 mb-2">Payment Summary</h4>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal {pricing.isSpecialRate && <span className="text-xs text-green-600 font-bold bg-green-50 px-1 rounded ml-1">Special Rate</span>}</span>
                                    <span className="font-medium">${(pricing.subtotal || 0).toFixed(2)}</span>
                                </div>
                                {(pricing.discount || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">{t('discount')}</span>
                                        <span className="font-medium text-green-600">-${(pricing.discount || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-300">
                                    <span className="text-gray-900">Total Fee</span>
                                    <span className="text-indigo-600">${(pricing.total || 0).toFixed(2)}</span>
                                </div>
                                {totalCOD.value > 0 && (
                                    <div className="flex justify-between text-sm pt-2 text-red-600 font-medium border-t border-gray-200 mt-2">
                                        <span>COD to Collect</span>
                                        <span>{totalCOD.display}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
};
