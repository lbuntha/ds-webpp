
import React, { useState } from 'react';
import { Account, Branch, SystemSettings } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MASTER_COA_DATA } from '../../constants';
import { toast } from '../../src/shared/utils/toast';

interface Props {
  onComplete: (settings: SystemSettings, accounts: Account[], branches: Branch[], shouldReset?: boolean) => Promise<void>;
}

export const OnboardingWizard: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Data State
  const [companyName, setCompanyName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'KHR'>('USD');
  const [branchName, setBranchName] = useState('Headquarters');
  const [branchCode, setBranchCode] = useState('HQ');

  // Reset Toggle
  const [shouldReset, setShouldReset] = useState(false);

  const handleNext = () => {
    if (step === 1 && !companyName) return toast.warning('Please enter a company name.');
    if (step === 2 && (!branchName || !branchCode)) return toast.warning('Please define at least one branch.');
    setStep((prev) => Math.min(prev + 1, 3) as any);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1) as any);
  };

  const handleFinish = async () => {
    // 1. Immediate Feedback
    setLoading(true);
    setStatusMessage("Initializing setup...");

    // 2. Small delay to allow UI to update
    await new Promise(r => setTimeout(r, 100));

    try {
      const settings: SystemSettings = {
        companyName,
        setupComplete: true
      };

      const branches: Branch[] = [
        { id: `br-${Date.now()}`, name: branchName, code: branchCode }
      ];

      setStatusMessage("Configuring Chart of Accounts...");

      // Map special wallet accounts for default settings
      // Customer Wallets
      let custWalletUSD = '';
      let custWalletKHR = '';

      // Driver Wallets (Commission Liability)
      let driverWalletUSD = '';
      let driverWalletKHR = '';

      // Driver Commission Expense (COGS)
      let driverCommExpUSD = '';
      let driverCommExpKHR = '';

      // Settlement Banks
      let settlementBankIdUSD = '';
      let settlementBankIdKHR = '';

      // Use the Master List
      const accounts = MASTER_COA_DATA.map(acc => {
        const id = acc.id || acc.code || `acc-${Date.now()}-${Math.random()}`;

        // Identify Wallet Accounts by code
        // 3200002 = Accounts Payable(Customer Wallet) USD
        if (acc.code === '3200002') custWalletUSD = id;
        // 3200001 = Accounts Payable(Customer Wallet) KHR
        if (acc.code === '3200001') custWalletKHR = id;

        // 3210102 = Accrued Commision USD (Driver Payable)
        if (acc.code === '3210102') driverWalletUSD = id;
        // 3210101 = Accrued Commision KHR
        if (acc.code === '3210101') driverWalletKHR = id;

        // 6501002 = Delivery commision expense Labor USD
        if (acc.code === '6501002') driverCommExpUSD = id;
        // 6501001 = Delivery commision expense Labor KHR
        if (acc.code === '6501001') driverCommExpKHR = id;

        // Settlement Banks (Asset)
        // 1101002 = Settlement Account USD
        if (acc.code === '1101002') settlementBankIdUSD = id;
        // 1101001 = Settlement Account KHR
        if (acc.code === '1101001') settlementBankIdKHR = id;

        return {
          ...acc,
          id: id
        };
      });

      // Auto-configure new settings
      if (custWalletUSD) settings.customerWalletAccountUSD = custWalletUSD;
      if (custWalletKHR) settings.customerWalletAccountKHR = custWalletKHR;

      if (driverWalletUSD) settings.driverWalletAccountUSD = driverWalletUSD;
      if (driverWalletKHR) settings.driverWalletAccountKHR = driverWalletKHR;

      if (driverCommExpUSD) settings.driverCommissionExpenseAccountUSD = driverCommExpUSD;
      if (driverCommExpKHR) settings.driverCommissionExpenseAccountKHR = driverCommExpKHR;

      // Settlement Account Mapping
      if (settlementBankIdUSD) {
        settings.defaultDriverSettlementBankIdUSD = settlementBankIdUSD;
        settings.defaultCustomerSettlementBankIdUSD = settlementBankIdUSD;

        // Legacy Fallbacks
        settings.defaultCustomerWalletAccountId = custWalletUSD;
        settings.defaultDriverWalletAccountId = driverWalletUSD;
        settings.defaultDriverSettlementBankId = settlementBankIdUSD;
        settings.defaultCustomerSettlementBankId = settlementBankIdUSD;
        settings.defaultSettlementBankAccountId = settlementBankIdUSD;
      }

      if (settlementBankIdKHR) {
        settings.defaultDriverSettlementBankIdKHR = settlementBankIdKHR;
        settings.defaultCustomerSettlementBankIdKHR = settlementBankIdKHR;
      }

      setStatusMessage(shouldReset ? "Clearing old data & importing..." : "Importing data...");

      await onComplete(settings, accounts, branches, shouldReset);

    } catch (e: any) {
      console.error(e);
      toast.error(`Setup failed: ${e.message || 'Unknown error'}`);
      setLoading(false);
    }
    // Note: We don't set loading false on success because the app will reload/redirect
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-10 space-x-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${step >= i ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-gray-200 text-gray-500'
              }`}
          >
            {i}
          </div>
          {i < 3 && (
            <div className={`w-12 h-1 mx-2 rounded ${step > i ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-gray-900">Setup Your Company</h1>
          <p className="text-gray-500 mt-2">Customize DS Accounting for your business needs.</p>
        </div>

        <StepIndicator />

        <Card className="shadow-xl border-t-4 border-indigo-600">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Company Profile</h2>
                <p className="text-sm text-gray-500">Start by telling us about your organization.</p>
              </div>

              <Input
                label="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Trading Co."
                autoFocus
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base Currency</label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setBaseCurrency('USD')}
                    className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${baseCurrency === 'USD' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="text-2xl font-bold text-gray-800 mb-1">$ USD</div>
                    <div className="text-xs text-gray-500">US Dollar</div>
                  </div>
                  <div
                    onClick={() => setBaseCurrency('KHR')}
                    className={`p-4 border rounded-xl cursor-pointer text-center transition-all ${baseCurrency === 'KHR' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="text-2xl font-bold text-gray-800 mb-1">៛ KHR</div>
                    <div className="text-xs text-gray-500">Cambodian Riel</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  This is the currency used for your financial reports (Balance Sheet, P&L). You can still transact in other currencies.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Operating Structure</h2>
                <p className="text-sm text-gray-500">Define your primary branch/location.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <Input
                  label="Primary Branch Name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Headquarters"
                />
                <div className="mt-4">
                  <Input
                    label="Branch Code"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    placeholder="e.g. HQ"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">You can add more branches later in Settings.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Review & Finish</h2>
                <p className="text-sm text-gray-500">Ready to launch your system.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 space-y-4 border border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-500">Company Name</span>
                  <span className="font-medium text-gray-900">{companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Currency</span>
                  <span className="font-medium text-gray-900">{baseCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Primary Branch</span>
                  <span className="font-medium text-gray-900">{branchName} ({branchCode})</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-4">
                  <span className="text-gray-500">Chart of Accounts</span>
                  <span className="font-medium text-gray-900">{MASTER_COA_DATA.length} Standard Accounts</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="resetToggle"
                  className="mt-1 h-5 w-5 text-red-600 border-red-300 rounded focus:ring-red-500 cursor-pointer"
                  checked={shouldReset}
                  onChange={(e) => setShouldReset(e.target.checked)}
                />
                <div>
                  <label htmlFor="resetToggle" className="block text-sm font-bold text-red-800 cursor-pointer">
                    Fresh Start: Wipe existing operational data
                  </label>
                  <p className="text-xs text-red-700 mt-2 leading-relaxed">
                    Check this box if you want to <strong>DELETE ALL</strong> existing Transactions, Invoices, Parcels, Customers, and Wallet history to start fresh.
                    <br /><br />
                    <span className="font-semibold">Note:</span> Your Users, Drivers, Branches, and Chart of Accounts will NOT be deleted (unless you manually reset them).
                  </p>
                </div>
              </div>

              {loading && statusMessage && (
                <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg text-center animate-pulse border border-blue-100">
                  {statusMessage}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} disabled={loading} type="button">Back</Button>
            ) : (
              <div></div> // Spacer
            )}

            {step < 3 ? (
              <Button onClick={handleNext} type="button">Next Step</Button>
            ) : (
              <Button
                onClick={handleFinish}
                isLoading={loading}
                variant={shouldReset ? 'danger' : 'primary'}
                className={!shouldReset ? "!bg-green-600 !hover:bg-green-700" : ""}
                type="button"
                disabled={loading}
              >
                {shouldReset ? 'Reset & Complete Setup' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
