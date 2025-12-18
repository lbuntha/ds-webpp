
import { BaseService } from './baseService';
import { Account, JournalEntry, FixedAsset, FixedAssetCategory } from '../types';
import { doc, deleteDoc, writeBatch, arrayUnion } from 'firebase/firestore';

// ... (keep existing code)

// --- REVENUE RECOGNITION (Service Fees) ---


export class FinanceService extends BaseService {
    // Accounts
    async getAccounts() { return this.getCollection<Account>('accounts'); }
    async addAccount(a: Account) { await this.saveDocument('accounts', a); }
    async updateAccount(a: Account) { await this.saveDocument('accounts', a); }
    async deleteAccount(id: string) { await this.deleteDocument('accounts', id); }

    async importAccounts(accounts: Account[]) {
        if (!Array.isArray(accounts)) return; // Safety check

        // Deduplicate by Code to prevent batch errors or overwrites in same batch
        // Use a Map where key=code to keep only the last occurrence (or first)
        const uniqueAccounts = Array.from(
            new Map(accounts.map(item => [item.code, item])).values()
        );

        // Process in chunks of 400 to respect Firestore batch limits (500)
        const chunkSize = 400;
        for (let i = 0; i < uniqueAccounts.length; i += chunkSize) {
            const chunk = uniqueAccounts.slice(i, i + chunkSize);
            const batch = writeBatch(this.db);

            chunk.forEach(acc => {
                // Use GL Code as ID for stability and upsert behavior
                const docId = acc.code;
                const ref = doc(this.db, 'accounts', docId);
                // Ensure ID is set in the data
                const data = this.cleanData({ ...acc, id: docId });
                batch.set(ref, data);
            });

            await batch.commit();
        }
    }

    // Journal
    async getTransactions() { return this.getCollection<JournalEntry>('transactions'); }
    async addTransaction(t: JournalEntry) { await this.saveDocument('transactions', t); }
    async updateTransaction(t: JournalEntry) { await this.saveDocument('transactions', t); }
    async deleteTransactions(ids: string[]) { await Promise.all(ids.map(id => deleteDoc(doc(this.db, 'transactions', id)))); }

    // Fixed Assets
    async getFixedAssets() { return this.getCollection<FixedAsset>('fixed_assets'); }
    async addFixedAsset(fa: FixedAsset) { await this.saveDocument('fixed_assets', fa); }
    async updateFixedAsset(fa: FixedAsset) { await this.saveDocument('fixed_assets', fa); }

    async getFixedAssetCategories() { return this.getCollection<FixedAssetCategory>('fixed_asset_categories'); }
    async addFixedAssetCategory(c: FixedAssetCategory) { await this.saveDocument('fixed_asset_categories', c); }
    async updateFixedAssetCategory(c: FixedAssetCategory) { await this.saveDocument('fixed_asset_categories', c); }
    async deleteFixedAssetCategory(id: string) { await this.deleteDocument('fixed_asset_categories', id); }

    async runBatchDepreciation(date: string) { return { processed: 0, totalAmount: 0 }; } // Stub implementation
    async depreciateAsset(id: string, date: string, amount: number) { /* Logic omitted */ }
    async disposeAsset(id: string, date: string, amount: number, depositAcc: string, lossAcc: string) { /* Logic omitted */ }

    // --- REVENUE RECOGNITION (Service Fees) ---
    async recognizeItemRevenue(booking: any, itemId: string, settings: any) {
        if ((booking.revenueRecognizedItems || []).includes(itemId)) return;

        const date = new Date().toISOString().split('T')[0];
        const isUSD = booking.currency !== 'KHR' && booking.codCurrency !== 'KHR'; // Simplified
        const currency = isUSD ? 'USD' : 'KHR';

        // Accounts
        // FIX: Use "Customer Wallet" (Liability) instead of "Settlement Bank" (Asset)
        const walletLiabId = isUSD
            ? (settings.customerWalletAccountUSD || settings.defaultCustomerWalletAccountId)
            : (settings.customerWalletAccountKHR || settings.defaultCustomerWalletAccountId);

        const revenueAccId = isUSD
            ? (settings.defaultRevenueAccountUSD || settings.defaultRevenueAccountId)
            : (settings.defaultRevenueAccountKHR || settings.defaultRevenueAccountId);

        const taxAccId = isUSD
            ? (settings.defaultTaxAccountUSD || settings.defaultTaxAccountId)
            : (settings.defaultTaxAccountKHR || settings.defaultTaxAccountId);

        if (!walletLiabId || !revenueAccId) {
            console.warn("Missing GL Accounts for Service Fee Recognition");
            return;
        }

        // Amounts (Pro-rata)
        const totalItems = (booking.items && booking.items.length > 0) ? booking.items.length : 1;
        const feeTotal = booking.totalDeliveryFee || 0;
        const taxTotal = booking.taxAmount || 0;

        const feePerItem = feeTotal / totalItems;
        const taxPerItem = taxTotal / totalItems;
        const revPerItem = feePerItem - taxPerItem;

        // Skip if 0 (e.g. Free Delivery)
        if (feePerItem === 0) return;

        const lines = [
            {
                accountId: walletLiabId,
                debit: feePerItem,
                credit: 0,
                description: `Service Fee Deduction: ${booking.id.slice(-6)} (Item)`
            },
            {
                accountId: revenueAccId,
                debit: 0,
                credit: revPerItem,
                description: `Service Revenue: ${booking.serviceTypeName}`
            }
        ];

        if (taxPerItem > 0 && taxAccId) {
            lines.push({
                accountId: taxAccId,
                debit: 0,
                credit: taxPerItem,
                description: `Tax Payable`
            });
        }

        const je: JournalEntry = {
            id: `je-fee-${booking.id}-${itemId}`,
            date,
            reference: booking.id,
            description: `Service Fee Recognition - Booking ${booking.id} Item ${itemId.slice(-4)}`,
            currency,
            exchangeRate: 1, // Assumed base
            lines,
            createdAt: Date.now(),
            branchId: booking.branchId || 'main',
            // Corrected Typings
        };

        // Atomic Write
        const batch = writeBatch(this.db);
        batch.set(doc(this.db, 'transactions', je.id), je);
        batch.update(doc(this.db, 'parcel_bookings', booking.id), {
            revenueRecognizedItems: arrayUnion(itemId)
        });
        await batch.commit();

        console.log(`Revenue Recognized for Booking ${booking.id} Item ${itemId}`);
    }
}
