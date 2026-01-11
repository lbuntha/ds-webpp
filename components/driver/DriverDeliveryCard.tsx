import React, { useState, useMemo } from 'react';
import { ParcelBooking, ParcelItem } from '../../src/shared/types';
import { Card } from '../ui/Card';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

interface Props {
  job: ParcelBooking;
  onZoomImage: (url: string) => void;
  onAction: (bookingId: string, itemId: string, action: 'DELIVER' | 'RETURN' | 'TRANSFER' | 'OUT_FOR_DELIVERY') => void;
  onUpdateCod: (bookingId: string, itemId: string, amount: number, currency: 'USD' | 'KHR') => Promise<void>;
  onChatClick: (bookingId: string, item: ParcelItem) => void;
  hasBranches: boolean;
  currentDriverId?: string;
}

export const DriverDeliveryCard: React.FC<Props> = ({ job, onZoomImage, onAction, onUpdateCod, onChatClick, hasBranches, currentDriverId }) => {
  const { t } = useLanguage();
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickEditAmount, setQuickEditAmount] = useState(0);
  const [quickEditCurrency, setQuickEditCurrency] = useState<'USD' | 'KHR'>('USD');
  const [isSaving, setIsSaving] = useState(false);

  // Filter to active items for this driver
  const activeItems = useMemo(() => {
    return (job.items || []).filter(i => {
      const isCorrectStatus = i.status === 'PICKED_UP' || i.status === 'AT_WAREHOUSE' || i.status === 'OUT_FOR_DELIVERY' || (i.status === 'IN_TRANSIT' && !i.targetBranchId);
      const isMyItem = !currentDriverId || i.driverId === currentDriverId || i.delivererId === currentDriverId;
      return isCorrectStatus && isMyItem;
    });
  }, [job.items, currentDriverId]);

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getStatusLabel = (status: string) => {
    // @ts-ignore
    const label = t(`status_${status}`);
    return label === `status_${status}` ? status : label;
  };

  const startQuickEdit = (item: ParcelItem) => {
    setQuickEditId(item.id);
    setQuickEditAmount(Number(item.productPrice) || 0);
    setQuickEditCurrency(item.codCurrency || (Number(item.productPrice) >= 1000 ? 'KHR' : 'USD'));
  };

  const handleSaveCod = async (itemId: string) => {
    setIsSaving(true);
    await onUpdateCod(job.id, itemId, quickEditAmount, quickEditCurrency);
    setIsSaving(false);
    setQuickEditId(null);
  };

  // Calculate totals for view
  const totalCodUSD = activeItems.filter(i => i.codCurrency !== 'KHR').reduce((sum, i) => sum + (Number(i.productPrice) || 0), 0);
  const totalCodKHR = activeItems.filter(i => i.codCurrency === 'KHR').reduce((sum, i) => sum + (Number(i.productPrice) || 0), 0);

  // Detect STOCK booking by stockProducts array on job (new simplified structure)
  const isStockBooking = job.stockProducts && job.stockProducts.length > 0;

  if (activeItems.length === 0) return null;

  // --- STOCK VIEW: Show stock products list + single delivery action ---
  if (isStockBooking && activeItems.length === 1) {
    const item = activeItems[0]; // The single consolidated item
    return (
      <Card className="border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>

        {/* Header */}
        <div className="pl-3 pr-3 pt-3 pb-2 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                  📦 Stock ({job.stockProducts!.length})
                </span>
                <span className="text-[10px] text-gray-400">{job.bookingDate}</span>
              </div>
              <h4 className="font-bold text-gray-900 mt-1">{item.receiverName}</h4>
              <p className="text-xs text-gray-600">{item.receiverPhone}</p>
              <p className="text-xs text-gray-500 mt-1">{item.destinationAddress}</p>
            </div>
            <button
              onClick={() => onChatClick(job.id, item)}
              className="text-xs text-indigo-600 flex items-center font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
          </div>
        </div>

        {/* Products List from stockProducts */}
        <div className="px-3 py-2 max-h-[150px] overflow-y-auto bg-gray-50">
          {job.stockProducts!.map((sp, idx) => (
            <div key={sp.stockItemId || idx} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
              {sp.image && (
                <img
                  src={sp.image}
                  className="w-10 h-10 rounded object-cover cursor-pointer"
                  onClick={() => onZoomImage(sp.image!)}
                  alt=""
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{sp.name || sp.sku || `Product ${idx + 1}`}</p>
                <p className="text-[10px] text-gray-500">Qty: {sp.quantity || 1}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-red-600">
                  {sp.codCurrency === 'KHR'
                    ? `${(sp.unitPrice || 0).toLocaleString()}៛`
                    : `$${(sp.unitPrice || 0).toFixed(2)}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-3 py-2 bg-red-50 border-t border-red-100">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Total COD to Collect:</span>
            <span className="font-bold text-red-700">
              {item.codCurrency === 'KHR'
                ? `${(item.productPrice || 0).toLocaleString()}៛`
                : `$${(item.productPrice || 0).toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
            <span>Delivery Fee:</span>
            <span>${(job.totalDeliveryFee || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons - operates on the single consolidated item */}
        <div className="flex gap-2 p-3">
          <button
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-green-700"
            onClick={() => onAction(job.id, item.id, 'DELIVER')}
          >
            ✓ Delivered
          </button>
          <button
            className="px-4 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg text-xs font-bold hover:bg-gray-50"
            onClick={() => onAction(job.id, item.id, 'RETURN')}
          >
            Return
          </button>
          {hasBranches && (
            <button
              className="px-4 bg-indigo-50 text-indigo-700 py-2.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100"
              onClick={() => onAction(job.id, item.id, 'TRANSFER')}
            >
              Hub
            </button>
          )}
        </div>
      </Card>
    );
  }

  // --- STANDARD VIEW for normal bookings (item-by-item delivery) ---
  return (
    <div className="space-y-3">
      {activeItems.map((item) => {
        const showEstimate = item.codCurrency !== 'KHR' && item.productPrice > 0 && job.exchangeRateForCOD;
        const estimatedKHR = showEstimate ? item.productPrice * (job.exchangeRateForCOD || 4100) : 0;

        return (
          <Card key={item.id} className="border border-gray-200 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
            <div className="pl-3 flex gap-4">
              <div
                className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onZoomImage(item.image)}
              >
                <img src={item.image} className="w-full h-full object-cover" alt="Parcel" />
              </div>
              <div className="flex-1 min-w-0 py-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-900 truncate">{item.receiverName}</h4>
                    <p className="text-[10px] text-gray-500">
                      {job.bookingDate} • {formatTime(job.createdAt)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${item.status === 'IN_TRANSIT' ? 'bg-orange-100 text-orange-800' :
                    item.status === 'OUT_FOR_DELIVERY' ? 'bg-purple-100 text-purple-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                    {getStatusLabel(item.status || 'PICKED_UP')}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 truncate">{item.destinationAddress}</p>

                {/* Inline COD */}
                <div className="flex items-center gap-4 mt-2">
                  {quickEditId === item.id ? (
                    <div className="flex items-center gap-1 bg-white border border-red-200 rounded p-1 shadow-sm animate-fade-in-up">
                      <input
                        type="number"
                        className="w-16 text-sm font-bold text-red-600 border-none focus:ring-0 p-0 text-right bg-transparent"
                        value={quickEditAmount}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setQuickEditAmount(val);
                          if (!isNaN(val)) {
                            setQuickEditCurrency(val >= 1000 ? 'KHR' : 'USD');
                          }
                        }}
                        autoFocus
                      />
                      <select
                        className="text-xs border-none focus:ring-0 bg-transparent text-gray-500 font-bold p-0 pr-4"
                        value={quickEditCurrency}
                        onChange={e => setQuickEditCurrency(e.target.value as any)}
                      >
                        <option value="USD">$</option>
                        <option value="KHR">៛</option>
                      </select>
                      <button
                        onClick={() => handleSaveCod(item.id)}
                        className="text-green-600 hover:text-green-800 bg-green-50 rounded p-1"
                        disabled={isSaving}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </button>
                      <button onClick={() => setQuickEditId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <div className="flex flex-col">
                        <div className="text-xs font-bold text-red-600">
                          COD: {item.productPrice
                            ? (item.codCurrency === 'KHR' ? `${item.productPrice.toLocaleString()}៛` : `$${item.productPrice}`)
                            : '$0.00'}
                        </div>
                        {showEstimate && (
                          <div className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded">
                            or {estimatedKHR.toLocaleString()}៛ (Rate: {job.exchangeRateForCOD})
                          </div>
                        )}
                        {(() => {
                          const itemFee = item.deliveryFee ?? (job.totalDeliveryFee / (activeItems.length || 1));
                          const itemCurrency = item.codCurrency || 'USD';
                          if (itemFee <= 0) return null;
                          return (
                            <div className="text-[10px] font-medium text-indigo-600 mt-0.5">
                              Fee: {itemCurrency === 'KHR'
                                ? `${Math.round(itemFee).toLocaleString()}៛`
                                : `$${itemFee.toFixed(2)}`}
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => startQuickEdit(item)}
                        className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Update Amount"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => onChatClick(job.id, item)}
                    className="text-xs text-indigo-600 flex items-center font-medium ml-auto"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Chat
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pl-3">
              <button
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-green-700"
                onClick={() => onAction(job.id, item.id, 'DELIVER')}
              >
                {t('status_DELIVERED')}
              </button>
              <button
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
                onClick={() => onAction(job.id, item.id, 'RETURN')}
              >
                {t('status_RETURN_TO_SENDER')}
              </button>
              {hasBranches && (
                <button
                  className="px-3 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-xs font-bold border border-indigo-100"
                  onClick={() => onAction(job.id, item.id, 'TRANSFER')}
                >
                  Hub
                </button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  );
};

