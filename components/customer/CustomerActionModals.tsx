import React from 'react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

interface CancelModalProps {
  isOpen: boolean;
  bookingId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CancelBookingModal: React.FC<CancelModalProps> = ({ isOpen, bookingId, onConfirm, onCancel }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm p-4" onClick={onCancel}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
                <div className="bg-red-100 p-3 rounded-full">
                    <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">{t('cancel_booking')}?</h3>
            <p className="text-center text-gray-600 mb-6 text-sm">
                {t('confirm_cancel')} <strong>#{(bookingId || '').slice(-6)}</strong>?
                <br/>
                <span className="text-xs text-red-500 mt-2 block">
                    Note: If the driver is already on the way, cancellation fees may apply.
                </span>
            </p>
            <div className="flex space-x-3">
                <Button variant="outline" onClick={onCancel} className="w-full justify-center">
                    No, Keep
                </Button>
                <Button 
                    onClick={onConfirm} 
                    className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                >
                    Yes, Cancel
                </Button>
            </div>
        </div>
    </div>
  );
};
