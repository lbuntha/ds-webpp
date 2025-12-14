
import React, { useState, useEffect } from 'react';
import { Customer, Account, Invoice } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CustomerForm } from './CustomerForm';
import { CustomerSettlementModal } from './CustomerSettlementModal';
import { CustomerRateModal } from './CustomerRateModal'; // Import
import { firebaseService } from '../../services/firebaseService';

interface Props {
  customers: Customer[];
  accounts: Account[]; 
  invoices?: Invoice[]; // Added invoices prop
  onAddCustomer: (customer: Customer) => Promise<void>;
  onUpdateCustomer: (customer: Customer) => Promise<void>;
}

export const CustomerList: React.FC<Props> = ({ customers, accounts, invoices = [], onAddCustomer, onUpdateCustomer }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [viewingQr, setViewingQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Settlement Modal State
  const [settleCustomer, setSettleCustomer] = useState<Customer | null>(null);
  
  // Rate Modal State
  const [rateCustomer, setRateCustomer] = useState<Customer | null>(null);

  const [currentUser, setCurrentUser] = useState<{uid: string, name: string} | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ customer: Customer, newStatus: 'ACTIVE' | 'INACTIVE' } | null>(null);

  useEffect(() => {
      firebaseService.getCurrentUser().then(u => {
          if (u) setCurrentUser({ uid: u.uid, name: u.name });
      });
  }, []);

  const handleAddClick = () => {
    setEditingCustomer(undefined);
    setIsFormOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleSave = async (customer: Customer) => {
    if (editingCustomer) {
      await onUpdateCustomer(customer);
    } else {
      await onAddCustomer(customer);
    }
    setIsFormOpen(false);
    setEditingCustomer(undefined);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingCustomer(undefined);
  };

  const initiateStatusToggle = (e: React.MouseEvent, c: Customer) => {
      e.preventDefault();
      e.stopPropagation();
      const newStatus = c.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
      setConfirmModal({ customer: c, newStatus });
  };

  const executeStatusToggle = async () => {
      if (!confirmModal) return;
      const { customer, newStatus } = confirmModal;
      
      setLoading(true);
      try {
          const updatedCustomer: Customer = {
              ...customer,
              status: newStatus,
              bankAccounts: customer.bankAccounts || []
          };

          await onUpdateCustomer(updatedCustomer);
          setConfirmModal(null);
      } catch(e) {
          console.error(e);
          alert("Failed to update status");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Customer Management</h2>
        {!isFormOpen && (
            <Button onClick={handleAddClick}>+ Add Customer</Button>
        )}
      </div>

      {isFormOpen ? (
        <CustomerForm 
            initialData={editingCustomer}
            onSave={handleSave}
            onCancel={handleCancel}
        />
      ) : (
        <Card>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance (Due)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {customers.map(c => {
                    const outstanding = invoices
                        .filter(i => i.customerId === c.id && i.status === 'POSTED')
                        .reduce((sum, i) => sum + (i.totalAmount - i.amountPaid), 0);

                    return (
                        <tr key={c.id} className={`hover:bg-gray-50 ${c.status === 'INACTIVE' ? 'bg-red-50/50' : ''}`}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                                {c.name}
                                {c.status === 'INACTIVE' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">INACTIVE</span>}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                            {c.email && <div className="text-xs">{c.email}</div>}
                            {c.phone && <div className="text-xs">{c.phone}</div>}
                            {!c.email && !c.phone && '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={c.address}>{c.address || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                            {outstanding > 0 ? (
                                <span className="text-red-600">${outstanding.toLocaleString()}</span>
                            ) : (
                                <span className="text-gray-400">-</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => setRateCustomer(c)}
                                    className="text-xs font-bold px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    title="Set Special Prices"
                                >
                                    Rates
                                </button>
                                <button
                                    onClick={() => setSettleCustomer(c)}
                                    className="text-xs font-bold px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                    title="Request Wallet Settlement/Adjustment"
                                >
                                    Settle
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleEditClick(c)}
                                    className="text-indigo-600 hover:text-indigo-900 px-2"
                                >
                                    Edit
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => initiateStatusToggle(e, c)}
                                    className={`text-xs font-bold px-2 py-1 rounded border transition-colors ${c.status === 'INACTIVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                                >
                                    {c.status === 'INACTIVE' ? 'Enable' : 'Disable'}
                                </button>
                            </div>
                        </td>
                        </tr>
                    );
                })}
                {customers.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">No customers found.</td></tr>
                )}
                </tbody>
            </table>
            </div>
        </Card>
      )}

      {/* Special Rates Modal */}
      {rateCustomer && (
          <CustomerRateModal 
              customer={rateCustomer}
              onClose={() => setRateCustomer(null)}
          />
      )}

      {/* Settlement Modal */}
      {settleCustomer && currentUser && (
          <CustomerSettlementModal 
              customer={settleCustomer}
              accounts={accounts}
              invoices={invoices} // Passing invoices down
              currentUserUid={currentUser.uid}
              currentUserName={currentUser.name}
              onClose={() => setSettleCustomer(null)}
              onSuccess={() => setSettleCustomer(null)}
          />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                        Confirm {confirmModal.newStatus === 'INACTIVE' ? 'Deactivation' : 'Activation'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                        Are you sure you want to {confirmModal.newStatus === 'INACTIVE' ? 'deactivate' : 'activate'} <strong>{confirmModal.customer.name}</strong>?
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

      {/* QR Code Modal */}
      {viewingQr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4" onClick={() => setViewingQr(null)}>
              <div className="bg-white p-4 rounded-xl max-w-sm w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                  <img src={viewingQr} alt="QR Code" className="w-full h-auto rounded-lg border border-gray-200" />
                  <Button onClick={() => setViewingQr(null)} className="mt-4 w-full">Close</Button>
              </div>
          </div>
      )}
    </div>
  );
};
