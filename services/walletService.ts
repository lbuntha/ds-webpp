
import { BaseService } from './baseService';
import { WalletTransaction, ReferralRule } from '../types';
import { query, collection, where, getDocs, updateDoc, doc, getDoc, increment } from 'firebase/firestore';

export class WalletService extends BaseService {
  async getWalletTransactions(uid: string): Promise<WalletTransaction[]> { 
      const q = query(collection(this.db, 'wallet_transactions'), where('userId', '==', uid));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as WalletTransaction);
  }

  // Admin: Get all transactions for reporting
  async getAllWalletTransactions(): Promise<WalletTransaction[]> {
      const snap = await getDocs(collection(this.db, 'wallet_transactions'));
      return snap.docs.map(d => d.data() as WalletTransaction);
  }

  async requestWalletTopUp(uid: string, amount: number, currency: string, bankId: string, attachment: string, desc: string) {
      if (attachment && attachment.startsWith('data:')) attachment = await this.uploadAttachment(attachment);
      const txn: WalletTransaction = {
          id: `wtxn-${Date.now()}`,
          userId: uid,
          amount,
          currency: currency as any,
          type: 'DEPOSIT',
          status: 'PENDING',
          date: new Date().toISOString().split('T')[0],
          description: desc,
          bankAccountId: bankId,
          attachment
      };
      await this.saveDocument('wallet_transactions', txn);
  }

  async requestWithdrawal(uid: string, userName: string, amount: number, currency: string, bankId: string, desc: string, items?: { bookingId: string, itemId: string }[]) {
      const txn: WalletTransaction = {
          id: `wtxn-wd-${Date.now()}`,
          userId: uid,
          userName,
          amount,
          currency: currency as any,
          type: 'WITHDRAWAL',
          status: 'PENDING', // Requires Finance Approval
          date: new Date().toISOString().split('T')[0],
          description: desc,
          bankAccountId: bankId,
          relatedItems: items
      };
      await this.saveDocument('wallet_transactions', txn);
  }
  
  async requestSettlement(uid: string, userName: string, amount: number, currency: string, bankId: string, attachment: string, desc: string, items?: { bookingId: string, itemId: string }[]) {
      if (attachment && attachment.startsWith('data:')) attachment = await this.uploadAttachment(attachment);
      const txn: WalletTransaction = {
          id: `wtxn-stl-${Date.now()}`,
          userId: uid,
          userName,
          amount,
          currency: currency as any,
          type: 'SETTLEMENT',
          status: 'PENDING',
          date: new Date().toISOString().split('T')[0],
          description: desc,
          bankAccountId: bankId,
          attachment,
          relatedItems: items
      };
      await this.saveDocument('wallet_transactions', txn);
  }

  async processWalletTransaction(uid: string, amount: number, currency: string, type: string, bankId: string, desc: string) {
      const txn: WalletTransaction = {
          id: `wtxn-${Date.now()}`,
          userId: uid,
          amount,
          currency: currency as any,
          type: type as any,
          status: 'APPROVED',
          date: new Date().toISOString().split('T')[0],
          description: desc,
          bankAccountId: bankId
      };
      await this.saveDocument('wallet_transactions', txn);
  }

  async getPendingWalletTransactions(): Promise<WalletTransaction[]> {
      const q = query(collection(this.db, 'wallet_transactions'), where('status', '==', 'PENDING'));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as WalletTransaction);
  }

  async approveWalletTransaction(id: string, approverId: string, journalEntryId?: string) { 
      const updates: any = { status: 'APPROVED' };
      if (journalEntryId) updates.journalEntryId = journalEntryId;
      await updateDoc(doc(this.db, 'wallet_transactions', id), updates); 
  }
  
  async rejectWalletTransaction(id: string, reason: string) { await updateDoc(doc(this.db, 'wallet_transactions', id), { status: 'REJECTED', rejectionReason: reason }); }

  // --- Referral Logic ---
  async processReferralReward(refereeUid: string, referrerCode: string) {
      // Deprecated, kept for fallback
  }

  async executeReferralRule(refereeUid: string, referrerCode: string, rule: ReferralRule) {
      const q = query(collection(this.db, 'users'), where('referralCode', '==', referrerCode));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const referrerUser = snap.docs[0].data();
      const referrerUid = referrerUser.uid;
      if (referrerUid === refereeUid) return;

      const today = new Date().toISOString().split('T')[0];

      // 1. Reward Referrer
      if (rule.referrerAmount > 0) {
          const txn: WalletTransaction = {
              id: `wtxn-ref-out-${Date.now()}`,
              userId: referrerUid,
              userName: referrerUser.name,
              amount: rule.referrerAmount,
              currency: rule.referrerCurrency,
              type: 'EARNING',
              status: 'APPROVED',
              date: today,
              description: `Referral Reward: ${rule.name}`,
              bankAccountId: ''
          };
          await this.saveDocument('wallet_transactions', txn);
          
          await updateDoc(doc(this.db, 'users', referrerUid), {
              'referralStats.count': increment(1),
              'referralStats.earnings': increment(rule.referrerAmount)
          });
      }

      // 2. Reward Referee (Cashback)
      if (rule.refereeAmount > 0) {
          const txnReferee: WalletTransaction = {
              id: `wtxn-ref-in-${Date.now()}`,
              userId: refereeUid,
              userName: 'Referee',
              amount: rule.refereeAmount,
              currency: rule.refereeCurrency,
              type: 'EARNING',
              status: 'APPROVED',
              date: today,
              description: `Welcome Bonus: ${rule.name}`,
              bankAccountId: ''
          };
          await this.saveDocument('wallet_transactions', txnReferee);
      }
  }
}
