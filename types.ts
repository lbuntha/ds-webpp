
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
  settlementStatus?: 'UNSETTLED' | 'SETTLED';
  notes?: string;
  status?: 'PENDING' | 'PICKED_UP' | 'AT_WAREHOUSE' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURN_TO_SENDER' | 'CANCELLED';
  delayReason?: string; // New field for delay tracking
  weight?: number;
  driverId?: string;
  driverName?: string;
  targetBranchId?: string;
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
  | 'PERFORM_CLOSING'
  | 'MANAGE_PARCELS' // Legacy/General
  // Granular Logistics Permissions
  | 'VIEW_LOGISTICS_OVERVIEW'
  | 'CREATE_BOOKING'
  | 'MANAGE_DISPATCH'
  | 'MANAGE_WAREHOUSE'
  | 'MANAGE_FLEET'
  | 'MANAGE_LOGISTICS_CONFIG'
  // Granular Configuration Permissions
  | 'CONFIG_MANAGE_SERVICES'
  | 'CONFIG_MANAGE_PLACES'
  | 'CONFIG_MANAGE_PROMOTIONS'
  | 'CONFIG_MANAGE_STATUSES'
  | 'CONFIG_MANAGE_DRIVERS'
  | 'CONFIG_MANAGE_WAREHOUSE'
  | 'CONFIG_MANAGE_DISPATCH'
  // Driver Permissions
  | 'DRIVER_VIEW_JOBS'
  | 'DRIVER_ACCESS_WALLET'
  | 'DRIVER_MANAGE_PROFILE'
  // Customer Permissions
  | 'CUSTOMER_VIEW_DASHBOARD'
  | 'CUSTOMER_CREATE_BOOKING'
  | 'CUSTOMER_ACCESS_WALLET'
  | 'CUSTOMER_VIEW_REPORTS'
  | 'CUSTOMER_MANAGE_PROFILE';

export type UserRole = 'system-admin' | 'accountant' | 'finance-manager' | 'customer' | 'driver' | 'warehouse';

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
  zone?: string; // NEW: Zone assignment for commission rules
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
  defaultCustomerSettlementBankIdUSD?: string;
  defaultCustomerSettlementBankIdKHR?: string;

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
  distance: number;
  subtotal: number;
  discountAmount: number;
  promotionId?: string;
  taxAmount: number;
  taxRateId?: string;
  totalDeliveryFee: number;
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

export type PermissionGroup =
  | 'FINANCE'
  | 'LOGISTICS'
  | 'SETTINGS'
  | 'REPORTS'
  | 'SYSTEM'
  | 'DRIVER'
  | 'CUSTOMER';

export interface NavigationItem {
  id: string;
  label: string;
  viewId: string;
  iconKey: string;
  allowedRoles: UserRole[];
  requiredPermission?: Permission; // NEW: Link menu to specific permission
  permissionGroup?: PermissionGroup; // NEW: Group for organization in UI
  order: number;
  section?: string; // Optional grouping
  isSubItem?: boolean; // NEW: For nested/grouped items
  parentId?: string; // NEW: For hierarchical grouping
}

export interface IDataService {
  getAccounts(): Promise<Account[]>;
  getBranches(): Promise<Branch[]>;
  getTransactions(): Promise<JournalEntry[]>;
  addTransaction(entry: JournalEntry): Promise<void>;
}
