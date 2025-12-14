
import React, { useState, useEffect } from 'react';
import { Account, AccountType, AccountSubType } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { ImageUpload } from './ui/ImageUpload'; // Import ImageUpload
import { TYPE_TO_SUBTYPE_MAP } from '../constants';

interface Props {
  initialData?: Account;
  accounts: Account[]; 
  onSubmit: (account: Account) => Promise<void>;
  onCancel: () => void;
}

export const AccountForm: React.FC<Props> = ({ initialData, accounts = [], onSubmit, onCancel }) => {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<AccountType>(initialData?.type || AccountType.ASSET);
  const [subType, setSubType] = useState<AccountSubType>(initialData?.subType || AccountSubType.CURRENT_ASSET);
  const [description, setDescription] = useState(initialData?.description || '');
  const [currency, setCurrency] = useState(initialData?.currency || 'USD');
  const [qrCode, setQrCode] = useState(initialData?.qrCode || ''); // New State
  
  // Sub-ledger state
  const [isHeader, setIsHeader] = useState(initialData?.isHeader || false);
  const [parentAccountId, setParentAccountId] = useState(initialData?.parentAccountId || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When Parent Changes, inherit Type and SubType
  useEffect(() => {
      if (parentAccountId) {
          const parent = accounts.find(a => a.id === parentAccountId);
          if (parent) {
              setType(parent.type);
              setSubType(parent.subType);
          }
      }
  }, [parentAccountId, accounts]);

  // Reset subtype if type changes manually and current subtype is not valid
  useEffect(() => {
    const validSubTypes = TYPE_TO_SUBTYPE_MAP[type];
    if (!validSubTypes.includes(subType)) {
      setSubType(validSubTypes[0]);
    }
  }, [type, subType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code || !name) {
      setError('Code and Name are required.');
      return;
    }

    const account: Account = {
      id: initialData?.id || `acc-${Date.now()}`,
      code,
      name,
      type,
      subType,
      description,
      currency,
      isHeader,
      parentAccountId: parentAccountId || undefined,
      qrCode: qrCode || undefined // Include QR
    };

    try {
      setLoading(true);
      await onSubmit(account);
    } catch (err) {
      setError('Failed to save account.');
      setLoading(false);
    }
  };

  // Filter potential parents
  const potentialParents = accounts.filter(a => a.id !== initialData?.id);

  // Check if it looks like a bank account to show QR field
  const isBankAccount = name.toLowerCase().includes('bank') || name.toLowerCase().includes('cash') || subType === AccountSubType.CURRENT_ASSET;

  return (
    <Card title={initialData ? 'Edit Account' : 'New Account'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ... (Existing fields: Code, Name, Hierarchy) ... */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Basic Info */}
          <Input
            label="Account Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 100001"
            required
          />
          <Input
            label="Account Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cash on Hand USD"
            required
          />

          {/* Hierarchy Configuration */}
          <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-700 mb-3">Structure & Hierarchy</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 
                 {/* Is Header Toggle */}
                 <div className="flex items-center space-x-3 h-full">
                    <input
                        id="isHeader"
                        type="checkbox"
                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={isHeader}
                        onChange={(e) => setIsHeader(e.target.checked)}
                    />
                    <label htmlFor="isHeader" className="text-sm font-medium text-gray-700">
                        Is Header Account? <span className="text-xs text-gray-500 font-normal block">Headers cannot be used in transactions. Used for grouping.</span>
                    </label>
                 </div>

                 {/* Parent Select */}
                 <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account (Optional)</label>
                    <select
                        className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={parentAccountId}
                        onChange={(e) => setParentAccountId(e.target.value)}
                    >
                        <option value="">-- No Parent (Top Level) --</option>
                        {potentialParents.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Sub-ledger under this account.</p>
                 </div>
              </div>
          </div>
          
          {/* ... (Type, SubType, Currency fields remain same) ... */}
           <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              disabled={!!parentAccountId}
            >
              {Object.values(AccountType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Type</label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm"
              value={subType}
              onChange={(e) => setSubType(e.target.value as AccountSubType)}
              disabled={!!parentAccountId}
            >
               {/* ... options ... */}
               <option value={AccountSubType.CURRENT_ASSET}>Current Asset</option>
               <option value={AccountSubType.NON_CURRENT_ASSET}>Non-Current Asset</option>
               {/* ... map other types properly in real code or keep simple ... */}
               {TYPE_TO_SUBTYPE_MAP[type].map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="KHR">KHR (៛)</option>
            </select>
          </div>
          
          <div className="md:col-span-2">
            <Input
              label="Description (Optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* QR Code for Banking */}
          {isBankAccount && (
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">Nostro Account Configuration (Bank Integration)</h4>
                  <ImageUpload 
                      label="Company QR Code (For Deposits)"
                      value={qrCode}
                      onChange={setQrCode}
                  />
                  <p className="text-xs text-blue-700 mt-2">
                      <strong>Important:</strong> Uploading a QR code here will display it to Drivers and Customers when they select this account for Settlements or Wallet Top-ups.
                  </p>
              </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" isLoading={loading}>
            {initialData ? 'Update Account' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
