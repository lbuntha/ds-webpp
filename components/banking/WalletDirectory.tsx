
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, UserRole } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { WalletDashboard } from '../wallet/WalletDashboard';

export const WalletDirectory: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'customer' | 'driver'>('ALL');
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
      const loadUsers = async () => {
          setLoading(true);
          try {
              const allUsers = await firebaseService.getUsers();
              // Filter out admins/staff to focus on wallet users
              const walletUsers = allUsers.filter(u => u.role === 'customer' || u.role === 'driver');
              setUsers(walletUsers);
          } catch (e) {
              console.error(e);
          } finally {
              setLoading(false);
          }
      };
      loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
      return users.filter(user => {
          const matchesRole = filterRole === 'ALL' || user.role === filterRole;
          const matchesSearch = 
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.phone && user.phone.includes(searchTerm));
          return matchesRole && matchesSearch;
      });
  }, [users, filterRole, searchTerm]);

  return (
    <div className="space-y-6">
      {selectedUser ? (
          <div>
              <div className="mb-4">
                  <button 
                    onClick={() => setSelectedUser(null)} 
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center"
                  >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                      Back to Directory
                  </button>
              </div>
              <WalletDashboard user={selectedUser} />
          </div>
      ) : (
          <Card title="User Wallet Directory">
              <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                      <button 
                          onClick={() => setFilterRole('ALL')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterRole === 'ALL' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                      >
                          All
                      </button>
                      <button 
                          onClick={() => setFilterRole('customer')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterRole === 'customer' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:text-gray-900'}`}
                      >
                          Customers
                      </button>
                      <button 
                          onClick={() => setFilterRole('driver')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterRole === 'driver' ? 'bg-white shadow text-orange-700' : 'text-gray-500 hover:text-gray-900'}`}
                      >
                          Drivers
                      </button>
                  </div>
                  <div className="relative w-full md:w-64">
                      <input 
                          type="text" 
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {filteredUsers.map((u) => (
                              <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <Avatar name={u.name} size="sm" className="mr-3" />
                                          <div>
                                              <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                              <div className="text-xs text-gray-500">{u.email}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                                          u.role === 'customer' ? 'bg-teal-100 text-teal-800' : 
                                          u.role === 'driver' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100'
                                      }`}>
                                          {u.role}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {u.phone || '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button 
                                          onClick={() => setSelectedUser(u)}
                                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:border-indigo-300 transition-all"
                                      >
                                          View Wallet
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {filteredUsers.length === 0 && (
                              <tr>
                                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                      {loading ? 'Loading users...' : 'No users found matching your filters.'}
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}
    </div>
  );
};
