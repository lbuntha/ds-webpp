
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';

interface Props {
  user: UserProfile;
  onUpdateProfile: (name: string) => Promise<void>;
}

export const UserProfileView: React.FC<Props> = ({ user, onUpdateProfile }) => {
  const [name, setName] = useState(user.name);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await onUpdateProfile(name);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <div className="flex flex-col items-center pb-6 border-b border-gray-100">
          <Avatar name={name || user.name} size="xl" className="mb-4 shadow-md" />
          <h2 className="text-2xl font-bold text-gray-900">{name || user.name}</h2>
          <span className="px-3 py-1 mt-2 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full capitalize">
            {(user.role || '').replace('-', ' ')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="flex items-center px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-gray-500 sm:text-sm">
                <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {user.email}
                <span className="ml-auto text-xs text-gray-400">(Read Only)</span>
              </div>
            </div>

            <Input
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account ID</label>
                <div className="text-xs font-mono text-gray-400 break-all">
                    {user.uid}
                </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
