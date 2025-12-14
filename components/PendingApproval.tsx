
import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { firebaseService } from '../services/firebaseService';

interface Props {
  onLogout: () => void;
  userName: string;
}

export const PendingApproval: React.FC<Props> = ({ onLogout, userName }) => {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
        try {
            const user = await firebaseService.getCurrentUser();
            if (user && user.status === 'APPROVED') {
                window.location.reload(); // Refresh to enter the main app
            }
        } catch (e) {
            console.error("Status check failed", e);
        }
    };
    
    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualCheck = async () => {
      setIsChecking(true);
      const user = await firebaseService.getCurrentUser();
      if (user && user.status === 'APPROVED') {
          window.location.reload();
      } else {
          setTimeout(() => setIsChecking(false), 500); // Small delay for UX
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full text-center p-8 border-t-4 border-indigo-600 shadow-xl">
        <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-indigo-50 rounded-full flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-25"></div>
                <svg className="h-10 w-10 text-indigo-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
        <p className="text-gray-600 mb-6 leading-relaxed">
            Hi <strong>{userName}</strong>, your account has been created successfully. 
            <br/>
            For security, a System Administrator must approve your access before you can enter the dashboard.
        </p>

        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-8 text-sm text-yellow-800 flex items-start text-left">
            <svg className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
                We are automatically checking your status. You will be redirected automatically once approved.
            </span>
        </div>

        <div className="space-y-3">
            <Button onClick={handleManualCheck} isLoading={isChecking} className="w-full justify-center bg-indigo-600 hover:bg-indigo-700">
                Check Status Now
            </Button>
            <Button variant="outline" onClick={onLogout} className="w-full justify-center">
                Sign Out
            </Button>
        </div>
      </Card>
    </div>
  );
};
