import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthForms } from '../../../components/AuthForms';
import { firebaseService } from '../../shared/services/firebaseService';
import { useAuth } from '../../shared/contexts/AuthContext';
import { googleProvider } from '../../config/firebase';

export default function AuthView() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const { mode: urlMode } = useParams<{ mode?: string }>();
    const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET' | 'EMAIL_SENT' | 'VERIFY'>(
        urlMode === 'register' ? 'REGISTER' :
            urlMode === 'reset' ? 'RESET' :
                urlMode === 'verify' ? 'VERIFY' : 'LOGIN'
    );

    // Redirect if already logged in or after successful login
    useEffect(() => {
        if (!loading && user) {
            console.log('[AuthView] User authenticated, redirecting to /app');
            navigate('/app', { replace: true });
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        const checkEmailLink = async () => {
            if (firebaseService.isEmailLink(window.location.href)) {
                // Simplified verification: if an email link is detected,
                // we assume it's for verification and set the mode.
                // The actual completion happens in handleSubmit if mode is 'VERIFY'.
                setMode('VERIFY');
            }
        };
        checkEmailLink();
    }, []);

    const handleSubmit = async (data: any) => {
        // Navigation is handled by useEffect when user state changes
        if (mode === 'LOGIN') {
            await firebaseService.login(data.email, data.password);
        } else if (mode === 'REGISTER') {
            await firebaseService.sendRegistrationLink(data.email, data);
            setMode('EMAIL_SENT');
        } else if (mode === 'VERIFY') {
            const email = window.localStorage.getItem('registration_email') || '';
            await firebaseService.completeRegistrationWithLink(email, data.password);
        } else if (mode === 'RESET') {
            const isPhone = !data.email.includes('@') && data.email.length >= 8;
            if (isPhone) {
                navigate(`/auth/reset/phone?phone=${encodeURIComponent(data.email)}`);
                return;
            }
            await firebaseService.resetPassword(data.email);
        }
    };

    const handleGoogleSignIn = async (role: string) => {
        await firebaseService.signInWithGoogle(googleProvider, role);
        // Navigation is handled by useEffect when user state changes
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
            onGoogleSignIn={handleGoogleSignIn}
        />
    );
}
