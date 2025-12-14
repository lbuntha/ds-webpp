import { RouterProvider } from 'react-router-dom';
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
    return (
        <AppProviders>
            <RouterProvider router={router} />
        </AppProviders>
    );
}
