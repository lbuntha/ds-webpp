import React from 'react';
import { Invoice, Bill, StaffLoan, LoanStatus, BillStatus, InvoiceStatus } from '../../types';
import { Button } from './Button';

interface Props {
  type: 'INVOICE' | 'BILL' | 'LOAN';
  data: any;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<Props> = ({ type, data, onClose }) => {
  if (!data) return null;

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const renderStatus = (status: string) => {
      let color = 'bg-gray-100 text-gray-800';
      if (['PAID'].includes(status)) color = 'bg-green-100 text-green-800';
      if (['POSTED', 'ACTIVE'].includes(status)) color = 'bg-blue-100 text-blue-800';
      if (['VOID', 'WRITTEN_OFF'].includes(status)) color = 'bg-red-100 text-red-800';
      
      return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${color}`}>
              {status}
          </span>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center space-x-3">
             <div className={`p-2 rounded-lg ${type === 'INVOICE' ? 'bg-blue-100 text-blue-600' : type === 'BILL' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                 {type === 'INVOICE' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                 {type === 'BILL' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                 {type === 'LOAN' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
             </div>
             <div>
                 <h3 className="text-lg font-bold text-gray-900 capitalize">{type === 'INVOICE' ? 'Sales Invoice' : type === 'BILL' ? 'Vendor Bill' : 'Staff Loan Record'}</h3>
                 <p className="text-xs text-gray-500 font-mono">{data.id}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            {/* Top Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                {type === 'INVOICE' && (
                    <>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Invoice #</span>
                            <span className="block font-medium text-gray-900">{(data as Invoice).number}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Customer</span>
                            <span className="block font-medium text-gray-900">{(data as Invoice).customerName}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Date</span>
                            <span className="block font-medium text-gray-900">{(data as Invoice).date}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Status</span>
                            <div className="mt-1">{renderStatus((data as Invoice).status)}</div>
                        </div>
                    </>
                )}

                {type === 'BILL' && (
                    <>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Bill #</span>
                            <span className="block font-medium text-gray-900">{(data as Bill).billNumber}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Vendor</span>
                            <span className="block font-medium text-gray-900">{(data as Bill).vendorName}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Date</span>
                            <span className="block font-medium text-gray-900">{(data as Bill).date}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Status</span>
                            <div className="mt-1">{renderStatus((data as Bill).status)}</div>
                        </div>
                    </>
                )}

                {type === 'LOAN' && (
                    <>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Employee</span>
                            <span className="block font-medium text-gray-900">{(data as StaffLoan).employeeName}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Date Issued</span>
                            <span className="block font-medium text-gray-900">{(data as StaffLoan).date}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-gray-500 uppercase">Status</span>
                            <div className="mt-1">{renderStatus((data as StaffLoan).status)}</div>
                        </div>
                    </>
                )}
            </div>

            {/* Table of Items (Invoice/Bill) */}
            {(type === 'INVOICE' || type === 'BILL') && (
                <div className="border rounded-xl overflow-hidden mb-6">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase text-xs">Description</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">Qty</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">Unit Price</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase text-xs">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {(data as any).lines?.map((line: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="px-4 py-3 text-gray-900">{line.description}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{line.quantity || 1}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                        {line.unitPrice ? formatCurrency(line.unitPrice, (data as any).currency || 'USD') : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                                        {formatCurrency(line.amount, (data as any).currency || 'USD')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Loan Specific Details */}
            {type === 'LOAN' && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Loan Description</h4>
                    <p className="text-sm text-gray-600">{(data as StaffLoan).description}</p>
                </div>
            )}

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-64 space-y-2">
                    {type === 'INVOICE' && (data as Invoice).subtotal && (
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Subtotal</span>
                            <span>{formatCurrency((data as Invoice).subtotal!, (data as Invoice).currency)}</span>
                        </div>
                    )}
                    {type === 'INVOICE' && (data as Invoice).taxAmount && (data as Invoice).taxAmount! > 0 && (
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Tax ({(data as Invoice).taxName})</span>
                            <span>{formatCurrency((data as Invoice).taxAmount!, (data as Invoice).currency)}</span>
                        </div>
                    )}
                    
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                        <span>Total</span>
                        <span>
                            {type === 'LOAN' 
                                ? formatCurrency((data as StaffLoan).amount) 
                                : formatCurrency((data as any).totalAmount, (data as any).currency || 'USD')
                            }
                        </span>
                    </div>

                    <div className="flex justify-between text-sm font-medium text-green-600">
                        <span>Paid / Repaid</span>
                        <span>
                            {type === 'LOAN' 
                                ? formatCurrency((data as StaffLoan).amountRepaid) 
                                : formatCurrency((data as any).amountPaid, (data as any).currency || 'USD')
                            }
                        </span>
                    </div>
                    
                    <div className="flex justify-between text-sm font-medium text-red-600">
                        <span>Balance Due</span>
                        <span>
                            {type === 'LOAN' 
                                ? formatCurrency((data as StaffLoan).amount - (data as StaffLoan).amountRepaid) 
                                : formatCurrency((data as any).totalAmount - (data as any).amountPaid, (data as any).currency || 'USD')
                            }
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <Button onClick={onClose}>Close Preview</Button>
        </div>
      </div>
    </div>
  );
};