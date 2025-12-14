
import React, { useState } from 'react';
import { Branch } from '../../types';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ui/ImageUpload';

// --- Action Confirmation (Delivery/Return) ---
interface ActionConfirmationProps {
  action: 'TRANSIT' | 'DELIVER' | 'RETURN';
  isOpen: boolean;
  onConfirm: (proof?: string, cod?: { amount: number, currency: 'USD' | 'KHR' }) => void;
  onCancel: () => void;
  initialCodAmount?: number;
  initialCodCurrency?: 'USD' | 'KHR';
}

export const ActionConfirmationModal: React.FC<ActionConfirmationProps> = ({ 
  action, isOpen, onConfirm, onCancel, initialCodAmount = 0, initialCodCurrency = 'USD' 
}) => {
  const [proofImage, setProofImage] = useState('');
  const [codAmount, setCodAmount] = useState(initialCodAmount);
  const [codCurrency, setCodCurrency] = useState(initialCodCurrency);

  if (!isOpen) return null;

  let title = "Start Delivery?";
  let message = "Are you sure you want to start delivering this parcel?";

  if (action === 'DELIVER') {
      title = "Confirm Delivery?";
      message = "Mark this parcel as successfully delivered? Please confirm the COD amount and capture proof.";
  } else if (action === 'RETURN') {
      title = "Mark as Failed/Returned?";
      message = "Are you sure you want to mark this delivery as failed/returned?";
  }

  const handleConfirm = () => {
      if (action === 'DELIVER' && !proofImage) {
          alert("Proof of Delivery photo is required.");
          return;
      }
      onConfirm(
          proofImage, 
          action === 'DELIVER' ? { amount: codAmount, currency: codCurrency } : undefined
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 text-sm">{message}</p>
        
        {action === 'DELIVER' && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-gray-600 mb-2">Confirm Collected Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-green-700 focus:ring-green-500 focus:border-green-500"
                value={codAmount}
                onChange={e => {
                    const val = parseFloat(e.target.value);
                    setCodAmount(val);
                    // Auto-switch currency based on amount magnitude
                    if (!isNaN(val)) {
                        setCodCurrency(val >= 1000 ? 'KHR' : 'USD');
                    }
                }}
              />
              <select
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-green-500 focus:border-green-500"
                value={codCurrency}
                onChange={e => setCodCurrency(e.target.value as 'USD' | 'KHR')}
              >
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
          </div>
        )}

        {action === 'DELIVER' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Delivery (Required)</label>
            <ImageUpload value={proofImage} onChange={setProofImage} />
          </div>
        )}

        <div className="flex space-x-3">
          <Button variant="outline" onClick={onCancel} className="w-full justify-center">Cancel</Button>
          <Button onClick={handleConfirm} className="w-full justify-center bg-indigo-600 hover:bg-indigo-700">Confirm</Button>
        </div>
      </div>
    </div>
  );
};

// --- Transfer Modal ---
interface TransferModalProps {
  isOpen: boolean;
  branches: Branch[];
  onConfirm: (branchId: string) => void;
  onCancel: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, branches, onConfirm, onCancel }) => {
  const [targetBranchId, setTargetBranchId] = useState(branches[0]?.id || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Transfer to Branch</h3>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Destination Hub</label>
          <select 
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            value={targetBranchId}
            onChange={(e) => setTargetBranchId(e.target.value)}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={onCancel} className="w-full justify-center">Cancel</Button>
          <Button onClick={() => onConfirm(targetBranchId)} className="w-full justify-center bg-indigo-600 hover:bg-indigo-700">Confirm Transfer</Button>
        </div>
      </div>
    </div>
  );
};
