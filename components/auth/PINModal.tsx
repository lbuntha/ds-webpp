import { useState } from 'react';
import { PINInput } from './PINInput';
import { Button } from '../ui/Button';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface PINModalProps {
    mode: 'setup' | 'unlock' | 'change' | 'reset';
    userId: string;
    userPhone?: string;
    onSuccess: () => void;
    onCancel: () => void;
    onForgotPIN?: () => void;
}

/**
 * Modal component for PIN setup, unlock, change, and reset flows
 */
export function PINModal({
    mode,
    userId,
    userPhone,
    onSuccess,
    onCancel,
    onForgotPIN
}: PINModalProps) {
    const [step, setStep] = useState<'enter' | 'confirm' | 'otp' | 'newpin'>('enter');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(null);

    const handlePINEntered = async (enteredPin: string) => {
        setError(null);

        if (mode === 'unlock') {
            // Verify PIN
            setIsLoading(true);
            const result = await firebaseService.verifyUserPIN(userId, enteredPin);
            setIsLoading(false);

            if (result.success) {
                onSuccess();
            } else {
                setError(result.message);
            }
        } else if (mode === 'setup' || mode === 'change') {
            if (step === 'enter') {
                setPin(enteredPin);
                setStep('confirm');
            } else if (step === 'confirm') {
                if (enteredPin !== pin) {
                    setError('PINs do not match. Please try again.');
                    setStep('enter');
                    setPin('');
                } else {
                    // Save PIN
                    setIsLoading(true);
                    const result = await firebaseService.setUserPIN(userId, enteredPin);
                    setIsLoading(false);

                    if (result.success) {
                        onSuccess();
                    } else {
                        setError(result.message);
                    }
                }
            }
        } else if (mode === 'reset') {
            if (step === 'newpin') {
                setPin(enteredPin);
                setStep('confirm');
            } else if (step === 'confirm') {
                if (enteredPin !== pin) {
                    setError('PINs do not match. Please try again.');
                    setStep('newpin');
                    setPin('');
                } else {
                    // Reset PIN with OTP
                    setIsLoading(true);
                    const result = await firebaseService.resetPINWithOTP(userPhone || '', otp, enteredPin);
                    setIsLoading(false);

                    if (result.success) {
                        onSuccess();
                    } else {
                        setError(result.message);
                    }
                }
            }
        }
    };

    const handleRequestOTP = async () => {
        if (!userPhone) {
            setError('No phone number associated with this account');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await firebaseService.requestOTP(userPhone, 'LOGIN');
            if (result.success) {
                const otpData = await firebaseService.getOTP(userPhone);
                if (otpData.code) {
                    setDevOtp(otpData.code);
                }
                setStep('otp');
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
        setStep('newpin');
    };

    const getTitle = () => {
        if (mode === 'setup') return step === 'confirm' ? 'Confirm Your PIN' : 'Set Up Your PIN';
        if (mode === 'unlock') return 'Enter Your PIN';
        if (mode === 'change') return step === 'confirm' ? 'Confirm New PIN' : 'Enter New PIN';
        if (mode === 'reset') {
            if (step === 'otp') return 'Enter Verification Code';
            if (step === 'newpin') return 'Enter New PIN';
            if (step === 'confirm') return 'Confirm New PIN';
            return 'Reset PIN';
        }
        return '';
    };

    const getSubtitle = () => {
        if (mode === 'setup') return step === 'confirm' ? 'Enter your PIN again to confirm' : 'Create a 4-digit PIN for quick access';
        if (mode === 'unlock') return 'Enter your 4-digit PIN to continue';
        if (mode === 'change') return step === 'confirm' ? 'Enter the PIN again' : 'Create your new 4-digit PIN';
        if (mode === 'reset') {
            if (step === 'otp') return `Code sent to ${userPhone}`;
            return 'Create a new 4-digit PIN';
        }
        return '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{getTitle()}</h2>
                    <p className="text-sm text-slate-600 mt-1">{getSubtitle()}</p>
                </div>

                {/* Dev OTP Display */}
                {devOtp && step === 'otp' && (
                    <div className="mb-6 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm text-center">
                        <strong>Dev:</strong> OTP is <code className="font-mono bg-blue-100 px-2 py-0.5 rounded">{devOtp}</code>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center">
                        {error}
                    </div>
                )}

                {/* OTP Input for Reset */}
                {mode === 'reset' && step === 'otp' && (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit code"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-center text-xl tracking-widest font-mono"
                            maxLength={6}
                            autoFocus
                        />
                        <Button
                            onClick={handleVerifyOTP}
                            isLoading={isLoading}
                            disabled={otp.length !== 6}
                            className="w-full"
                        >
                            Verify Code
                        </Button>
                    </div>
                )}

                {/* Request OTP for Reset */}
                {mode === 'reset' && step === 'enter' && (
                    <div className="space-y-4">
                        <p className="text-center text-slate-600 text-sm">
                            We'll send a verification code to your phone number to reset your PIN.
                        </p>
                        <Button
                            onClick={handleRequestOTP}
                            isLoading={isLoading}
                            className="w-full"
                        >
                            Send Code to {userPhone}
                        </Button>
                    </div>
                )}

                {/* PIN Input for other steps */}
                {((mode !== 'reset' || step === 'newpin' || step === 'confirm')) && step !== 'otp' && !(mode === 'reset' && step === 'enter') && (
                    <PINInput
                        length={4}
                        onComplete={handlePINEntered}
                        error={error}
                        disabled={isLoading}
                    />
                )}

                {/* Footer Actions */}
                <div className="mt-8 flex flex-col gap-3">
                    {mode === 'unlock' && onForgotPIN && (
                        <button
                            onClick={onForgotPIN}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Forgot PIN?
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        className="text-sm text-slate-500 hover:text-slate-700"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PINModal;
