
import { GLBookingService, GLBookingParams } from '../src/shared/services/glBookingService';
import { Account, SystemSettings, ParcelBooking, Employee, DriverCommissionRule, AccountType, AccountSubType } from '../src/shared/types/index';

// MOCK DATA
const mockAccounts: Account[] = [
    { id: 'bank-usd', name: 'ABA USD', code: '101001', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'USD', isHeader: false },
    { id: 'bank-khr', name: 'ABA KHR', code: '101002', type: AccountType.ASSET, subType: AccountSubType.CURRENT_ASSET, currency: 'KHR', isHeader: false },
    { id: 'wallet-cust', name: 'Cust Wallet', code: '201001', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD', isHeader: false },
    { id: 'wallet-driver', name: 'Driver Wallet', code: '201002', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD', isHeader: false },
    { id: 'rev-doorstep', name: 'Doorstep Revenue', code: '401001', type: AccountType.REVENUE, subType: AccountSubType.OPERATING_REVENUE, currency: 'USD', isHeader: false },
    { id: 'exp-comm', name: 'Commission Expense', code: '601001', type: AccountType.EXPENSE, subType: AccountSubType.OPERATING_EXPENSE, currency: 'USD', isHeader: false },
    { id: 'liab-comm', name: 'Commission Payable', code: '202001', type: AccountType.LIABILITY, subType: AccountSubType.CURRENT_LIABILITY, currency: 'USD', isHeader: false },
];

const mockSettings: SystemSettings = {
    defaultDriverSettlementBankIdUSD: 'bank-usd',
    defaultDriverWalletAccountId: 'wallet-driver',
    defaultCustomerWalletAccountId: 'wallet-cust',
    defaultRevenueAccountId: 'rev-doorstep',
    driverCommissionExpenseAccountUSD: 'exp-comm',
    transactionRules: {
        '4': 'bank-usd',
        '5': 'wallet-driver'
    }
};

const mockEmployee: Employee = {
    id: 'emp1',
    linkedUserId: 'driver1',
    name: 'John Driver',
    isDriver: true,
    hasBaseSalary: false,
    walletAccountId: 'wallet-driver',
    createdAt: Date.now()
};

const mockBooking: ParcelBooking = {
    id: 'b1',
    bookingDate: '2023-01-01',
    senderId: 'cust1',
    driverId: 'driver1',
    status: 'COMPLETED',
    totalDeliveryFee: 5,
    currency: 'USD',
    senderName: 'Sender',
    senderPhone: '123',
    pickupAddress: 'Addr',
    serviceTypeId: 'srv1',
    serviceTypeName: 'Standard',
    items: [
        {
            id: 'item1',
            image: '',
            receiverName: 'Receiver',
            receiverPhone: '456',
            destinationAddress: 'Dest',
            productPrice: 50,

            // Core Logic Props
            trackingCode: 'TRK1',
            codCurrency: 'USD',
            deliveryFee: 5,
            driverSettlementStatus: 'UNSETTLED',
            driverId: 'driver1',
            delivererId: 'driver1',
        }
    ],
    // Dummy required fields
    distance: 10,
    subtotal: 5,
    discountAmount: 0,
    taxAmount: 0,
    branchId: 'b1',
    createdAt: Date.now(),
};

const rulePickup: DriverCommissionRule = { id: 'r1', zoneName: 'Default', isDefault: true, type: 'PERCENTAGE', value: 30, commissionFor: 'PICKUP', driverSalaryType: 'WITHOUT_BASE_SALARY' }; // 30% of 5 = 1.5
const ruleDelivery: DriverCommissionRule = { id: 'r2', zoneName: 'Default', isDefault: true, type: 'PERCENTAGE', value: 70, commissionFor: 'DELIVERY', driverSalaryType: 'WITHOUT_BASE_SALARY' }; // 70% of 5 = 3.5

async function runTests() {
    console.log("--- STARTING ACCOUNTING VERIFICATION (Gross Revenue Model) ---");

    const context = {
        accounts: mockAccounts,
        settings: mockSettings,
        employees: [mockEmployee],
        commissionRules: [rulePickup, ruleDelivery], // Pickup 1.5, Delivery 3.5 = Total 5
        bookings: [mockBooking],
        currencies: [{ id: 'usd', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBase: true }, { id: 'khr', code: 'KHR', name: 'Khmer Riel', symbol: '៛', exchangeRate: 4000, isBase: false }]
    };

    // TEST 1: Exact Match Settlement ($50 COD)
    const params1: GLBookingParams = {
        transactionType: 'SETTLEMENT',
        userId: 'u1', userName: 'John Driver', userRole: 'driver',
        amount: 50, currency: 'USD',
        bankAccountId: 'bank-usd', branchId: 'b1',
        relatedItems: [{ bookingId: 'b1', itemId: 'item1' }]
    };

    console.log("\nTest 1: Exact Match Settlement ($50 COD)");
    try {
        const result = await GLBookingService.previewGLEntry(params1, context as any);

        if (result.isValid) {
            console.log("SUCCESS: GL Generated");
            let hasError = false;

            result.lines.forEach(l => {
                console.log(`  ${l.description} (${l.accountId}): Dr ${l.debit} Cr ${l.credit}`);
            });

            // Expected Validations:
            // 1. COD Payable (Net) -> Cr 45 (50 - 5)
            // 2. Revenue (Gross) -> Cr 5
            // 3. Commission Expense -> Dr 5
            // 4. Commission Credit -> Cr 5
            // 5. Cash (Bank) -> Dr 50 (Provided in params)
            // TOTAL Check: Dr 50+5=55. Cr 45+5+5=55. Balanced.

            // Check specific logic lines
            const expLine = result.lines.find(l => l.accountId === 'exp-comm');
            const revLine = result.lines.find(l => l.accountId === 'rev-doorstep');
            const custLine = result.lines.find(l => l.accountId === 'wallet-cust');

            if (!expLine || expLine.debit !== 5) {
                console.log("  -> FAIL: Commission Expense missing or incorrect."); hasError = true;
            }
            if (!revLine || revLine.credit !== 5) {
                console.log("  -> FAIL: Gross Revenue missing or incorrect."); hasError = true;
            }
            if (!custLine || custLine.credit !== 45) {
                console.log("  -> FAIL: Net Customer Liability incorrect."); hasError = true;
            }

            if (!hasError) {
                console.log("  -> PASS: Gross Model Logic Verified.");
            }

        } else {
            console.error("FAIL:", result.errors);
        }
    } catch (e) {
        console.error("Test 1 Error:", e);
    }

    // TEST 2: Cross Currency Block
    console.log("\nTest 2: Cross Currency Attempt (Item USD, Pay KHR)");
    try {
        const result = await GLBookingService.previewGLEntry({
            transactionType: 'SETTLEMENT',
            userId: 'driver1',
            userName: 'John Driver',
            userRole: 'driver',
            amount: 200000,
            currency: 'KHR',
            bankAccountId: 'bank-usd',
            relatedItems: [{ bookingId: 'b1', itemId: 'item1' }],
            branchId: 'b1'
        }, context as any);

        if (result.isValid) {
            console.error("FAILED: Should be invalid but returned valid result");
        } else {
            console.log("SUCCESS: Blocked Cross Currency. Error:", result.errors[0]);
        }
    } catch (e) {
        console.log("ERROR: Unexpected throw in Test 2:", e);
    }
}

runTests();
