import React, { useState, useMemo, useEffect } from 'react';
import { Permission, UserProfile, UserRole, UserStatus, Account, AccountType, Branch, Customer, BankAccountDetails, SavedLocation, CustomerSpecialRate, ParcelServiceType, Employee } from '../src/shared/types';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FEATURE_LIST } from '../src/shared/constants';
import { firebaseService } from '../src/shared/services/firebaseService';
import { logisticsService } from '../src/shared/services/logisticsService';
import { toast } from '../src/shared/utils/toast';
import { PlaceAutocomplete } from './ui/PlaceAutocomplete';
import { LocationPicker } from './ui/LocationPicker';

interface Props {
    users: UserProfile[];
    branches?: Branch[];
    rolePermissions?: Record<UserRole, Permission[]>;
    onUpdateRole?: (uid: string, role: UserRole) => Promise<void>;
    onUpdateStatus?: (uid: string, status: UserStatus) => Promise<void>;
    onUpdateProfile?: (uid: string, name: string, extra: any) => Promise<void>; // New Prop
    onUpdatePermissions?: (permissions: Record<UserRole, Permission[]>) => Promise<void>;
    onSyncProfile?: (user: UserProfile) => Promise<void>;
    onDeleteUser?: (uid: string, linkedCustomerId?: string) => Promise<void>;
}

export const UserList: React.FC<Props> = ({ users, branches = [], rolePermissions, onUpdateRole, onUpdateStatus, onUpdateProfile, onUpdatePermissions, onSyncProfile, onDeleteUser }) => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PENDING' | 'ACCESS'>('ACTIVE');

    // Edit State
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('accountant');
    const [selectedStatus, setSelectedStatus] = useState<UserStatus>('APPROVED');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [isTaxable, setIsTaxable] = useState(false); // New State

    const [walletAccount, setWalletAccount] = useState('');
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ uid: string; name: string; type: 'APPROVED' | 'REJECTED' | 'SYNC' | 'DELETE'; extra?: any } | null>(null);

    const [editedPermissions, setEditedPermissions] = useState<Record<UserRole, Permission[]> | null>(null);
    const [savingPerms, setSavingPerms] = useState(false);

    // Modal State
    const [activeModalTab, setActiveModalTab] = useState<'USER' | 'CUSTOMER' | 'EMPLOYEE'>('USER');

    // Employee state (for driver/warehouse roles)
    const [employeeData, setEmployeeData] = useState<Employee | null>(null);
    const [empPosition, setEmpPosition] = useState('');
    const [empDepartment, setEmpDepartment] = useState('');
    const [empHireDate, setEmpHireDate] = useState('');
    const [empSalary, setEmpSalary] = useState<number | undefined>();
    const [empIsDriver, setEmpIsDriver] = useState(false);
    const [empVehicleType, setEmpVehicleType] = useState('');
    const [empVehiclePlate, setEmpVehiclePlate] = useState('');
    const [empLicenseNumber, setEmpLicenseNumber] = useState('');
    const [empZone, setEmpZone] = useState('');

    // Customer billing state
    const [customerData, setCustomerData] = useState<Customer | null>(null);
    const [customerBankAccounts, setCustomerBankAccounts] = useState<BankAccountDetails[]>([]);
    const [customExchangeRate, setCustomExchangeRate] = useState<number | undefined>(undefined);

    // Customer Profile Fields (from Customer collection)
    const [custName, setCustName] = useState('');
    const [custPhone, setCustPhone] = useState('');
    const [custEmail, setCustEmail] = useState('');
    const [custAddress, setCustAddress] = useState('');
    const [custSavedLocations, setCustSavedLocations] = useState<SavedLocation[]>([]);
    const [custReferralCode, setCustReferralCode] = useState('');

    // Bank Modal
    const [showAddBankModal, setShowAddBankModal] = useState(false);
    const [newBankName, setNewBankName] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountNumber, setNewAccountNumber] = useState('');

    // Location Modal
    const [showAddLocationModal, setShowAddLocationModal] = useState(false);
    const [newLocationLabel, setNewLocationLabel] = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState('');
    const [newLocationLat, setNewLocationLat] = useState('');
    const [newLocationLng, setNewLocationLng] = useState('');
    const [showLocationMapPicker, setShowLocationMapPicker] = useState(false);

    // Special Rates State
    const [serviceTypes, setServiceTypes] = useState<ParcelServiceType[]>([]);
    const [specialRates, setSpecialRates] = useState<CustomerSpecialRate[]>([]);
    const [newRateServiceId, setNewRateServiceId] = useState('');
    const [newRatePrice, setNewRatePrice] = useState('');
    const [newRatePriceKHR, setNewRatePriceKHR] = useState('');
    const [newRateStartDate, setNewRateStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [newRateEndDate, setNewRateEndDate] = useState('2099-12-31');
    const [loadingRates, setLoadingRates] = useState(false);


    const [savingBilling, setSavingBilling] = useState(false);

    const isAdmin = !!onUpdateRole;

    useEffect(() => {
        firebaseService.getAccounts().then(accs => {
            setAvailableAccounts(accs.filter(a => a.type === AccountType.LIABILITY && !a.isHeader));
        });
        logisticsService.getParcelServices().then(setServiceTypes);
    }, []);

    const handleTabChange = (tab: 'ACTIVE' | 'PENDING' | 'ACCESS') => {
        setActiveTab(tab);
        if (tab === 'ACCESS' && rolePermissions) {
            const deepCopy: Record<UserRole, Permission[]> = {} as any;
            for (const role in rolePermissions) {
                if (Object.prototype.hasOwnProperty.call(rolePermissions, role)) {
                    deepCopy[role as UserRole] = [...rolePermissions[role as UserRole]];
                }
            }
            setEditedPermissions(deepCopy);
        }
    };

    const normalizedUsers = useMemo(() => {
        return users.map(u => ({
            ...u,
            status: u.status || 'APPROVED'
        }));
    }, [users]);

    const pendingUsers = useMemo(() => normalizedUsers.filter(u => u.status === 'PENDING'), [normalizedUsers]);
    const activeUsers = useMemo(() => normalizedUsers.filter(u => u.status === 'APPROVED' || u.status === 'INACTIVE'), [normalizedUsers]);

    const displayedUsers = activeTab === 'ACTIVE' ? activeUsers : pendingUsers;

    const fetchCustomerData = async (uid: string, linkedCustomerId?: string) => {
        const customers = await firebaseService.getCustomers();
        const customer = customers.find(c => c.linkedUserId === uid || (linkedCustomerId && c.id === linkedCustomerId));

        if (customer) {
            setCustomerData(customer);
            setCustomerBankAccounts(customer.bankAccounts || []);
            setCustomExchangeRate(customer.customExchangeRate);
            setCustName(customer.name || '');
            setCustPhone(customer.phone || '');
            setCustEmail(customer.email || '');
            setCustAddress(customer.address || '');
            setCustSavedLocations(customer.savedLocations || []);
            setCustReferralCode(customer.referralCode || '');
            setIsTaxable(customer.isTaxable || false);  // Load from customers collection

            try {
                setLoadingRates(true);
                const rates = await logisticsService.getCustomerSpecialRates(customer.id);
                setSpecialRates(rates);
            } catch (e) {
                console.error('Failed to load rates', e);
            } finally {
                setLoadingRates(false);
            }
        } else {
            setCustomerData(null);
            setCustomerBankAccounts([]);
            setCustomExchangeRate(undefined);
            setCustName('');
            setCustPhone('');
            setCustEmail('');
            setCustAddress('');
            setCustSavedLocations([]);
            setCustReferralCode('');
            setSpecialRates([]);
        }
    };

    const fetchEmployeeData = async (uid: string) => {
        const employee = await firebaseService.hrService.getEmployeeByUserId(uid);

        if (employee) {
            setEmployeeData(employee);
            setEmpPosition(employee.position || '');
            setEmpDepartment(employee.department || '');
            setEmpHireDate(employee.hireDate || '');
            setEmpSalary(employee.baseSalaryAmount);
            setEmpIsDriver(employee.isDriver || false);
            setEmpVehicleType(employee.vehicleType || '');
            setEmpVehiclePlate(employee.vehiclePlateNumber || '');
            setEmpLicenseNumber(employee.licenseNumber || '');
            setEmpZone(employee.zone || '');
        } else {
            setEmployeeData(null);
            setEmpPosition('');
            setEmpDepartment('');
            setEmpHireDate('');
            setEmpSalary(undefined);
            setEmpIsDriver(false);
            setEmpVehicleType('');
            setEmpVehiclePlate('');
            setEmpLicenseNumber('');
            setEmpZone('');
        }
    };

    const handleEditClick = async (user: UserProfile) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditPhone(user.phone || '');
        setIsTaxable(user.isTaxable || false);
        setSelectedRole(user.role);
        setSelectedStatus(user.status || 'APPROVED');
        setWalletAccount(user.walletAccountId || '');
        setSelectedBranchId(user.managedBranchId || '');
        setUpdateError(null);
        setActiveModalTab('USER');

        // Always try to load customer data - connection might be one-way (Customer -> User)
        // Always try to load customer data - connection might be one-way (Customer -> User)
        try {
            await fetchCustomerData(user.uid, user.linkedCustomerId);
        } catch (e) {
            console.error('Failed to load customer data:', e);
            // Fallback clear
            setCustomerData(null);
        }

        // Load employee data for driver/warehouse roles
        if (user.role === 'driver' || user.role === 'warehouse') {
            try {
                await fetchEmployeeData(user.uid);
            } catch (e) {
                console.error('Failed to load employee data:', e);
                setEmployeeData(null);
            }
        }
    };


    const handleCancelUserEdit = () => {
        setEditingUser(null);
        setIsUpdating(false);
        setUpdateError(null);
        setCustomerData(null);
        setCustomerBankAccounts([]);
        setCustomExchangeRate(undefined);
        setCustName('');
        setCustPhone('');
        setCustEmail('');
        setCustAddress('');
        setCustSavedLocations([]);
        setCustReferralCode('');
        setSpecialRates([]); // Clear special rates on cancel
        setShowAddBankModal(false);
        setShowAddLocationModal(false);
        setActiveModalTab('USER');
    };

    const handleDeleteUser = async () => {
        if (!editingUser) return;
        setConfirmAction({
            uid: editingUser.uid,
            name: editingUser.name,
            type: 'DELETE',
            extra: { linkedCustomerId: editingUser.linkedCustomerId }
        });
    };

    const confirmDeleteUser = async () => {
        if (!confirmAction || confirmAction.type !== 'DELETE' || !onDeleteUser) return;
        const linkedCustomerId = confirmAction.extra?.linkedCustomerId;

        try {
            setProcessingId(confirmAction.uid);
            await onDeleteUser(confirmAction.uid, linkedCustomerId);
            // No need to setUsers here, parent will reload
            toast.success('User deleted successfully');
            setEditingUser(null);
            setConfirmAction(null);
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete user');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAddBankAccount = async () => {
        if (!customerData || !newBankName || !newAccountNumber) {
            toast.error('Please fill in bank name and account number');
            return;
        }

        const newAccount: BankAccountDetails = {
            id: `bank-${Date.now()}`,
            bankName: newBankName,
            accountName: newAccountName,
            accountNumber: newAccountNumber
        };

        const updatedBankAccounts = [...customerBankAccounts, newAccount];
        setCustomerBankAccounts(updatedBankAccounts);

        try {
            await firebaseService.updateCustomer({
                ...customerData,
                bankAccounts: updatedBankAccounts
            });
            toast.success('Bank account added');
            setShowAddBankModal(false);
            setNewBankName('');
            setNewAccountName('');
            setNewAccountNumber('');
        } catch (error) {
            console.error('Error adding bank account:', error);
            toast.error('Failed to add bank account');
        }
    };

    const handleRemoveBankAccount = (bankIdOrNum: string) => {
        setCustomerBankAccounts(prev => prev.filter(b => (b.id !== bankIdOrNum && b.accountNumber !== bankIdOrNum)));
    };

    const handleAddLocation = async () => {
        if (!newLocationLabel || !newLocationAddress) {
            toast.error('Label and Address are required');
            return;
        }
        if (!editingUser) return;

        const newLoc: SavedLocation = {
            id: Date.now().toString(),
            label: newLocationLabel,
            address: newLocationAddress,
            coordinates: (newLocationLat && newLocationLng) ? {
                lat: parseFloat(newLocationLat),
                lng: parseFloat(newLocationLng)
            } : undefined,
            isPrimary: custSavedLocations.length === 0 // Make primary if it's the first one
        };

        const updatedLocations = [...custSavedLocations, newLoc];
        setCustSavedLocations(updatedLocations);

        // Save to Firebase
        try {
            await firebaseService.configService.updateUserLocations(editingUser.uid, updatedLocations);
            toast.success('Location saved!');
        } catch (e) {
            console.error('Failed to save location', e);
            toast.error('Failed to save location');
        }

        setNewLocationLabel('');
        setNewLocationAddress('');
        setNewLocationLat('');
        setNewLocationLng('');
        setShowAddLocationModal(false);
    };

    const handleRemoveLocation = async (locationId: string) => {
        if (!editingUser) return;
        const updatedLocations = custSavedLocations.filter(l => l.id !== locationId);
        setCustSavedLocations(updatedLocations);

        // Save to Firebase
        try {
            await firebaseService.configService.updateUserLocations(editingUser.uid, updatedLocations);
            toast.success('Location removed');
        } catch (e) {
            console.error('Failed to remove location', e);
            toast.error('Failed to remove location');
        }
    };

    const handleSetPrimaryLocation = async (locationId: string) => {
        if (!editingUser) return;
        const updatedLocations = custSavedLocations.map(l => ({
            ...l,
            isPrimary: l.id === locationId
        }));
        setCustSavedLocations(updatedLocations);

        // Save to Firebase
        try {
            await firebaseService.configService.updateUserLocations(editingUser.uid, updatedLocations);
            toast.success('Primary location updated');
        } catch (e) {
            console.error('Failed to update primary location', e);
            toast.error('Failed to update primary location');
        }
    };

    const handleGenerateReferralCode = () => {
        // Simple random code: first 3 letters of name (or 'CUST') + 4 random digits
        const prefix = (custName ? custName.replace(/[^a-zA-Z]/g, '').substring(0, 3) : 'CUST').toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setCustReferralCode(`${prefix}-${randomNum}`);
    };

    const handleAddRate = async () => {
        if (!customerData || !newRateServiceId || !newRatePrice) {
            toast.error('Please select a service and enter a price.');
            return;
        }

        const service = serviceTypes.find(s => s.id === newRateServiceId);
        if (!service) {
            toast.error('Selected service not found.');
            return;
        }

        const newRate: CustomerSpecialRate = {
            id: Date.now().toString(),
            customerId: customerData.id,
            serviceTypeId: service.id,
            serviceName: service.name,
            price: parseFloat(newRatePrice),
            priceKHR: newRatePriceKHR ? parseFloat(newRatePriceKHR) : undefined,
            startDate: newRateStartDate,
            endDate: newRateEndDate,
            createdAt: Date.now()
        };

        try {
            await logisticsService.saveCustomerSpecialRate(newRate);
            setSpecialRates([...specialRates, newRate]);
            setNewRateServiceId('');
            setNewRatePrice('');
            setNewRatePriceKHR('');
            setNewRateStartDate(new Date().toISOString().split('T')[0]);
            setNewRateEndDate('2099-12-31');
            toast.success('Special rate added');
        } catch (error) {
            console.error('Error adding rate:', error);
            toast.error('Failed to add rate');
        }
    };

    const handleDeleteRate = async (rateId: string) => {
        try {
            await logisticsService.deleteCustomerSpecialRate(rateId);
            setSpecialRates(prev => prev.filter(r => r.id !== rateId));
            toast.success('Rate removed');
        } catch (error) {
            console.error('Error removing rate:', error);
            toast.error('Failed to remove rate');
        }
    };

    const handleSaveCustomExchangeRate = async () => {
        if (!customerData) return;

        setSavingBilling(true);
        try {
            await firebaseService.updateCustomer({
                ...customerData,
                customExchangeRate: customExchangeRate || undefined
            });
            toast.success('Exchange rate updated');
        } catch (error) {
            console.error('Error updating exchange rate:', error);
            toast.error('Failed to update exchange rate');
        } finally {
            setSavingBilling(false);
        }
    };

    const handleSaveCustomerDetails = async () => {
        if (!customerData) return;
        setSavingBilling(true);
        try {
            await firebaseService.updateCustomer({
                ...customerData,
                name: custName,
                phone: custPhone,
                email: custEmail,
                address: custAddress,
                customExchangeRate: customExchangeRate || undefined,
                bankAccounts: customerBankAccounts,
                savedLocations: custSavedLocations,
                referralCode: custReferralCode,
                isTaxable: isTaxable  // Save to customers collection
            });

            toast.success('Customer details updated');
        } catch (error) {
            console.error('Error updating customer details:', error);
            toast.error('Failed to update customer details');
        } finally {
            setSavingBilling(false);
        }
    };

    const handleUserSave = async () => {
        if (!editingUser || !onUpdateRole) return;

        setIsUpdating(true);
        setUpdateError(null);
        try {
            // 1. Update Basic Profile + Extra (Taxable)
            if (onUpdateProfile) {
                await onUpdateProfile(editingUser.uid, editName, {
                    phone: editPhone,
                    isTaxable: isTaxable
                });
            }

            // 2. Update Role
            if (selectedRole !== editingUser.role) {
                await onUpdateRole(editingUser.uid, selectedRole);
            }

            // 3. Update Status
            if (onUpdateStatus && selectedStatus !== editingUser.status) {
                await onUpdateStatus(editingUser.uid, selectedStatus);
            }

            // 4. Update Wallet Mapping
            if (walletAccount !== editingUser.walletAccountId) {
                await firebaseService.updateUserWalletMapping(editingUser.uid, walletAccount);
            }

            // 5. Update Branch Mapping
            if (selectedRole === 'warehouse') {
                await firebaseService.updateUserBranch(editingUser.uid, selectedBranchId);
            } else {
                await firebaseService.updateUserBranch(editingUser.uid, null);
            }

            setEditingUser(null);
            // Ideally trigger a refresh of users list from parent, but assuming parent does it via promise resolution
        } catch (e) {
            console.error("Failed to update user", e);
            setUpdateError("Failed to update user configuration.");
        } finally {
            setIsUpdating(false);
        }
    };

    const initiateStatusUpdate = (uid: string, name: string, status: 'APPROVED' | 'REJECTED') => {
        setConfirmAction({ uid, name, type: status });
    };

    const confirmStatusUpdate = async () => {
        if (!onUpdateStatus || !confirmAction) return;
        if (confirmAction.type === 'SYNC' || confirmAction.type === 'DELETE') return;

        setProcessingId(confirmAction.uid);
        try {
            await onUpdateStatus(confirmAction.uid, confirmAction.type);
        } catch (e) {
            console.error(e);
            toast.error("Failed to update status. Please try again.");
        } finally {
            setProcessingId(null);
            setConfirmAction(null);
        }
    };

    const togglePermission = (role: UserRole, permission: Permission) => {
        if (!editedPermissions) return;

        const currentPerms = editedPermissions[role] || [];
        const hasPerm = currentPerms.includes(permission);

        let newPerms: Permission[];
        if (hasPerm) {
            newPerms = currentPerms.filter(p => p !== permission);
        } else {
            newPerms = [...currentPerms, permission];
        }

        setEditedPermissions({
            ...editedPermissions,
            [role]: newPerms
        });
    };

    const savePermissions = async () => {
        if (!onUpdatePermissions || !editedPermissions) return;
        setSavingPerms(true);
        try {
            await onUpdatePermissions(editedPermissions);
            toast.success("Access permissions updated successfully.");
        } catch (e) {
            toast.error("Failed to save permissions.");
        } finally {
            setSavingPerms(false);
        }
    };

    const handleSyncCustomer = async (user: UserProfile) => {
        if (!onSyncProfile) {
            toast.warning("Sync capability not available.");
            return;
        }

        // Use existing modal state for confirmation
        setConfirmAction({ uid: user.uid, name: user.name, type: 'SYNC' });
    };

    const executeSync = async () => {
        if (!confirmAction || confirmAction.type !== 'SYNC') return;
        const user = users.find(u => u.uid === confirmAction.uid);
        if (!user || !onSyncProfile) return;

        setSyncingId(user.uid);
        try {
            await onSyncProfile(user);
            toast.success("Customer synced successfully.");
            // After sync, re-fetch customer data to update the modal
            if (editingUser && editingUser.uid === user.uid) {
                await fetchCustomerData(user.uid);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to sync customer.");
        } finally {
            setSyncingId(null);
            setConfirmAction(null);
        }
    };


    return (
        <div className="space-y-6 relative">

            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100 max-w-fit overflow-x-auto">
                <button
                    onClick={() => handleTabChange('ACTIVE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ACTIVE' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    User Accounts ({activeUsers.length})
                </button>
                <button
                    onClick={() => handleTabChange('PENDING')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center whitespace-nowrap ${activeTab === 'PENDING' ? 'bg-yellow-50 text-yellow-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    Pending Approval
                    {pendingUsers.length > 0 && (
                        <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                            {pendingUsers.length}
                        </span>
                    )}
                </button>
                {rolePermissions && onUpdatePermissions && (
                    <button
                        onClick={() => handleTabChange('ACCESS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ACCESS' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Role Permissions
                    </button>
                )}
            </div>

            {activeTab === 'ACCESS' && editedPermissions ? (
                <Card title="Role-Based Feature Access Control" action={
                    <Button onClick={savePermissions} isLoading={savingPerms}>Save Configuration</Button>
                }>
                    <div className="overflow-x-auto">
                        <p className="text-sm text-gray-500 mb-4">
                            Define which features are accessible for each user role. Changes will apply immediately for all users with that role.
                        </p>
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Feature Module</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Accountant</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Finance Mgr</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {FEATURE_LIST.map((feature) => (
                                    <tr key={feature.key} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {feature.label}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['system-admin'].includes(feature.key)}
                                                onChange={() => togglePermission('system-admin', feature.key)}
                                                disabled={feature.key === 'MANAGE_USERS'}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['accountant'].includes(feature.key)}
                                                onChange={() => togglePermission('accountant', feature.key)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['finance-manager'].includes(feature.key)}
                                                onChange={() => togglePermission('finance-manager', feature.key)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['driver'] ? editedPermissions['driver'].includes(feature.key) : false}
                                                onChange={() => togglePermission('driver', feature.key)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['warehouse'] ? editedPermissions['warehouse'].includes(feature.key) : false}
                                                onChange={() => togglePermission('warehouse', feature.key)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded cursor-pointer"
                                                checked={editedPermissions['customer'] ? editedPermissions['customer'].includes(feature.key) : false}
                                                onChange={() => togglePermission('customer', feature.key)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                <Card title={activeTab === 'ACTIVE' ? "System Users" : "Pending Approvals"}>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch/Wallet</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                                    {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {displayedUsers.map((user) => (
                                    <tr key={user.uid} className={`hover:bg-gray-50 transition-colors ${user.status === 'INACTIVE' ? 'bg-red-50/50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <Avatar name={user.name} size="md" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize 
                        ${user.role === 'system-admin' ? 'bg-purple-100 text-purple-800' :
                                                    user.role === 'finance-manager' ? 'bg-blue-100 text-blue-800' :
                                                        user.role === 'driver' ? 'bg-orange-100 text-orange-800' :
                                                            user.role === 'warehouse' ? 'bg-indigo-100 text-indigo-800' :
                                                                user.role === 'customer' ? 'bg-teal-100 text-teal-800' :
                                                                    'bg-green-100 text-green-800'}`}>
                                                {(user.role || '').replace('-', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${user.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                'bg-red-50 text-red-700 border border-red-200'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.managedBranchId && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">
                                                    Branch: {branches.find(b => b.id === user.managedBranchId)?.name || 'Unknown'}
                                                </span>
                                            )}
                                            {user.walletAccountId && (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 ml-1">
                                                    Custom Wallet
                                                </span>
                                            )}
                                            {!user.managedBranchId && !user.walletAccountId && <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.lastLogin
                                                ? new Date(user.lastLogin).toLocaleDateString()
                                                : <span className="text-gray-400 italic">Never</span>}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {activeTab === 'ACTIVE' ? (
                                                    <div className="flex justify-end items-center">
                                                        {user.role === 'customer' && !user.linkedCustomerId && onSyncProfile && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSyncCustomer(user); }}
                                                                disabled={syncingId === user.uid}
                                                                className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 mr-2 disabled:opacity-50 disabled:cursor-wait"
                                                                title="Create missing CRM record"
                                                            >
                                                                {syncingId === user.uid ? 'Syncing...' : 'Sync Profile'}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEditClick(user)}
                                                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                        >
                                                            Manage
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end space-x-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); initiateStatusUpdate(user.uid, user.name, 'REJECTED'); }}
                                                            disabled={processingId === user.uid}
                                                            className={`text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded border border-red-100 text-xs font-bold ${processingId === user.uid ? 'opacity-50 cursor-wait' : ''}`}
                                                        >
                                                            {processingId === user.uid ? '...' : 'Reject'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); initiateStatusUpdate(user.uid, user.name, 'APPROVED'); }}
                                                            disabled={processingId === user.uid}
                                                            className={`text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded border border-green-100 text-xs font-bold ${processingId === user.uid ? 'opacity-50 cursor-wait' : ''}`}
                                                        >
                                                            {processingId === user.uid ? 'Processing...' : 'Approve'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {displayedUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-gray-500 text-sm">
                                            <p>No users found in this category.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {confirmAction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            {confirmAction.type === 'APPROVED' ? (
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            ) : confirmAction.type === 'SYNC' ? (
                                <div className="bg-blue-100 p-3 rounded-full">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </div>
                            ) : (
                                <div className="bg-red-100 p-3 rounded-full">
                                    <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </div>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                            {confirmAction.type === 'APPROVED' ? 'Confirm Approval' : confirmAction.type === 'SYNC' ? 'Sync Customer Profile' : confirmAction.type === 'DELETE' ? 'Delete User' : 'Confirm Rejection'}
                        </h3>
                        <p className="text-center text-gray-600 mb-6 text-sm">
                            {confirmAction.type === 'SYNC'
                                ? <span>Create a CRM customer record for <strong>{confirmAction.name}</strong>?<br />This will allow them to book parcels and track history.</span>
                                : confirmAction.type === 'DELETE'
                                    ? <span>Are you sure you want to permanently delete <strong>{confirmAction.name}</strong>?
                                        {confirmAction.extra?.linkedCustomerId && <br />}
                                        {confirmAction.extra?.linkedCustomerId && <span className="text-red-600 font-bold">Warning: This will also delete their linked Customer Data!</span>}
                                        <br />This action cannot be undone.</span>
                                    : <span>Are you sure you want to {confirmAction.type === 'APPROVED' ? 'approve' : 'reject'} <strong>{confirmAction.name}</strong>?
                                        {confirmAction.type === 'APPROVED' ? ' They will gain access to the dashboard immediately.' : ' Their access will be blocked.'}</span>
                            }
                        </p>
                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setConfirmAction(null)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmAction.type === 'SYNC' ? executeSync : confirmAction.type === 'DELETE' ? confirmDeleteUser : confirmStatusUpdate}
                                className={`w-full justify-center ${confirmAction.type === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : confirmAction.type === 'SYNC' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                isLoading={!!processingId || !!syncingId}
                            >
                                {confirmAction.type === 'DELETE' ? 'Delete Permanently' : 'Confirm'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {
                editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-fade-in-up flex flex-col max-h-[95vh]">
                            <div className="px-6 py-4 border-b border-gray-100 flex flex-col bg-gray-50">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Manage User Account</h3>
                                    <button onClick={handleCancelUserEdit} className="text-gray-400 hover:text-gray-500">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex space-x-4 border-b border-gray-200">
                                    <button
                                        onClick={() => setActiveModalTab('USER')}
                                        className={`pb-2 text-sm font-medium ${activeModalTab === 'USER' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        User Account
                                    </button>
                                    {selectedRole === 'customer' && (
                                        <button
                                            onClick={() => setActiveModalTab('CUSTOMER')}
                                            className={`pb-2 text-sm font-medium ${activeModalTab === 'CUSTOMER' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Customer Data
                                        </button>
                                    )}
                                    {(selectedRole === 'driver' || selectedRole === 'warehouse') && (
                                        <button
                                            onClick={() => setActiveModalTab('EMPLOYEE')}
                                            className={`pb-2 text-sm font-medium ${activeModalTab === 'EMPLOYEE' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Employee Data
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto">
                                {activeModalTab === 'USER' ? (
                                    <>
                                        {/* Profile Section */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">Profile Information</h4>
                                            <div className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-2">
                                                <Avatar name={editingUser.name} size="md" />
                                                <div>
                                                    <p className="text-xs text-gray-500 font-mono">{editingUser.email}</p>
                                                    <p className="text-[10px] text-gray-400">UID: {editingUser.uid.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input label="Full Name" value={editName} onChange={e => setEditName(e.target.value)} />
                                                <Input label="Phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+855..." />
                                            </div>
                                        </div>

                                        {/* Access Section */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">Access Control</h4>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
                                                    <select
                                                        className={`block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 sm:text-sm font-bold ${selectedStatus === 'APPROVED' ? 'text-green-700 border-green-200 bg-green-50' : 'text-red-700 border-red-200 bg-red-50'
                                                            }`}
                                                        value={selectedStatus}
                                                        onChange={(e) => setSelectedStatus(e.target.value as UserStatus)}
                                                    >
                                                        <option value="APPROVED">Active (Approved)</option>
                                                        <option value="INACTIVE">Deactivated</option>
                                                        <option value="PENDING">Pending Review</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
                                                    <select
                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm capitalize"
                                                        value={selectedRole}
                                                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                                    >
                                                        <option value="system-admin">System Admin</option>
                                                        <option value="accountant">Accountant</option>
                                                        <option value="finance-manager">Finance Manager</option>
                                                        <option value="warehouse">Warehouse Staff</option>
                                                        <option value="driver">Driver</option>
                                                        <option value="customer">Customer</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Operational Context */}
                                        {(selectedRole === 'warehouse' || selectedRole === 'driver' || selectedRole === 'customer') && (
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">Operational Context</h4>

                                                {selectedRole === 'warehouse' && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Branch (Warehouse)</label>
                                                        <select
                                                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                            value={selectedBranchId}
                                                            onChange={(e) => setSelectedBranchId(e.target.value)}
                                                        >
                                                            <option value="">-- Select Branch --</option>
                                                            {branches.map(b => (
                                                                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Customer Data Tab */
                                    <div className="space-y-6">
                                        {!customerData ? (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                <p className="text-sm text-yellow-800 mb-3">
                                                    This user doesn't have a linked customer record yet. Create one to manage custom billing and details.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (editingUser) handleSyncCustomer(editingUser);
                                                    }}
                                                    className="text-sm"
                                                >
                                                    Create Customer Record
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-6">

                                                    {/* Exchange Rate Preferences */}
                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Exchange Rate Preferences</h3>

                                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                                                <h4 className="text-sm font-bold text-blue-900 mb-1">Daily Exchange Rate</h4>
                                                                <p className="text-xs text-blue-700">
                                                                    Set the exchange rate (USD to KHR) that drivers should use when collecting cash for your COD parcels. If you leave this blank, the system default (4,000) will be applied.
                                                                </p>
                                                            </div>

                                                            <div className="flex items-end gap-3">
                                                                <div className="flex-1">
                                                                    <label className="text-sm font-medium text-gray-700 block mb-1">Your Custom Rate (KHR)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={customExchangeRate || ''}
                                                                        onChange={e => setCustomExchangeRate(parseFloat(e.target.value) || undefined)}
                                                                        placeholder="4100"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="primary" // Using default red/primary
                                                                    className="mb-[1px]" // Align with input
                                                                    onClick={handleSaveCustomExchangeRate}
                                                                    isLoading={savingBilling}
                                                                >
                                                                    Update Rate
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Tax Configuration</h3>
                                                            <div className="flex items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                                                                <input
                                                                    id="isTaxableCust"
                                                                    type="checkbox"
                                                                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                                    checked={isTaxable}
                                                                    onChange={(e) => setIsTaxable(e.target.checked)}
                                                                    disabled={savingBilling}
                                                                />
                                                                <div className="ml-3">
                                                                    <label htmlFor="isTaxableCust" className="block text-sm font-bold text-gray-900">
                                                                        Apply VAT/Tax on Transactions?
                                                                    </label>
                                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                                        If checked, transactions for this customer will automatically trigger tax calculations based on global system settings.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 flex justify-end">
                                                                <Button
                                                                    variant="primary"
                                                                    onClick={handleSaveCustomerDetails} // Re-using main save for convenience, though it saves all
                                                                    isLoading={savingBilling}
                                                                >
                                                                    Save Tax Setting
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Special Rates */}
                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Special Rates</h3>

                                                            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-4">
                                                                <h4 className="text-sm font-bold text-purple-900 mb-1">Custom Pricing</h4>
                                                                <p className="text-xs text-purple-700">
                                                                    Override the default price for specific services. These rates will be automatically applied when this customer books a parcel.
                                                                </p>
                                                            </div>

                                                            <div className="space-y-3 mb-6">
                                                                {loadingRates ? (
                                                                    <p className="text-sm text-gray-500 italic">Loading rates...</p>
                                                                ) : specialRates.length > 0 ? (
                                                                    specialRates.map(rate => (
                                                                        <div key={rate.id} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-100">
                                                                            <div>
                                                                                <div className="font-bold text-gray-900">{rate.serviceName}</div>
                                                                                <div className="text-xs text-gray-500">Standard Price Override</div>
                                                                            </div>
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="text-xs text-gray-500 flex flex-col items-end">
                                                                                    <span>{rate.startDate}</span>
                                                                                    <span className="text-[10px]">to {rate.endDate}</span>
                                                                                </div>
                                                                                <div className="flex flex-col gap-1">
                                                                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-sm">
                                                                                        ${rate.price.toFixed(2)}
                                                                                    </span>
                                                                                    {rate.priceKHR && (
                                                                                        <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
                                                                                            {rate.priceKHR.toLocaleString()}៛
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleDeleteRate(rate.id)}
                                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                                                >
                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-center py-4 border-2 border-dashed border-gray-100 rounded-lg">
                                                                        <p className="text-xs text-gray-400">No special rates configured</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-2 items-end">
                                                                <div className="flex-1">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Service</label>
                                                                    <select
                                                                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={newRateServiceId}
                                                                        onChange={e => setNewRateServiceId(e.target.value)}
                                                                    >
                                                                        <option value="">Select Service...</option>
                                                                        {serviceTypes.map(s => (
                                                                            <option key={s.id} value={s.id}>{s.name} (${s.defaultPrice})</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="w-24">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">USD ($)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={newRatePrice}
                                                                        onChange={e => setNewRatePrice(e.target.value)}
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                                <div className="w-28">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">KHR (៛)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={newRatePriceKHR}
                                                                        onChange={e => setNewRatePriceKHR(e.target.value)}
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                                <div className="w-32">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Start Date</label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={newRateStartDate}
                                                                        onChange={e => setNewRateStartDate(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="w-32">
                                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">End Date</label>
                                                                    <input
                                                                        type="date"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                                        value={newRateEndDate}
                                                                        onChange={e => setNewRateEndDate(e.target.value)}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    onClick={handleAddRate}
                                                                    disabled={!newRateServiceId || !newRatePrice}
                                                                    className="mb-[1px]"
                                                                >
                                                                    Add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>


                                                    {/* Bank Accounts */}
                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Bank Accounts</h3>

                                                            <div className="space-y-3">
                                                                {customerBankAccounts.length > 0 && customerBankAccounts.map(bank => (
                                                                    <div key={bank.id || bank.accountNumber} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-bold text-gray-900">{bank.bankName}</h4>
                                                                                <p className="text-sm text-gray-500">{bank.accountNumber}</p>
                                                                                {bank.accountName && <p className="text-xs text-gray-400">{bank.accountName}</p>}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRemoveBankAccount(bank.id || bank.accountNumber)}
                                                                            className="text-sm text-red-500 hover:text-red-700 font-medium"
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                <button
                                                                    onClick={() => setShowAddBankModal(true)}
                                                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                                    Add Bank Account ({customerBankAccounts.length}/5)
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Saved Locations */}
                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Saved Locations</h3>

                                                            <div className="space-y-3">
                                                                {custSavedLocations.length > 0 && custSavedLocations.map(loc => (
                                                                    <div key={loc.id} className="border border-gray-200 rounded-lg p-4 relative group">
                                                                        <div className="flex justify-between items-start">
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <h4 className="font-bold text-gray-900">{loc.label}</h4>
                                                                                    {loc.isPrimary && (
                                                                                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded">PRIMARY</span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-sm text-gray-600 mb-1">{loc.address}</p>
                                                                                {loc.coordinates && (
                                                                                    <p className="text-xs text-mono text-gray-400">{loc.coordinates.lat.toFixed(5)}, {loc.coordinates.lng.toFixed(5)}</p>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col items-end gap-2">
                                                                                <button
                                                                                    onClick={() => handleRemoveLocation(loc.id)}
                                                                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                                                                >
                                                                                    Delete
                                                                                </button>
                                                                                {!loc.isPrimary && (
                                                                                    <button
                                                                                        onClick={() => handleSetPrimaryLocation(loc.id)}
                                                                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                                                                    >
                                                                                        Set Primary
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                <button
                                                                    onClick={() => setShowAddLocationModal(true)}
                                                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                                    Add New Location
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Employee Data Tab */}
                                {activeModalTab === 'EMPLOYEE' && (
                                    <div className="space-y-6">
                                        {!employeeData ? (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                <p className="text-sm text-yellow-800 mb-3">
                                                    This user doesn't have a linked employee record yet. Create one to manage HR and payroll details.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    onClick={async () => {
                                                        if (editingUser) {
                                                            const employee = await firebaseService.hrService.createEmployeeForUser(
                                                                editingUser.uid,
                                                                editingUser.name,
                                                                selectedRole === 'driver'
                                                            );
                                                            setEmployeeData(employee);
                                                            toast.success('Employee record created!');
                                                        }
                                                    }}
                                                    className="text-sm"
                                                >
                                                    Create Employee Record
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Employment Info */}
                                                <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                    <div className="p-6">
                                                        <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Employment Information</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <Input label="Position" value={empPosition} onChange={e => setEmpPosition(e.target.value)} />
                                                            <Input label="Department" value={empDepartment} onChange={e => setEmpDepartment(e.target.value)} />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                                                                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={empHireDate} onChange={e => setEmpHireDate(e.target.value)} />
                                                            </div>
                                                            <Input label="Monthly Salary (USD)" type="number" value={empSalary || ''} onChange={e => setEmpSalary(parseFloat(e.target.value) || undefined)} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Driver-Specific Fields */}
                                                {empIsDriver && (
                                                    <div className="bg-white border text-card-foreground shadow-sm rounded-xl overflow-hidden">
                                                        <div className="p-6">
                                                            <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">Driver Information</h3>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <Input label="Vehicle Type" value={empVehicleType} onChange={e => setEmpVehicleType(e.target.value)} />
                                                                <Input label="Plate Number" value={empVehiclePlate} onChange={e => setEmpVehiclePlate(e.target.value)} />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                                <Input label="License Number" value={empLicenseNumber} onChange={e => setEmpLicenseNumber(e.target.value)} />
                                                                <Input label="Zone Assignment" value={empZone} onChange={e => setEmpZone(e.target.value)} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Save Button */}
                                                <div className="flex justify-end">
                                                    <Button
                                                        onClick={async () => {
                                                            if (!employeeData) return;
                                                            const updated = {
                                                                ...employeeData,
                                                                position: empPosition,
                                                                department: empDepartment,
                                                                hireDate: empHireDate,
                                                                baseSalaryAmount: empSalary,
                                                                hasBaseSalary: !!empSalary,
                                                                vehicleType: empVehicleType,
                                                                vehiclePlateNumber: empVehiclePlate,
                                                                licenseNumber: empLicenseNumber,
                                                                zone: empZone
                                                            };
                                                            await firebaseService.hrService.updateEmployee(updated);
                                                            setEmployeeData(updated);
                                                            toast.success('Employee data updated!');
                                                        }}
                                                        isLoading={savingBilling}
                                                    >
                                                        Save Employee Data
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {updateError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                        {updateError}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                <div>
                                    {activeModalTab === 'USER' && (
                                        <button
                                            onClick={handleDeleteUser}
                                            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors font-medium text-sm"
                                        >
                                            Delete User
                                        </button>
                                    )}
                                </div>
                                <div className="flex space-x-3">
                                    <Button variant="outline" onClick={handleCancelUserEdit} disabled={isUpdating || savingBilling}>Cancel</Button>
                                    {activeModalTab === 'USER' ? (
                                        <Button onClick={handleUserSave} isLoading={isUpdating} disabled={isUpdating}>Save Changes</Button>
                                    ) : (
                                        <Button onClick={handleSaveCustomerDetails} isLoading={savingBilling} disabled={!customerData || savingBilling}>Save Customer Data</Button>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                )
            }

            {/* Add Bank Account Modal */}
            {
                showAddBankModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Bank Account</h3>
                            <div className="space-y-4">
                                <Input
                                    label="Bank Name"
                                    value={newBankName}
                                    onChange={e => setNewBankName(e.target.value)}
                                    placeholder="e.g. ABA Bank"
                                />
                                <Input
                                    label="Account Name"
                                    value={newAccountName}
                                    onChange={e => setNewAccountName(e.target.value)}
                                    placeholder="Account holder name"
                                />
                                <Input
                                    label="Account Number"
                                    value={newAccountNumber}
                                    onChange={e => setNewAccountNumber(e.target.value)}
                                    placeholder="Account number"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => {
                                    setShowAddBankModal(false);
                                    setNewBankName('');
                                    setNewAccountName('');
                                    setNewAccountNumber('');
                                }}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddBankAccount}>
                                    Add Account
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Location Modal */}
            {
                showAddLocationModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Location</h3>
                            <div className="space-y-4">
                                <Input
                                    label="Label (e.g. Home, Office)"
                                    value={newLocationLabel}
                                    onChange={e => setNewLocationLabel(e.target.value)}
                                    placeholder="Home, Office, Warehouse A..."
                                />
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">Address / Coordinates</label>
                                    <PlaceAutocomplete
                                        value={newLocationAddress}
                                        onChange={setNewLocationAddress}
                                        onSelect={(place) => {
                                            setNewLocationAddress(place.address || place.name);
                                            if (place.location) {
                                                setNewLocationLat(place.location.lat.toString());
                                                setNewLocationLng(place.location.lng.toString());
                                            }
                                        }}
                                        onPickMap={() => setShowLocationMapPicker(true)}
                                        placeholder="Enter address or select on map"
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                                    />
                                    {(newLocationLat && newLocationLng) && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            📍 {newLocationLat}, {newLocationLng}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Latitude (Optional)"
                                        value={newLocationLat}
                                        onChange={e => setNewLocationLat(e.target.value)}
                                        placeholder="11.5564"
                                    />
                                    <Input
                                        label="Longitude (Optional)"
                                        value={newLocationLng}
                                        onChange={e => setNewLocationLng(e.target.value)}
                                        placeholder="104.9282"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => {
                                    setShowAddLocationModal(false);
                                    setNewLocationLabel('');
                                    setNewLocationAddress('');
                                    setNewLocationLat('');
                                    setNewLocationLng('');
                                }}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddLocation}>
                                    Add Location
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Location Map Picker */}
            {showLocationMapPicker && (
                <LocationPicker
                    onClose={() => setShowLocationMapPicker(false)}
                    onConfirm={(lat, lng, address) => {
                        setNewLocationAddress(address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                        setNewLocationLat(lat.toString());
                        setNewLocationLng(lng.toString());
                        setShowLocationMapPicker(false);
                    }}
                />
            )}
        </div >
    );
};
