import React, { useState } from 'react';
import { Button } from './ui/Button';
import { FirebaseService } from '../src/shared/services/firebaseService';
import { auth, db } from '../src/shared/services/firebaseInstance';

const firebaseService = new FirebaseService();

interface OTPSignupProps {
    onSuccess?: () => void;
    onBackToLogin?: () => void;
}

export const OTPSignup: React.FC<OTPSignupProps> = ({ onSuccess, onBackToLogin }) => {
    const [step, setStep] = useState<'phone' | 'otp' | 'pin'>('phone');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [otpInfo, setOtpInfo] = useState<{ code: string; expiresAt: number } | null>(null);

    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const result = await firebaseService.requestOTP(phone, 'SIGNUP');

            if (!result.success) {
                throw new Error(result.message);
            }

            const otp = await firebaseService.getOTP(phone);

            if (otp.code) {
                setOtpInfo(otp);
            }

            setStep('otp');
        } catch (err: any) {
            setError(err.message || 'Failed to request OTP');
        } finally {
            setIsLoading(false);
        }
    };


    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const normalizedPhone = phone.replace(/\s+/g, '');

            // Use the OTPService directly through firebaseService
            const otpService = firebaseService.authService['otpService'];
            const verification = await otpService.verifyOTP(normalizedPhone, otpCode);

            if (!verification.success) {
                throw new Error(verification.message);
            }

            setStep('pin');
        } catch (err: any) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetupPin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (pin.length < 4) {
            setError('PIN must be at least 4 digits');
            return;
        }

        if (pin !== confirmPin) {
            setError('PINs do not match');
            return;
        }

        setIsLoading(true);

        try {
            // Use registerWithPhone which uses PIN as password
            await firebaseService.registerWithPhone(phone, pin, name, { pin });

            if (onSuccess) {
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create account');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center p-4">
            <div className="mx-auto w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="mb-10 text-center">
                    <div className="flex justify-center mb-6">
                        <img src="/logo/icon.png" alt="Doorstep" className="h-10 w-auto object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        {step === 'phone' ? 'Sign Up with Phone' :
                            step === 'otp' ? 'Verify OTP' :
                                'Set Up Your PIN'}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        {step === 'phone'
                            ? 'Enter your phone number to get started'
                            : step === 'otp'
                                ? 'Enter the OTP code sent to your phone'
                                : 'Create a secure PIN for your account'
                        }
                    </p>
                </div>

                {/* Progress Indicator */}
                <div className="mb-6 flex items-center justify-center gap-2">
                    <div className={`h-2 w-16 rounded-full ${step === 'phone' || step === 'otp' || step === 'pin' ? 'bg-red-500' : 'bg-gray-200'}`} />
                    <div className={`h-2 w-16 rounded-full ${step === 'otp' || step === 'pin' ? 'bg-red-500' : 'bg-gray-200'}`} />
                    <div className={`h-2 w-16 rounded-full ${step === 'pin' ? 'bg-red-500' : 'bg-gray-200'}`} />
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Step 1: Phone Number */}
                {step === 'phone' && (
                    <form onSubmit={handleRequestOTP} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="John Doe"
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
                                placeholder="+1234567890"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Include country code (e.g., +1 for US, +855 for Cambodia)
                            </p>
                        </div>

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            Request OTP Code
                        </Button>

                        {onBackToLogin && (
                            <button
                                type="button"
                                onClick={onBackToLogin}
                                className="w-full text-sm text-gray-600 hover:text-gray-900"
                            >
                                Back to Login
                            </button>
                        )}
                    </form>
                )}

                {/* Step 2: OTP Verification */}
                {step === 'otp' && (
                    <form onSubmit={handleVerifyOTP} className="space-y-5">
                        {otpInfo && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-900 font-medium mb-2">
                                    🔐 Your OTP Code (Development Mode):
                                </p>
                                <p className="text-2xl font-bold text-blue-700 text-center tracking-wider">
                                    {otpInfo.code}
                                </p>
                                <p className="text-xs text-blue-600 mt-2 text-center">
                                    Expires: {new Date(otpInfo.expiresAt).toLocaleTimeString()}
                                </p>
                                <p className="text-xs text-blue-600 mt-1 text-center">
                                    (In production, this will be sent via SMS)
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP Code</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center text-2xl font-bold tracking-widest focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="123456"
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            Verify OTP
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('phone');
                                setOtpCode('');
                                setError(null);
                            }}
                            className="w-full text-sm text-gray-600 hover:text-gray-900"
                        >
                            ← Change Phone Number
                        </button>
                    </form>
                )}

                {/* Step 3: PIN Setup */}
                {step === 'pin' && (
                    <form onSubmit={handleSetupPin} className="space-y-5">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                            <p className="text-sm text-green-900">
                                ✅ Phone number verified! Now create a secure PIN.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Create PIN</label>
                            <input
                                type="password"
                                required
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center text-2xl font-bold tracking-widest focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="••••"
                                value={pin}
                                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                4-6 digits recommended
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
                            <input
                                type="password"
                                required
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center text-2xl font-bold tracking-widest focus:border-red-500 focus:ring-red-500 outline-none transition-colors"
                                placeholder="••••"
                                value={confirmPin}
                                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>

                        <Button type="submit" isLoading={isLoading} className="w-full">
                            Create Account
                        </Button>

                        <button
                            type="button"
                            onClick={() => {
                                setStep('otp');
                                setPin('');
                                setConfirmPin('');
                                setError(null);
                            }}
                            className="w-full text-sm text-gray-600 hover:text-gray-900"
                        >
                            ← Back to OTP
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
