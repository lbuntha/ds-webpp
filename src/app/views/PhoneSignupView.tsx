import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firebaseService } from '../../shared/services/firebaseService';
import { Button } from '../../../components/ui/Button';
import { getFriendlyErrorMessage } from '../../shared/utils/errorUtils';

type Step = 'PHONE' | 'OTP' | 'DETAILS';

export default function PhoneSignupView() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('PHONE');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'customer' | 'driver'>('customer');
    const [referralCode, setReferralCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(null); // For development

    const handleRequestOTP = async () => {
        if (!phone.trim()) {
            setError('Please enter your phone number');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await firebaseService.requestOTP(phone.trim(), 'SIGNUP');
            if (result.success) {
                // For development, fetch the OTP to display
                const otpData = await firebaseService.getOTP(phone.trim());
                if (otpData.code) {
                    setDevOtp(otpData.code);
                }
                setStep('OTP');
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp.trim() || otp.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Just verify OTP validity, don't complete signup yet
            setStep('DETAILS');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompleteSignup = async () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await firebaseService.signupWithOTP(phone.trim(), otp, name.trim(), {
                role: role,
                password: password,
                referredBy: referralCode.trim() || undefined,
            });
            navigate('/app', { replace: true });
        } catch (err: any) {
            const msg = getFriendlyErrorMessage(err);
            setError(msg);

            // If OTP is missing/expired, they need to go back
            if (msg.includes('No OTP found') || msg.includes('expired')) {
                setOtp('');
                setDevOtp(null);
                setStep('PHONE');
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
                        Sign Up with Phone
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                        No email required. Sign up quickly with just your phone number.
                    </p>
                </div>
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-red-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <button
                        onClick={() => step === 'PHONE' ? navigate('/auth/register') : setStep(step === 'OTP' ? 'PHONE' : 'OTP')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </button>

                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="mb-8 text-center">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-3xl">📱</span>
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                {step === 'PHONE' ? 'Enter Phone Number' :
                                    step === 'OTP' ? 'Verify Code' :
                                        'Complete Profile'}
                            </h2>
                            <p className="mt-2 text-sm text-slate-600">
                                {step === 'PHONE' ? 'We\'ll send you a verification code' :
                                    step === 'OTP' ? `Enter the code sent to ${phone}` :
                                        'Just a few more details'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Development OTP Display */}
                        {devOtp && step === 'OTP' && (
                            <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                                <strong>Dev Mode:</strong> Your OTP is <code className="font-mono bg-blue-100 px-2 py-1 rounded">{devOtp}</code>
                            </div>
                        )}

                        {step === 'PHONE' && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="e.g., 012 345 678"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    onClick={handleRequestOTP}
                                    isLoading={isLoading}
                                    className="w-full py-3"
                                >
                                    Send Code
                                </Button>
                            </div>
                        )}

                        {step === 'OTP' && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Verification Code
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Enter 6-digit code"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg text-center tracking-widest font-mono"
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    onClick={handleVerifyOTP}
                                    isLoading={isLoading}
                                    className="w-full py-3"
                                >
                                    Verify Code
                                </Button>
                                <button
                                    onClick={handleRequestOTP}
                                    className="w-full text-sm text-blue-600 hover:text-blue-700"
                                    disabled={isLoading}
                                >
                                    Resend Code
                                </button>
                            </div>
                        )}

                        {step === 'DETAILS' && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"
                                        autoFocus
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setRole('customer')}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === 'customer'
                                            ? 'border-red-500 bg-red-50 text-red-600'
                                            : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                        <span className="text-xs font-bold">Customer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('driver')}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === 'driver'
                                            ? 'border-red-500 bg-red-50 text-red-600'
                                            : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                        </svg>
                                        <span className="text-xs font-bold">Driver</span>
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create a password (min 6 chars)"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Referral Code (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value)}
                                        placeholder="Enter code if you have one"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                    />
                                </div>
                                <Button
                                    onClick={handleCompleteSignup}
                                    isLoading={isLoading}
                                    className="w-full py-3"
                                >
                                    Create Account
                                </Button>
                            </div>
                        )}

                        {/* Steps indicator */}
                        <div className="flex justify-center mt-8 gap-2">
                            {['PHONE', 'OTP', 'DETAILS'].map((s, i) => (
                                <div
                                    key={s}
                                    className={`w-2 h-2 rounded-full transition-colors ${step === s ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
