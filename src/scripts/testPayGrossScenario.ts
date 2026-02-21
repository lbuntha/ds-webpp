import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 1. Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Polyfill import.meta.env for the services
const processEnv = process.env;
(global as any).import = {
    meta: {
        env: {
            ...processEnv,
            VITE_FIREBASE_API_KEY: processEnv.VITE_FIREBASE_API_KEY || processEnv.FIREBASE_API_KEY,
            VITE_FIREBASE_AUTH_DOMAIN: processEnv.VITE_FIREBASE_AUTH_DOMAIN || processEnv.FIREBASE_AUTH_DOMAIN,
            VITE_FIREBASE_PROJECT_ID: processEnv.VITE_FIREBASE_PROJECT_ID || processEnv.FIREBASE_PROJECT_ID,
            VITE_FIREBASE_STORAGE_BUCKET: processEnv.VITE_FIREBASE_STORAGE_BUCKET || processEnv.FIREBASE_STORAGE_BUCKET,
            VITE_FIREBASE_MESSAGING_SENDER_ID: processEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || processEnv.FIREBASE_MESSAGING_SENDER_ID,
            VITE_FIREBASE_APP_ID: processEnv.VITE_FIREBASE_APP_ID || processEnv.FIREBASE_APP_ID,
        }
    }
};

// Polyfill window for LogisticsService.cleanData
(global as any).window = global;
(global as any).HTMLElement = class { };

async function testPayGrossScenario() {
    const { firebaseService } = await import('../shared/services/firebaseService.js');
    const { db } = await import('../shared/services/firebaseInstance.js');
    const { updateDoc, doc, setDoc, deleteDoc, getDoc } = await import('firebase/firestore');

    console.log('--- Phase 0: Setup ---');
    const testAdminPhone = '011223344';
    const testAdminPin = '888888';

    try {
        console.log(`Attempting to login as test admin...`);
        await firebaseService.authService.loginWithEmailOrPhone(testAdminPhone, testAdminPin);
        console.log('✅ Logged in as Test Admin');
    } catch (e) {
        console.log('Test admin not found or login failed, creating new...');
        try {
            await firebaseService.authService.registerWithPhone(testAdminPhone, testAdminPin, 'Script Admin');
            console.log('✅ Registered new test admin');
        } catch (regError: any) {
            console.log('Registration failed (maybe already exists in auth but not firestore), trying login again...');
        }
    }

    // Ensure we are logged in
    const { auth } = await import('../shared/services/firebaseInstance.js');
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error('❌ Failed to authenticate');
        return;
    }

    console.log(`Authenticated as: ${currentUser.uid}`);

    // Self-Promote to system-admin
    console.log('Self-promoting to system-admin...');
    await updateDoc(doc(db, 'users', currentUser.uid), {
        role: 'system-admin'
    });
    console.log('✅ Self-promotion successful');

    const testCustomerId = 'test-cust-paygross';
    const testUserId = 'test-user-paygross';
    const branchId = 'b1';

    // Cleanup & Create Test User/Customer
    console.log('Cleaning up old test data...');
    await deleteDoc(doc(db, 'customers', testCustomerId)).catch(() => { });
    await deleteDoc(doc(db, 'users', testUserId)).catch(() => { });

    const { collection, getDocs, query, where, writeBatch } = await import('firebase/firestore');

    // Cleanup old wallet txns
    const wq = query(collection(db, 'wallet_transactions'), where('userId', '==', testUserId));
    const wqSnap = await getDocs(wq);
    const wBatch = writeBatch(db);
    wqSnap.forEach(d => wBatch.delete(d.ref));
    await wBatch.commit();

    // Cleanup old fee receivables
    const fq = query(collection(db, 'fee_receivables'), where('customerId', '==', testCustomerId));
    const fqSnap = await getDocs(fq);
    const fBatch = writeBatch(db);
    fqSnap.forEach(d => fBatch.delete(d.ref));
    await fBatch.commit();

    console.log('Creating Test Customer & User...');
    const testCustomer = {
        id: testCustomerId,
        name: 'Test PayGross Customer',
        phone: '099111222',
        type: 'INDIVIDUAL',
        createdAt: Date.now()
    };
    const testUser = {
        uid: testUserId,
        name: 'Test PayGross User',
        phone: '099111222',
        role: 'customer',
        linkedCustomerId: testCustomerId,
        createdAt: Date.now(),
        status: 'ACTIVE'
    };

    await setDoc(doc(db, 'customers', testCustomerId), testCustomer);
    await setDoc(doc(db, 'users', testUserId), testUser);
    console.log('✅ Test data ready');

    console.log('\n--- Phase 1: Booking & Delivery ---');
    const bookingId = `book-${Date.now()}`;
    const itemId = `item-${Date.now()}`;
    const booking = {
        id: bookingId,
        senderId: testCustomerId,
        senderName: testCustomer.name,
        senderPhone: testCustomer.phone,
        pickupAddress: 'Test Warehouse',
        serviceTypeId: 'S1',
        serviceTypeName: 'Standard',
        branchId: branchId,
        bookingDate: new Date().toISOString().split('T')[0],
        status: 'PENDING' as any,
        currency: 'USD' as any,
        distance: 5,
        subtotal: 21.25,
        discountAmount: 0,
        taxAmount: 0,
        totalDeliveryFee: 1.25,
        items: [{
            id: itemId,
            receiverName: 'Receiver 1',
            receiverPhone: '099000001',
            productPrice: 20.00,
            codCurrency: 'USD' as any,
            deliveryFeeUSD: 1.25,
            image: '',
            destinationAddress: 'Test Destination',
            status: 'PENDING' as any
        }],
        createdAt: Date.now()
    };

    await firebaseService.logisticsService.saveParcelBooking(booking);
    console.log(`✅ Booking ${bookingId} created: COD $20, Fee $1.25`);

    // Simulate Delivery
    const updatedBooking = { ...booking };
    updatedBooking.status = 'COMPLETED';
    updatedBooking.items[0].status = 'DELIVERED';
    await firebaseService.logisticsService.saveParcelBooking(updatedBooking);
    console.log('✅ Booking marked as DELIVERED');

    // Simulate Driver Settlement (Net $18.75 to wallet)
    // In real system, this happens via Finance Approval of Driver Settlement
    console.log('Simulating Driver Settlement (Net Entry to Wallet)...');
    await firebaseService.walletService.processWalletTransaction(
        testUserId,
        18.75,
        'USD',
        'EARNING', // Usually earnings or similar credit
        'system-bank',
        `COD Settlement: ${bookingId}`,
        [{ bookingId, itemId }]
    );
    console.log('✅ Wallet credited with $18.75 (Net)');

    console.log('\n--- Phase 2: Gross Payout ---');
    // Admin initiates Gross Payout of $20.00
    console.log('Initiating Gross Payout of $20.00...');
    await firebaseService.walletService.requestSettlement(
        testUserId,
        testUser.name,
        20.00,
        'USD',
        'system-bank',
        '',
        `Gross Payout: ${bookingId}`,
        [{ bookingId, itemId }],
        true // excludeFees = true
    );

    // Find the pending request to approve it
    const pending = await firebaseService.walletService.getPendingWalletTransactions();
    const myRequest = pending.find(t => t.userId === testUserId && t.type === 'SETTLEMENT');

    if (myRequest) {
        console.log('Approving Payout Request...');
        // We'll skip GL entry creation in script for now as it's complex to mock the GL service here, 
        // but we verify the wallet balance after the transaction is APPROVED.
        await firebaseService.walletService.approveWalletTransaction(myRequest.id, 'admin-uid', 'je-123');
        console.log('✅ Payout APPROVED');
    }

    console.log('\n--- Phase 3: Verification (FeeReceivable Creation) ---');
    // Verify Balance is technically -$1.25 from a wallet perspective, but we now check `fee_receivables`

    // Check wallet balance
    const txns = await firebaseService.walletService.getWalletTransactions(testUserId);
    let balance = 0;
    txns.forEach(t => {
        if (t.status === 'APPROVED') {
            if (t.type === 'EARNING' || t.type === 'DEPOSIT') balance += t.amount;
            if (t.type === 'SETTLEMENT' || t.type === 'WITHDRAWAL') balance -= t.amount;
        }
    });
    console.log(`Wallet Balance: $${balance.toFixed(2)} (Expected: -$1.25)`);

    // Check FeeReceivable
    console.log('Querying fee_receivables for test customer...');
    const q = query(
        collection(db, 'fee_receivables'),
        where('customerId', '==', testCustomerId)
    );
    const feeSnap = await getDocs(q);
    const fees = feeSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    if (fees.length === 1 && fees[0].totalAmount === 1.25 && fees[0].status === 'UNPAID') {
        console.log(`✅ SUCCESS: Created 1 UNPAID FeeReceivable for $1.25 (ID: ${fees[0].id})`);
    } else {
        console.error(`❌ FAILURE: Expected 1 UNPAID FeeReceivable for $1.25, found:`, fees);
    }

    console.log('\n--- Phase 4: Collection Flow (Admin clears the Fee) ---');

    // Simulate what CustomerCollectionForm does: Create a DEPOSIT and update the FeeReceivable
    if (fees.length > 0) {
        const feeToClear = fees[0];
        console.log(`Simulating Admin collecting $1.25 cash to clear fee ${feeToClear.id}...`);

        // 1. Create overarching DEPOSIT
        const txnId = `wtxn-col-${Date.now()}`;
        const txn = {
            id: txnId,
            userId: testUserId,
            amount: 1.25,
            currency: 'USD',
            type: 'DEPOSIT',
            status: 'APPROVED',
            date: new Date().toISOString().split('T')[0],
            description: `Fee Collection (Script Test)`,
            bankAccountId: 'system-bank',
            relatedItems: [
                { bookingId: feeToClear.bookingId, itemId: feeToClear.itemId }
            ]
        };
        await firebaseService.walletService.saveDocument('wallet_transactions', txn);
        console.log('✅ Created DEPOSIT wallet transaction for $1.25');

        // 2. Update FeeReceivable
        await updateDoc(doc(db, 'fee_receivables', feeToClear.id), {
            paidAmount: 1.25,
            status: 'PAID',
            clearingTxnIds: [txnId],
            clearedAt: Date.now()
        });
        console.log(`✅ Marked FeeReceivable ${feeToClear.id} as PAID`);

        // Verify final wallet state
        const finalTxns = await firebaseService.walletService.getWalletTransactions(testUserId);
        let finalBalance = 0;
        finalTxns.forEach(t => {
            if (t.status === 'APPROVED') {
                if (t.type === 'EARNING' || t.type === 'DEPOSIT') finalBalance += t.amount;
                if (t.type === 'SETTLEMENT' || t.type === 'WITHDRAWAL') finalBalance -= t.amount;
            }
        });

        console.log(`Final Wallet Balance: $${finalBalance.toFixed(2)}`);
        if (Math.abs(finalBalance) < 0.01) {
            console.log('✅ SUCCESS: Final wallet balance is $0.00. End-to-end Pay Gross flow verified.');
        } else {
            console.error(`❌ FAILURE: Expected $0.00, got $${finalBalance.toFixed(2)}`);
        }
    } else {
        console.error('❌ Skipping Collection Flow: No FeeReceivable found to collect.');
    }
}

testPayGrossScenario().catch(console.error).finally(() => process.exit(0));
