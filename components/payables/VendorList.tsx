
import React, { useState } from 'react';
import { Vendor } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  vendors: Vendor[];
  onAddVendor: (vendor: Vendor) => Promise<void>;
  onUpdateVendor: (vendor: Vendor) => Promise<void>;
}

export const VendorList: React.FC<Props> = ({ vendors, onAddVendor, onUpdateVendor }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  
  // Banking State
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');
  const [bankNotes, setBankNotes] = useState('');
  
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setTaxId('');
    setPaymentTerms('');
    setBankName('');
    setBankAccountNumber('');
    setBankRoutingNumber('');
    setBankNotes('');
    setNotes('');
  };

  const openAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setName(v.name);
    setContactPerson(v.contactPerson || '');
    setEmail(v.email || '');
    setPhone(v.phone || '');
    setAddress(v.address || '');
    setTaxId(v.taxId || '');
    setPaymentTerms(v.paymentTerms || '');
    setBankName(v.bankName || '');
    setBankAccountNumber(v.bankAccountNumber || '');
    setBankRoutingNumber(v.bankRoutingNumber || '');
    setBankNotes(v.bankNotes || '');
    setNotes(v.notes || '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    const vendorData: Vendor = {
      id: editingId || `vend-${Date.now()}`,
      name,
      contactPerson,
      email,
      phone,
      address,
      taxId,
      paymentTerms,
      bankName,
      bankAccountNumber,
      bankRoutingNumber,
      bankNotes,
      notes,
      createdAt: editingId ? (vendors.find(v => v.id === editingId)?.createdAt || Date.now()) : Date.now()
    };

    try {
      if (editingId) {
        await onUpdateVendor(vendorData);
      } else {
        await onAddVendor(vendorData);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (e) {
      console.error("Failed to save vendor", e);
      alert("Failed to save vendor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Vendor Management</h2>
        <Button onClick={openAdd} disabled={isFormOpen}>+ Add Vendor</Button>
      </div>

      {isFormOpen && (
        <Card className="mb-6 border-indigo-100 ring-2 ring-indigo-50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
               <h3 className="font-medium text-gray-900">{editingId ? 'Edit Vendor Profile' : 'New Vendor Profile'}</h3>
            </div>
            
            {/* General Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Company Name" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
                <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                <div className="md:col-span-2">
                    <Input label="Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full billing address" />
                </div>
            </div>

            {/* Financial Info */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Financial Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Tax ID / VAT / GST" value={taxId} onChange={e => setTaxId(e.target.value)} />
                    <Input label="Payment Terms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
                </div>
            </div>

            {/* Banking Info */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Banking Information (For Outgoing Payments)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} />
                    <Input label="Account Number" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} />
                    <Input label="Routing / Sort Code" value={bankRoutingNumber} onChange={e => setBankRoutingNumber(e.target.value)} />
                    <div className="md:col-span-3">
                        <Input label="Banking Notes" value={bankNotes} onChange={e => setBankNotes(e.target.value)} placeholder="IBAN, SWIFT, or other payment instructions" />
                    </div>
                </div>
            </div>
            
             <div>
                <Input label="Internal Notes" value={notes} onChange={e => setNotes(e.target.value)} />
             </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsFormOpen(false)} type="button">Cancel</Button>
              <Button type="submit" isLoading={loading}>{editingId ? 'Update Vendor' : 'Save Vendor'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax & Terms</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Banking</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{v.name}</div>
                    {v.contactPerson && <div className="text-xs text-gray-500">Attn: {v.contactPerson}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {v.email && <div className="text-xs">{v.email}</div>}
                    {v.phone && <div className="text-xs">{v.phone}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {v.taxId && <div className="text-xs">Tax: {v.taxId}</div>}
                    {v.paymentTerms && <div className="text-xs">Terms: {v.paymentTerms}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                     {v.bankName ? (
                         <div className="text-xs">
                             <span className="font-medium">{v.bankName}</span>
                             <br/>{v.bankAccountNumber && `...${v.bankAccountNumber.slice(-4)}`}
                         </div>
                     ) : <span className="text-xs text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button 
                      onClick={() => openEdit(v)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">No vendors found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
