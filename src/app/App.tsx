import { RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AppProviders } from './providers';
import { router } from './router';

/**
 * Main App component - Simplified from 593 lines to ~15 lines!
 * All routing, state management, and business logic moved to:
 * - router.tsx (routing configuration)
 * - providers.tsx (context providers)
 * - contexts/ (state management)
 * - views/ (page components)
 */
export default function App() {
    // TEMP: Log ID Token for API testing
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdToken();
                console.log('%c[FIREBASE ID TOKEN]', 'color: #00ff00; font-weight: bold; font-size: 14px');
                console.log(token);
                console.log('%c[CURL COMMAND]', 'color: #00aaaa; font-weight: bold');
                console.log(`curl -H "Authorization: Bearer ${token}" https://us-central1-doorstep-c75e3.cloudfunctions.net/api/health`);
            } else {
                console.log('[Auth] No user logged in');
            }
        });
        return () => unsubscribe();
    }, []);

    return (
        <AppProviders>
            <RouterProvider router={router} />
        </AppProviders>
    );
}
