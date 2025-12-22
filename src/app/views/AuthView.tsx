import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthForms } from '../../../components/AuthForms';
import { firebaseService } from '../../shared/services/firebaseService';

export default function AuthView() {
    const navigate = useNavigate();
    const { mode: urlMode } = useParams<{ mode?: string }>();
    const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET' | 'EMAIL_SENT' | 'VERIFY'>(
        urlMode === 'register' ? 'REGISTER' :
            urlMode === 'reset' ? 'RESET' :
                urlMode === 'verify' ? 'VERIFY' : 'LOGIN'
    );

    useEffect(() => {
        const checkEmailLink = async () => {
            if (firebaseService.isEmailLink(window.location.href)) {
                setMode('VERIFY');
            }
        };
        checkEmailLink();
    }, []);

    const handleSubmit = async (data: any) => {
        if (mode === 'LOGIN') {
            await firebaseService.login(data.email, data.password);
            setTimeout(() => navigate('/app'), 500);
        } else if (mode === 'REGISTER') {
            // Option A: Send Email Link
            await firebaseService.sendRegistrationLink(data.email, data);
            setMode('EMAIL_SENT');
        } else if (mode === 'VERIFY') {
            // Complete registration
            const email = window.localStorage.getItem('registration_email') || '';
            await firebaseService.completeRegistrationWithLink(email, data.password);
            setTimeout(() => navigate('/app'), 500);
        } else if (mode === 'RESET') {
            await firebaseService.resetPassword(data.email);
        }
    };

    const handleModeChange = (newMode: 'LOGIN' | 'REGISTER' | 'RESET' | 'EMAIL_SENT' | 'VERIFY') => {
        setMode(newMode);
        if (newMode === 'LOGIN' || newMode === 'REGISTER' || newMode === 'RESET') {
            const path = newMode === 'REGISTER' ? '/auth/register' : newMode === 'RESET' ? '/auth/reset' : '/auth/login';
            navigate(path, { replace: true });
        }
    };

    const handleBack = () => {
        navigate('/landing');
    };

    return (
        <AuthForms
            mode={mode}
            onSubmit={handleSubmit}
            onModeChange={handleModeChange}
            onBack={handleBack}
        />
    );
}
