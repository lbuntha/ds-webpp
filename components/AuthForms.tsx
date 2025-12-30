import React, { useState } from 'react';
import { Button } from './ui/Button';
import { getFriendlyErrorMessage } from '../src/shared/utils/errorUtils';

interface AuthProps {
    mode: 'LOGIN' | 'REGISTER' | 'RESET' | 'EMAIL_SENT' | 'VERIFY';
    onSubmit: (data: any) => Promise<void>;
    onModeChange: (mode: 'LOGIN' | 'REGISTER' | 'RESET') => void;
    onBack?: () => void;
    onGoogleSignIn?: (role: string) => Promise<void>;
}

export const AuthForms: React.FC<AuthProps> = ({ mode, onSubmit, onModeChange, onBack, onGoogleSignIn }) => {
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
    const [confirmPassword, setConfirmPassword] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        if (!onGoogleSignIn) return;
        setGoogleLoading(true);
        setError(null);
        try {
            const role = accountType === 'DRIVER' ? 'driver' : 'customer';
            await onGoogleSignIn(role);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setGoogleLoading(false);
        }
    };

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
                // Password is now included for direct registration
            }

            if (mode === 'VERIFY') {
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match");
                }
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
                    <div className="flex items-center gap-3 mb-10">
                        <img src="/logo/icon.png" alt="Doorstep" className="h-8 w-8 object-contain" />
                        <span className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">Doorstep</span>
                    </div>
                    <h1 className="text-4xl font-extrabold leading-tight mb-6">
                        {mode === 'REGISTER' || mode === 'EMAIL_SENT' ? "Join the Future of Logistics." : mode === 'VERIFY' ? "Set Your Password." : "Welcome back to your dashboard."}
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

                <div className="mx-auto w-full max-w-md bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                    <div className="mb-8 text-center">
                        <div className="flex justify-center mb-6">
                            <img src="/logo/icon.png" alt="Doorstep" className="h-10 w-auto object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {mode === 'LOGIN' ? 'Sign In' :
                                mode === 'REGISTER' ? 'Create Account' :
                                    mode === 'RESET' ? 'Reset Password' :
                                        mode === 'EMAIL_SENT' ? 'Check Your Email' :
                                            'Set Your Password'}
                        </h2>
                        {mode !== 'EMAIL_SENT' && mode !== 'VERIFY' && (
                            <div className="mt-2 flex flex-col gap-1">
                                <p className="text-xs text-slate-600">
                                    {mode === 'LOGIN' ? "Don't have an account? " : mode === 'REGISTER' ? "Already have an account? " : "Remember your password? "}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onModeChange(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                                            setError(null);
                                            setSuccessMessage(null);
                                        }}
                                        className="font-bold text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        {mode === 'LOGIN' ? 'Sign up' : 'Log in'}
                                    </button>
                                </p>
                                {mode === 'REGISTER' && (
                                    <p className="text-xs text-slate-600">
                                        Or{' '}
                                        <a
                                            href="/signup/phone"
                                            className="font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                                        >
                                            📱 Sign up with Phone
                                        </a>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Google Sign-In Button - Primary Option for Register */}
                        {(mode === 'LOGIN' || mode === 'REGISTER') && onGoogleSignIn && (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={handleGoogleSignIn}
                                    disabled={googleLoading}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all font-semibold text-sm text-slate-700 shadow-sm active:scale-[0.98] disabled:opacity-50"
                                >
                                    {googleLoading ? (
                                        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    )}
                                    Continue with Google
                                </button>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-100" />
                                    </div>
                                    <div className="relative flex justify-center text-[10px]">
                                        <span className="px-2 bg-white text-slate-400 font-semibold uppercase tracking-wider">or</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {mode === 'EMAIL_SENT' && (
                            <div className="text-center py-8 animate-fade-in-up">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                                <p className="text-slate-600 mb-6">
                                    We've sent a verification link to <span className="font-bold text-slate-900">{email}</span>. Please click the link in your email to continue.
                                </p>
                                <Button
                                    onClick={() => onModeChange('LOGIN')}
                                    variant="outline"
                                    className="w-full"
                                >
                                    Back to Login
                                </Button>
                            </div>
                        )}

                        {mode === 'REGISTER' && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAccountType('CUSTOMER')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 group ${accountType === 'CUSTOMER'
                                        ? 'border-red-500 bg-red-50/50 text-red-600 shadow-sm'
                                        : 'border-slate-100 bg-slate-50/30 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg mb-1 transition-colors ${accountType === 'CUSTOMER' ? 'bg-red-100/50' : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}`}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold">Customer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('DRIVER')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 group ${accountType === 'DRIVER'
                                        ? 'border-red-500 bg-red-50/50 text-red-600 shadow-sm'
                                        : 'border-slate-100 bg-slate-50/30 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg mb-1 transition-colors ${accountType === 'DRIVER' ? 'bg-red-100/50' : 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}`}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold">Driver</span>
                                </button>
                            </div>
                        )}

                        {/* REGISTER Mode: Name, Phone, Referral, Email (NO PASSWORD) */}
                        {mode === 'REGISTER' && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="e.g. John Doe"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="+855 12 345 678"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                                        Referral Code
                                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">Optional</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all uppercase placeholder:normal-case placeholder:text-slate-400"
                                        placeholder="Enter code if you have one"
                                        value={referralCode}
                                        onChange={e => setReferralCode(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Shared Email Field for LOGIN, REGISTER, RESET */}
                        {(mode === 'LOGIN' || mode === 'REGISTER' || mode === 'RESET') && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    {mode === 'REGISTER' ? 'Email Address' : 'Email or Phone Number'}
                                </label>
                                <input
                                    type={mode === 'REGISTER' ? 'email' : 'text'}
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                                    placeholder={mode === 'REGISTER' ? 'you@example.com' : 'you@example.com or +855...'}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Password Fields for LOGIN and VERIFY (Not REGISTER) */}
                        {(mode === 'LOGIN' || mode === 'VERIFY') && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-700">
                                            {mode === 'VERIFY' ? 'Set Your Password' : 'Password'}
                                        </label>
                                        {mode === 'LOGIN' && (
                                            <button type="button" onClick={() => onModeChange('RESET')} className="text-xs font-bold text-red-600 hover:text-red-700">
                                                Forgot?
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all pr-12 placeholder:text-slate-400"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                        >
                                            {showPassword ? (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {mode === 'VERIFY' && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-600 border border-red-100 flex items-start gap-3 animate-head-shake">
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="rounded-xl bg-green-50 p-4 text-xs font-medium text-green-700 border border-green-100 flex items-start gap-3 animate-bounce">
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                <span className="leading-relaxed">{successMessage}</span>
                            </div>
                        )}

                        {mode !== 'EMAIL_SENT' && (
                            <Button
                                type="submit"
                                className="w-full justify-center py-3 text-sm font-bold shadow-[0_8px_16px_-4px_rgba(220,38,38,0.25)] bg-red-600 hover:bg-red-700 transition-all hover:-translate-y-0.5 active:translate-y-0 rounded-xl"
                                isLoading={isLoading}
                            >
                                {mode === 'LOGIN' ? 'Sign In' :
                                    mode === 'REGISTER' ? 'Create Account' :
                                        mode === 'RESET' ? 'Send Reset Link' :
                                            'Complete Registration'}
                            </Button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};