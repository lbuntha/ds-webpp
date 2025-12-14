import React, { useState } from 'react';
import { Button } from './ui/Button';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

interface AuthProps {
  mode: 'LOGIN' | 'REGISTER' | 'RESET';
  onSubmit: (data: any) => Promise<void>;
  onModeChange: (mode: 'LOGIN' | 'REGISTER' | 'RESET') => void;
  onBack?: () => void;
}

export const AuthForms: React.FC<AuthProps> = ({ mode, onSubmit, onModeChange, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Registration specific
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [accountType, setAccountType] = useState<'CUSTOMER' | 'DRIVER' | 'BUSINESS'>('CUSTOMER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const payload: any = { email: email.trim(), password, name: name.trim() };
      
      if (mode === 'REGISTER') {
          payload.phone = phone.trim();
          payload.referredBy = referralCode.trim();
          payload.role = accountType === 'CUSTOMER' ? 'customer' : accountType === 'DRIVER' ? 'driver' : 'accountant';
      }

      await onSubmit(payload);
      
      if (mode === 'RESET') {
          setSuccessMessage('Password reset link sent to your email.');
          setEmail('');
      }
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-row bg-white">
      
      {/* --- LEFT PANEL: BRANDING (Hidden on Mobile) --- */}
      <div className="hidden lg:flex lg:w-5/12 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
                <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-900/50">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-2xl font-bold tracking-tight">Doorstep</span>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight mb-6">
                {mode === 'REGISTER' ? "Join the Future of Logistics." : "Welcome back to your dashboard."}
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                Seamlessly manage bookings, track your fleet, and handle financials in one unified operating system.
            </p>
        </div>
        
        {/* Abstract Visuals */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10 text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Doorstep Logistics. All rights reserved.
        </div>
      </div>

      {/* --- RIGHT PANEL: FORM --- */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative bg-gray-50/50">
        
        {/* Floating Back Button (Desktop) */}
        {onBack && (
            <button 
                onClick={onBack}
                className="absolute top-8 left-8 hidden md:flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors group"
            >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 group-hover:border-slate-400 transition-colors shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </div>
                Back to Home
            </button>
        )}

        <div className="mx-auto w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">
                    {mode === 'LOGIN' ? 'Sign In' : mode === 'REGISTER' ? 'Create Account' : 'Reset Password'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                    {mode === 'LOGIN' ? "Don't have an account? " : mode === 'REGISTER' ? "Already have an account? " : "Remember your password? "}
                    <button 
                        onClick={() => {
                            onModeChange(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                            setError(null);
                            setSuccessMessage(null);
                        }}
                        className="font-bold text-red-600 hover:text-red-700 hover:underline"
                    >
                        {mode === 'LOGIN' ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                
                {mode === 'REGISTER' && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {[
                            { id: 'CUSTOMER', label: 'Customer', icon: '🛍️' },
                            { id: 'DRIVER', label: 'Driver', icon: '🛵' },
                            { id: 'BUSINESS', label: 'Staff', icon: '💼' }
                        ].map((type) => (
                            <div 
                                key={type.id}
                                onClick={() => setAccountType(type.id as any)}
                                className={`cursor-pointer rounded-xl border p-3 text-center transition-all duration-200 ${
                                    accountType === type.id 
                                    ? 'border-red-600 bg-red-50 ring-1 ring-red-600' 
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="text-xl mb-1">{type.icon}</div>
                                <div className={`text-xs font-bold ${accountType === type.id ? 'text-red-700' : 'text-gray-600'}`}>
                                    {type.label}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {mode === 'REGISTER' && (
                    <div className="space-y-4 animate-fade-in-up">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input 
                                type="text" 
                                required 
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="e.g. John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input 
                                type="tel" 
                                required 
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="+855 12 345 678"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>
                        {accountType === 'CUSTOMER' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors uppercase placeholder:normal-case"
                                    placeholder="Enter code if you have one"
                                    value={referralCode}
                                    onChange={e => setReferralCode(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input 
                        type="email" 
                        required 
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                </div>

                {mode !== 'RESET' && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            {mode === 'LOGIN' && (
                                <button type="button" onClick={() => onModeChange('RESET')} className="text-xs font-medium text-red-600 hover:text-red-700">
                                    Forgot password?
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"}
                                required 
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors pr-10"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100 flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 border border-green-100 flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        {successMessage}
                    </div>
                )}

                <Button 
                    type="submit" 
                    className="w-full justify-center py-3 text-base font-semibold shadow-lg shadow-red-200 bg-red-600 hover:bg-red-700 transition-all hover:shadow-red-300" 
                    isLoading={isLoading}
                >
                    {mode === 'LOGIN' ? 'Sign In' : mode === 'REGISTER' ? 'Create Account' : 'Send Reset Link'}
                </Button>

                {/* Inline Back Button for Mobile/Ease of Access */}
                {onBack && (
                    <div className="mt-4 text-center border-t border-gray-100 pt-4">
                         <button 
                            type="button" 
                            onClick={onBack}
                            className="text-sm text-slate-500 hover:text-slate-800 flex items-center justify-center mx-auto transition-colors"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                            Back to Home
                        </button>
                    </div>
                )}
            </form>
        </div>
      </div>
    </div>
  );
};