import React, { useState, useEffect } from 'react';
import { Branch } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { ImageUpload } from '../ui/ImageUpload';
import { toast } from '../../src/shared/utils/toast';

// --- Action Confirmation (Delivery/Return) ---
interface ActionConfirmationProps {
  action: 'TRANSIT' | 'DELIVER' | 'RETURN' | 'OUT_FOR_DELIVERY';
  isOpen: boolean;
  onConfirm: (proof?: string, cod?: { amount: number, currency: 'USD' | 'KHR' }, taxiData?: { isTaxiDelivery: boolean, taxiFee: number, taxiFeeCurrency: 'USD' | 'KHR' }) => void;
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

  // Taxi delivery state
  const [isTaxiDelivery, setIsTaxiDelivery] = useState(false);
  const [taxiFee, setTaxiFee] = useState(0);
  const [taxiFeeCurrency, setTaxiFeeCurrency] = useState<'USD' | 'KHR'>('USD');

  // Reset state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setProofImage('');
      setCodAmount(initialCodAmount);
      setCodCurrency(initialCodCurrency);
      setIsTaxiDelivery(false);
      setTaxiFee(0);
      setTaxiFeeCurrency('USD');
    }
  }, [isOpen, initialCodAmount, initialCodCurrency]);

  if (!isOpen) return null;

  let title = "Start Delivery?";
  let message = "Are you sure you want to start delivering this parcel?";

  if (action === 'DELIVER') {
    title = isTaxiDelivery ? "Confirm Taxi Handoff?" : "Confirm Delivery?";
    message = isTaxiDelivery
      ? "Hand off this parcel to a taxi driver. Enter the taxi fee you're paying."
      : "Mark this parcel as successfully delivered? Please confirm the COD amount and capture proof.";
  } else if (action === 'RETURN') {
    title = "Mark as Failed/Returned?";
    message = "Are you sure you want to mark this delivery as failed/returned?";
  }

  const handleConfirm = () => {
    if (action === 'DELIVER' && !proofImage) {
      toast.warning(isTaxiDelivery ? "Photo of taxi handoff is required." : "Proof of Delivery photo is required.");
      return;
    }
    if (action === 'DELIVER' && isTaxiDelivery && taxiFee <= 0) {
      toast.warning("Please enter the taxi fee amount.");
      return;
    }
    onConfirm(
      proofImage,
      action === 'DELIVER' && !isTaxiDelivery ? { amount: codAmount, currency: codCurrency } : undefined,
      action === 'DELIVER' && isTaxiDelivery ? { isTaxiDelivery: true, taxiFee, taxiFeeCurrency } : undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 text-sm">{message}</p>

        {action === 'DELIVER' && (
          <>
            {/* Taxi Delivery Toggle */}
            <div className={`mb-4 p-3 rounded-lg border ${initialCodAmount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <label className={`flex items-center gap-3 ${initialCodAmount > 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={isTaxiDelivery}
                  onChange={e => {
                    if (initialCodAmount > 0) {
                      toast.warning("COD must be $0 before enabling taxi delivery. Update the COD amount first.");
                      return;
                    }
                    setIsTaxiDelivery(e.target.checked);
                  }}
                  disabled={initialCodAmount > 0}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 disabled:opacity-50"
                />
                <div>
                  <span className="font-medium text-gray-900">🚕 Deliver via Taxi</span>
                  <p className="text-xs text-gray-500">Hand off to taxi driver (no COD collection)</p>
                </div>
              </label>
              {initialCodAmount > 0 && (
                <div className="mt-2 text-xs text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
                  ⚠️ COD is {initialCodCurrency === 'KHR' ? `${initialCodAmount.toLocaleString()} ៛` : `$${initialCodAmount}`}. Update to $0 to enable taxi delivery.
                </div>
              )}
            </div>

            {/* Taxi Fee Input - Only shown when taxi delivery is enabled */}
            {isTaxiDelivery && (
              <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-200">
                <label className="block text-xs font-bold text-orange-700 mb-2">Taxi Fee (You Pay)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-lg font-bold text-orange-700 focus:ring-orange-500 focus:border-orange-500"
                    value={taxiFee || ''}
                    placeholder="0.00"
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setTaxiFee(val);
                      if (val >= 1000) setTaxiFeeCurrency('KHR');
                      else if (val > 0) setTaxiFeeCurrency('USD');
                    }}
                  />
                  <select
                    className="bg-white border border-orange-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-orange-500 focus:border-orange-500"
                    value={taxiFeeCurrency}
                    onChange={e => setTaxiFeeCurrency(e.target.value as 'USD' | 'KHR')}
                  >
                    <option value="USD">USD</option>
                    <option value="KHR">KHR</option>
                  </select>
                </div>
                <p className="text-xs text-orange-600 mt-2 italic">You pay the taxi now. Company will reimburse you.</p>
              </div>
            )}

            {/* COD Amount Input - Hidden when taxi delivery is enabled */}
            {!isTaxiDelivery && (
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
          </>
        )}

        {action === 'DELIVER' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isTaxiDelivery ? 'Photo of Taxi Handoff (Required)' : 'Proof of Delivery (Required)'}
            </label>
            <ImageUpload value={proofImage} onChange={setProofImage} />
          </div>
        )}

        <div className="flex space-x-3">
          <Button variant="outline" onClick={onCancel} className="w-full justify-center">Cancel</Button>
          <Button
            onClick={handleConfirm}
            className={`w-full justify-center ${isTaxiDelivery ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {isTaxiDelivery ? '🚕 Confirm Handoff' : 'Confirm'}
          </Button>
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

// --- Batch Delivery Modal for Stock Bookings ---
interface BatchDeliveryModalProps {
  isOpen: boolean;
  itemCount: number;
  initialCodAmount: number;
  initialCodCurrency: 'USD' | 'KHR';
  onConfirm: (proof: string, cod?: { amount: number, currency: 'USD' | 'KHR' }, taxiData?: { isTaxiDelivery: boolean, taxiFee: number, taxiFeeCurrency: 'USD' | 'KHR' }) => void;
  onCancel: () => void;
}

export const BatchDeliveryModal: React.FC<BatchDeliveryModalProps> = ({
  isOpen, itemCount, initialCodAmount, initialCodCurrency, onConfirm, onCancel
}) => {
  const [proofImage, setProofImage] = useState('');
  const [codAmount, setCodAmount] = useState(initialCodAmount);
  const [codCurrency, setCodCurrency] = useState(initialCodCurrency);

  // Taxi delivery state
  const [isTaxiDelivery, setIsTaxiDelivery] = useState(false);
  const [taxiFee, setTaxiFee] = useState(0);
  const [taxiFeeCurrency, setTaxiFeeCurrency] = useState<'USD' | 'KHR'>('USD');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!proofImage) {
      toast.warning(isTaxiDelivery ? "Photo of taxi handoff is required." : "Proof of Delivery photo is required.");
      return;
    }
    if (isTaxiDelivery && taxiFee <= 0) {
      toast.warning("Please enter the taxi fee amount.");
      return;
    }
    onConfirm(
      proofImage,
      !isTaxiDelivery ? { amount: codAmount, currency: codCurrency } : undefined,
      isTaxiDelivery ? { isTaxiDelivery: true, taxiFee, taxiFeeCurrency } : undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {isTaxiDelivery ? '🚕 Confirm Taxi Handoff' : 'Confirm Stock Delivery'}
        </h3>
        <p className="text-gray-600 mb-4 text-sm">
          Mark all {itemCount} items as delivered.
        </p>

        {/* Taxi Delivery Toggle */}
        <div className={`mb-4 p-3 rounded-lg border ${initialCodAmount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <label className={`flex items-center gap-3 ${initialCodAmount > 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={isTaxiDelivery}
              onChange={e => {
                if (codAmount > 0) {
                  toast.warning("COD must be $0 before enabling taxi delivery.");
                  return;
                }
                setIsTaxiDelivery(e.target.checked);
              }}
              disabled={codAmount > 0}
              className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 disabled:opacity-50"
            />
            <div>
              <span className="font-medium text-gray-900">🚕 Deliver via Taxi</span>
              <p className="text-xs text-gray-500">Hand off to taxi driver (no COD collection)</p>
            </div>
          </label>
          {codAmount > 0 && (
            <div className="mt-2 text-xs text-red-600 font-medium bg-red-100 px-2 py-1 rounded">
              ⚠️ Total COD is {codCurrency === 'KHR' ? `${codAmount.toLocaleString()} ៛` : `$${codAmount}`}. Update to $0 to enable taxi.
            </div>
          )}
        </div>

        {/* Taxi Fee Input */}
        {isTaxiDelivery && (
          <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-200">
            <label className="block text-xs font-bold text-orange-700 mb-2">Taxi Fee (You Pay)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-lg font-bold text-orange-700"
                value={taxiFee || ''}
                placeholder="0.00"
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setTaxiFee(val);
                  if (val >= 1000) setTaxiFeeCurrency('KHR');
                  else if (val > 0) setTaxiFeeCurrency('USD');
                }}
              />
              <select
                className="bg-white border border-orange-300 rounded-lg px-3 py-2 text-sm font-medium"
                value={taxiFeeCurrency}
                onChange={e => setTaxiFeeCurrency(e.target.value as 'USD' | 'KHR')}
              >
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
            <p className="text-xs text-orange-600 mt-2 italic">You pay the taxi now. Company will reimburse you.</p>
          </div>
        )}

        {/* COD Amount Input */}
        {!isTaxiDelivery && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-gray-600 mb-2">Total COD Collected</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-green-700"
                value={codAmount}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setCodAmount(val);
                  if (!isNaN(val)) {
                    setCodCurrency(val >= 1000 ? 'KHR' : 'USD');
                  }
                }}
              />
              <select
                className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                value={codCurrency}
                onChange={e => setCodCurrency(e.target.value as 'USD' | 'KHR')}
              >
                <option value="USD">USD</option>
                <option value="KHR">KHR</option>
              </select>
            </div>
          </div>
        )}

        {/* Proof of Delivery */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isTaxiDelivery ? 'Photo of Taxi Handoff (Required)' : 'Proof of Delivery (Required)'}
          </label>
          <ImageUpload value={proofImage} onChange={setProofImage} />
        </div>

        <div className="flex space-x-3 mt-4">
          <Button variant="outline" onClick={onCancel} className="w-full justify-center">Cancel</Button>
          <Button
            onClick={handleConfirm}
            className={`w-full justify-center ${isTaxiDelivery ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {isTaxiDelivery ? '🚕 Confirm Handoff' : `Deliver All (${itemCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
};
