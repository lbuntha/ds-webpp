import { BaseService } from './baseService';
import { Account, JournalEntry, FixedAsset, FixedAssetCategory, JournalEntryStatus, ExpenseTemplate } from '../types';
import { doc, deleteDoc, writeBatch, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';

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

    // ======== MAKER-CHECKER WORKFLOW ========

    /**
     * Submit a journal entry for approval (Maker action)
     * Entry is saved with PENDING_APPROVAL status
     */
    async submitForApproval(entry: JournalEntry, userId: string, userName: string): Promise<void> {
        const entryWithStatus: JournalEntry = {
            ...entry,
            status: 'PENDING_APPROVAL',
            createdBy: userId,
            createdByName: userName,
            createdAt: Date.now()
        };
        await this.saveDocument('transactions', entryWithStatus);
    }

    /**
     * Save as draft (Maker action)
     * Entry is saved with DRAFT status, not yet submitted for approval
     */
    async saveAsDraft(entry: JournalEntry, userId: string, userName: string): Promise<void> {
        const entryWithStatus: JournalEntry = {
            ...entry,
            status: 'DRAFT',
            createdBy: userId,
            createdByName: userName,
            createdAt: entry.createdAt || Date.now()
        };
        await this.saveDocument('transactions', entryWithStatus);
    }

    /**
     * Approve a pending journal entry (Checker action)
     * Changes status to POSTED and records approver info
     */
    async approveJournalEntry(entryId: string, approverId: string, approverName: string): Promise<void> {
        const ref = doc(this.db, 'transactions', entryId);
        await updateDoc(ref, {
            status: 'POSTED' as JournalEntryStatus,
            approvedBy: approverId,
            approvedByName: approverName,
            approvedAt: Date.now(),
            rejectionReason: null // Clear any previous rejection
        });
    }

    /**
     * Reject a pending journal entry (Checker action)
     * Changes status to REJECTED with reason
     */
    async rejectJournalEntry(entryId: string, reason: string, rejecterId: string, rejecterName: string): Promise<void> {
        const ref = doc(this.db, 'transactions', entryId);
        await updateDoc(ref, {
            status: 'REJECTED' as JournalEntryStatus,
            approvedBy: rejecterId,
            approvedByName: rejecterName,
            approvedAt: Date.now(),
            rejectionReason: reason
        });
    }

    /**
     * Get all entries pending approval (for Checker's queue)
     */
    async getPendingApprovals(): Promise<JournalEntry[]> {
        const q = query(
            collection(this.db, 'transactions'),
            where('status', '==', 'PENDING_APPROVAL')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as JournalEntry));
    }

    /**
     * Get drafts for a specific user (Maker's drafts)
     */
    async getUserDrafts(userId: string): Promise<JournalEntry[]> {
        const q = query(
            collection(this.db, 'transactions'),
            where('status', '==', 'DRAFT'),
            where('createdBy', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as JournalEntry));
    }

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

    // ======== EXPENSE TEMPLATES ========
    async getExpenseTemplates() { return this.getCollection<ExpenseTemplate>('expense_templates'); }
    async saveExpenseTemplate(template: ExpenseTemplate) { await this.saveDocument('expense_templates', template); }
    async deleteExpenseTemplate(id: string) { await this.deleteDocument('expense_templates', id); }
}
