import React, { useState, useEffect } from 'react';
import { Employee, UserProfile, Branch } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

interface Props {
    branches?: Branch[];
}

export const DriverManagement: React.FC<Props> = ({ branches = [] }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ emp: Employee, newStatus: 'ACTIVE' | 'INACTIVE' } | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleType, setVehicleType] = useState('TUKTUK');
    const [plateNumber, setPlateNumber] = useState('');
    const [branchId, setBranchId] = useState('');
    const [linkedUserId, setLinkedUserId] = useState('');
    const [zone, setZone] = useState(''); // NEW

    const loadData = async () => {
        setLoading(true);
        try {
            const [empData, userData] = await Promise.all([
                firebaseService.getEmployees(),
                firebaseService.getUsers()
            ]);
            setEmployees(empData.filter(e => e.isDriver));
            setUsers(userData.filter(u => u.role === 'driver'));
        } catch (e) {
            console.error("Load data failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const openAdd = () => {
        setEditingId(null);
        setName('');
        setPhone('');
        setVehicleType('TUKTUK');
        setPlateNumber('');
        setBranchId('');
        setLinkedUserId('');
        setZone(''); // Reset
        setIsFormOpen(true);
    };

    const openEdit = (e: Employee) => {
        setEditingId(e.id);
        setName(e.name);
        setPhone(e.phone || '');
        setVehicleType(e.vehicleType || 'TUKTUK');
        setPlateNumber(e.vehiclePlateNumber || '');
        setBranchId(e.branchId || '');
        setLinkedUserId(e.linkedUserId || '');
        setZone(e.zone || ''); // Load
        setIsFormOpen(true);
    };

    const handleUserLinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const uid = e.target.value;
        setLinkedUserId(uid);

        if (uid) {
            const user = users.find(u => u.uid === uid);
            if (user) {
                if (!name) setName(user.name);
                if (!phone && user.phone) setPhone(user.phone);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setLoading(true);

        const existing = employees.find(e => e.id === editingId);
        const status = existing?.status || 'ACTIVE';

        const employee: Employee = {
            id: editingId || `emp-${Date.now()}`,
            name: name.trim(),
            phone: phone.trim(),
            position: 'Driver',
            department: 'Logistics',
            isDriver: true,
            status,
            vehicleType,
            vehiclePlateNumber: plateNumber.trim(),
            branchId: branchId || null,
            linkedUserId: linkedUserId || null,
            zone: zone.trim() || undefined, // Save
            createdAt: existing?.createdAt || Date.now()
        };

        try {
            if (editingId) await firebaseService.updateEmployee(employee);
            else await firebaseService.addEmployee(employee);
            setIsFormOpen(false);
            await loadData();
            toast.success(editingId ? "Driver updated." : "Driver profile created.");
        } catch (err: any) {
            console.error("Save driver error:", err);
            toast.error(`Failed to save driver: ${err.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const initiateStatusToggle = (e: React.MouseEvent, emp: Employee) => {
        e.preventDefault();
        e.stopPropagation();
        const newStatus = emp.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
        setConfirmModal({ emp, newStatus });
    };

    const executeStatusToggle = async () => {
        if (!confirmModal) return;
        const { emp, newStatus } = confirmModal;

        setLoading(true);
        try {
            const updatedEmp: Employee = {
                ...emp,
                status: newStatus
            };

            await firebaseService.updateEmployee(updatedEmp);
            await loadData();
            toast.success(`Driver ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
            setConfirmModal(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to update status");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Fleet Management</h2>
                {!isFormOpen && <Button onClick={openAdd}>+ Add Driver</Button>}
            </div>

            {isFormOpen && (
                <Card title={editingId ? "Edit Driver" : "New Driver Profile"}>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <label className="block text-sm font-bold text-indigo-900 mb-1">Link to System User (App Login)</label>
                            <select
                                className="block w-full px-3 py-2 border border-indigo-300 rounded-lg shadow-sm focus:ring-indigo-500 sm:text-sm"
                                value={linkedUserId}
                                onChange={handleUserLinkChange}
                            >
                                <option value="">-- No App Login (Manual Record Only) --</option>
                                {users.map(u => (
                                    <option key={u.uid} value={u.uid}>
                                        {u.name} ({u.email})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-indigo-700 mt-1">
                                Linking enables this driver to log in to the Driver App and receive jobs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Driver Name" value={name} onChange={e => setName(e.target.value)} required />
                            <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} required />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500"
                                    value={vehicleType}
                                    onChange={e => setVehicleType(e.target.value)}
                                >
                                    <option value="MOTO">Motorbike</option>
                                    <option value="TUKTUK">Tuktuk</option>
                                    <option value="CAR">Car/Sedan</option>
                                    <option value="TRUCK">Truck/Van</option>
                                </select>
                            </div>
                            <Input label="License Plate" value={plateNumber} onChange={e => setPlateNumber(e.target.value)} required placeholder="e.g. 1A-1234" />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Home Branch (Warehouse)</label>
                                <select
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500"
                                    value={branchId}
                                    onChange={e => setBranchId(e.target.value)}
                                >
                                    <option value="">-- None / Roaming --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Input
                                    label="Zone / Commission Rule"
                                    value={zone}
                                    onChange={e => setZone(e.target.value)}
                                    placeholder="e.g. Phnom Penh Standard"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Enter the exact name of a Commission Rule (see Settings).</p>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                            <Button type="submit" isLoading={loading}>Save Profile</Button>
                        </div>
                    </form>
                </Card>
            )}

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employees.map(emp => (
                        <div key={emp.id} className={`border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow bg-white relative ${emp.status === 'INACTIVE' ? 'border-red-200 bg-red-50/50' : 'border-gray-200'}`}>
                            <div className="flex items-center space-x-4">
                                {emp.linkedUserId && (
                                    <div className="absolute top-2 right-2" title="App Connected">
                                        <span className="flex h-2 w-2 relative">
                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${emp.status === 'INACTIVE' ? 'bg-gray-400' : 'bg-green-400'}`}></span>
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${emp.status === 'INACTIVE' ? 'bg-gray-500' : 'bg-green-500'}`}></span>
                                        </span>
                                    </div>
                                )}
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${emp.status === 'INACTIVE' ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {emp.vehicleType === 'MOTO' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                    {emp.vehicleType !== 'MOTO' && <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900">{emp.name}</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${emp.status === 'INACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {emp.status || 'ACTIVE'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">{emp.vehicleType} • {emp.vehiclePlateNumber}</p>
                                    <p className="text-xs text-indigo-600 font-medium">{emp.phone}</p>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {emp.branchId && (
                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                                {branches.find(b => b.id === emp.branchId)?.code || 'Branch'}
                                            </span>
                                        )}
                                        {emp.zone && (
                                            <span className="text-[10px] bg-blue-50 px-2 py-0.5 rounded text-blue-700 border border-blue-100">
                                                Rule: {emp.zone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    onClick={(e) => initiateStatusToggle(e, emp)}
                                    className={`text-xs px-2 py-1 rounded border transition-colors ${emp.status === 'INACTIVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                                >
                                    {emp.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openEdit(emp)}
                                    className="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                >
                                    Edit Profile
                                </button>
                            </div>
                        </div>
                    ))}
                    {employees.length === 0 && <p className="text-gray-500 col-span-3 text-center py-8">No drivers registered.</p>}
                </div>
            </Card>

            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                            Confirm {confirmModal.newStatus === 'INACTIVE' ? 'Deactivation' : 'Activation'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-6">
                            Are you sure you want to {confirmModal.newStatus === 'INACTIVE' ? 'deactivate' : 'activate'} <strong>{confirmModal.emp.name}</strong>?
                            {confirmModal.newStatus === 'INACTIVE' && " They will not be able to receive new job assignments."}
                        </p>
                        <div className="flex justify-end space-x-3">
                            <Button variant="outline" onClick={() => setConfirmModal(null)}>Cancel</Button>
                            <Button
                                onClick={executeStatusToggle}
                                variant={confirmModal.newStatus === 'INACTIVE' ? 'danger' : 'primary'}
                                isLoading={loading}
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
