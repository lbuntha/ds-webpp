
import React, { useState } from 'react';
import { Employee } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  employees: Employee[];
  onAddEmployee: (employee: Employee) => Promise<void>;
  onUpdateEmployee: (employee: Employee) => Promise<void>;
}

export const EmployeeList: React.FC<Props> = ({ employees, onAddEmployee, onUpdateEmployee }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPosition('');
    setDepartment('');
  };

  const openAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditingId(e.id);
    setName(e.name);
    setEmail(e.email || '');
    setPhone(e.phone || '');
    setPosition(e.position || '');
    setDepartment(e.department || '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    const employeeData: Employee = {
      id: editingId || `emp-${Date.now()}`,
      name,
      email,
      phone,
      position,
      department,
      createdAt: editingId ? (employees.find(e => e.id === editingId)?.createdAt || Date.now()) : Date.now()
    };

    try {
      if (editingId) {
        await onUpdateEmployee(employeeData);
      } else {
        await onAddEmployee(employeeData);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (e) {
      console.error("Failed to save employee", e);
      alert("Failed to save employee record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Employee Directory</h2>
        <Button onClick={openAdd} disabled={isFormOpen}>+ Add Employee</Button>
      </div>

      {isFormOpen && (
        <Card className="mb-6 border-indigo-100 ring-2 ring-indigo-50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
               <h3 className="font-medium text-gray-900">{editingId ? 'Edit Employee Profile' : 'New Employee Profile'}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                     <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                <Input label="Position / Title" value={position} onChange={e => setPosition(e.target.value)} />
                <Input label="Department" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsFormOpen(false)} type="button">Cancel</Button>
              <Button type="submit" isLoading={loading}>{editingId ? 'Update Employee' : 'Save Employee'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role / Dept</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{e.name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                     {e.position && <div className="text-gray-900 font-medium">{e.position}</div>}
                     {e.department && <div className="text-xs">{e.department}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {e.email && <div className="text-xs">{e.email}</div>}
                    {e.phone && <div className="text-xs">{e.phone}</div>}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <button 
                      onClick={() => openEdit(e)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
