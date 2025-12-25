
import { Account, AccountSubType, AccountType, Branch, Permission, UserRole, ParcelStatusConfig, NavigationItem } from '../types';

export const INITIAL_BRANCHES: Branch[] = [
  { id: 'b1', name: 'Headquarters', code: 'HQ' },
];

export const DEFAULT_KHR_EXCHANGE_RATE = 4100;

export const TYPE_TO_SUBTYPE_MAP: Record<AccountType, AccountSubType[]> = {
  [AccountType.ASSET]: [AccountSubType.CURRENT_ASSET, AccountSubType.NON_CURRENT_ASSET],
  [AccountType.LIABILITY]: [AccountSubType.CURRENT_LIABILITY, AccountSubType.LONG_TERM_LIABILITY],
  [AccountType.EQUITY]: [AccountSubType.EQUITY],
  [AccountType.REVENUE]: [AccountSubType.OPERATING_REVENUE, AccountSubType.OTHER_REVENUE],
  [AccountType.EXPENSE]: [AccountSubType.COST_OF_GOODS_SOLD, AccountSubType.OPERATING_EXPENSE, AccountSubType.OTHER_EXPENSE]
};

// Role Based Access Control Configuration (Default Fallback)
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'system-admin': [
    // Admin gets all permissions
    'VIEW_DASHBOARD',
    'VIEW_JOURNAL',
    'CREATE_JOURNAL',
    'VIEW_REPORTS',
    'MANAGE_SETTINGS',
    'MANAGE_USERS',
    'MANAGE_RECEIVABLES',
    'MANAGE_PAYABLES',
    'MANAGE_ASSETS',
    'MANAGE_STAFF_LOANS',
    'MANAGE_BANKING',
    'PERFORM_CLOSING',
    // Parcel permissions
    'MANAGE_PARCELS',
    'VIEW_PARCELS_OVERVIEW',
    'CREATE_PARCEL_BOOKING',
    'MANAGE_PARCEL_OPERATIONS',
    'MANAGE_PARCEL_WAREHOUSE',
    'MANAGE_PARCEL_DISPATCH',
    'VIEW_PARCEL_RETENTION',
    'VIEW_PARCEL_AGING',
    'MANAGE_PARCEL_FLEET',
    'MANAGE_PARCEL_PLACES',
    'MANAGE_PARCEL_PRODUCTS'
  ],
  'accountant': [
    'VIEW_DASHBOARD',
    'VIEW_JOURNAL',
    'CREATE_JOURNAL',
    'VIEW_REPORTS',
    'MANAGE_RECEIVABLES',
    'MANAGE_PAYABLES',
    'MANAGE_ASSETS',
    'MANAGE_STAFF_LOANS',
    'MANAGE_BANKING',
    'VIEW_PARCELS_OVERVIEW' // Can view parcel list only
  ],
  'finance-manager': [
    'VIEW_DASHBOARD',
    'VIEW_JOURNAL',
    'VIEW_REPORTS',
    'VIEW_PARCELS_OVERVIEW',
    'VIEW_PARCEL_RETENTION',
    'VIEW_PARCEL_AGING'
  ],
  'customer': ['CREATE_BOOKING', 'VIEW_MY_PARCELS', 'TRACK_PARCELS', 'VIEW_PROFILE', 'CUSTOMER_VIEW_REPORTS'],
  'driver': ['VIEW_DRIVER_JOBS', 'VIEW_DRIVER_PICKUPS', 'VIEW_DRIVER_EARNINGS', 'VIEW_PROFILE'],
  'fleet-driver': ['VIEW_DRIVER_JOBS', 'VIEW_DRIVER_PICKUPS', 'VIEW_DRIVER_EARNINGS', 'VIEW_PROFILE'],
  'warehouse': [
    'VIEW_DASHBOARD',
    'VIEW_PARCELS_OVERVIEW',
    'CREATE_PARCEL_BOOKING',
    'MANAGE_PARCEL_WAREHOUSE',
    'MANAGE_PARCEL_OPERATIONS'
  ]
};

export const DEFAULT_NAVIGATION: NavigationItem[] = [
  // ==============================
  // ADMIN & ACCOUNTANT MENUS
  // ==============================
  { id: 'nav-dashboard', label: 'Dashboard', viewId: 'DASHBOARD', iconKey: 'dashboard', order: 1, allowedRoles: ['system-admin', 'accountant', 'warehouse'] },
  { id: 'nav-analytics', label: 'Analytics', viewId: 'ANALYTICS', iconKey: 'analytics', order: 2, allowedRoles: ['system-admin', 'accountant'] },

  // ==============================
  // WAREHOUSE / OPERATIONS MENUS
  // ==============================
  { id: 'nav-parcels-overview', label: 'Parcels Overview', viewId: 'PARCELS_OVERVIEW', iconKey: 'parcels', order: 10, allowedRoles: ['system-admin', 'warehouse', 'accountant'] },
  { id: 'nav-parcels-new', label: 'New Booking', viewId: 'PARCELS_NEW', iconKey: 'plus', order: 11, allowedRoles: ['system-admin', 'warehouse'] },
  { id: 'nav-parcels-operations', label: 'Operations', viewId: 'PARCELS_OPERATIONS', iconKey: 'operations', order: 12, allowedRoles: ['system-admin', 'warehouse'] },
  { id: 'nav-parcels-warehouse', label: 'Warehouse', viewId: 'PARCELS_WAREHOUSE', iconKey: 'warehouse', order: 13, allowedRoles: ['system-admin', 'warehouse'] },
  { id: 'nav-parcels-dispatch', label: 'Dispatch', viewId: 'PARCELS_DISPATCH', iconKey: 'dispatch', order: 14, allowedRoles: ['system-admin', 'warehouse'] },
  { id: 'nav-parcels-fleet', label: 'Fleet Management', viewId: 'PARCELS_FLEET', iconKey: 'fleet', order: 15, allowedRoles: ['system-admin', 'warehouse'] },
  { id: 'nav-parcels-places', label: 'Places', viewId: 'PARCELS_PLACES', iconKey: 'places', order: 16, allowedRoles: ['system-admin'] },
  { id: 'nav-parcels-products', label: 'Products/Services', viewId: 'PARCELS_PRODUCTS', iconKey: 'products', order: 17, allowedRoles: ['system-admin'] },

  // ==============================
  // ACCOUNTANT / FINANCE MENUS
  // ==============================
  { id: 'nav-journal', label: 'Journal', viewId: 'JOURNAL', iconKey: 'journal', order: 20, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-banking', label: 'Banking', viewId: 'BANKING', iconKey: 'banking', order: 21, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-staff', label: 'Staff Loans', viewId: 'STAFF', iconKey: 'staff', order: 22, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-reports', label: 'Reports', viewId: 'REPORTS', iconKey: 'reports', order: 23, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-settled-parcels', label: 'Settled Parcels', viewId: 'SETTLED_PARCELS', iconKey: 'checkCircle', order: 24, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-parcels-retention', label: 'Customer Retention', viewId: 'PARCELS_RETENTION', iconKey: 'retention', order: 25, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-parcels-aging', label: 'Aging Report', viewId: 'PARCELS_AGING', iconKey: 'aging', order: 26, allowedRoles: ['system-admin', 'accountant'] },
  { id: 'nav-closing', label: 'Period Closing', viewId: 'CLOSING', iconKey: 'closing', order: 27, allowedRoles: ['system-admin', 'accountant'] },

  // ==============================
  // CUSTOMER MENUS
  // ==============================
  { id: 'nav-customer-dashboard', label: 'My Parcels', viewId: 'CUSTOMER_PARCELS', iconKey: 'dashboard', order: 50, allowedRoles: ['customer'] },
  { id: 'nav-customer-booking', label: 'New Booking', viewId: 'CUSTOMER_BOOKING', iconKey: 'plus', order: 51, allowedRoles: ['customer'] },
  { id: 'nav-customer-wallet', label: 'Wallet', viewId: 'CUSTOMER_WALLET', iconKey: 'wallet', order: 52, allowedRoles: ['customer'] },
  { id: 'nav-customer-reports', label: 'Spending Report', viewId: 'CUSTOMER_REPORTS', iconKey: 'reports', order: 53, allowedRoles: ['customer'] },
  { id: 'nav-customer-profile', label: 'My Profile', viewId: 'CUSTOMER_PROFILE', iconKey: 'user', order: 54, allowedRoles: ['customer'] },

  // ==============================
  // DRIVER MENUS
  // ==============================
  { id: 'nav-driver-jobs', label: 'My Jobs', viewId: 'DRIVER_JOBS', iconKey: 'jobs', order: 60, allowedRoles: ['driver'] },
  { id: 'nav-driver-wallet', label: 'Wallet', viewId: 'DRIVER_WALLET', iconKey: 'wallet', order: 61, allowedRoles: ['driver'] },
  { id: 'nav-driver-profile', label: 'Profile', viewId: 'DRIVER_PROFILE', iconKey: 'user', order: 62, allowedRoles: ['driver'] },

  // ==============================
  // SYSTEM / ADMIN ONLY
  // ==============================
  { id: 'nav-settings', label: 'Configuration', viewId: 'SETTINGS', iconKey: 'settings', order: 90, allowedRoles: ['system-admin'], section: 'system' },
  { id: 'nav-users', label: 'Users', viewId: 'USERS', iconKey: 'users', order: 91, allowedRoles: ['system-admin'], section: 'system' },
  { id: 'nav-manual', label: 'Manual', viewId: 'MANUAL', iconKey: 'manual', order: 99, allowedRoles: ['system-admin', 'accountant', 'warehouse', 'driver', 'customer'] }
];

// List of Features for UI Mapping
export const FEATURE_LIST: { key: Permission; label: string }[] = [
  { key: 'VIEW_DASHBOARD', label: 'View Dashboard' },
  { key: 'VIEW_JOURNAL', label: 'View General Journal' },
  { key: 'CREATE_JOURNAL', label: 'Create/Edit Journal Entries' },
  { key: 'MANAGE_RECEIVABLES', label: 'Sales & Receivables' },
  { key: 'MANAGE_PAYABLES', label: 'Purchases & Payables' },
  { key: 'MANAGE_ASSETS', label: 'Fixed Assets' },
  { key: 'MANAGE_STAFF_LOANS', label: 'Staff Loans & Advances' },
  { key: 'MANAGE_BANKING', label: 'Banking & Transfers' },
  { key: 'VIEW_REPORTS', label: 'Financial Reports' },
  { key: 'PERFORM_CLOSING', label: 'Period Closing' },
  { key: 'MANAGE_SETTINGS', label: 'System Configuration' },
  { key: 'MANAGE_USERS', label: 'User Management' },
  // Parcel/Logistics
  { key: 'VIEW_PARCELS_OVERVIEW', label: 'Parcels: View Overview & List' },
  { key: 'CREATE_PARCEL_BOOKING', label: 'Parcels: Create Booking' },
  { key: 'MANAGE_PARCEL_OPERATIONS', label: 'Parcels: Operations Console' },
  { key: 'MANAGE_PARCEL_WAREHOUSE', label: 'Parcels: Warehouse Operations' },
  { key: 'MANAGE_PARCEL_DISPATCH', label: 'Parcels: Dispatch Console' },
  { key: 'VIEW_PARCEL_RETENTION', label: 'Parcels: Customer Retention Reports' },
  { key: 'VIEW_PARCEL_AGING', label: 'Parcels: Aging Reports' },
  { key: 'MANAGE_PARCEL_FLEET', label: 'Parcels: Fleet/Driver Management' },
  { key: 'MANAGE_PARCEL_PLACES', label: 'Parcels: Places Management' },
  { key: 'MANAGE_PARCEL_PRODUCTS', label: 'Parcels: Products/Services Setup' },
  { key: 'CUSTOMER_VIEW_REPORTS', label: 'Customer: Spending Reports' },
];

export const PERMISSION_GROUPS: Record<PermissionGroup, Permission[]> = {
  FINANCE: [
    'VIEW_JOURNAL',
    'CREATE_JOURNAL',
    'MANAGE_RECEIVABLES',
    'MANAGE_PAYABLES',
    'MANAGE_ASSETS',
    'MANAGE_STAFF_LOANS',
    'MANAGE_BANKING',
    'MANAGE_CUSTOMER_SETTLEMENTS',
    'PERFORM_CLOSING'
  ],
  LOGISTICS: [
    'MANAGE_PARCELS',
    'VIEW_PARCELS_OVERVIEW',
    'CREATE_PARCEL_BOOKING',
    'MANAGE_PARCEL_OPERATIONS',
    'MANAGE_PARCEL_WAREHOUSE',
    'MANAGE_PARCEL_DISPATCH',
    'MANAGE_PARCEL_FLEET',
    'MANAGE_PARCEL_PLACES',
    'MANAGE_PARCEL_PRODUCTS'
  ],
  REPORTS: [
    'VIEW_REPORTS',
    'VIEW_PARCEL_RETENTION',
    'VIEW_PARCEL_AGING',
    'CUSTOMER_VIEW_REPORTS'
  ],
  SETTINGS: [
    'MANAGE_SETTINGS',
    'MANAGE_USERS',
    'MANAGE_PARCEL_CONFIG',
    'MANAGE_LOGISTICS_CONFIG'
  ],
  SYSTEM: [
    'VIEW_DASHBOARD'
  ],
  DRIVER: [
    'VIEW_DRIVER_JOBS',
    'VIEW_DRIVER_PICKUPS',
    'VIEW_DRIVER_EARNINGS'
  ],
  CUSTOMER: [
    'CREATE_BOOKING',
    'VIEW_MY_PARCELS',
    'TRACK_PARCELS',
    'VIEW_PROFILE'
  ]
};

// --- PARCEL DEFAULTS ---
export const DEFAULT_PARCEL_STATUSES: ParcelStatusConfig[] = [
  { id: 'ps-pending', label: 'Pending', color: 'bg-gray-100 text-gray-800', order: 1, isDefault: true, triggersRevenue: false, isTerminal: false },
  { id: 'ps-pickup', label: 'Picked Up', color: 'bg-blue-100 text-blue-800', order: 2, isDefault: false, triggersRevenue: false, isTerminal: false },
  { id: 'ps-transit', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800', order: 3, isDefault: false, triggersRevenue: false, isTerminal: false },
  { id: 'ps-delivered', label: 'Delivered', color: 'bg-green-100 text-green-800', order: 4, isDefault: false, triggersRevenue: true, isTerminal: true },
  { id: 'ps-returned', label: 'Returned', color: 'bg-orange-100 text-orange-800', order: 5, isDefault: false, triggersRevenue: false, isTerminal: true },
  { id: 'ps-cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800', order: 6, isDefault: false, triggersRevenue: false, isTerminal: true },
];

// --- MASTER CHART OF ACCOUNTS (UPDATED WITH USER DATA) ---
export const MASTER_COA_DATA: Account[] = [
  // ASSETS - Current Assets
  { id: '1100001', code: '1100001', name: 'Petty Cash', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1101001', code: '1101001', name: 'Settlement Account', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1101002', code: '1101002', name: 'Settlement Account', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1101101', code: '1101101', name: 'Transit', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1101102', code: '1101102', name: 'Transit', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },

  // FIX: Remapped AR from 1100001/2 to 1105001/2 to avoid duplicate keys
  { id: '1105001', code: '1105001', name: 'Accounts Receivable (Delivery Wallet)', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1105002', code: '1105002', name: 'Accounts Receivable (Delivery Wallet)', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },

  { id: '1111001', code: '1111001', name: 'Cash on Hand', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1111002', code: '1111002', name: 'Cash on Hand', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1112001', code: '1112001', name: 'Cash in Bank', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1112002', code: '1112002', name: 'Cash in Bank', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1113001', code: '1113001', name: 'Employee Advances', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1113002', code: '1113002', name: 'Employee Advances', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1114001', code: '1114001', name: 'Other Receivables', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1114002', code: '1114002', name: 'Other Receivables', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1130001', code: '1130001', name: 'Prepaid Insurance', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1130002', code: '1130002', name: 'Prepaid Insurance', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1131001', code: '1131001', name: 'Prepaid Rent', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1131002', code: '1131002', name: 'Prepaid Rent', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1132001', code: '1132001', name: 'Prepaid Expenses - Other', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1132002', code: '1132002', name: 'Prepaid Expenses - Other', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1133001', code: '1133001', name: 'Deposits - Security', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1133002', code: '1133002', name: 'Deposits - Security', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1134001', code: '1134001', name: 'Deferred Tax Asset - Current', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },
  { id: '1134002', code: '1134002', name: 'Deferred Tax Asset - Current', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1234002', code: '1234002', name: 'VAT-Input', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD' },
  { id: '1234001', code: '1234001', name: 'VAT-Input', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR' },

  // ASSETS - Fixed Assets / Non-Current
  { id: '2140001', code: '2140001', name: 'Land', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2140002', code: '2140002', name: 'Land', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2141001', code: '2141001', name: 'Buildings', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2141002', code: '2141002', name: 'Buildings', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2141101', code: '2141101', name: 'Accumulated Depreciation - Buildings', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2141102', code: '2141102', name: 'Accumulated Depreciation - Buildings', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2142001', code: '2142001', name: 'Leasehold Improvements', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2142002', code: '2142002', name: 'Leasehold Improvements', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2142101', code: '2142101', name: 'Accumulated Amortization - Leasehold', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2142102', code: '2142102', name: 'Accumulated Amortization - Leasehold', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2151001', code: '2151001', name: 'Office Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2151002', code: '2151002', name: 'Office Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2151101', code: '2151101', name: 'Accumulated Depreciation - Office Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2151102', code: '2151102', name: 'Accumulated Depreciation - Office Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2152001', code: '2152001', name: 'Computer Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2152002', code: '2152002', name: 'Computer Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2152101', code: '2152101', name: 'Accumulated Depreciation - Computer Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2152102', code: '2152102', name: 'Accumulated Depreciation - Computer Equipment', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2153001', code: '2153001', name: 'Furniture & Fixtures', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2153002', code: '2153002', name: 'Furniture & Fixtures', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2153101', code: '2153101', name: 'Accumulated Depreciation - Furniture', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2153102', code: '2153102', name: 'Accumulated Depreciation - Furniture', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2160001', code: '2160001', name: 'Vehicles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2160002', code: '2160002', name: 'Vehicles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2160101', code: '2160101', name: 'Accumulated Depreciation - Vehicles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2160102', code: '2160102', name: 'Accumulated Depreciation - Vehicles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },

  // Intangible Assets
  { id: '2170001', code: '2170001', name: 'Intangible Assets - Patents', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2170002', code: '2170002', name: 'Intangible Assets - Patents', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2171001', code: '2171001', name: 'Intangible Assets - Trademarks', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2171002', code: '2171002', name: 'Intangible Assets - Trademarks', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2172001', code: '2172001', name: 'Intangible Assets - Goodwill', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2172002', code: '2172002', name: 'Intangible Assets - Goodwill', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2173001', code: '2173001', name: 'Accumulated Amortization - Intangibles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2173002', code: '2173002', name: 'Accumulated Amortization - Intangibles', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2174001', code: '2174001', name: 'Intangible Asset-Software & Licenses', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2174002', code: '2174002', name: 'Intangible Asset -Software & Licenses', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2175001', code: '2175001', name: 'Accumulated Amortization – Software', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2175002', code: '2175002', name: 'Accumulated Amortization – Software', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },

  // Long-Term Investments & Receivables
  { id: '2180001', code: '2180001', name: 'Long-term Investments', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2180002', code: '2180002', name: 'Long-term Investments', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2181001', code: '2181001', name: 'Notes Receivable - Long-term', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2181002', code: '2181002', name: 'Notes Receivable - Long-term', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },
  { id: '2190001', code: '2190001', name: 'Deferred Tax Asset - Long-term', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'KHR' },
  { id: '2190002', code: '2190002', name: 'Deferred Tax Asset - Long-term', type: AccountType.ASSET, subType: AccountSubType.NON_CURRENT_ASSET, currency: 'USD' },

  // LIABILITIES - Current
  { id: '3200001', code: '3200001', name: 'Accounts Payable(Customer Wallet)', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3200002', code: '3200002', name: 'Accounts Payable(Customer Wallet)', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3210102', code: '3210102', name: 'Accrued Commision', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3210101', code: '3210101', name: 'Accrued Commision', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3201001', code: '3201001', name: 'Accrued Expenses', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3201002', code: '3201002', name: 'Accrued Expenses', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3202001', code: '3202001', name: 'Notes Payable - Current', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3202002', code: '3202002', name: 'Notes Payable - Current', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },

  // Payroll & Tax Liabilities
  { id: '3210001', code: '3210001', name: 'Salaries & Wages Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3210002', code: '3210002', name: 'Salaries & Wages Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3211001', code: '3211001', name: 'Payroll Tax Payable - Federal', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3211002', code: '3211002', name: 'Payroll Tax Payable - Federal', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3211101', code: '3211101', name: 'Payroll Tax Payable - State', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3211102', code: '3211102', name: 'Payroll Tax Payable - State', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3211201', code: '3211201', name: 'Payroll Tax Payable - Local', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3211202', code: '3211202', name: 'Payroll Tax Payable - Local', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3212001', code: '3212001', name: 'Employee Benefits Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3212002', code: '3212002', name: 'Employee Benefits Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3213001', code: '3213001', name: 'Health Insurance Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3213002', code: '3213002', name: 'Health Insurance Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3221001', code: '3221001', name: 'Income Tax Payable - Federal', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3222002', code: '3222002', name: 'Income Tax Payable - Federal', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3222101', code: '3222101', name: 'Income Tax Payable - State', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3222102', code: '3222102', name: 'Income Tax Payable - State', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3223001', code: '3223001', name: 'Property Tax Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3223002', code: '3223002', name: 'Property Tax Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3224001', code: '3224001', name: 'Estimated Tax Payments', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3224002', code: '3224002', name: 'Estimated Tax Payments', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3230001', code: '3230001', name: 'Unearned Revenue', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3230002', code: '3230002', name: 'Unearned Revenue', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3232001', code: '3232001', name: 'Dividends Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3232002', code: '3232002', name: 'Dividends Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3233001', code: '3233001', name: 'Interest Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },
  { id: '3233002', code: '3233002', name: 'Interest Payable', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3333002', code: '3333002', name: 'VAT-Output', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD' },
  { id: '3333001', code: '3333001', name: 'VAT-Output', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'KHR' },

  // LIABILITIES - Long Term
  { id: '3240001', code: '3240001', name: 'Notes Payable - Long-term', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3240002', code: '3240002', name: 'Notes Payable - Long-term', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },
  { id: '3241001', code: '3241001', name: 'Mortgage Payable', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3241002', code: '3241002', name: 'Mortgage Payable', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },
  { id: '3242001', code: '3242001', name: 'Bonds Payable', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3242002', code: '3242002', name: 'Bonds Payable', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },
  { id: '3243001', code: '3243001', name: 'Deferred Tax Liability', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3243002', code: '3243002', name: 'Deferred Tax Liability', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },
  { id: '3244001', code: '3244001', name: 'Pension Liability', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3244002', code: '3244002', name: 'Pension Liability', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },
  { id: '3245001', code: '3245001', name: 'Lease Liability - Long-term', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'KHR' },
  { id: '3245002', code: '3245002', name: 'Lease Liability - Long-term', type: AccountType.LIABILITY, subType: AccountSubType.LONG_TERM_LIABILITY, currency: 'USD' },

  // EQUITY
  { id: '4300001', code: '4300001', name: 'Common Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4300002', code: '4300002', name: 'Common Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4301001', code: '4301001', name: 'Preferred Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4301002', code: '4301002', name: 'Preferred Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4302001', code: '4302001', name: 'Additional Paid-in Capital', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4302002', code: '4302002', name: 'Additional Paid-in Capital', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4303001', code: '4303001', name: 'Treasury Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4303002', code: '4303002', name: 'Treasury Stock', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4310001', code: '4310001', name: 'Retained Earnings', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4310002', code: '4310002', name: 'Retained Earnings', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4330001', code: '4330001', name: 'Dividends Declared', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4330002', code: '4330002', name: 'Dividends Declared', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },
  { id: '4340001', code: '4340001', name: 'Accumulated Other Comprehensive Income', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'KHR' },
  { id: '4340002', code: '4340002', name: 'Accumulated Other Comprehensive Income', type: AccountType.EQUITY, subType: AccountSubType.EQUITY, currency: 'USD' },

  // REVENUE (Income)
  { id: '5401001', code: '5401001', name: 'Delivery revenue', type: AccountType.REVENUE, subType: AccountSubType.OPERATING_REVENUE, currency: 'KHR' },
  { id: '5401002', code: '5401002', name: 'Delivery revenue', type: AccountType.REVENUE, subType: AccountSubType.OPERATING_REVENUE, currency: 'USD' },
  { id: '5411001', code: '5411001', name: 'Delivery Discounts', type: AccountType.REVENUE, subType: AccountSubType.OPERATING_REVENUE, currency: 'KHR' },
  { id: '5411002', code: '5411002', name: 'Delivery Discounts', type: AccountType.REVENUE, subType: AccountSubType.OPERATING_REVENUE, currency: 'USD' },
  { id: '5450001', code: '5450001', name: 'Interest Income from bank', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'KHR' },
  { id: '5450002', code: '5450002', name: 'Interest Income from bank', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'USD' },
  { id: '5451001', code: '5451001', name: 'Dividend Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'KHR' },
  { id: '5451002', code: '5451002', name: 'Dividend Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'USD' },
  { id: '5453001', code: '5453001', name: 'Gain on Sale of Assets', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'KHR' },
  { id: '5453002', code: '5453002', name: 'Gain on Sale of Assets', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'USD' },
  { id: '5454001', code: '5454001', name: 'Foreign Exchange Gain', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'KHR' },
  { id: '5454002', code: '5454002', name: 'Foreign Exchange Gain', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'USD' },
  { id: '5455001', code: '5455001', name: 'Miscellaneous Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'KHR' },
  { id: '5455002', code: '5455002', name: 'Miscellaneous Income', type: AccountType.REVENUE, subType: AccountSubType.OTHER_REVENUE, currency: 'USD' },

  // EXPENSES
  { id: '6501001', code: '6501001', name: 'Delivery commision expense Labor', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD, currency: 'KHR' },
  { id: '6501002', code: '6501002', name: 'Delivery commision expense Labor', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD, currency: 'USD' },
  { id: '6502001', code: '6502001', name: 'Cost of Goods Sold - Overhead', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD, currency: 'KHR' },
  { id: '6502002', code: '6502002', name: 'Cost of Goods Sold - Overhead', type: AccountType.EXPENSE, subType: AccountSubType.COST_OF_GOODS_SOLD, currency: 'USD' },

  // Selling Expenses
  { id: '6600001', code: '6600001', name: 'Advertising & Marketing', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' }, // Mapped to Operating for now
  { id: '6600002', code: '6600002', name: 'Advertising & Marketing', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6601001', code: '6601001', name: 'Sales Commissions', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6601002', code: '6601002', name: 'Sales Commissions', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6602001', code: '6602001', name: 'Sales Salaries', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6602002', code: '6602002', name: 'Sales Salaries', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6603001', code: '6603001', name: 'Travel & Entertainment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6603002', code: '6603002', name: 'Travel & Entertainment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6606001', code: '6606001', name: 'Commission Fee Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6606002', code: '6606002', name: 'Commission Fee Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },

  // General & Admin Expenses
  { id: '6650001', code: '6650001', name: 'Salaries & Wages - Administrative', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6650002', code: '6650002', name: 'Salaries & Wages - Administrative', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6651001', code: '6651001', name: 'Salaries & Wages - Management', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6651002', code: '6651002', name: 'Salaries & Wages - Management', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6652001', code: '6652001', name: 'Employee Benefits', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6652002', code: '6652002', name: 'Employee Benefits', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6653001', code: '6653001', name: 'Payroll Taxes', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6653002', code: '6653002', name: 'Payroll Taxes', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6654001', code: '6654001', name: 'Workers Compensation Insurance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6654002', code: '6654002', name: 'Workers Compensation Insurance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6655001', code: '6655001', name: 'Health Insurance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6655002', code: '6655002', name: 'Health Insurance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6657001', code: '6657001', name: 'Training & Development', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6657002', code: '6657002', name: 'Training & Development', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6658001', code: '6658001', name: 'Recruitment Expenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6658002', code: '6658002', name: 'Recruitment Expenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6670001', code: '6670001', name: 'Rent Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6670002', code: '6670002', name: 'Rent Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6671001', code: '6671001', name: 'Property Tax', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6671002', code: '6671002', name: 'Property Tax', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6672001', code: '6672001', name: 'Building Maintenance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6672002', code: '6672002', name: 'Building Maintenance', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6673001', code: '6673001', name: 'Utilities - Electric', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6673002', code: '6673002', name: 'Utilities - Electric', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6673101', code: '6673101', name: 'Utilities - Gas', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6673102', code: '6673102', name: 'Utilities - Gas', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6673201', code: '6673201', name: 'Utilities - Water', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6673202', code: '6673202', name: 'Utilities - Water', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6680001', code: '6680001', name: 'Office Supplies', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6680002', code: '6680002', name: 'Office Supplies', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6681001', code: '6681001', name: 'Postage & Shipping', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6681002', code: '6681002', name: 'Postage & Shipping', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6682001', code: '6682001', name: 'Telephone & Internet', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6682002', code: '6682002', name: 'Telephone & Internet', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6683001', code: '6683001', name: 'Printing & Copying', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6683002', code: '6683002', name: 'Printing & Copying', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6684001', code: '6684001', name: 'Subscriptions & Memberships', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6684002', code: '6684002', name: 'Subscriptions & Memberships', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6690001', code: '6690001', name: 'Legal Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6690002', code: '6690002', name: 'Legal Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6691001', code: '6691001', name: 'Accounting & Bookkeeping', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6691002', code: '6691002', name: 'Accounting & Bookkeeping', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6692001', code: '6692001', name: 'Consulting Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6692002', code: '6692002', name: 'Consulting Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6693001', code: '6693001', name: 'Professional Fees - Other', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6693002', code: '6693002', name: 'Professional Fees - Other', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6700001', code: '6700001', name: 'Software & Licenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6700002', code: '6700002', name: 'Software & Licenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6701001', code: '6701001', name: 'IT Support & Services', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6701002', code: '6701002', name: 'IT Support & Services', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6702001', code: '6702001', name: 'Cloud Services & Hosting', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6702002', code: '6702002', name: 'Cloud Services & Hosting', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6703001', code: '6703001', name: 'Computer Supplies', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6703002', code: '6703002', name: 'Computer Supplies', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6710001', code: '6710001', name: 'Insurance - General Liability', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6710002', code: '6710002', name: 'Insurance - General Liability', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6711001', code: '6711001', name: 'Insurance - Property', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6711002', code: '6711002', name: 'Insurance - Property', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6712001', code: '6712001', name: 'Insurance - Professional Liability', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6712002', code: '6712002', name: 'Insurance - Professional Liability', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6713001', code: '6713001', name: 'Insurance - Vehicle', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6713002', code: '6713002', name: 'Insurance - Vehicle', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6714001', code: '6714001', name: 'Insurance - Other', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6714002', code: '6714002', name: 'Insurance - Other', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6720001', code: '6720001', name: 'Vehicle Fuel', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6720002', code: '6720002', name: 'Vehicle Fuel', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6721001', code: '6721001', name: 'Vehicle Maintenance & Repairs', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6721002', code: '6721002', name: 'Vehicle Maintenance & Repairs', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6722001', code: '6722001', name: 'Vehicle Registration & Licenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6722002', code: '6722002', name: 'Vehicle Registration & Licenses', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6730001', code: '6730001', name: 'Depreciation Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6730002', code: '6730002', name: 'Depreciation Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6731001', code: '6731001', name: 'Amortization Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6731002', code: '6731002', name: 'Amortization Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6740001', code: '6740001', name: 'Bank Charges & Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6740002', code: '6740002', name: 'Bank Charges & Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6741001', code: '6741001', name: 'Credit Card Processing Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6741002', code: '6741002', name: 'Credit Card Processing Fees', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6742001', code: '6742001', name: 'Bad Debt Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6742002', code: '6742002', name: 'Bad Debt Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6743001', code: '6743001', name: 'Licenses & Permits', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6743002', code: '6743002', name: 'Licenses & Permits', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6744001', code: '6744001', name: 'Donations & Contributions', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6744002', code: '6744002', name: 'Donations & Contributions', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6745001', code: '6745001', name: 'Meals & Entertainment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6745002', code: '6745002', name: 'Meals & Entertainment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6746001', code: '6746001', name: 'Repairs & Maintenance - Equipment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6746002', code: '6746002', name: 'Repairs & Maintenance - Equipment', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6747001', code: '6747001', name: 'Uniforms & Laundry', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6747002', code: '6747002', name: 'Uniforms & Laundry', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6748001', code: '6748001', name: 'Waste Disposal', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6748002', code: '6748002', name: 'Waste Disposal', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },
  { id: '6749001', code: '6749001', name: 'Miscellaneous Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'KHR' },
  { id: '6749002', code: '6749002', name: 'Miscellaneous Expense', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD' },

  // Other Expenses
  { id: '6800001', code: '6800001', name: 'Interest Expense', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'KHR' },
  { id: '6800002', code: '6800002', name: 'Interest Expense', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'USD' },
  { id: '6801001', code: '6801001', name: 'Loss on Sale of Assets', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'KHR' },
  { id: '6801002', code: '6801002', name: 'Loss on Sale of Assets', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'USD' },
  { id: '6802001', code: '6802001', name: 'Foreign Exchange Loss', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'KHR' },
  { id: '6802002', code: '6802002', name: 'Foreign Exchange Loss', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'USD' },
  { id: '6803001', code: '6803001', name: 'Income Tax Expense', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'KHR' },
  { id: '6803002', code: '6803002', name: 'Income Tax Expense', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'USD' },
  { id: '6804001', code: '6804001', name: 'Penalties & Fines', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'KHR' },
  { id: '6804002', code: '6804002', name: 'Penalties & Fines', type: AccountType.EXPENSE, subType: AccountSubType.OTHER_EXPENSE, currency: 'USD' },
];

export const STANDARD_COA: Account[] = MASTER_COA_DATA;

// --- TRANSACTION DEFINITIONS (RULES) ---
export const TRANSACTION_DEFINITIONS = [
  { id: 1, description: 'Pickup from Customer', auto: 'Y' },
  { id: 2, description: 'Received Cash', auto: 'Y' },
  { id: 3, description: 'Exchange', auto: 'Y' },
  { id: 4, description: 'Settle to Company', auto: 'Y' },
  { id: 5, description: 'Settle to Customer', auto: 'Y' },
  { id: 6, description: 'Return back to Customer', auto: 'Y' },
  { id: 7, description: 'Warehouse Delivery', auto: 'Y' },
  { id: 8, description: 'Pickup from warehouse', auto: 'Y' },
  { id: 9, description: 'Service Fee', auto: 'Y' },
  { id: 10, description: 'Commission Expense', auto: 'Y' },
  { id: 11, description: 'Transit warehouse', auto: 'Y' },
  { id: 12, description: 'Collection Fee', auto: 'Y' },
  { id: 13, description: 'VAT-Output', auto: 'Y' },
  { id: 14, description: 'VAT-Input', auto: 'Y' }
];
