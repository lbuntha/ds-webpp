import React, { useState, useEffect } from 'react';
import { UserProfile, SavedLocation, Customer, BankAccountDetails, CurrencyConfig, Employee } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { ImageUpload } from '../ui/ImageUpload';
import { Modal } from '../ui/Modal';
import { LocationPicker } from '../ui/LocationPicker';
import { PlaceAutocomplete } from '../ui/PlaceAutocomplete';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    user: UserProfile;
    hideExchangeRate?: boolean;
}

export const CustomerProfile: React.FC<Props> = ({ user, hideExchangeRate }) => {
    const { t } = useLanguage();
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phone || '');
    const [address, setAddress] = useState(user.address || '');
    const [loading, setLoading] = useState(false);

    // Referral Code State - start empty, load from customers collection
    const [displayReferralCode, setDisplayReferralCode] = useState<string>('');

    // Location Management State - start empty, load from customers collection
    const [locations, setLocations] = useState<SavedLocation[]>([]);
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const [newLocLabel, setNewLocLabel] = useState('');
    const [newLocAddress, setNewLocAddress] = useState('');
    const [newLocLat, setNewLocLat] = useState<number | ''>('');
    const [newLocLng, setNewLocLng] = useState<number | ''>('');
    const [showMapPicker, setShowMapPicker] = useState(false);

    const [confirmDeleteLocationId, setConfirmDeleteLocationId] = useState<string | null>(null);
    const [confirmDeleteBankIndex, setConfirmDeleteBankIndex] = useState<number | null>(null);

    // Employee Data for Drivers
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [employeeLoading, setEmployeeLoading] = useState(false);

    // Bank Account State
    const [customerData, setCustomerData] = useState<Customer | null>(null);
    const [isAddingBank, setIsAddingBank] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [newBankAccount, setNewBankAccount] = useState('');
    const [newBankQR, setNewBankQR] = useState('');
    const [bankLoading, setBankLoading] = useState(false);

    // Exchange Rate State
    const [exchangeRate, setExchangeRate] = useState<number | ''>('');
    const [rateLoading, setRateLoading] = useState(false);
    const [systemRate, setSystemRate] = useState(4100);

    // Telegram Unlink Confirmation
    const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
    const [unlinkLoading, setUnlinkLoading] = useState(false);



    // Load Linked Customer Data & System Rates
    useEffect(() => {
        const loadData = async () => {
            // 1. Get System Rate
            const currencies = await firebaseService.getCurrencies();
            const khr = currencies.find(c => c.code === 'KHR');
            if (khr) setSystemRate(khr.exchangeRate);

            // 2. Get Customer Data
            let cust: Customer | undefined;

            if (user.linkedCustomerId) {
                const data = await firebaseService.getDocument('customers', user.linkedCustomerId);
                if (data) cust = data as Customer;
            } else {
                // Try searching by linkedUserId
                const allCustomers = await firebaseService.getCustomers();
                cust = allCustomers.find(c => c.linkedUserId === user.uid);
            }

            if (cust) {
                setCustomerData(cust);
                if (cust.customExchangeRate) {
                    setExchangeRate(cust.customExchangeRate);
                }

                // Sync Locations from Customer Doc if present, else keep User's
                if (cust.savedLocations && cust.savedLocations.length > 0) {
                    setLocations(cust.savedLocations);
                }

                // Sync Referral Code from Customer Doc if present
                if (cust.referralCode) {
                    setDisplayReferralCode(cust.referralCode);
                }
            }
        };
        loadData();

        // 3. Get Employee Data if Driver
        if (user.role === 'driver') {
            const loadEmployee = async () => {
                setEmployeeLoading(true);
                try {
                    const emp = await firebaseService.hrService.getEmployeeByUserId(user.uid);
                    setEmployeeData(emp);
                } catch (e) {
                    console.error("Error loading employee data", e);
                } finally {
                    setEmployeeLoading(false);
                }
            };
            loadEmployee();
        }
    }, [user.uid, user.linkedCustomerId, user.role]);

    // Auto-generate Referral Code if missing
    useEffect(() => {
        const ensureReferralCode = async () => {
            // Check displayReferralCode (which is synced from Customer or User)
            if (!displayReferralCode) {
                // Generate: First 3 letters of name (or 'USR') + random 4 digits
                const cleanName = user.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
                const prefix = (cleanName.length >= 3 ? cleanName.substring(0, 3) : (cleanName + 'USR').substring(0, 3));
                const suffix = Math.floor(1000 + Math.random() * 9000);
                const newCode = `${prefix}-${suffix}`;

                try {
                    if (customerData) {
                        // Save to Customer Doc
                        const updatedCustomer = { ...customerData, referralCode: newCode };
                        await firebaseService.updateCustomer(updatedCustomer);
                        setCustomerData(updatedCustomer);
                    } else {
                        // Save to User Profile
                        await firebaseService.updateUserProfile(user.name, { referralCode: newCode });
                    }
                    // Update local view immediately
                    setDisplayReferralCode(newCode);
                } catch (e) {
                    console.error("Failed to generate referral code", e);
                }
            }
        };

        ensureReferralCode();
    }, [user.uid, user.name, displayReferralCode, customerData]); // Added customerData dependency

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Update profile via ConfigService (which handles collection routing)
            await firebaseService.updateUserProfile(name, { phone, address });

            // Local state update for Customer model if present
            if (customerData) {
                setCustomerData({
                    ...customerData,
                    name,
                    phone,
                    address
                });
            }

            toast.success(t('profile_updated'));
        } catch (e) {
            console.error(e);
            toast.error("Error updating profile.");
        } finally {
            setLoading(false);
        }
    };

    // --- RATE LOGIC ---
    const handleSaveRate = async () => {
        if (!customerData) return;
        setRateLoading(true);
        try {
            const updatedCustomer = {
                ...customerData,
                customExchangeRate: exchangeRate ? Number(exchangeRate) : undefined
            };
            await firebaseService.updateCustomer(updatedCustomer);
            setCustomerData(updatedCustomer);
            // @ts-ignore
            toast.success(t('rate_updated_success'));
        } catch (e) {
            console.error(e);
            // @ts-ignore
            toast.error(t('rate_updated_error'));
        } finally {
            setRateLoading(false);
        }
    };

    // --- LOCATION LOGIC ---
    const handleLocationPicked = (lat: number, lng: number, address: string) => {
        setNewLocLat(lat);
        setNewLocLng(lng);
        setNewLocAddress(address);
        setShowMapPicker(false);
    };

    const handleAddLocation = async () => {
        if (!newLocLabel || !newLocAddress) return toast.warning("Label and Address are required.");

        setLoading(true);

        let coords = undefined;
        if (typeof newLocLat === 'number' && typeof newLocLng === 'number' && !isNaN(newLocLat) && !isNaN(newLocLng)) {
            coords = { lat: newLocLat, lng: newLocLng };
        }

        const newLocation: SavedLocation = {
            id: `loc-${Date.now()}`,
            label: newLocLabel,
            address: newLocAddress,
            coordinates: coords,
            isPrimary: locations.length === 0 // First one is primary by default
        };

        const updatedLocations = [...locations, newLocation];

        try {
            // Update through service (handles routing to 'customers' or 'users')
            await firebaseService.updateUserLocations(updatedLocations);

            if (customerData) {
                setCustomerData({ ...customerData, savedLocations: updatedLocations });
            }

            setLocations(updatedLocations);
            setIsAddingLocation(false);
            setNewLocLabel('');
            setNewLocAddress('');
            setNewLocLat('');
            setNewLocLng('');
        } catch (e) {
            console.error(e);
            toast.error("Failed to save location.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLocationClick = (id: string) => {
        setConfirmDeleteLocationId(id);
    };

    const executeDeleteLocation = async () => {
        if (!confirmDeleteLocationId) return;

        const updated = locations.filter(l => l.id !== confirmDeleteLocationId);

        try {
            await firebaseService.updateUserLocations(updated);

            if (customerData) {
                setCustomerData({ ...customerData, savedLocations: updated });
            }

            setLocations(updated);
            setConfirmDeleteLocationId(null);
            // @ts-ignore
            toast.success(t('location_deleted') || "Location deleted");
        } catch (e) {
            toast.error("Failed to delete.");
        }
    };

    const handleSetPrimary = async (id: string) => {
        const updated = locations.map(l => ({
            ...l,
            isPrimary: l.id === id
        }));

        if (customerData) {
            const updatedCustomer = { ...customerData, savedLocations: updated };
            await firebaseService.updateCustomer(updatedCustomer);
            setCustomerData(updatedCustomer);
        } else {
            await firebaseService.updateUserLocations(updated);
        }

        setLocations(updated);
    };

    // --- BANK ACCOUNT LOGIC ---

    const handleCreateBillingProfile = async () => {
        setBankLoading(true);
        try {
            await firebaseService.createCustomerFromUser(user);
            toast.success(t('profile_updated'));
            window.location.reload();
        } catch (e) {
            console.error(e);
            toast.error("Failed to initialize wallet profile.");
        } finally {
            setBankLoading(false);
        }
    };

    const handleAddBank = async () => {
        if (!customerData) return;
        if (!newBankName || !newBankAccount) return toast.warning("Bank Name and Account Number are required.");

        // Limit Check
        if ((customerData.bankAccounts?.length || 0) >= 2) {
            return toast.warning(t('max_bank_limit'));
        }

        setBankLoading(true);

        let qrCodeUrl = newBankQR;
        if (newBankQR && newBankQR.startsWith('data:')) {
            qrCodeUrl = await firebaseService.walletService.uploadAttachment(newBankQR);
        }

        const newBank: BankAccountDetails = {
            bankName: newBankName,
            accountNumber: newBankAccount,
            qrCode: qrCodeUrl
        };

        const updatedCustomer = {
            ...customerData,
            bankAccounts: [...(customerData.bankAccounts || []), newBank]
        };

        try {
            await firebaseService.updateCustomer(updatedCustomer);
            setCustomerData(updatedCustomer);
            setIsAddingBank(false);
            setNewBankName('');
            setNewBankAccount('');
            setNewBankQR('');
        } catch (e) {
            console.error(e);
            toast.error("Failed to save bank account.");
        } finally {
            setBankLoading(false);
        }
    };

    const handleDeleteBankClick = (index: number) => {
        setConfirmDeleteBankIndex(index);
    };

    const executeDeleteBank = async () => {
        if (!customerData || confirmDeleteBankIndex === null) return;

        const updatedAccounts = [...(customerData.bankAccounts || [])];
        updatedAccounts.splice(confirmDeleteBankIndex, 1);

        const updatedCustomer = { ...customerData, bankAccounts: updatedAccounts };

        try {
            await firebaseService.updateCustomer(updatedCustomer);
            setCustomerData(updatedCustomer);
            setConfirmDeleteBankIndex(null);
            toast.success(t('bank_deleted') || "Bank account deleted");
        } catch (e) {
            toast.error("Failed to delete.");
        }
    };

    const canAddBank = customerData && (customerData.bankAccounts?.length || 0) < 2;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <Card>
                <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mb-6">
                    <Avatar name={user.name} size="lg" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                        <p className="text-gray-500">{user.email}</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <Input label={t('full_name')} value={name} onChange={e => setName(e.target.value)} />
                    <Input label={t('phone_number')} value={phone} onChange={e => setPhone(e.target.value)} />
                    <Input label={t('default_address')} value={address} onChange={e => setAddress(e.target.value)} placeholder="House, Street, City..." />

                    <div className="pt-2 flex justify-end">
                        <Button type="submit" isLoading={loading}>{t('save_basic_info')}</Button>
                    </div>
                </form>
            </Card>


            {/* TELEGRAM CONNECTION SECTION */}
            <Card title="Telegram Notifications">
                {customerData?.telegramChatId ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-900">Connected to Telegram</h3>
                                    <p className="text-sm text-green-700">
                                        {customerData.telegramChatType === 'group' || customerData.telegramChatType === 'supergroup'
                                            ? `Notifications sent to group: ${customerData.telegramGroupName || 'Group Chat'}`
                                            : 'Notifications sent to your private chat'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${customerData.telegramChatType === 'group' || customerData.telegramChatType === 'supergroup'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-green-100 text-green-700'
                                    }`}>
                                    {customerData.telegramChatType === 'group' || customerData.telegramChatType === 'supergroup' ? '👥 Group' : '👤 Private'}
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-green-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <p className="text-xs text-green-600">
                                You can unlink and connect to a different chat anytime.
                            </p>
                            <button
                                onClick={() => setShowUnlinkConfirm(true)}
                                className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                            >
                                Unlink Telegram
                            </button>
                        </div>

                        {/* Unlink Confirmation Modal */}
                        <Modal
                            isOpen={showUnlinkConfirm}
                            onClose={() => setShowUnlinkConfirm(false)}
                            title="Unlink Telegram"
                            maxWidth="max-w-md"
                        >
                            <div className="text-center py-4">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Disconnect from Telegram?</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    You will stop receiving notifications on Telegram. You can reconnect anytime using your private chat or a group.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowUnlinkConfirm(false)}
                                        disabled={unlinkLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        isLoading={unlinkLoading}
                                        onClick={async () => {
                                            setUnlinkLoading(true);
                                            try {
                                                const updatedCustomer = {
                                                    ...customerData,
                                                    telegramChatId: undefined,
                                                    telegramChatType: undefined,
                                                    telegramGroupName: undefined,
                                                    telegramLinkedAt: undefined,
                                                    telegramLinkedBy: undefined
                                                };
                                                await firebaseService.updateCustomer(updatedCustomer);
                                                setCustomerData(updatedCustomer);
                                                setShowUnlinkConfirm(false);
                                                toast.success('Telegram unlinked successfully');
                                            } catch (e) {
                                                console.error(e);
                                                toast.error('Failed to unlink Telegram');
                                            } finally {
                                                setUnlinkLoading(false);
                                            }
                                        }}
                                    >
                                        Unlink
                                    </Button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Option 1: Quick Connect (Private Chat) */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                            <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                            </div>
                            <h3 className="font-bold text-gray-900 mb-2">Get Instant Notifications</h3>
                            <p className="text-gray-600 mb-4 text-sm max-w-md mx-auto">
                                Receive settlement reports and payment updates directly on Telegram.
                            </p>
                            <a
                                href={`https://t.me/DSDelivery_bot?start=${user.uid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#0088cc] hover:bg-[#0077b5] shadow-sm transition-all transform hover:scale-105"
                            >
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                                Connect via Private Chat
                            </a>
                        </div>

                        {/* Option 2: Link to Group */}
                        {customerData && (
                            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-purple-900 mb-1">Link to Group Chat</h4>
                                        <p className="text-sm text-purple-700 mb-4">
                                            Add the bot to your Telegram group so your whole team can see notifications.
                                        </p>

                                        <div className="space-y-3">
                                            <a
                                                href={`https://t.me/DSDelivery_bot?startgroup=link_${customerData.code || customerData.id || ''}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-white hover:bg-purple-100 shadow-sm transition-all"
                                            >
                                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
                                                Add Bot to Group
                                            </a>

                                            <div className="text-xs text-purple-600 bg-purple-100/50 rounded-lg p-3">
                                                <p className="font-medium mb-1">After adding the bot, send this command in the group:</p>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <code className="bg-white px-2 py-1 rounded font-mono text-purple-800 text-xs break-all">
                                                        /link {customerData.code || customerData.id || 'YOUR_CODE'}
                                                    </code>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`/link ${customerData.code || customerData.id || 'YOUR_CODE'}`);
                                                            toast.success('Command copied!');
                                                        }}
                                                        className="text-purple-600 hover:text-purple-800 font-medium"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>



            {/* EXCHANGE RATE SETTING */}
            {!hideExchangeRate && (
                <Card title={'Exchange Rate Preferences'}>
                    {!customerData ? (
                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                            <p className="text-gray-600 mb-4 text-sm">{t('need_billing_profile')}</p>
                            <Button onClick={handleCreateBillingProfile} isLoading={bankLoading}>
                                {t('init_wallet_profile')}
                            </Button>
                        </div>
                    ) : (
                        <>

                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-4 text-sm text-blue-800">
                                <p className="font-bold mb-1">
                                    {
                                        // @ts-ignore
                                        t('daily_rate_title')
                                    }
                                </p>
                                <p>
                                    {
                                        // @ts-ignore
                                        t('cod_rate_expl').replace('{0}', systemRate.toLocaleString())
                                    }
                                </p>
                            </div>

                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {
                                            // @ts-ignore
                                            t('custom_rate_label')
                                        }
                                    </label>
                                    <input
                                        type="number"
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm font-bold text-gray-900"
                                        placeholder={`System Default: ${systemRate}`}
                                        value={exchangeRate}
                                        onChange={e => setExchangeRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    />
                                </div>
                                <Button onClick={handleSaveRate} isLoading={rateLoading} className="mb-[1px]">
                                    {
                                        // @ts-ignore
                                        t('update_rate')
                                    }
                                </Button>
                            </div>

                        </>
                    )}
                </Card>
            )}

            {/* TAX CONFIGURATION - Read Only for Customer */}
            {customerData && (
                <Card title="Tax Configuration">
                    <div className="flex items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <input
                            id="isTaxableCust"
                            type="checkbox"
                            className="h-5 w-5 text-gray-400 border-gray-300 rounded cursor-not-allowed"
                            checked={customerData.isTaxable || false}
                            disabled
                        />
                        <div className="ml-3">
                            <label htmlFor="isTaxableCust" className="block text-sm font-bold text-gray-700">
                                {customerData.isTaxable ? 'VAT/Tax Applied' : 'No Tax Applied'}
                            </label>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Tax configuration is managed by the administrator.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* SPECIAL RATES - Read Only for Customer */}
            {customerData && (
                <Card title="Special Rates">
                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-bold text-purple-900 mb-1">Custom Pricing</h4>
                        <p className="text-xs text-purple-700">
                            Special rates configured by the administrator will be automatically applied when you book a parcel.
                        </p>
                    </div>
                    <div className="text-center py-4 border-2 border-dashed border-gray-100 rounded-lg">
                        <p className="text-xs text-gray-400">Contact support to request special pricing</p>
                    </div>
                </Card>
            )}

            {/* BANK ACCOUNTS SECTION */}
            <Card title={t('bank_accounts')}>
                {user.role === 'driver' ? (
                    <div className="space-y-4">
                        {employeeData ? (
                            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 bg-blue-50/50 hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">Official Bank Account</h4>
                                        <p className="text-sm text-gray-600 font-mono">{employeeData.bankAccount || 'Not set in employee profile'}</p>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Managed by Administration</p>
                                    </div>
                                </div>
                            </div>
                        ) : employeeLoading ? (
                            <div className="text-center py-6 text-gray-500 text-sm">Loading bank info...</div>
                        ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-gray-500 text-sm">No employee record found for your account.</p>
                            </div>
                        )}
                    </div>
                ) : !customerData ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-gray-600 mb-4 text-sm">{t('need_billing_profile')}</p>
                        <Button onClick={handleCreateBillingProfile} isLoading={bankLoading}>
                            {t('init_wallet_profile')}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {customerData.bankAccounts && customerData.bankAccounts.map((bank, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-200 transition-colors bg-white">
                                <div className="flex items-center gap-4">
                                    {bank.qrCode ? (
                                        <img src={bank.qrCode} alt="QR" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-gray-50" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-gray-900">{bank.bankName}</h4>
                                        <p className="text-sm text-gray-600 font-mono">{bank.accountNumber}</p>
                                        {bank.qrCode && <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">{t('qr_enabled')}</span>}
                                    </div>
                                </div>
                                {confirmDeleteBankIndex === idx ? (
                                    <div className="flex gap-2">
                                        <button onClick={executeDeleteBank} className="text-xs text-red-600 font-bold hover:underline px-2 py-1 bg-red-50 rounded">{t('confirm')}</button>
                                        <button onClick={() => setConfirmDeleteBankIndex(null)} className="text-xs text-gray-600 hover:underline px-2 py-1 bg-gray-100 rounded">{t('cancel')}</button>
                                    </div>
                                ) : (
                                    <button onClick={() => handleDeleteBankClick(idx)} className="text-xs text-red-600 hover:underline font-medium px-2 py-1 rounded hover:bg-red-50">{t('remove')}</button>
                                )}
                            </div>
                        ))}

                        {!isAddingBank ? (
                            canAddBank ? (
                                <button
                                    onClick={() => setIsAddingBank(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    {t('add_bank_account')} ({customerData.bankAccounts?.length || 0}/2)
                                </button>
                            ) : (
                                <div className="text-center text-xs text-gray-400 py-2">
                                    {t('max_bank_limit')}
                                </div>
                            )
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in-up">
                                <h4 className="text-sm font-bold text-blue-800 mb-3">{t('add_bank_account')}</h4>
                                <div className="space-y-3">
                                    <Input
                                        label={t('bank_name')}
                                        value={newBankName}
                                        onChange={e => setNewBankName(e.target.value)}
                                        placeholder="e.g. ABA Bank, ACLEDA"
                                    />
                                    <Input
                                        label={t('account_no')}
                                        value={newBankAccount}
                                        onChange={e => setNewBankAccount(e.target.value)}
                                        placeholder="000 000 000"
                                    />
                                    <ImageUpload
                                        label={t('qr_code_label')}
                                        value={newBankQR}
                                        onChange={setNewBankQR}
                                    />
                                    <div className="flex justify-end space-x-2 pt-2">
                                        <Button variant="outline" onClick={() => setIsAddingBank(false)} className="text-xs">{t('cancel')}</Button>
                                        <Button onClick={handleAddBank} isLoading={bankLoading} className="text-xs">{t('save_account')}</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* SAVED LOCATIONS */}
            {user.role !== 'driver' && (
                <Card title={t('saved_locations')}>
                    <div className="space-y-4">
                        {locations.map(loc => (
                            <div key={loc.id} className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-red-200 transition-colors bg-white">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900">{loc.label}</h4>
                                        {loc.isPrimary && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{t('primary_badge')}</span>}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{loc.address}</p>
                                    {loc.coordinates && (
                                        <p className="text-xs text-gray-400 mt-1 font-mono">
                                            {(loc.coordinates.lat || 0).toFixed(5)}, {(loc.coordinates.lng || 0).toFixed(5)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {!loc.isPrimary && (
                                        <button onClick={() => handleSetPrimary(loc.id)} className="text-xs text-indigo-600 hover:underline">{t('set_primary')}</button>
                                    )}
                                    {confirmDeleteLocationId === loc.id ? (
                                        <div className="flex gap-2">
                                            <button onClick={executeDeleteLocation} className="text-xs text-red-600 font-bold hover:underline px-2 py-1 bg-red-50 rounded">{t('confirm')}</button>
                                            <button onClick={() => setConfirmDeleteLocationId(null)} className="text-xs text-gray-600 hover:underline px-2 py-1 bg-gray-100 rounded">{t('cancel')}</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleDeleteLocationClick(loc.id)} className="text-xs text-red-600 hover:underline">{t('delete')}</button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {!isAddingLocation ? (
                            <button
                                onClick={() => setIsAddingLocation(true)}
                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-red-300 hover:text-red-600 transition-all flex items-center justify-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                {t('add_new_location')}
                            </button>
                        ) : (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-fade-in-up">
                                <h4 className="text-sm font-bold text-gray-800 mb-3">{t('add_new_location')}</h4>
                                <div className="space-y-3">
                                    <Input
                                        label={t('loc_label_placeholder')}
                                        value={newLocLabel}
                                        onChange={e => setNewLocLabel(e.target.value)}
                                        placeholder="Home, Office, Warehouse A..."
                                    />

                                    {/* Address Input with Place Autocomplete */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('address_coordinates')}</label>
                                        <PlaceAutocomplete
                                            value={newLocAddress}
                                            onChange={setNewLocAddress}
                                            onSelect={(place) => {
                                                setNewLocAddress(place.address || place.name);
                                                if (place.location) {
                                                    setNewLocLat(place.location.lat);
                                                    setNewLocLng(place.location.lng);
                                                }
                                            }}
                                            onPickMap={() => setShowMapPicker(true)}
                                            placeholder={t('enter_address_placeholder')}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                                        />
                                        {newLocLat !== '' && newLocLng !== '' && (
                                            <p className="text-xs text-green-600 mt-1 flex items-center">
                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                {t('coordinates_set')}: {Number(newLocLat).toFixed(6)}, {Number(newLocLng).toFixed(6)}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex justify-end space-x-2 pt-2">
                                        <Button variant="outline" onClick={() => setIsAddingLocation(false)} className="text-xs">{t('cancel')}</Button>
                                        <Button onClick={handleAddLocation} isLoading={loading} className="text-xs">{t('save_location')}</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Map Picker Modal */}
            {
                showMapPicker && (
                    <LocationPicker
                        initialLat={typeof newLocLat === 'number' ? newLocLat : undefined}
                        initialLng={typeof newLocLng === 'number' ? newLocLng : undefined}
                        onConfirm={handleLocationPicked}
                        onClose={() => setShowMapPicker(false)}
                    />
                )
            }

            <Card title={t('referral_program')}>
                <div className="bg-red-50 p-6 rounded-xl text-center border border-red-100">
                    <p className="text-red-800 font-medium mb-2">{t('referral_code_title')}</p>
                    <div className="text-3xl font-mono font-bold text-red-600 tracking-widest mb-4 bg-white inline-block px-6 py-2 rounded-lg border border-red-200 shadow-sm">
                        {displayReferralCode || 'Generating...'}
                    </div>
                    <p className="text-sm text-red-600">
                        {t('referral_desc')}
                    </p>

                    {/* Earnings Display */}
                    {user.referralStats && (
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-red-200 pt-4">
                            <div>
                                <p className="text-xs text-red-500 uppercase font-bold">Total Referrals</p>
                                <p className="text-xl font-bold text-red-900">{user.referralStats.count}</p>
                            </div>
                            <div>
                                <p className="text-xs text-red-500 uppercase font-bold">Total Earned</p>
                                <p className="text-xl font-bold text-red-900">${(user.referralStats.earnings || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => { navigator.clipboard.writeText(displayReferralCode || ''); toast.success(t('copied')); }}
                        className="mt-4 text-xs font-bold text-red-700 hover:underline uppercase"
                    >
                        {t('copy_code')}
                    </button>
                </div>
            </Card>
        </div >
    );
};
