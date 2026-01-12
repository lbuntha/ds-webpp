import React, { useState, useEffect } from 'react';
import { ParcelServiceType, Account, TaxRate } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { toast } from '../../src/shared/utils/toast';
import { ParcelServiceForm } from './ParcelServiceForm';
import { Package, Plus, Edit2, Trash2 } from 'lucide-react';

interface Props {
    accounts: Account[];
    taxRates: TaxRate[];
    onBookService?: (serviceId: string) => void;
}

export const ParcelServiceSetup: React.FC<Props> = ({ accounts, taxRates, onBookService }) => {
    const [services, setServices] = useState<ParcelServiceType[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<ParcelServiceType | null>(null);

    // Delete confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const loadServices = async () => {
        const data = await firebaseService.getParcelServices();
        setServices(data);
    };

    useEffect(() => {
        loadServices();
    }, []);

    const handleAddNew = () => {
        setEditingService(null);
        setIsModalOpen(true);
    };

    const handleEdit = (service: ParcelServiceType) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    const handleSave = async (formData: Partial<ParcelServiceType>) => {
        setLoading(true);
        try {
            const newService: ParcelServiceType = {
                id: editingService ? editingService.id : `ps-${Date.now()}`,
                name: formData.name!,
                nameKH: formData.nameKH,
                defaultPrice: formData.defaultPrice!,
                pricePerKm: formData.pricePerKm || 0,
                defaultPriceKHR: formData.defaultPriceKHR || 0,
                pricePerKmKHR: formData.pricePerKmKHR || 0,
                revenueAccountId: editingService ? editingService.revenueAccountId : undefined, // Preserve if existing, logic handled elsewhere or deprecated
                description: formData.description,
                image: formData.image,
                taxRateId: formData.taxRateId,
                rule: formData.rule,
                ruleKH: formData.ruleKH,
            };

            await firebaseService.saveParcelService(newService);
            handleCloseModal();
            await loadServices();
            toast.success(editingService ? "Service updated." : "Service created.");
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
            await loadServices();
            toast.success("Service deleted.");
        } catch (e) {
            toast.error("Failed to delete service.");
        } finally {
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Configured Services</h3>
                <Button onClick={handleAddNew} className="flex items-center gap-2">
                    <Plus size={16} />
                    Add New Service
                </Button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
                <ul role="list" className="divide-y divide-gray-200">
                    {services.length === 0 ? (
                        <li className="px-6 py-12 text-center text-gray-500">
                            <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <p>No services configured yet.</p>
                            <Button variant="outline" onClick={handleAddNew} className="mt-4">
                                Create your first service
                            </Button>
                        </li>
                    ) : (
                        services.map((service) => (
                            <li key={service.id}>
                                <div className="px-4 py-4 flex items-center sm:px-6 hover:bg-gray-50 transition-colors duration-150">
                                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                                                {service.image ? (
                                                    <img className="h-full w-full object-cover" src={service.image} alt={service.name} />
                                                ) : (
                                                    <Package className="h-6 w-6 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-gray-900 truncate">{service.name}</p>
                                                    {service.nameKH && <span className="text-xs text-gray-500 font-medium px-1.5 py-0.5 bg-gray-100 rounded">{service.nameKH}</span>}
                                                </div>
                                                <div className="mt-1 flex items-center text-sm text-gray-500 gap-4">
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-medium text-gray-900">${service.defaultPrice}</span> base
                                                    </span>
                                                    <span className="text-gray-300">|</span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-medium text-gray-900">${service.pricePerKm}</span> / km
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ml-5 flex-shrink-0 flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(service)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={18} />
                                        </button>

                                        {confirmDeleteId === service.id ? (
                                            <div className="flex items-center gap-2 bg-red-50 p-1 rounded-full animate-in fade-in slide-in-from-right-4 duration-200">
                                                <span className="text-xs text-red-600 font-medium px-2">Confirm?</span>
                                                <button
                                                    onClick={() => executeDelete(service.id)}
                                                    className="p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                                                    title="Yes, delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="p-1 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300"
                                                    title="Cancel"
                                                >
                                                    <span className="sr-only">Cancel</span>
                                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDeleteId(service.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingService ? `Edit ${editingService.name}` : "Add New Service"}
                maxWidth="max-w-3xl"
            >
                <ParcelServiceForm
                    initialData={editingService}
                    taxRates={taxRates}
                    onSave={handleSave}
                    onCancel={handleCloseModal}
                    isLoading={loading}
                />
            </Modal>
        </div>
    );
};
