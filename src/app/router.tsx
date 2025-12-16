import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';
import { PermissionRoute } from './PermissionRoute';
import { UserRole } from '../shared/types';

// Lazy load components for code splitting
const LandingPage = lazy(() => import('../../components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthForms = lazy(() => import('../../components/AuthForms').then(m => ({ default: m.AuthForms })));
const PendingApproval = lazy(() => import('../../components/PendingApproval').then(m => ({ default: m.PendingApproval })));
const OnboardingWizard = lazy(() => import('../../components/setup/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));

// Layouts
const CustomerLayout = lazy(() => import('../../components/customer/CustomerLayout').then(m => ({ default: m.CustomerLayout })));
const DriverLayout = lazy(() => import('../../components/driver/DriverLayout').then(m => ({ default: m.DriverLayout })));
const MainLayout = lazy(() => import('./layouts/MainLayout'));

// Dashboard & Analytics
const Dashboard = lazy(() => import('../../components/Dashboard').then(m => ({ default: m.Dashboard })));
const AnalyticsDashboard = lazy(() => import('../../components/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));

// Accounting
const JournalView = lazy(() => import('./views/JournalView'));
const BankingView = lazy(() => import('./views/BankingView'));
const StaffLoansView = lazy(() => import('./views/StaffLoansView'));

// Parcel/Logistics Views
const ParcelsOverviewView = lazy(() => import('./views/ParcelsOverviewView'));
const ParcelsNewView = lazy(() => import('./views/ParcelsNewView'));
const ParcelsOperationsView = lazy(() => import('./views/ParcelsOperationsView'));
const ParcelsWarehouseView = lazy(() => import('./views/ParcelsWarehouseView'));
const ParcelsDispatchView = lazy(() => import('./views/ParcelsDispatchView'));
const ParcelsFleetView = lazy(() => import('./views/ParcelsFleetView'));
const ParcelsPlacesView = lazy(() => import('./views/ParcelsPlacesView'));
const ParcelsProductsView = lazy(() => import('./views/ParcelsProductsView'));
const ParcelsRetentionView = lazy(() => import('./views/ParcelsRetentionView'));
const ParcelsAgingView = lazy(() => import('./views/ParcelsAgingView'));

// Reports & Settings
const ReportsView = lazy(() => import('./views/ReportsView'));
const ClosingView = lazy(() => import('./views/ClosingView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const UsersView = lazy(() => import('./views/UsersView'));
const UserProfileView = lazy(() => import('./views/UserProfileView'));
const UserManualView = lazy(() => import('./views/UserManualView'));
const SeedPermissionsView = lazy(() => import('./views/SeedPermissionsView'));

// Driver Views
const DriverJobsView = lazy(() => import('./views/DriverJobsView'));
const DriverPickupsView = lazy(() => import('./views/DriverPickupsView'));
const DriverEarningsView = lazy(() => import('./views/DriverEarningsView'));
const DriverWalletView = lazy(() => import('./views/DriverWalletView'));
const DriverProfileView = lazy(() => import('./views/DriverProfileView'));

// Customer Views
const CustomerBookingView = lazy(() => import('./views/CustomerBookingView'));
const CustomerParcelsView = lazy(() => import('./views/CustomerParcelsView'));
const CustomerTrackingView = lazy(() => import('./views/CustomerTrackingView'));
const CustomerWalletView = lazy(() => import('./views/CustomerWalletView'));
const CustomerReportView = lazy(() => import('./views/CustomerReportView'));
const CustomerProfileView = lazy(() => import('./views/CustomerProfileView'));

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

// Views
const AuthView = lazy(() => import('./views/AuthView'));

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
        element: withSuspense(AuthView),
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
                path: 'banking',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant', 'finance-manager']}>
                        {withSuspense(BankingView)}
                    </RoleBasedRoute>
                ),
            },
            {
                path: 'staff',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin', 'accountant']}>
                        {withSuspense(StaffLoansView)}
                    </RoleBasedRoute>
                ),
            },
            // Parcel/Logistics Routes - Permission-based access control
            {
                path: 'parcels/overview',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PARCELS_OVERVIEW">
                        {withSuspense(ParcelsOverviewView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/new',
                element: (
                    <PermissionRoute requiredPermission="CREATE_PARCEL_BOOKING">
                        {withSuspense(ParcelsNewView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/operations',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_OPERATIONS">
                        {withSuspense(ParcelsOperationsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/warehouse',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_WAREHOUSE">
                        {withSuspense(ParcelsWarehouseView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/dispatch',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_DISPATCH">
                        {withSuspense(ParcelsDispatchView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/fleet',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_FLEET">
                        {withSuspense(ParcelsFleetView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/places',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_PLACES">
                        {withSuspense(ParcelsPlacesView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/products',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_PRODUCTS">
                        {withSuspense(ParcelsProductsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/retention',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PARCEL_RETENTION">
                        {withSuspense(ParcelsRetentionView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/aging',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PARCEL_AGING">
                        {withSuspense(ParcelsAgingView)}
                    </PermissionRoute>
                ),
            },
            // Redirects for old parcel routes
            {
                path: 'parcels',
                element: <Navigate to="/app/parcels/overview" replace />,
            },
            {
                path: 'parcels/list',
                element: <Navigate to="/app/parcels/overview" replace />,
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
                path: 'seed-permissions',
                element: (
                    <RoleBasedRoute allowedRoles={['system-admin']}>
                        {withSuspense(SeedPermissionsView)}
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
            // Driver Routes
            {
                path: 'driver/jobs',
                element: (
                    <PermissionRoute requiredPermission="VIEW_DRIVER_JOBS">
                        {withSuspense(DriverJobsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'driver/pickups',
                element: (
                    <PermissionRoute requiredPermission="VIEW_DRIVER_PICKUPS">
                        {withSuspense(DriverPickupsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'driver/earnings',
                element: (
                    <PermissionRoute requiredPermission="VIEW_DRIVER_EARNINGS">
                        {withSuspense(DriverEarningsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'driver/wallet',
                element: (
                    <PermissionRoute requiredPermission="VIEW_DRIVER_EARNINGS">
                        {withSuspense(DriverWalletView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'driver/profile',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PROFILE">
                        {withSuspense(DriverProfileView)}
                    </PermissionRoute>
                ),
            },
            // Customer Routes
            {
                path: 'customer/booking',
                element: (
                    <PermissionRoute requiredPermission="CREATE_BOOKING">
                        {withSuspense(CustomerBookingView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/parcels',
                element: (
                    <PermissionRoute requiredPermission="VIEW_MY_PARCELS">
                        {withSuspense(CustomerParcelsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/reports',
                element: (
                    <PermissionRoute requiredPermission="VIEW_MY_PARCELS">
                        {withSuspense(CustomerReportView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/tracking',
                element: (
                    <PermissionRoute requiredPermission="TRACK_PARCELS">
                        {withSuspense(CustomerTrackingView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/profile',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PROFILE">
                        {withSuspense(CustomerProfileView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/wallet',
                element: (
                    <PermissionRoute requiredPermission="VIEW_PROFILE">
                        {withSuspense(CustomerWalletView)}
                    </PermissionRoute>
                ),
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/landing" replace />,
    },
];

export const router = createBrowserRouter(routes);
