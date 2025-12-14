
import React, { useState, useEffect } from 'react';
import { DriverCommissionRule } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { firebaseService } from '../../services/firebaseService';

export const DriverCommissionSetup: React.FC = () => {
  const [rules, setRules] = useState<DriverCommissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [zoneName, setZoneName] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [value, setValue] = useState<number>(70);
  const [isDefault, setIsDefault] = useState(false);

  const loadRules = async () => {
      setLoading(true);
      try {
          const data = await firebaseService.logisticsService.getDriverCommissionRules();
          setRules(data.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))); // Default at top
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadRules();
  }, []);

  const resetForm = () => {
      setEditingId(null);
      setZoneName('');
      setType('PERCENTAGE');
      setValue(70);
      setIsDefault(false);
  };

  const handleEdit = (rule: DriverCommissionRule) => {
      setEditingId(rule.id);
      setZoneName(rule.zoneName);
      setType(rule.type);
      setValue(rule.value);
      setIsDefault(rule.isDefault);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!zoneName) return;

      setLoading(true);
      try {
          // If setting default, unset others locally for logic (backend doesn't enforce, but good practice)
          if (isDefault) {
              const currentDefault = rules.find(r => r.isDefault && r.id !== editingId);
              if (currentDefault) {
                  await firebaseService.logisticsService.saveDriverCommissionRule({ ...currentDefault, isDefault: false });
              }
          }

          const rule: DriverCommissionRule = {
              id: editingId || `comm-${Date.now()}`,
              zoneName,
              type,
              value,
              isDefault,
              currency: 'USD'
          };

          await firebaseService.logisticsService.saveDriverCommissionRule(rule);
          resetForm();
          await loadRules();
      } catch (e) {
          alert("Failed to save rule");
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Delete this commission rule?")) {
          await firebaseService.logisticsService.deleteDriverCommissionRule(id);
          loadRules();
      }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card title={editingId ? "Edit Rule" : "Add Commission Rule"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input 
                        label="Zone / Rule Name" 
                        value={zoneName} 
                        onChange={e => setZoneName(e.target.value)} 
                        placeholder="e.g. Phnom Penh Standard" 
                        required 
                    />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Commission Type</label>
                        <div className="flex rounded-md shadow-sm">
                            <button
                                type="button"
                                onClick={() => setType('PERCENTAGE')}
                                className={`flex-1 py-2 text-xs font-bold border rounded-l-lg ${type === 'PERCENTAGE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                            >
                                Percentage (%)
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('FIXED_AMOUNT')}
                                className={`flex-1 py-2 text-xs font-bold border rounded-r-lg ${type === 'FIXED_AMOUNT' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                            >
                                Fixed Amount ($)
                            </button>
                        </div>
                    </div>

                    <Input 
                        label={type === 'PERCENTAGE' ? "Percentage Value (e.g. 70 for 70%)" : "Fixed Amount ($)"}
                        type="number" 
                        step={type === 'PERCENTAGE' ? "1" : "0.01"}
                        value={value} 
                        onChange={e => setValue(parseFloat(e.target.value))} 
                        required 
                    />

                    <div className="flex items-center space-x-2 pt-2">
                        <input 
                            type="checkbox" 
                            id="isDefault"
                            checked={isDefault}
                            onChange={e => setIsDefault(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Set as Default Rule
                        </label>
                    </div>
                    <p className="text-xs text-gray-500">Default rule applies to all bookings unless a specific zone is matched.</p>

                    <div className="flex justify-end space-x-2 pt-4">
                        {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
                        <Button type="submit" isLoading={loading}>{editingId ? 'Update Rule' : 'Save Rule'}</Button>
                    </div>
                </form>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card title="Commission Configuration">
                {rules.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No rules configured. System will default to 70%.</div>
                ) : (
                    <div className="space-y-3">
                        {rules.map(rule => (
                            <div key={rule.id} className={`flex justify-between items-center p-4 border rounded-xl hover:shadow-sm transition-shadow bg-white ${rule.isDefault ? 'border-l-4 border-l-indigo-500' : 'border-gray-200'}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900">{rule.zoneName}</h4>
                                        {rule.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Default</span>}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Driver gets: <span className="font-bold text-green-600">{rule.type === 'PERCENTAGE' ? `${rule.value}%` : `$${rule.value.toFixed(2)}`}</span> per booking
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(rule)} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-2">Edit</button>
                                    <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-900 text-sm font-medium px-2">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    </div>
  );
};
