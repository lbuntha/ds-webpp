import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from './ProtectedRoute';
import { PermissionRoute } from './PermissionRoute';
import { RoleBasedRedirect } from './RoleBasedRedirect';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';


// Lazy load components for code splitting
const LandingPage = lazy(() => import('../../components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthForms = lazy(() => import('../../components/AuthForms').then(m => ({ default: m.AuthForms })));
const PendingApproval = lazy(() => import('../../components/PendingApproval').then(m => ({ default: m.PendingApproval })));
const OnboardingView = lazy(() => import('./views/OnboardingView'));
const OTPSignup = lazy(() => import('../../components/OTPSignup').then(m => ({ default: m.OTPSignup })));
const PhoneSignupView = lazy(() => import('./views/PhoneSignupView'));
const PhoneResetView = lazy(() => import('./views/PhoneResetView'));
const EmailResetView = lazy(() => import('./views/EmailResetView'));


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
const StandardExpenseView = lazy(() => import('./views/StandardExpenseView'));
const ExpenseTemplatesView = lazy(() => import('./views/ExpenseTemplatesView'));

// Parcel/Logistics Views
const ParcelsOverviewView = lazy(() => import('./views/ParcelsOverviewView'));
const ParcelsNewView = lazy(() => import('./views/ParcelsNewView'));
const ParcelsOperationsView = lazy(() => import('./views/ParcelsOperationsView'));
const ParcelsWarehouseView = lazy(() => import('./views/ParcelsWarehouseView'));
const ParcelsDispatchView = lazy(() => import('./views/ParcelsDispatchView'));
const DelayedChatsView = lazy(() => import('./views/DelayedChatsView'));
const ParcelsFleetView = lazy(() => import('./views/ParcelsFleetView'));
const ParcelsPlacesView = lazy(() => import('./views/ParcelsPlacesView'));
const ParcelsProductsView = lazy(() => import('./views/ParcelsProductsView'));
const ParcelsRetentionView = lazy(() => import('./views/ParcelsRetentionView'));
const ParcelsServiceSetupView = lazy(() => import('./views/ParcelsServiceSetupView'));
const DriverCommissionSetupView = lazy(() => import('./views/DriverCommissionSetupView'));
const ParcelsAgingView = lazy(() => import('./views/ParcelsAgingView'));
const PromotionsPage = lazy(() => import('./views/PromotionsPage'));
const CashbackPage = lazy(() => import('./views/CashbackPage'));
const CashbackReportPage = lazy(() => import('./views/CashbackReportPage'));

// Stock Management Views
const StockManagement = lazy(() => import('../../components/stock/StockManagement').then(m => ({ default: m.StockManagement })));
const StockAlertReport = lazy(() => import('../../components/reports/StockAlertReport').then(m => ({ default: m.StockAlertReport })));
const CustomerStockView = lazy(() => import('../../components/customer/CustomerStockView').then(m => ({ default: m.CustomerStockView })));
const ProductCatalog = lazy(() => import('../../components/customer/ProductCatalog').then(m => ({ default: m.ProductCatalog })));
const StockRequestList = lazy(() => import('../../components/customer/StockRequestList').then(m => ({ default: m.StockRequestList })));
const IncomingRequests = lazy(() => import('../../components/stock/IncomingRequests').then(m => ({ default: m.IncomingRequests })));

// Reports & Settings
const ReportsView = lazy(() => import('./views/ReportsView'));
const ClosingView = lazy(() => import('./views/ClosingView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const UsersView = lazy(() => import('./views/UsersView'));
const CustomersView = lazy(() => import('./views/CustomersView'));
const BookingMapReport = lazy(() => import('../../components/reports/BookingMapReport').then(m => ({ default: m.BookingMapReport })));
const BookingStatusByDriverReport = lazy(() => import('../../components/reports/BookingStatusByDriverReport').then(m => ({ default: m.BookingStatusByDriverReport })));
const UserProfileView = lazy(() => import('./views/UserProfileView'));
const UserManualView = lazy(() => import('./views/UserManualView'));
const SeedPermissionsView = lazy(() => import('./views/SeedPermissionsView'));
const MenuBuilderView = lazy(() => import('./views/MenuBuilderView'));

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
        errorElement: <ErrorBoundary />
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
        path: '/auth/login/phone',
        element: withSuspense(lazy(() => import('./views/PhoneLoginView'))),
    },
    {
        path: '/signup/phone',
        element: withSuspense(PhoneSignupView),
    },
    {
        path: '/auth/reset/phone',
        element: withSuspense(PhoneResetView),
    },
    {
        path: '/auth/action',
        element: withSuspense(EmailResetView),
    },
    {
        // Also handle Firebase's __/auth/action path format for when Console is configured
        path: '/__/auth/action',
        element: withSuspense(EmailResetView),
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
                {withSuspense(OnboardingView)}
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
                element: <RoleBasedRedirect />,
            },
            {
                path: 'dashboard',
                element: (
                    <PermissionRoute requiredPermission="VIEW_DASHBOARD">
                        {withSuspense(Dashboard)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'analytics',
                element: (
                    <PermissionRoute requiredPermission="VIEW_REPORTS">
                        {withSuspense(AnalyticsDashboard)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'journal',
                element: (
                    <PermissionRoute requiredPermission="VIEW_JOURNAL">
                        {withSuspense(JournalView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'banking',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_BANKING">
                        {withSuspense(BankingView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'expenses',
                children: [
                    {
                        path: 'standard',
                        element: (
                            <PermissionRoute requiredPermission="MANAGE_BANKING">
                                {withSuspense(StandardExpenseView)}
                            </PermissionRoute>
                        ),
                    },
                    {
                        path: 'templates',
                        element: (
                            <PermissionRoute requiredPermission="MANAGE_BANKING">
                                {withSuspense(ExpenseTemplatesView)}
                            </PermissionRoute>
                        ),
                    },
                ]
            },
            {
                path: 'staff',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(StaffLoansView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'staff/manage',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(lazy(() => import('./views/EmployeeManagementView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'staff/issue-loan',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(lazy(() => import('./views/StaffLoanIssueView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'staff/allowances',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(lazy(() => import('./views/StaffAllowanceView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'staff/settlements',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(lazy(() => import('./views/StaffSettlementView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'staff/deposit',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_STAFF_LOANS">
                        {withSuspense(lazy(() => import('./views/StaffDepositView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'payroll',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PAYROLL">
                        {withSuspense(lazy(() => import('./views/PayrollView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer-settlements',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CUSTOMER_SETTLEMENTS">
                        {withSuspense(lazy(() => import('../../components/reports/CustomerSettlementReport').then(m => ({ default: m.CustomerSettlementReport }))))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'settled-parcels',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CUSTOMER_SETTLEMENTS">
                        {withSuspense(lazy(() => import('../../components/reports/SettledParcelsReport').then(m => ({ default: m.SettledParcelsReport }))))}
                    </PermissionRoute>
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
                path: 'parcels/delayed-chats',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_WAREHOUSE">
                        {withSuspense(DelayedChatsView)}
                    </PermissionRoute>
                ),
            },
            // Stock Management Routes
            {
                path: 'stock',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CUSTOMER_STOCK">
                        {withSuspense(StockManagement)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'stock/alerts',
                element: (
                    <PermissionRoute requiredPermission="VIEW_STOCK_REPORTS">
                        {withSuspense(StockAlertReport)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'stock/requests',
                element: (
                    <PermissionRoute requiredPermission="REVIEW_STOCK_REQUEST">
                        {withSuspense(IncomingRequests)}
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
                path: 'promotions',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_PRODUCTS">
                        {withSuspense(PromotionsPage)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'cashback',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CASHBACK">
                        {withSuspense(CashbackPage)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'cashback-report',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CASHBACK">
                        {withSuspense(CashbackReportPage)}
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
            {
                path: 'parcels/service/setup',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_CONFIG">
                        {withSuspense(ParcelsServiceSetupView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/commissions',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_LOGISTICS_CONFIG">
                        {withSuspense(DriverCommissionSetupView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'parcels/config',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_PARCEL_CONFIG">
                        {withSuspense(ParcelsServiceSetupView)}
                    </PermissionRoute>
                ),
            },
            // Redirects for old/alias parcel routes
            {
                path: 'parcels/booking',
                element: <Navigate to="/app/parcels/new" replace />,
            },
            {
                path: 'parcels/list',
                element: <Navigate to="/app/parcels/overview" replace />,
            },
            {
                path: 'reports',
                element: (
                    <PermissionRoute requiredPermission="VIEW_REPORTS">
                        {withSuspense(ReportsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'reports/booking-map',
                element: (
                    <PermissionRoute requiredPermission="VIEW_REPORTS">
                        {withSuspense(BookingMapReport)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'reports/booking-status-driver',
                element: (
                    <PermissionRoute requiredPermission="VIEW_REPORTS">
                        {withSuspense(BookingStatusByDriverReport)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'closing',
                element: (
                    <PermissionRoute requiredPermission="PERFORM_CLOSING">
                        {withSuspense(ClosingView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'settings',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_SETTINGS">
                        {withSuspense(SettingsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'settings/menu-builder',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_SETTINGS">
                        {withSuspense(MenuBuilderView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'seed-permissions',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_SETTINGS">
                        {withSuspense(SeedPermissionsView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'telegram',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_SETTINGS">
                        {withSuspense(lazy(() => import('./views/TelegramView')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'users',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_USERS">
                        {withSuspense(UsersView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'users',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_USERS">
                        {withSuspense(UsersView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'admin/migration',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_SETTINGS">
                        {withSuspense(lazy(() => import('../pages/admin/MigrationPage')))}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customers',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CUSTOMERS">
                        {withSuspense(CustomersView)}
                    </PermissionRoute>
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
                path: 'customer/stock-booking',
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
                    <PermissionRoute requiredPermission="CUSTOMER_VIEW_REPORTS">
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
            {
                path: 'customer/stock',
                element: (
                    <PermissionRoute requiredPermission="VIEW_CUSTOMER_STOCK">
                        {withSuspense(CustomerStockView)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/products',
                element: (
                    <PermissionRoute requiredPermission="MANAGE_CUSTOMER_PRODUCTS">
                        {withSuspense(ProductCatalog)}
                    </PermissionRoute>
                ),
            },
            {
                path: 'customer/stock-requests',
                element: (
                    <PermissionRoute requiredPermission="CREATE_STOCK_REQUEST">
                        {withSuspense(StockRequestList)}
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
