
import { Account, AccountType, JournalEntry, TrialBalanceRow, GeneralLedgerLine, JournalEntryLine, Invoice, Bill } from '../types';

export interface HealthIssue {
  severity: 'CRITICAL' | 'WARNING';
  type: 'UNBALANCED' | 'EMPTY' | 'ORPHANED_ACCOUNT' | 'FUTURE_DATED' | 'DUPLICATE_COA' | 'UNPOSTED_DOC';
  message: string;
  transactionId?: string;
  date?: string;
  meta?: any; // Generic container for extra data (like duplicate lists)
}

export class AccountingService {
  /**
   * Validates if debits equal credits
   */
  static validateEntry(entry: JournalEntry): boolean {
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    // Allow for minor floating point discrepancies
    return Math.abs(totalDebit - totalCredit) < 0.01;
  }

  /**
   * System Health Check
   * Scans all transactions for accounting anomalies
   */
  static validateLedgerHealth(
      transactions: JournalEntry[], 
      accounts: Account[],
      invoices: Invoice[] = [],
      bills: Bill[] = []
  ): HealthIssue[] {
      const issues: HealthIssue[] = [];
      const safeTxns = transactions || [];
      const safeAccounts = accounts || [];
      const safeInvoices = invoices || [];
      const safeBills = bills || [];

      const accountIds = new Set(safeAccounts.map(a => a.id));

      // 1. Check for Duplicate Account Codes
      const codeMap = new Map<string, Account[]>();
      safeAccounts.forEach(acc => {
          const existing = codeMap.get(acc.code) || [];
          codeMap.set(acc.code, [...existing, acc]);
      });

      codeMap.forEach((accs, code) => {
          if (accs.length > 1) {
              issues.push({
                  severity: 'WARNING',
                  type: 'DUPLICATE_COA',
                  message: `Duplicate Account Code detected: ${code}. ${accs.length} accounts share this code.`,
                  date: new Date().toISOString().split('T')[0],
                  meta: { accounts: accs }
              });
          }
      });

      // 2. Check for Unposted (Draft) Documents
      const today = new Date().toISOString().split('T')[0];
      const draftInvoices = safeInvoices.filter(i => i.status === 'DRAFT' && i.date <= today);
      if (draftInvoices.length > 0) {
          issues.push({
              severity: 'WARNING',
              type: 'UNPOSTED_DOC',
              message: `Found ${draftInvoices.length} unposted Draft Invoices. These are not reflected in financial reports.`,
              date: today
          });
      }
      
      const draftBills = safeBills.filter(b => b.status === 'DRAFT' && b.date <= today);
      if (draftBills.length > 0) {
          issues.push({
              severity: 'WARNING',
              type: 'UNPOSTED_DOC',
              message: `Found ${draftBills.length} unposted Draft Bills. These are not reflected in financial reports.`,
              date: today
          });
      }

      // 3. Transaction Level Checks
      safeTxns.forEach(txn => {
          // Check for Balance
          if (!this.validateEntry(txn)) {
              const debit = txn.lines.reduce((s, l) => s + l.debit, 0);
              const credit = txn.lines.reduce((s, l) => s + l.credit, 0);
              issues.push({
                  severity: 'CRITICAL',
                  type: 'UNBALANCED',
                  message: `Transaction ${txn.reference || txn.id} is unbalanced. Debit: ${debit.toFixed(2)}, Credit: ${credit.toFixed(2)}`,
                  transactionId: txn.id,
                  date: txn.date
              });
          }

          // Check for Empty Lines
          if (txn.lines.length === 0) {
              issues.push({
                  severity: 'WARNING',
                  type: 'EMPTY',
                  message: `Transaction ${txn.reference || txn.id} has no line items.`,
                  transactionId: txn.id,
                  date: txn.date
              });
          }

          // Check for Orphaned Accounts (Lines pointing to accounts that don't exist)
          txn.lines.forEach(line => {
              if (!accountIds.has(line.accountId)) {
                  issues.push({
                      severity: 'CRITICAL',
                      type: 'ORPHANED_ACCOUNT',
                      message: `Transaction ${txn.reference || txn.id} refers to a missing account ID: ${line.accountId}`,
                      transactionId: txn.id,
                      date: txn.date
                  });
              }
          });
      });

      return issues;
  }

  /**
   * Generates a Period Closing Entry (Month-End or Year-End)
   * 1. Calculates Revenue & Expense totals for the specified period
   * 2. Creates an entry to zero them out
   * 3. Plugs the difference (Net Income) to Retained Earnings
   */
  static generatePeriodClosingEntry(
      startDate: string,
      endDate: string,
      accounts: Account[],
      transactions: JournalEntry[],
      retainedEarningsAccountId: string,
      branchId?: string
  ): JournalEntry | null {
      const safeTxns = transactions || [];
      const safeAccounts = accounts || [];

      // Filter txns for the period and optionally branch
      const periodTxns = safeTxns.filter(t => 
          t.date >= startDate && 
          t.date <= endDate && 
          (!branchId || t.branchId === branchId) &&
          !t.isClosingEntry // Avoid double counting if running multiple times
      );

      if (periodTxns.length === 0) return null;

      // Calculate totals per account
      const accountBalances: Record<string, number> = {};

      periodTxns.forEach(txn => {
          txn.lines.forEach(line => {
              const acc = safeAccounts.find(a => a.id === line.accountId);
              // Only interested in P&L accounts (Revenue & Expense)
              if (acc && (acc.type === AccountType.REVENUE || acc.type === AccountType.EXPENSE)) {
                  const currentBal = accountBalances[line.accountId] || 0;
                  // Standard Debit positive, Credit negative for internal calc
                  accountBalances[line.accountId] = currentBal + (line.debit - line.credit);
              }
          });
      });

      const lines: JournalEntryLine[] = [];
      let totalDebits = 0;
      let totalCredits = 0;

      // Create lines to zero out balances
      Object.entries(accountBalances).forEach(([accId, balance]) => {
          if (Math.abs(balance) < 0.01) return; // Skip zero balances

          // To zero out:
          // If Balance is Positive (Debit heavy, usually Expense), we need to Credit it.
          // If Balance is Negative (Credit heavy, usually Revenue), we need to Debit it.
          
          if (balance > 0) {
              // Debit Balance (Expense) -> Credit to close
              lines.push({ accountId: accId, debit: 0, credit: balance });
              totalCredits += balance;
          } else {
              // Credit Balance (Revenue) -> Debit to close
              const absBal = Math.abs(balance);
              lines.push({ accountId: accId, debit: absBal, credit: 0 });
              totalDebits += absBal;
          }
      });

      if (lines.length === 0) return null;

      // Calculate Net Income (Credits - Debits in the closing entry perspective, or inverse of P&L)
      // The "Plug" goes to Retained Earnings.
      // If Total Debits > Total Credits in closing entry, it means we had more Revenue (which we debited to close). 
      // The difference is Credit to Retained Earnings (Profit).
      
      const difference = totalDebits - totalCredits;

      if (Math.abs(difference) > 0.01) {
          if (difference > 0) {
              // Credit Retained Earnings (Profit)
              lines.push({ accountId: retainedEarningsAccountId, debit: 0, credit: difference });
          } else {
              // Debit Retained Earnings (Loss)
              lines.push({ accountId: retainedEarningsAccountId, debit: Math.abs(difference), credit: 0 });
          }
      }

      const closingEntry: JournalEntry = {
          id: `je-close-${endDate}-${Date.now()}`,
          date: endDate, // Last day of period
          description: `Period Closing Entry (${startDate} to ${endDate})`,
          reference: `CLOSE-${endDate.replace(/-/g, '')}`,
          branchId: branchId || 'All',
          currency: 'USD',
          exchangeRate: 1,
          createdAt: Date.now(),
          isClosingEntry: true,
          lines: lines
      };

      return closingEntry;
  }

  /**
   * Generates Trial Balance Data with Hierarchy Rollup
   */
  static generateTrialBalance(accounts: Account[], transactions: JournalEntry[], branchId?: string): TrialBalanceRow[] {
    const tb: Map<string, TrialBalanceRow> = new Map();
    const safeTxns = transactions || [];
    const safeAccounts = accounts || [];

    // 1. Initialize all accounts
    safeAccounts.forEach(acc => {
      tb.set(acc.id, {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        type: acc.type,
        debit: 0,
        credit: 0,
        isHeader: acc.isHeader || false,
        parentAccountId: acc.parentAccountId,
        depth: 0 // To be calculated
      });
    });

    // 2. Sum transactions (Detail accounts only usually)
    safeTxns.forEach(txn => {
      if (branchId && txn.branchId !== branchId) return;

      txn.lines.forEach(line => {
        const record = tb.get(line.accountId);
        if (record) {
          record.debit += line.debit;
          record.credit += line.credit;
        }
      });
    });

    // 3. Calculate Depth and Rollup Totals
    // Helper to calculate depth to ensure proper indentation
    const getDepth = (id: string): number => {
        const acc = safeAccounts.find(a => a.id === id);
        if (!acc || !acc.parentAccountId) return 0;
        // Simple cycle prevention
        if (acc.parentAccountId === id) return 0;
        return 1 + getDepth(acc.parentAccountId);
    };

    // Assign depths
    safeAccounts.forEach(acc => {
        const row = tb.get(acc.id);
        if (row) row.depth = getDepth(acc.id);
    });

    // Rollup Logic: Process from deepest to shallowest
    const sortedByDepth = [...safeAccounts].sort((a, b) => {
        const depthA = tb.get(a.id)?.depth || 0;
        const depthB = tb.get(b.id)?.depth || 0;
        return depthB - depthA; // Descending
    });

    sortedByDepth.forEach(childAcc => {
        if (childAcc.parentAccountId) {
            const childRow = tb.get(childAcc.id);
            const parentRow = tb.get(childAcc.parentAccountId);
            
            if (childRow && parentRow) {
                parentRow.debit += childRow.debit;
                parentRow.credit += childRow.credit;
            }
        }
    });

    // Return list, sorted by Code
    return Array.from(tb.values())
        .filter(row => row.debit > 0.001 || row.credit > 0.001 || row.isHeader) // Show headers even if 0 if they exist, or clean up empty headers later in UI
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  /**
   * Generates General Ledger for a specific account
   */
  static generateGeneralLedger(accountId: string, transactions: JournalEntry[]): GeneralLedgerLine[] {
    const lines: GeneralLedgerLine[] = [];
    let runningBalance = 0;
    const safeTxns = transactions || [];

    // Sort transactions by date
    const sortedTxns = [...safeTxns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTxns.forEach(txn => {
      // Find ALL lines for this account (handle split transactions correctly)
      const matchingLines = txn.lines.filter(l => l.accountId === accountId);
      
      matchingLines.forEach(line => {
        // Standard Running Balance: Debit adds, Credit subtracts
        // (UI presentation layer can invert this for Credit-normal accounts)
        runningBalance += (line.debit - line.credit);

        lines.push({
          date: txn.date,
          journalId: txn.id,
          description: line.description || txn.description, // Prefer line description if exists
          reference: txn.reference,
          debit: line.debit,
          credit: line.credit,
          balance: runningBalance,
          displayedBalance: runningBalance // Default, UI can override or use as is
        });
      });
    });

    return lines;
  }

  /**
   * Helper to calculate P&L
   */
  static calculateNetIncome(accounts: Account[], transactions: JournalEntry[], branchId?: string): number {
    const tb = this.generateTrialBalance(accounts, transactions, branchId);
    let revenue = 0;
    let expenses = 0;

    tb.forEach(row => {
        // Important: Only count Top-Level rows (Depth 0).
        // Since `generateTrialBalance` rolls up children values to parents,
        // summing Depth 0 accounts ensures we include everything exactly once.
        // Summing !isHeader creates double counting if parents are not marked as headers.
        if (row.depth !== 0) return;

        if(row.type === AccountType.REVENUE) {
            revenue += (row.credit - row.debit);
        } else if (row.type === AccountType.EXPENSE) {
            expenses += (row.debit - row.credit);
        }
    });

    return revenue - expenses;
  }
}
