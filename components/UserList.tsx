
import React, { useState, useMemo, useEffect } from 'react';
import { Permission, UserProfile, UserRole, UserStatus, Account, AccountType, Branch } from '../types';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { FEATURE_LIST } from '../constants';
import { firebaseService } from '../services/firebaseService';
import { toast } from '../src/shared/utils/toast';

interface Props {
    users: UserProfile[];
    branches?: Branch[];
    rolePermissions?: Record<UserRole, Permission[]>;
    onUpdateRole?: (uid: string, role: UserRole) => Promise<void>;
    onUpdateStatus?: (uid: string, status: UserStatus) => Promise<void>;
    onUpdateProfile?: (uid: string, name: string, extra: any) => Promise<void>; // New Prop
    onUpdatePermissions?: (permissions: Record<UserRole, Permission[]>) => Promise<void>;
    onSyncProfile?: (user: UserProfile) => Promise<void>;
}

export const UserList: React.FC<Props> = ({ users, branches = [], rolePermissions, onUpdateRole, onUpdateStatus, onUpdateProfile, onUpdatePermissions, onSyncProfile }) => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PENDING' | 'ACCESS'>('ACTIVE');

    // Edit State
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('accountant');
    const [selectedStatus, setSelectedStatus] = useState<UserStatus>('APPROVED');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');

    const [walletAccount, setWalletAccount] = useState('');
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ uid: string; name: string; type: 'APPROVED' | 'REJECTED' } | null>(null);

    const [editedPermissions, setEditedPermissions] = useState<Record<UserRole, Permission[]> | null>(null);
    const [savingPerms, setSavingPerms] = useState(false);

    const isAdmin = !!onUpdateRole;

    useEffect(() => {
        firebaseService.getAccounts().then(accs => {
            setAvailableAccounts(accs.filter(a => a.type === AccountType.LIABILITY && !a.isHeader));
        });
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

    const handleEditClick = (user: UserProfile) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditPhone(user.phone || '');
        setSelectedRole(user.role);
        setSelectedStatus(user.status || 'APPROVED');
        setWalletAccount(user.walletAccountId || '');
        setSelectedBranchId(user.managedBranchId || '');
        setUpdateError(null);
    };

    const handleCancelUserEdit = () => {
        setEditingUser(null);
        setIsUpdating(false);
        setUpdateError(null);
    };

    const handleUserSave = async () => {
        if (!editingUser || !onUpdateRole) return;

        setIsUpdating(true);
        setUpdateError(null);
        try {
            // 1. Update Basic Profile
            if (onUpdateProfile) {
                await onUpdateProfile(editingUser.uid, editName, { phone: editPhone });
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
        setConfirmAction({ uid: user.uid, name: user.name, type: 'SYNC' as any });
    };

    const executeSync = async () => {
        if (!confirmAction || confirmAction.type !== ('SYNC' as any)) return;
        const user = users.find(u => u.uid === confirmAction.uid);
        if (!user || !onSyncProfile) return;

        setSyncingId(user.uid);
        try {
            await onSyncProfile(user);
            toast.success("Customer synced successfully.");
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
                        <div className="flex justify-center mb-4">
                            {confirmAction.type === 'APPROVED' ? (
                                <div className="bg-green-100 p-3 rounded-full">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            ) : confirmAction.type === ('SYNC' as any) ? (
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
                            {confirmAction.type === 'APPROVED' ? 'Confirm Approval' : confirmAction.type === ('SYNC' as any) ? 'Sync Customer Profile' : 'Confirm Rejection'}
                        </h3>
                        <p className="text-center text-gray-600 mb-6 text-sm">
                            {confirmAction.type === ('SYNC' as any)
                                ? <span>Create a CRM customer record for <strong>{confirmAction.name}</strong>?<br />This will allow them to book parcels and track history.</span>
                                : <span>Are you sure you want to {confirmAction.type === 'APPROVED' ? 'approve' : 'reject'} <strong>{confirmAction.name}</strong>?
                                    {confirmAction.type === 'APPROVED' ? ' They will gain access to the dashboard immediately.' : ' Their access will be blocked.'}</span>
                            }
                        </p>
                        <div className="flex space-x-3">
                            <Button variant="outline" onClick={() => setConfirmAction(null)} className="w-full justify-center">
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmAction.type === ('SYNC' as any) ? executeSync : confirmStatusUpdate}
                                className={`w-full justify-center ${confirmAction.type === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : confirmAction.type === ('SYNC' as any) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                isLoading={!!processingId || !!syncingId}
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {
                editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col max-h-[95vh]">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="text-lg font-semibold text-gray-900">Manage User Account</h3>
                                <button onClick={handleCancelUserEdit} className="text-gray-400 hover:text-gray-500">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto">

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

                                        {(selectedRole === 'driver' || selectedRole === 'customer') && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Liability Mapping</label>
                                                <select
                                                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                    value={walletAccount}
                                                    onChange={(e) => setWalletAccount(e.target.value)}
                                                >
                                                    <option value="">-- Use System Default --</option>
                                                    {availableAccounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-gray-400 mt-1">Override the default Liability account for this user's wallet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {updateError && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                        {updateError}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                                <Button variant="outline" onClick={handleCancelUserEdit} disabled={isUpdating}>Cancel</Button>
                                <Button onClick={handleUserSave} isLoading={isUpdating} disabled={isUpdating}>Save Changes</Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
