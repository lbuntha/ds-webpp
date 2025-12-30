import { useState } from 'react';
import { Button } from '../ui/Button';
import { PINModal } from './PINModal';

interface PINSettingsProps {
    userId: string;
    userPhone?: string;
    hasPIN: boolean;
    onPINUpdated?: () => void;
}

/**
 * PIN settings section for user profile/settings page
 */
export function PINSettings({ userId, userPhone, hasPIN, onPINUpdated }: PINSettingsProps) {
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'setup' | 'change' | 'reset'>('setup');

    const handleSetupPIN = () => {
        setModalMode('setup');
        setShowModal(true);
    };

    const handleChangePIN = () => {
        setModalMode('change');
        setShowModal(true);
    };

    const handleResetPIN = () => {
        setModalMode('reset');
        setShowModal(true);
    };

    const handleSuccess = () => {
        setShowModal(false);
        onPINUpdated?.();
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">PIN Security</h3>
                    <p className="text-sm text-slate-600">
                        {hasPIN ? 'Your PIN is set up for quick access' : 'Set up a PIN for faster login'}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                {!hasPIN ? (
                    <Button onClick={handleSetupPIN} variant="primary">
                        Set Up PIN
                    </Button>
                ) : (
                    <>
                        <Button onClick={handleChangePIN} variant="outline">
                            Change PIN
                        </Button>
                        {userPhone && (
                            <Button onClick={handleResetPIN} variant="ghost">
                                Reset PIN via OTP
                            </Button>
                        )}
                    </>
                )}
            </div>

            {/* Status indicator */}
            <div className="mt-4 flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${hasPIN ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={hasPIN ? 'text-green-700' : 'text-slate-500'}>
                    {hasPIN ? 'PIN enabled' : 'PIN not set'}
                </span>
            </div>

            {/* Modal */}
            {showModal && (
                <PINModal
                    mode={modalMode}
                    userId={userId}
                    userPhone={userPhone}
                    onSuccess={handleSuccess}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </div>
    );
}

export default PINSettings;
