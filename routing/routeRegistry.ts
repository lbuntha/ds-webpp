import { Permission, UserRole } from '../types';

export interface AppRoute {
    id: string;
    path: string;
    label: string;
    component: string;
    iconKey: string;
    requiredPermission: Permission;
    allowedRoles: UserRole[];
    order: number;
    section?: string;
    isActive?: boolean;
}

// Default routes (seed data for Firebase)
export const DEFAULT_ROUTES: AppRoute[] = [
    // Finance Section
    { id: 'route-dashboard', path: 'DASHBOARD', label: 'dashboard', component: 'Dashboard', iconKey: 'dashboard', requiredPermission: 'VIEW_DASHBOARD', allowedRoles: ['system-admin', 'accountant', 'finance-manager', 'warehouse'], order: 1, section: 'finance', isActive: true },
    { id: 'route-journal', path: 'JOURNAL', label: 'journal', component: 'JournalView', iconKey: 'journal', requiredPermission: 'VIEW_JOURNAL', allowedRoles: ['system-admin', 'accountant', 'finance-manager'], order: 2, section: 'finance', isActive: true },
    { id: 'route-receivables', path: 'RECEIVABLES', label: 'receivables', component: 'ReceivablesDashboard', iconKey: 'receivables', requiredPermission: 'MANAGE_RECEIVABLES', allowedRoles: ['system-admin', 'accountant'], order: 3, section: 'finance', isActive: true },
    { id: 'route-payables', path: 'PAYABLES', label: 'payables', component: 'PayablesDashboard', iconKey: 'payables', requiredPermission: 'MANAGE_PAYABLES', allowedRoles: ['system-admin', 'accountant'], order: 4, section: 'finance', isActive: true },
    { id: 'route-banking', path: 'BANKING', label: 'banking', component: 'BankingDashboard', iconKey: 'banking', requiredPermission: 'MANAGE_BANKING', allowedRoles: ['system-admin', 'accountant'], order: 5, section: 'finance', isActive: true },
    { id: 'route-assets', path: 'ASSETS', label: 'fixed_assets', component: 'FixedAssetsDashboard', iconKey: 'assets', requiredPermission: 'MANAGE_ASSETS', allowedRoles: ['system-admin', 'accountant'], order: 6, section: 'finance', isActive: true },
    { id: 'route-closing', path: 'CLOSING', label: 'closing', component: 'ClosingDashboard', iconKey: 'closing', requiredPermission: 'PERFORM_CLOSING', allowedRoles: ['system-admin', 'accountant'], order: 7, section: 'finance', isActive: true },

    // Logistics - Operations
    { id: 'route-logistics-booking', path: 'PARCELS_BOOKING', label: 'new_booking', component: 'ParcelBookingForm', iconKey: 'booking', requiredPermission: 'CREATE_BOOKING', allowedRoles: ['system-admin', 'warehouse'], order: 20, section: 'logistics', isActive: true },
    { id: 'route-logistics-list', path: 'PARCELS_LIST', label: 'parcel_list', component: 'ParcelList', iconKey: 'list', requiredPermission: 'VIEW_LOGISTICS_OVERVIEW', allowedRoles: ['system-admin', 'warehouse'], order: 21, section: 'logistics', isActive: true },
    { id: 'route-logistics-operations', path: 'PARCELS_OPERATIONS', label: 'operations', component: 'ParcelOperations', iconKey: 'operations', requiredPermission: 'VIEW_LOGISTICS_OVERVIEW', allowedRoles: ['system-admin', 'warehouse'], order: 22, section: 'logistics', isActive: true },
    { id: 'route-logistics-dispatch', path: 'PARCELS_DISPATCH', label: 'dispatch', component: 'DispatchConsole', iconKey: 'dispatch', requiredPermission: 'MANAGE_DISPATCH', allowedRoles: ['system-admin'], order: 23, section: 'logistics', isActive: true },
    { id: 'route-logistics-warehouse', path: 'PARCELS_WAREHOUSE', label: 'warehouse', component: 'WarehouseOperations', iconKey: 'warehouse', requiredPermission: 'MANAGE_WAREHOUSE', allowedRoles: ['system-admin', 'warehouse'], order: 24, section: 'logistics', isActive: true },
    { id: 'route-logistics-fleet', path: 'PARCELS_FLEET', label: 'fleet', component: 'DriverManagement', iconKey: 'fleet', requiredPermission: 'MANAGE_FLEET', allowedRoles: ['system-admin'], order: 25, section: 'logistics', isActive: true },

    // Configuration Section
    { id: 'route-config-products', path: 'PARCELS_CONFIG', label: 'products_services', component: 'ParcelServiceSetup', iconKey: 'products', requiredPermission: 'CONFIG_MANAGE_SERVICES', allowedRoles: ['system-admin', 'accountant'], order: 100, section: 'configuration', isActive: true },
    { id: 'route-config-places', path: 'PARCELS_PLACES', label: 'places', component: 'PlaceManagement', iconKey: 'places', requiredPermission: 'CONFIG_MANAGE_PLACES', allowedRoles: ['system-admin', 'warehouse'], order: 101, section: 'configuration', isActive: true },
    { id: 'route-config-promotions', path: 'PARCELS_PROMOTIONS', label: 'promotions', component: 'ParcelPromotionSetup', iconKey: 'promo', requiredPermission: 'CONFIG_MANAGE_PROMOTIONS', allowedRoles: ['system-admin', 'accountant'], order: 102, section: 'configuration', isActive: true },
    { id: 'route-config-statuses', path: 'PARCELS_STATUSES', label: 'workflow_statuses', component: 'ParcelStatusSetup', iconKey: 'workflow', requiredPermission: 'CONFIG_MANAGE_STATUSES', allowedRoles: ['system-admin', 'warehouse'], order: 103, section: 'configuration', isActive: true },

    // Reports Section
    { id: 'route-reports', path: 'REPORTS', label: 'reports', component: 'Reports', iconKey: 'reports', requiredPermission: 'VIEW_REPORTS', allowedRoles: ['system-admin', 'accountant', 'finance-manager'], order: 200, section: 'reports', isActive: true },
    { id: 'route-reports-aging', path: 'PARCELS_AGING', label: 'aging_report', component: 'InTransitAgingReport', iconKey: 'aging', requiredPermission: 'VIEW_REPORTS', allowedRoles: ['system-admin', 'accountant'], order: 201, section: 'reports', isActive: true },
    { id: 'route-reports-retention', path: 'PARCELS_RETENTION', label: 'retention', component: 'CustomerRetentionReport', iconKey: 'retention', requiredPermission: 'VIEW_REPORTS', allowedRoles: ['system-admin', 'accountant'], order: 202, section: 'reports', isActive: true },
    { id: 'route-analytics', path: 'ANALYTICS', label: 'analytics', component: 'AnalyticsDashboard', iconKey: 'analytics', requiredPermission: 'VIEW_REPORTS', allowedRoles: ['system-admin', 'accountant', 'finance-manager'], order: 203, section: 'reports', isActive: true },

    // Staff Section
    { id: 'route-staff', path: 'STAFF', label: 'staff_loans', component: 'StaffLoansDashboard', iconKey: 'staff', requiredPermission: 'MANAGE_STAFF', allowedRoles: ['system-admin', 'accountant'], order: 300, section: 'staff', isActive: true },

    // System Section
    { id: 'route-settings', path: 'SETTINGS', label: 'configuration', component: 'SettingsDashboard', iconKey: 'settings', requiredPermission: 'MANAGE_SETTINGS', allowedRoles: ['system-admin'], order: 900, section: 'system', isActive: true },
];
