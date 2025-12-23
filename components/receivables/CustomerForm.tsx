
import React, { useState, useEffect } from 'react';
import { BankAccountDetails, Customer } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ImageUpload } from '../ui/ImageUpload';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
  initialData?: Customer;
  onSave: (customer: Customer) => Promise<void>;
  onCancel: () => void;
}

export const CustomerForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  
  // Custom Rate
  const [customExchangeRate, setCustomExchangeRate] = useState<number | ''>(initialData?.customExchangeRate || '');

  // Bank State (Ensure 2 slots)
  const [banks, setBanks] = useState<BankAccountDetails[]>(() => {
    const defaults = [
        { bankName: '', accountNumber: '', qrCode: '' },
        { bankName: '', accountNumber: '', qrCode: '' }
    ];

    if (initialData) {
        // Migration from legacy flat structure if bankAccounts is empty
        if (initialData.bankAccounts && initialData.bankAccounts.length > 0) {
            return [
                { ...defaults[0], ...initialData.bankAccounts[0] },
                { ...defaults[1], ...(initialData.bankAccounts[1] || {}) }
            ];
        } else if (initialData.bankName) {
            return [
                { bankName: initialData.bankName, accountNumber: initialData.bankAccount || '', qrCode: '' },
                defaults[1]
            ];
        }
    }
    return defaults;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBankChange = (index: number, field: keyof BankAccountDetails, value: string) => {
    const newBanks = [...banks];
    newBanks[index] = { ...newBanks[index], [field]: value };
    setBanks(newBanks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
        setError("Customer Name is required.");
        return;
    }
    
    setLoading(true);
    setError(null);
    
    // Filter out empty banks
    const validBanks = banks.filter(b => b.bankName.trim() !== '');

    try {
      const customer: Customer = {
        id: initialData?.id || `cust-${Date.now()}`,
        createdAt: initialData?.createdAt || Date.now(),
        name,
        email,
        phone,
        address,
        customExchangeRate: customExchangeRate ? Number(customExchangeRate) : undefined,
        bankAccounts: validBanks,
        // Clear legacy fields
        bankName: '', 
        bankAccount: ''
      };

      await onSave(customer);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-indigo-100 ring-2 ring-indigo-50" title={initialData ? 'Edit Customer' : 'New Customer Details'}>
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {error}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. ABC Trading Co." />
                <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="contact@example.com" />
                <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+855 12 345 678" />
                <Input label="Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, State, Zip" />
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom KHR Exchange Rate</label>
                    <input 
                        type="number"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        value={customExchangeRate}
                        onChange={e => setCustomExchangeRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="Default: 4100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Overrides the system rate for COD collection. Drivers will see this rate if collecting KHR for USD parcels.
                    </p>
                </div>
            </div>

            {/* Bank 1 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Bank Account 1 (Primary)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input 
                        label="Bank Name" 
                        value={banks[0].bankName} 
                        onChange={e => handleBankChange(0, 'bankName', e.target.value)} 
                        placeholder="e.g. ABA Bank" 
                    />
                    <Input 
                        label="Account No." 
                        value={banks[0].accountNumber} 
                        onChange={e => handleBankChange(0, 'accountNumber', e.target.value)} 
                    />
                </div>
                <ImageUpload 
                    label="Bank 1 QR Code"
                    value={banks[0].qrCode}
                    onChange={(val) => handleBankChange(0, 'qrCode', val)}
                />
            </div>

            {/* Bank 2 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Bank Account 2 (Secondary)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <Input 
                        label="Bank Name" 
                        value={banks[1].bankName} 
                        onChange={e => handleBankChange(1, 'bankName', e.target.value)} 
                        placeholder="e.g. ACLEDA Bank" 
                    />
                    <Input 
                        label="Account No." 
                        value={banks[1].accountNumber} 
                        onChange={e => handleBankChange(1, 'accountNumber', e.target.value)} 
                    />
                </div>
                <ImageUpload 
                    label="Bank 2 QR Code"
                    value={banks[1].qrCode}
                    onChange={(val) => handleBankChange(1, 'qrCode', val)}
                />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={onCancel} type="button">Cancel</Button>
                <Button type="submit" isLoading={loading}>{initialData ? 'Update Customer' : 'Save Customer'}</Button>
            </div>
        </form>
    </Card>
  );
};
