import React, { useState, useEffect } from 'react';
import { Customer, UserProfile } from '../src/shared/types';
import { firebaseService } from '../src/shared/services/firebaseService';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { toast } from '../src/shared/utils/toast';

interface Props {
    customers: Customer[];
    users: UserProfile[];
    onRefresh: () => void;
}

export const CustomerList: React.FC<Props> = ({ customers, users, onRefresh }) => {
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [type, setType] = useState<'INDIVIDUAL' | 'CORPORATE'>('INDIVIDUAL');
    const [linkedUserId, setLinkedUserId] = useState<string>('');

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (editingCustomer) {
            setName(editingCustomer.name);
            setPhone(editingCustomer.phone || '');
            setEmail(editingCustomer.email || '');
            setAddress(editingCustomer.address || '');
            setReferralCode(editingCustomer.referralCode || '');
            setType(editingCustomer.type || 'INDIVIDUAL');
            setLinkedUserId(editingCustomer.linkedUserId || '');
        } else {
            resetForm();
        }
    }, [editingCustomer]);

    const resetForm = () => {
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setReferralCode('');
        setType('INDIVIDUAL');
        setLinkedUserId('');
    };

    const handleCreateClick = () => {
        setEditingCustomer(null);
        resetForm();
        setIsCreating(true);
    };

    const handleEditClick = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsCreating(false);
    };

    const handleDeleteClick = (id: string) => {
        setShowDeleteConfirm(id);
    };

    const confirmDelete = async () => {
        if (!showDeleteConfirm) return;
        try {
            await firebaseService.deleteDocument('customers', showDeleteConfirm);
            toast.success('Customer deleted successfully');
            onRefresh();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete customer');
        } finally {
            setShowDeleteConfirm(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload: Partial<Customer> = {
                name,
                phone,
                email,
                address,
                referralCode,
                type,
                updatedAt: Date.now()
            };

            if (linkedUserId) {
                payload.linkedUserId = linkedUserId;
            } else {
                // If unselecting, we need to explicitly remove it or handle it in service
                // ideally set to null, but firestore types prefer undefined or string
                // handled by logic below
            }

            if (editingCustomer) {
                // Update
                await firebaseService.updateCustomer({ ...payload, id: editingCustomer.id });
                toast.success('Customer updated');
            } else {
                // Create
                const newId = `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                payload.id = newId;
                payload.createdAt = Date.now();

                await firebaseService.createCustomer(payload as Customer);
                toast.success('Customer created');
            }
            onRefresh();
            setEditingCustomer(null);
            setIsCreating(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to save customer');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || '').includes(searchTerm) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Map users for dropdown
    const availableUsers = users.filter(u => u.status !== 'REJECTED');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Customers</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage customer records and linkages</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search customers..."
                            className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <Button onClick={handleCreateClick}>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Customer
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked User</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">
                                    No customers found matching your search.
                                </td>
                            </tr>
                        ) : (
                            filteredCustomers.map(customer => {
                                const linkedUser = users.find(u => u.uid === customer.linkedUserId);
                                return (
                                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 flex-shrink-0">
                                                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                                                        {(customer.name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                                    <div className="text-xs text-gray-500">{customer.code || customer.id.slice(0, 8)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{customer.phone}</div>
                                            <div className="text-sm text-gray-500">{customer.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.type === 'CORPORATE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {customer.type || 'INDIVIDUAL'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {linkedUser ? (
                                                <div className="flex items-center text-green-600">
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                                    </svg>
                                                    {linkedUser.name}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Unlinked</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEditClick(customer)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(customer.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {(isCreating || editingCustomer) && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setIsCreating(false);
                        setEditingCustomer(null);
                    }}
                    title={isCreating ? "Add New Customer" : "Edit Customer"}
                    maxWidth="max-w-2xl"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone *</label>
                                <input
                                    type="tel"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <textarea
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    rows={3}
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Referral Code</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm uppercase"
                                    value={referralCode}
                                    onChange={e => setReferralCode(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Account Type</label>
                                <select
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    value={type}
                                    onChange={e => setType(e.target.value as any)}
                                >
                                    <option value="INDIVIDUAL">Individual</option>
                                    <option value="CORPORATE">Corporate</option>
                                </select>
                            </div>
                            <div className="col-span-2 border-t pt-4 mt-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Link User Account (Optional)</label>
                                <select
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                    value={linkedUserId}
                                    onChange={e => setLinkedUserId(e.target.value)}
                                >
                                    <option value="">-- No Linked User --</option>
                                    {availableUsers.map(u => (
                                        <option key={u.uid} value={u.uid}>
                                            {u.name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    Linking a user enables them to view this customer's data and bookings.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                            <Button
                                type="submit"
                                className="w-full sm:col-start-2"
                                isLoading={isSaving}
                            >
                                {isCreating ? 'Create Customer' : 'Save Changes'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-3 w-full sm:mt-0 sm:col-start-1"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingCustomer(null);
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-black ring-opacity-5 animate-scale-in">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Delete Customer</h3>
                            <p className="mt-2 text-sm text-gray-500">
                                Are you sure you want to delete this customer? This action cannot be undone.
                            </p>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                                    Cancel
                                </Button>
                                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
