
import React from 'react';
import { ParcelBooking } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  job: ParcelBooking;
  type: 'AVAILABLE' | 'PICKUP';
  onAction: (job: ParcelBooking) => void;
  onMapClick?: (address: string) => void;
  onChatClick?: (job: ParcelBooking) => void;
}

export const DriverJobCard: React.FC<Props> = ({ job, type, onAction, onMapClick, onChatClick }) => {
  const { t } = useLanguage();
  const items = job.items || [];

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status: string) => {
    // @ts-ignore
    const label = t(`status_${status}`);
    return label === `status_${status}` ? status : label;
  };

  const isAvailable = type === 'AVAILABLE';

  return (
    <Card className={`shadow-sm ${isAvailable ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500 shadow-md'}`}>
      <div className="flex gap-3">
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
          {items?.[0]?.image ? (
            <img src={items[0].image} alt="Parcel" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-gray-900 truncate">{job.senderName}</h4>
              <p className="text-[10px] text-gray-500">
                {job.bookingDate} • {formatTime(job.createdAt)}
              </p>
              {!isAvailable && <p className="text-xs text-gray-500 mt-1">{job.senderPhone}</p>}
            </div>
            {isAvailable ? (
              <Button onClick={() => onAction(job)} className="text-xs px-3 bg-green-600 hover:bg-green-700">{t('accept_job')}</Button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] bg-red-100 text-red-800 px-2 py-1 rounded font-bold uppercase">
                  {getStatusLabel(job.status)}
                </span>
                <Button onClick={() => onAction(job)} className="text-xs h-7 py-0 bg-indigo-600 hover:bg-indigo-700">{t('process_pickup')}</Button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{job.pickupAddress}</p>

          {isAvailable ? (
            <div className="mt-2 flex gap-2">
              <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">{items.length} items</span>
              <span className="text-[10px] bg-green-50 px-2 py-1 rounded font-bold text-green-700">
                Earn: {(() => {
                  const fee = job.totalDeliveryFee || 0;
                  const commRate = 0.7; // Hardcoded fallback for now, ideally from props or hook

                  const itemCurrencies = new Set(items.map(i => i.codCurrency || 'USD'));
                  const isMixed = itemCurrencies.has('USD') && itemCurrencies.has('KHR');

                  if (isMixed) {
                    const khrCount = items.filter(i => (i.codCurrency || 'USD') === 'KHR').length;
                    const usdCount = items.filter(i => (i.codCurrency || 'USD') === 'USD').length;
                    const total = items.length;
                    const feePerItem = fee / total;

                    const khrPortion = (feePerItem * khrCount) * commRate;
                    const usdPortion = (feePerItem * usdCount) * commRate;

                    // Rate 4000
                    const RATE = 4000;

                    let khrFinal = khrPortion;
                    let usdFinal = usdPortion;

                    // Adjust based on base fee currency
                    if (job.currency === 'USD') {
                      khrFinal = khrPortion * RATE;
                    } else {
                      usdFinal = usdPortion / RATE;
                    }

                    return `$${usdFinal.toFixed(2)} + ${khrFinal.toLocaleString()} ៛`;
                  }

                  const val = fee * commRate;
                  return job.currency === 'KHR' ? `${val.toLocaleString()} ៛` : `$${val.toFixed(2)}`;
                })()}
              </span>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              {job.driverId && onChatClick && (
                <button
                  onClick={() => onChatClick(job)}
                  className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full flex items-center font-bold border border-indigo-100"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Chat
                </button>
              )}
              {onMapClick && (
                <button
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full flex items-center font-bold border border-gray-200"
                  onClick={() => onMapClick(job.pickupAddress)}
                >
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Map
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
