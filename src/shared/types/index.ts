
export type GeoPoint = {
  lat: number;
  lng: number;
};

export interface Place {
  id: string;
  name: string;
  address: string;
  location?: GeoPoint;
  category?: string;
  phone?: string;
  keywords?: string[]; // For easier search
}

export type ParcelModification = {
  timestamp: number;
  userId: string;
  userName: string;
  field: string;
  oldValue: string;
  newValue: string;
};

export interface ParcelItem {
  id: string;
  trackingCode?: string;
  barcode?: string; // Physical label barcode
  image: string;
  proofOfDelivery?: string;
  receiverName: string;
  receiverPhone: string;
  destinationAddress: string;
  destinationLocation?: GeoPoint;
  productPrice: number;
  codCurrency?: 'USD' | 'KHR';
  settlementStatus?: 'UNSETTLED' | 'SETTLED'; // Legacy field (deprecated)
  driverSettlementStatus?: 'UNSETTLED' | 'SETTLED'; // Driver → Company settlement
  driverSettledCurrency?: 'USD' | 'KHR'; // Currency that was settled
  driverSettlementTxnId?: string; // Transaction ID for audit
  customerSettlementStatus?: 'UNSETTLED' | 'SETTLED'; // Company → Customer settlement
  customerSettledCurrency?: 'USD' | 'KHR'; // Currency that was settled
  customerSettlementTxnId?: string; // Transaction ID for audit
  notes?: string;
  status?: 'PENDING' | 'PICKED_UP' | 'AT_WAREHOUSE' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURN_TO_SENDER' | 'CANCELLED';
  delayReason?: string; // New field for delay tracking
  weight?: number;
  driverId?: string;
  driverName?: string;
  targetBranchId?: string;
  collectorId?: string;
  collectorName?: string;
  delivererId?: string;
  delivererName?: string;
  pickupCommission?: number;
  deliveryCommission?: number;
  modifications?: ParcelModification[];
}

export enum AccountType {
  ASSET = 'Asset',
  LIABILITY = 'Liability',
  EQUITY = 'Equity',
  REVENUE = 'Revenue',
  EXPENSE = 'Expense'
}

export enum AccountSubType {
  CURRENT_ASSET = 'Current Asset',
  NON_CURRENT_ASSET = 'Non-Current Asset',
  CURRENT_LIABILITY = 'Current Liability',
  LONG_TERM_LIABILITY = 'Long Term Liability',
  EQUITY = 'Equity',
  OPERATING_REVENUE = 'Operating Revenue',
  OTHER_REVENUE = 'Other Revenue',
  COST_OF_GOODS_SOLD = 'Cost of Goods Sold',
  OPERATING_EXPENSE = 'Operating Expense',
  OTHER_EXPENSE = 'Other Expense'
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  description?: string;
  currency?: string;
  isHeader?: boolean;
  parentAccountId?: string;
  qrCode?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
}

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_JOURNAL'
  | 'CREATE_JOURNAL'
  | 'VIEW_REPORTS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_USERS'
  | 'MANAGE_RECEIVABLES'
  | 'MANAGE_PAYABLES'
  | 'MANAGE_ASSETS'
  | 'MANAGE_STAFF_LOANS'
  | 'MANAGE_BANKING'
  | 'MANAGE_CUSTOMER_SETTLEMENTS'
  | 'PERFORM_CLOSING'
  | 'MANAGE_PARCELS' // Legacy/General - kept for backward compatibility
  // Granular Parcel/Logistics Permissions
  | 'VIEW_PARCELS_OVERVIEW'      // View list of all bookings
  | 'CREATE_PARCEL_BOOKING'      // Create new bookings
  | 'MANAGE_PARCEL_OPERATIONS'   // Operations console
  | 'MANAGE_PARCEL_WAREHOUSE'    // Warehouse operations
  | 'MANAGE_PARCEL_DISPATCH'     // Dispatch console
  | 'VIEW_PARCEL_RETENTION'      // Customer retention reports
  | 'VIEW_PARCEL_AGING'          // Aging reports
  | 'MANAGE_PARCEL_FLEET'        // Fleet/driver management
  | 'MANAGE_PARCEL_PLACES'       // Places management
  | 'MANAGE_PARCEL_PRODUCTS'     // Service types/products setup
  // Customer Permissions
  | 'CREATE_BOOKING'             // Customer: Create new parcel booking
  | 'VIEW_MY_PARCELS'            // Customer: View own parcel bookings
  | 'TRACK_PARCELS'              // Customer: Track parcel status
  | 'VIEW_PROFILE'               // Customer/Driver: View/edit own profile
  // Driver Permissions
  | 'VIEW_DRIVER_JOBS'           // Driver: View assigned delivery jobs
  | 'VIEW_DRIVER_PICKUPS'        // Driver: View pickup assignments
  | 'VIEW_DRIVER_EARNINGS'       // Driver: View earnings and commissions
  | 'CUSTOMER_VIEW_REPORTS'      // Customer: View spending reports
  | 'MANAGE_PARCEL_CONFIG'       // Admin: Manage parcel configuration
  | 'MANAGE_LOGISTICS_CONFIG';   // Admin: Manage logistics settings

export type UserRole = 'system-admin' | 'accountant' | 'finance-manager' | 'customer' | 'driver' | 'warehouse' | 'fleet-driver';

export type PermissionGroup = 'FINANCE' | 'LOGISTICS' | 'REPORTS' | 'SETTINGS' | 'SYSTEM' | 'DRIVER' | 'CUSTOMER';

export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE' | 'ACTIVE';

export interface SavedLocation {
  id: string;
  label: string;
  address: string;
  coordinates?: GeoPoint;
  isPrimary?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
  lastLogin?: number;
  walletAccountId?: string;
  managedBranchId?: string;
  phone?: string;
  address?: string;
  referralCode?: string;
  linkedCustomerId?: string;
  savedLocations?: SavedLocation[];
  walletBalance?: { usd: number, khr: number };
  isDriver?: boolean; // For legacy support
  // Referral Program
  referredBy?: string; // Referral Code of the person who invited them
  referralRewardPaid?: boolean; // Has the referrer been paid for this user?
  referralStats?: {
    count: number; // Total users referred
    earnings: number; // Total earned from referrals
  };
  // Tracking Stats
  walletBalanceUSD?: number; // Cached Balance
  walletBalanceKHR?: number; // Cached Balance
  completedOrderCount?: number;
  joinedAt?: number; // Timestamp of registration
  createdAt?: number; // Legacy timestamp
}

export interface ParcelStatusConfig {
  id: string;
  label: string;
  color: string;
  order: number;
  isDefault: boolean;
  triggersRevenue: boolean;
  isTerminal: boolean;
}

export interface DriverCommissionRule {
  id: string;
  zoneName: string; // e.g. "Default", "Phnom Penh", "Kandal"
  commissionFor: 'DELIVERY' | 'PICKUP'; // NEW: What action this commission is for
  driverSalaryType: 'WITH_BASE_SALARY' | 'WITHOUT_BASE_SALARY' | 'ALL'; // NEW: Driver salary classification
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number; // e.g. 70 (for 70%) or 1.50 (for $1.50)
  currency?: 'USD' | 'KHR'; // Only relevant for FIXED_AMOUNT
  isDefault: boolean;
}

export interface CustomerSpecialRate {
  id: string;
  customerId: string;
  serviceTypeId: string;
  serviceName: string; // Snapshot for UI
  price: number; // The override price
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string; // ISO Date YYYY-MM-DD
  createdAt: number;
}

export interface ReferralRule {
  id: string;
  name: string;
  isActive: boolean;
  trigger: 'FIRST_ORDER' | 'ORDER_MILESTONE';
  milestoneCount?: number;
  expiryDays?: number;
  referrerAmount: number;
  referrerCurrency: 'USD' | 'KHR';
  refereeAmount: number;
  refereeCurrency: 'USD' | 'KHR';
}

export interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  originalCurrency?: string;
  originalExchangeRate?: number;
  originalDebit?: number;
  originalCredit?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  branchId: string;
  currency: string;
  exchangeRate: number;
  lines: JournalEntryLine[];
  createdAt: number;
  originalTotal?: number;
  relatedDocumentId?: string;
  attachment?: string;
  isClosingEntry?: boolean;
}

export type ReportType = 'TB' | 'BS' | 'IS' | 'GL';

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: AccountType;
  debit: number;
  credit: number;
  isHeader: boolean;
  parentAccountId?: string;
  depth: number;
}

export interface GeneralLedgerLine {
  date: string;
  journalId: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  displayedBalance: number;
}

export interface BankAccountDetails {
  bankName: string;
  accountNumber: string;
  qrCode?: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  bankAccounts?: BankAccountDetails[];
  bankName?: string;
  bankAccountNumber?: string; // Legacy support
  bankAccount?: string; // Legacy support
  status?: 'ACTIVE' | 'INACTIVE';
  linkedUserId?: string | null;
  customExchangeRate?: number; // Custom KHR rate for COD
  createdAt: number;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  revenueAccountId: string;
}

export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  currency?: string;
  exchangeRate?: number;
  subtotal?: number;
  taxRateId?: string;
  taxName?: string;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  branchId: string;
  notes?: string;
  attachment?: string;
  createdAt: number;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankNotes?: string;
  notes?: string;
  createdAt: number;
}

export interface BillLine {
  description: string;
  quantity: number;
  amount: number;
  expenseAccountId: string;
}

export type BillStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'VOID';

export interface Bill {
  id: string;
  vendorId: string;
  vendorName: string;
  billNumber: string;
  date: string;
  dueDate: string;
  status: BillStatus;
  lines: BillLine[];
  totalAmount: number;
  amountPaid: number;
  branchId: string;
  currency?: string;
  exchangeRate?: number;
  attachment?: string;
  createdAt: number;
}

export interface BillPayment {
  id: string;
  billId: string;
  date: string;
  amount: number;
  paymentAccountId: string;
  reference?: string;
}

export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  isDriver?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  vehicleType?: string;
  vehiclePlateNumber?: string;
  branchId?: string | null;
  linkedUserId?: string | null;
  walletAccountId?: string; // Driver Wallet Liability Account
  zone?: string; // NEW: Zone assignment for commission rules
  hasBaseSalary?: boolean; // NEW: Whether driver receives a base salary
  baseSalaryAmount?: number; // NEW: Optional - actual salary amount for reference
  baseSalaryCurrency?: 'USD' | 'KHR'; // NEW: Currency for base salary
  createdAt: number;
}

export type LoanStatus = 'ACTIVE' | 'PAID' | 'WRITTEN_OFF';

export interface StaffLoan {
  id: string;
  employeeId: string;
  employeeName: string;
  description: string;
  date: string;
  amount: number;
  amountRepaid: number;
  status: LoanStatus;
  assetAccountId: string;
  payoutAccountId: string;
  branchId: string;
  createdAt: number;
}

export interface StaffLoanRepayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  depositAccountId: string;
  createdAt: number;
}

export interface FixedAssetCategory {
  id: string;
  name: string;
  usefulLifeYears: number;
  method: DepreciationMethod;
  assetAccountId: string;
  accumDepAccountId: string;
  depExpenseAccountId: string;
  gainLossAccountId?: string;
  writeOffAccountId?: string;
}

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE';

export interface FixedAsset {
  id: string;
  assetName: string;
  assetCode: string;
  serialNumber?: string;
  categoryId?: string;
  branchId: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: DepreciationMethod;
  assetAccountId: string;
  accumDepAccountId: string;
  depExpenseAccountId: string;
  status: 'ACTIVE' | 'DISPOSED';
  accumulatedDepreciation: number;
  bookValue: number;
  lastDepreciationDate?: string;
  createdAt: number;
}

export interface CurrencyConfig {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isBase: boolean;
}

export interface TaxRate {
  id: string;
  name: string;
  code: string;
  rate: number;
}

export interface SystemSettings {
  companyName?: string;
  setupComplete?: boolean;
  lockDate?: string;

  // Wallet Liabilities (Multi-Currency)
  customerWalletAccountUSD?: string;
  customerWalletAccountKHR?: string;
  driverWalletAccountUSD?: string; // For Commission Payable / Driver Liability
  driverWalletAccountKHR?: string;

  // Driver Commission Expense (COGS) - Multi-Currency
  driverCommissionExpenseAccountUSD?: string;
  driverCommissionExpenseAccountKHR?: string;

  // Legacy (Keep for compatibility until fully migrated)
  defaultCustomerWalletAccountId?: string;
  defaultDriverWalletAccountId?: string;

  // Bank Accounts (Nostro) for Settlements
  defaultDriverSettlementBankIdUSD?: string;
  defaultDriverSettlementBankIdKHR?: string;
  defaultDriverCashAccountIdUSD?: string; // NEW: Specific for Cash Settlements
  defaultDriverCashAccountIdKHR?: string;
  defaultCustomerSettlementBankIdUSD?: string;
  defaultCustomerSettlementBankIdKHR?: string;

  // Revenue & Tax Configuration (Centralized)
  defaultRevenueAccountId?: string;
  defaultRevenueAccountUSD?: string;
  defaultRevenueAccountKHR?: string;
  defaultTaxAccountId?: string;
  defaultTaxAccountUSD?: string;
  defaultTaxAccountKHR?: string;

  // Legacy Fallback
  defaultSettlementBankAccountId?: string;
  defaultDriverSettlementBankId?: string;
  defaultCustomerSettlementBankId?: string;

  // Referral Program Config
  referralRewardAmount?: number;
  referralRewardCurrency?: 'USD' | 'KHR';
  referralExpenseAccountId?: string; // Marketing Expense

  // Transaction Rule Mapping (Rule ID -> Account ID)
  transactionRules?: Record<string, string>;

  // Commission Exchange Rate (for converting USD commissions to KHR)
  commissionExchangeRate?: number; // Defaults to 4100 if not set
}

export interface ParcelServiceType {
  id: string;
  name: string;
  defaultPrice: number;
  pricePerKm?: number;
  revenueAccountId: string; // Legacy / Primary USD
  description?: string;
  image?: string;

  // Multi-currency Mapping
  revenueAccountUSD?: string;
  revenueAccountKHR?: string;

  driverSettlementUSD?: string;
  driverSettlementKHR?: string;

  customerSettlementUSD?: string;
  customerSettlementKHR?: string;

  taxAccountUSD?: string;
  taxAccountKHR?: string;
  taxRateId?: string;
}

export interface ParcelPromotion {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ParcelBooking {
  id: string;
  bookingDate: string;
  senderId?: string;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupLocation?: GeoPoint;
  serviceTypeId: string;
  serviceTypeName: string;
  items: ParcelItem[];
  involvedDriverIds?: string[]; // Denormalized index for querying item-level assignments
  distance: number;
  subtotal: number;
  discountAmount: number;
  promotionId?: string;
  taxAmount: number;
  taxRateId?: string;
  totalDeliveryFee: number;
  currency?: 'USD' | 'KHR'; // Fee currency
  status: string;
  statusId?: string;
  statusHistory?: {
    statusId: string;
    statusLabel: string;
    timestamp: number;
    updatedBy: string;
    notes?: string;
  }[];
  driverId?: string;
  driverName?: string;
  branchId: string;
  notes?: string;
  journalEntryId?: string;
  createdAt: number;
  referralProcessed?: boolean;
  exchangeRateForCOD?: number; // Snapshot of the rate used for this booking
}

export interface ChatMessage {
  id: string;
  itemId: string;
  bookingId?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  targetAudience: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  createdAt: number;
  link?: string;
  metadata?: any;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  currency: 'USD' | 'KHR';
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'EARNING' | 'REFUND' | 'SETTLEMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';
  date: string;
  description?: string;
  bankAccountId?: string;
  attachment?: string;
  rejectionReason?: string;
  journalEntryId?: string;
  relatedItems?: { bookingId: string, itemId: string }[];
}

export interface NavigationItem {
  id: string;
  label: string;
  viewId: string;
  iconKey: string;
  allowedRoles?: UserRole[]; // Optional - for backward compatibility
  requiredPermission?: Permission; // New - preferred method for access control
  order: number;
  section?: string; // Optional grouping (e.g., 'system')
  parentId?: string; // For submenu items - references parent's id
  isParent?: boolean; // Indicates this item has children
}

export interface IDataService {
  getAccounts(): Promise<Account[]>;
  getBranches(): Promise<Branch[]>;
  getTransactions(): Promise<JournalEntry[]>;
  addTransaction(entry: JournalEntry): Promise<void>;
}
