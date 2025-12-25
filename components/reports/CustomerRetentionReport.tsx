import React, { useState, useEffect, useMemo } from 'react';
import { ParcelBooking, Customer } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const CustomerRetentionReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<ParcelBooking[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<'ALL' | '2_DAYS' | '5_DAYS' | '7_DAYS' | 'OVER_7'>('ALL');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [custData, bookData] = await Promise.all([
          firebaseService.getCustomers(),
          firebaseService.getParcelBookings()
        ]);
        setCustomers(custData);
        setBookings(bookData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today

    // 1. Map Last Booking Date per Customer
    const lastActiveMap: Record<string, string> = {}; // customerId -> ISO Date String

    bookings.forEach(b => {
        if (!b.senderId) return; // Skip walk-ins without ID
        
        // We look for the LATEST date
        if (!lastActiveMap[b.senderId] || b.bookingDate > lastActiveMap[b.senderId]) {
            lastActiveMap[b.senderId] = b.bookingDate;
        }
    });

    // 2. Build Report Rows
    const rows = customers.map(c => {
        const lastDateStr = lastActiveMap[c.id];
        let daysInactive = -1; // -1 means Never Ordered

        if (lastDateStr) {
            const lastDate = new Date(lastDateStr);
            lastDate.setHours(0, 0, 0, 0);
            
            const diffTime = today.getTime() - lastDate.getTime();
            daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        // Categorize
        let bucket: 'ACTIVE' | '2_DAYS' | '5_DAYS' | '7_DAYS' | 'OVER_7' | 'NEVER' = 'ACTIVE';

        if (daysInactive === -1) bucket = 'NEVER';
        else if (daysInactive > 7) bucket = 'OVER_7';
        else if (daysInactive === 7) bucket = '7_DAYS';
        else if (daysInactive >= 5) bucket = '5_DAYS';
        else if (daysInactive >= 2) bucket = '2_DAYS';
        else bucket = 'ACTIVE'; // 0 or 1 day

        return {
            ...c,
            lastActiveDate: lastDateStr,
            daysInactive,
            bucket
        };
    });

    // Filter out 'NEVER' for this specific churn report (optional, but usually noise)
    return rows.filter(r => r.bucket !== 'NEVER').sort((a, b) => b.daysInactive - a.daysInactive);
  }, [customers, bookings]);

  const stats = useMemo(() => {
      return {
          d2: reportData.filter(r => r.bucket === '2_DAYS').length,
          d5: reportData.filter(r => r.bucket === '5_DAYS').length,
          d7: reportData.filter(r => r.bucket === '7_DAYS').length,
          over7: reportData.filter(r => r.bucket === 'OVER_7').length,
      };
  }, [reportData]);

  const filteredList = reportData.filter(r => selectedBucket === 'ALL' || r.bucket === selectedBucket);

  const StatCard = ({ label, count, active, onClick, colorClass }: any) => (
      <div 
        onClick={onClick}
        className={`p-4 rounded-xl border cursor-pointer transition-all ${active ? `ring-2 ring-offset-2 ${colorClass.ring} bg-white` : 'bg-gray-50 border-gray-200 hover:bg-white'}`}
      >
          <div className="flex justify-between items-start">
              <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">{label}</p>
                  <h3 className={`text-2xl font-bold mt-1 ${colorClass.text}`}>{count}</h3>
              </div>
              <div className={`p-2 rounded-full ${colorClass.bg} ${colorClass.text}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Customers Inactive</p>
      </div>
  );

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center print:hidden">
            <div>
                <h2 className="text-lg font-bold text-gray-900">Customer Retention Report</h2>
                <p className="text-sm text-gray-500">Identify inactive customers who have stopped booking.</p>
            </div>
            <Button variant="outline" onClick={() => window.print()}>Print Report</Button>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
                label="2-4 Days" 
                count={stats.d2} 
                active={selectedBucket === '2_DAYS'} 
                onClick={() => setSelectedBucket(selectedBucket === '2_DAYS' ? 'ALL' : '2_DAYS')}
                colorClass={{ text: 'text-yellow-600', bg: 'bg-yellow-100', ring: 'ring-yellow-500' }}
            />
            <StatCard 
                label="5-6 Days" 
                count={stats.d5} 
                active={selectedBucket === '5_DAYS'} 
                onClick={() => setSelectedBucket(selectedBucket === '5_DAYS' ? 'ALL' : '5_DAYS')}
                colorClass={{ text: 'text-orange-600', bg: 'bg-orange-100', ring: 'ring-orange-500' }}
            />
            <StatCard 
                label="Exactly 7 Days" 
                count={stats.d7} 
                active={selectedBucket === '7_DAYS'} 
                onClick={() => setSelectedBucket(selectedBucket === '7_DAYS' ? 'ALL' : '7_DAYS')}
                colorClass={{ text: 'text-red-500', bg: 'bg-red-100', ring: 'ring-red-400' }}
            />
            <StatCard 
                label="> 7 Days (Churn)" 
                count={stats.over7} 
                active={selectedBucket === 'OVER_7'} 
                onClick={() => setSelectedBucket(selectedBucket === 'OVER_7' ? 'ALL' : 'OVER_7')}
                colorClass={{ text: 'text-slate-600', bg: 'bg-slate-200', ring: 'ring-slate-500' }}
            />
        </div>

        <Card>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Booking</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days Inactive</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading analysis...</td></tr>
                        ) : filteredList.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">No customers found in this category.</td></tr>
                        ) : (
                            filteredList.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{c.phone}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                                        {c.lastActiveDate || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-lg font-bold text-gray-700">{c.daysInactive}</span>
                                        <span className="text-xs text-gray-400 ml-1">days</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {c.bucket === 'ACTIVE' && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">Active</span>}
                                        {c.bucket === '2_DAYS' && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">Slipping</span>}
                                        {c.bucket === '5_DAYS' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold">At Risk</span>}
                                        {(c.bucket === '7_DAYS' || c.bucket === 'OVER_7') && <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">Inactive</span>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    </div>
  );
};
