import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Button } from '../../../components/ui/Button';

type Step = 'LOADING' | 'NEW_PASSWORD' | 'SUCCESS' | 'ERROR';

export default function EmailResetView() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState<Step>('LOADING');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const oobCode = searchParams.get('oobCode');

    useEffect(() => {
        const verifyCode = async () => {
            if (!oobCode) {
                setError('Invalid or missing reset code. Please request a new password reset.');
                setStep('ERROR');
                return;
            }

            try {
                const userEmail = await verifyPasswordResetCode(auth, oobCode);
                setEmail(userEmail);
                setStep('NEW_PASSWORD');
            } catch (err: any) {
                console.error('Verify code error:', err);
                if (err.code === 'auth/expired-action-code') {
                    setError('This password reset link has expired. Please request a new one.');
                } else if (err.code === 'auth/invalid-action-code') {
                    setError('This password reset link is invalid or has already been used.');
                } else {
                    setError('Failed to verify reset link. Please try again.');
                }
                setStep('ERROR');
            }
        };

        verifyCode();
    }, [oobCode]);

    const handleResetPassword = async () => {
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await confirmPasswordReset(auth, oobCode!, password);
            setStep('SUCCESS');
        } catch (err: any) {
            console.error('Reset password error:', err);
            if (err.code === 'auth/weak-password') {
                setError('Password is too weak. Please choose a stronger password.');
            } else if (err.code === 'auth/expired-action-code') {
                setError('This reset link has expired. Please request a new one.');
            } else {
                setError('Failed to reset password. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-row bg-white">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-5/12 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-10">
                        <img src="/logo/icon.png" alt="Doorstep" className="h-8 w-8 object-contain" />
                        <span className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">Doorstep</span>
                    </div>
                    <h1 className="text-4xl font-extrabold leading-tight mb-6">
                        Reset Your Password
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                        Create a strong, memorable password to secure your account.
                    </p>
                </div>
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <button
                        onClick={() => navigate('/auth/login')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Login
                    </button>

                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        {step === 'LOADING' && (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                                <p className="text-slate-600">Verifying reset link...</p>
                            </div>
                        )}

                        {step === 'ERROR' && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">Link Invalid</h2>
                                <p className="text-slate-600 mb-8">{error}</p>
                                <Button onClick={() => navigate('/auth/reset')} className="w-full">
                                    Request New Reset Link
                                </Button>
                            </div>
                        )}

                        {step === 'SUCCESS' && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Reset!</h2>
                                <p className="text-slate-600 mb-8">Your password has been successfully updated. You can now log in with your new password.</p>
                                <Button onClick={() => navigate('/auth/login')} className="w-full">
                                    Go to Login
                                </Button>
                            </div>
                        )}

                        {step === 'NEW_PASSWORD' && (
                            <>
                                <div className="mb-8 text-center">
                                    <div className="flex justify-center mb-6">
                                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                            <span className="text-3xl">🔐</span>
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900">Create New Password</h2>
                                    <p className="mt-2 text-sm text-slate-600">
                                        for <span className="font-medium text-slate-800">{email}</span>
                                    </p>
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleResetPassword}
                                        isLoading={isLoading}
                                        className="w-full py-3"
                                    >
                                        Reset Password
                                    </Button>
                                </div>

                                {/* Password requirements */}
                                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                    <p className="text-xs font-medium text-slate-500 mb-2">Password Requirements:</p>
                                    <ul className="text-xs text-slate-500 space-y-1">
                                        <li className={password.length >= 6 ? 'text-green-600' : ''}>
                                            • At least 6 characters
                                        </li>
                                        <li className={password === confirmPassword && password.length > 0 ? 'text-green-600' : ''}>
                                            • Passwords must match
                                        </li>
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
