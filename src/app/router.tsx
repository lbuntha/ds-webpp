import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';
import { UserRole } from '../types';

// Lazy load components for code splitting
const LandingPage = lazy(() => import('../components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthForms = lazy(() => import('../components/AuthForms').then(m => ({ default: m.AuthForms })));
const PendingApproval = lazy(() => import('../components/PendingApproval').then(m => ({ default: m.PendingApproval })));
const OnboardingWizard = lazy(() => import('../components/setup/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));

// Layouts
const CustomerLayout = lazy(() => import('../components/customer/CustomerLayout').then(m => ({ default: m.CustomerLayout })));
const DriverLayout = lazy(() => import('../components/driver/DriverLayout').then(m => ({ default: m.DriverLayout })));
const MainLayout = lazy(() => import('./layouts/MainLayout'));

// Dashboard & Analytics
const Dashboard = lazy(() => import('../components/Dashboard').then(m => ({ default: m.Dashboard })));
const AnalyticsDashboard = lazy(() => import('../components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));

// Accounting
const JournalView = lazy(() => import('./views/JournalView'));
const ReceivablesView = lazy(() => import('./views/ReceivablesView'));
const PayablesView = lazy(() => import('./views/PayablesView'));
const BankingView = lazy(() => import('./views/BankingView'));
const StaffLoansView = lazy(() => import('./views/StaffLoansView'));
const FixedAssetsView = lazy(() => import('./views/FixedAssetsView'));

// Logistics
const ParcelsView = lazy(() => import('./views/ParcelsView'));

// Reports & Settings
const ReportsView = lazy(() => import('./views/ReportsView'));
const ClosingView = lazy(() => import('./views/ClosingView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const UsersView = lazy(() => import('./views/UsersView'));
const UserProfileView = lazy(() => import('./views/UserProfileView'));
const UserManualView = lazy(() => import('./views/UserManualView'));

// Loading fallback
const LoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">
        Loading...
    </div>
);

// Wrap lazy components with Suspense
const withSuspense = (Component: React.LazyExoticComponent<any>) => (
    <Suspense fallback={<LoadingFallback />}>
        <Component />
    </Suspense>
);

const routes: RouteObject[] = [
    {
        path: '/',
        element: <Navigate to="/landing" replace />,
    },
    {
        path: '/landing',
        element: withSuspense(LandingPage),
    },
    {
        path: '/auth/:mode?',
        element: withSuspense(AuthForms),
    },
    {
        path: '/pending',
        element: (
            <ProtectedRoute>
                {withSuspense(PendingApproval)}
            </ProtectedRoute>
        ),
    },
    {
        path: '/onboarding',
        element: (
            <ProtectedRoute requireRoles={['system-admin']}>
                {withSuspense(OnboardingWizard)}
            </ProtectedRoute>
        ),
    },
    {
        path: '/customer',
        element: (
            <RoleBasedRoute allowedRoles={['customer']}>
                {withSuspense(CustomerLayout)}
            </RoleBasedRoute>
        ),
    },
    {
        path: '/driver',
        element: (
            <RoleBasedRoute allowedRoles={['driver']}>
                {withSuspense(DriverLayout)}
            </RoleBasedRoute>
        ),
    },
    {
        path: '/app',
        element: (
            <ProtectedRoute>
                {withSuspense(MainLayout)}
            </ProtectedRoute>
        ),
        children: [
            {
                index: true,
                element: <Navigate to="/app/dashboard" replace />,
            },
            {
                path: 'dashboard',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager', 'warehouse']}>
                        {withSuspense(Dashboard)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'analytics',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager']}>
                        {withSuspense(AnalyticsDashboard)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'journal',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager']}>
                        {withSuspense(JournalView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'receivables',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(ReceivablesView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'payables',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(PayablesView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'banking',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager']}>
                        {withSuspense(BankingView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'staff-loans',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(StaffLoansView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'assets',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(FixedAssetsView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'parcels/*',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'warehouse']}>
                        {withSuspense(ParcelsView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'reports',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager']}>
                        {withSuspense(ReportsView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'closing',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(ClosingView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'settings',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin']}>
                        {withSuspense(SettingsView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'users',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin']}>
                        {withSuspense(UsersView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'profile',
                element: withSuspense(UserProfileView),
            },
            {
                path: 'manual',
                element: withSuspense(UserManualView),
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/landing" replace />,
    },
];

export const router = createBrowserRouter(routes);
