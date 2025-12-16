import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthForms } from '../../../components/AuthForms';
import { firebaseService } from '../../shared/services/firebaseService';

export default function AuthView() {
    const navigate = useNavigate();
    const { mode: urlMode } = useParams<{ mode?: string }>();
    const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>(
        urlMode === 'register' ? 'REGISTER' : urlMode === 'reset' ? 'RESET' : 'LOGIN'
    );

    const handleSubmit = async (data: any) => {
        if (mode === 'LOGIN') {
            await firebaseService.login(data.email, data.password);
            // Wait a bit for auth state to update, then navigate
            setTimeout(() => {
                navigate('/app');
            }, 500);
        } else if (mode === 'REGISTER') {
            await firebaseService.register(data.email, data.password, data.name, data);
            // Navigate to pending approval page
            navigate('/pending');
        } else {
            await firebaseService.resetPassword(data.email);
        }
    };

    const handleModeChange = (newMode: 'LOGIN' | 'REGISTER' | 'RESET') => {
        setMode(newMode);
        const path = newMode === 'REGISTER' ? '/auth/register' : newMode === 'RESET' ? '/auth/reset' : '/auth/login';
        navigate(path, { replace: true });
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
