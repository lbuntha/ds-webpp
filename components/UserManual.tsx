
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/Card';
import { firebaseService } from '../src/shared/services/firebaseService';
import { UserRole } from '../src/shared/types';

interface MenuSection {
  id: string;
  label: string;
  allowedRoles: (UserRole | 'ALL')[];
}

const MENU_SECTIONS: MenuSection[] = [
  { id: 'intro', label: '1. Introduction', allowedRoles: ['ALL'] },
  { id: 'config', label: '2. System Configuration', allowedRoles: ['system-admin'] },
  { id: 'financials', label: '3. Financial Management', allowedRoles: ['system-admin', 'accountant', 'finance-manager'] },
  { id: 'logistics', label: '4. Parcel Logistics', allowedRoles: ['system-admin', 'warehouse', 'customer'] },
  { id: 'driver', label: '5. Driver Operations', allowedRoles: ['system-admin', 'driver', 'warehouse'] },
  { id: 'wallet', label: '6. Wallet & Settlements', allowedRoles: ['ALL'] },
  { id: 'accounting_flow', label: '7. Accounting Logic', allowedRoles: ['system-admin', 'accountant'] },
  { id: 'closing', label: '8. Period Closing', allowedRoles: ['system-admin', 'accountant'] },
];

export const UserManual: React.FC = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await firebaseService.getCurrentUser();
        if (user) {
          setUserRole(user.role);
        }
      } catch (e) {
        console.error("Failed to load user role for manual", e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const visibleSections = useMemo(() => {
    if (!userRole) return [];
    return MENU_SECTIONS.filter(section => 
      section.allowedRoles.includes('ALL') || section.allowedRoles.includes(userRole)
    );
  }, [userRole]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">{children}</h3>
  );

  const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-lg font-bold text-indigo-700 mt-8 mb-3 flex items-center">
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 011.414 0l4-4z" clipRule="evenodd" /></svg>
      {children}
    </h4>
  );

  const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-gray-600 mb-4 leading-relaxed text-sm">{children}</p>
  );

  const TipBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 text-sm text-blue-700">
          {children}
        </div>
      </div>
    </div>
  );

  const ExampleBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 my-4 shadow-sm">
        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">Entry: {title}</h5>
        <div className="text-sm text-gray-800 space-y-2 font-mono">
            {children}
        </div>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading manual...</div>;
  }

  const canView = (id: string) => visibleSections.some(s => s.id === id);

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Sidebar Navigation */}
      <div className="lg:w-72 flex-shrink-0">
        <Card className="sticky top-6 border-none shadow-lg bg-white/80 backdrop-blur-md">
          <h4 className="font-bold text-gray-900 mb-4 px-2 text-lg">
             User Manual <span className="text-xs font-normal text-gray-500 block">for {userRole}</span>
          </h4>
          <nav className="space-y-1">
            {visibleSections.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm translate-x-1'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </Card>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-12 pb-24 max-w-4xl">

        {/* 1. Introduction */}
        {canView('intro') && (
          <section id="intro" className="scroll-mt-24">
            <Card>
              <SectionTitle>1. Introduction</SectionTitle>
              <P>
                Welcome to Doorstep, a comprehensive logistics and accounting operating system. 
                This platform unifies parcel booking, fleet management, and financial reporting into a single real-time dashboard.
              </P>
              <P>
                Unlike traditional systems where logistics and accounting are separate, Doorstep automates the creation of 
                journal entries based on operational activities like deliveries, driver settlements, and customer payouts.
              </P>
            </Card>
          </section>
        )}

        {/* 2. Configuration */}
        {canView('config') && (
          <section id="config" className="scroll-mt-24">
            <Card>
              <SectionTitle>2. System Configuration</SectionTitle>
              <P>
                Before starting operations, ensure the system is correctly mapped in <strong>Settings</strong>.
              </P>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 mb-4">
                  <li><strong>Chart of Accounts:</strong> Ensure you have created Asset accounts for Cash/Bank and Liability accounts for "Customer Wallet" and "Driver Wallet".</li>
                  <li><strong>Commissions:</strong> Configure driver commission rules (Percentage or Fixed) per Zone in the Logistics Settings.</li>
                  <li><strong>General Settings:</strong> Map the default settlement bank accounts for USD and KHR transactions. This controls where cash is deposited when drivers settle.</li>
              </ul>
              <TipBox>
                  Go to <strong>Settings &gt; General</strong> to link your "Customer Wallet" and "Driver Wallet" Liability accounts. This is crucial for the Wallet Dashboard to function.
              </TipBox>
            </Card>
          </section>
        )}

        {/* 3. Financials */}
        {canView('financials') && (
          <section id="financials" className="scroll-mt-24">
            <Card>
              <SectionTitle>3. Financial Management</SectionTitle>
              <P>
                The system handles standard accounting functions including:
              </P>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h5 className="font-bold text-gray-900 mb-1">Receivables</h5>
                      <p className="text-xs text-gray-600">Create invoices for corporate clients, track aging, and record payments.</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h5 className="font-bold text-gray-900 mb-1">Payables</h5>
                      <p className="text-xs text-gray-600">Manage vendor bills and record expenses like fuel, rent, or maintenance.</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h5 className="font-bold text-gray-900 mb-1">Banking</h5>
                      <p className="text-xs text-gray-600">Transfer funds between accounts and monitor real-time cash positions in USD and KHR.</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h5 className="font-bold text-gray-900 mb-1">Fixed Assets</h5>
                      <p className="text-xs text-gray-600">Register vehicles and equipment. Run automated depreciation schedules.</p>
                  </div>
              </div>
            </Card>
          </section>
        )}

        {/* 4. Logistics */}
        {canView('logistics') && (
          <section id="logistics" className="scroll-mt-24">
            <Card>
              <SectionTitle>4. Parcel Logistics</SectionTitle>
              <SubTitle>Booking Lifecycle</SubTitle>
              <P>
                  1. <strong>Creation:</strong> A booking is created via the Admin Panel or Customer App. Status: <em>PENDING</em>.
                  <br/>
                  2. <strong>Dispatch:</strong> The Dispatch Console allows admins to assign bookings to Drivers. Status updates to <em>CONFIRMED</em>.
                  <br/>
                  3. <strong>Pickup:</strong> Driver verifies items (weight/photos) and confirms pickup. Status: <em>PICKED_UP</em>.
                  <br/>
                  4. <strong>Hub/Transit:</strong> Items can be transferred to a Warehouse (Hub) or directly delivered.
                  <br/>
                  5. <strong>Delivery:</strong> Driver marks item as delivered and collects COD. Status: <em>DELIVERED</em>.
              </P>
              <TipBox>
                  Admins can use the <strong>Dispatch Console</strong> to bulk assign new jobs or transfer items from Warehouse to Drivers.
              </TipBox>
            </Card>
          </section>
        )}

        {/* 5. Driver Operations */}
        {canView('driver') && (
          <section id="driver" className="scroll-mt-24">
            <Card>
              <SectionTitle>5. Driver Operations</SectionTitle>
              <P>
                  Drivers use a simplified interface to manage their tasks.
              </P>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600 mb-4">
                  <li><strong>My Jobs:</strong> Drivers accept new jobs and process pickups using the camera to verify parcels.</li>
                  <li><strong>Delivery:</strong> On delivery, the driver collects Cash on Delivery (COD). This cash is tracked as "Floating Cash" in the driver's wallet.</li>
                  <li><strong>Transfers:</strong> Drivers can transfer items to a Branch (Warehouse) if they cannot deliver immediately.</li>
              </ul>
              <P>
                  When a driver collects cash, they "owe" this amount to the company until they perform a <strong>Settlement</strong>.
              </P>
            </Card>
          </section>
        )}

        {/* 6. Wallet & Settlement */}
        {canView('wallet') && (
          <section id="wallet" className="scroll-mt-24">
            <Card>
              <SectionTitle>6. Wallet & Settlements</SectionTitle>
              <P>
                The unique feature of Doorstep is the unified Wallet system for Drivers and Customers.
              </P>

              <SubTitle>For Drivers (Settlement)</SubTitle>
              <P>
                Drivers accumulate cash (COD) and earn Commissions. They must periodically "Settle" with the company.
                <br/>
                1. Driver goes to <strong>Wallet &gt; Request Settlement</strong>.
                <br/>
                2. System calculates Total COD held vs Commissions Earned.
                <br/>
                3. Driver uploads proof of transfer (Bank Slip) for the net amount.
                <br/>
                4. Finance approves the request in <strong>Banking &gt; Requests</strong>.
              </P>

              <SubTitle>For Customers (Withdrawal)</SubTitle>
              <P>
                Customers accumulate credits from COD deliveries (after fees are deducted).
                <br/>
                1. Customer requests a <strong>Payout</strong> via their app.
                <br/>
                2. Finance team reviews and transfers funds to the customer's bank.
                <br/>
                3. Request is marked Approved, debiting the customer's wallet liability.
              </P>
            </Card>
          </section>
        )}

        {/* 7. Accounting Logic */}
        {canView('accounting_flow') && (
          <section id="accounting_flow" className="scroll-mt-24">
            <Card>
              <SectionTitle>7. Automated Accounting Logic</SectionTitle>
              <P>
                When a <strong>Driver Settlement</strong> is approved, the system automatically creates a complex Journal Entry to balance all ledgers.
              </P>

              <SubTitle>Scenario: Driver Settles $100 COD</SubTitle>
              <div className="text-sm text-gray-600 mb-2">
                  Assumptions: COD Collected = $100. Service Fee = $10. Driver Commission = $7.
                  <br/>
                  Driver sends $100 cash to company. (Company keeps $10 revenue, owes $90 to Customer).
                  <br/>
                  <em>Note: In this system, we book the full cash in, then credit Revenue and Customer Liability separately.</em>
              </div>

              <ExampleBox title="Automated Journal Entry (Settlement Approval)">
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span>1010 - Company Bank (Asset)</span> 
                      <span className="font-bold text-green-600">Debit: $100.00</span>
                      <span className="text-xs text-gray-400"> (Cash In)</span>
                  </div>
                  <div className="flex justify-between pt-1 border-b border-gray-100 pb-1">
                      <span>4000 - Service Revenue</span> 
                      <span className="font-bold text-red-600">Credit: $10.00</span>
                      <span className="text-xs text-gray-400"> (Fee Earned)</span>
                  </div>
                  <div className="flex justify-between pt-1 border-b border-gray-100 pb-1">
                      <span>2100 - Customer Wallet (Liability)</span> 
                      <span className="font-bold text-red-600">Credit: $90.00</span>
                      <span className="text-xs text-gray-400"> (Net Owed to Customer)</span>
                  </div>
                  <div className="flex justify-between pt-1 border-b border-gray-100 pb-1">
                      <span>5001 - Driver Commissions (Expense)</span> 
                      <span className="font-bold text-green-600">Debit: $7.00</span>
                      <span className="text-xs text-gray-400"> (Cost of Sales)</span>
                  </div>
                  <div className="flex justify-between pt-1">
                      <span>2110 - Driver Wallet (Liability)</span> 
                      <span className="font-bold text-red-600">Credit: $7.00</span>
                      <span className="text-xs text-gray-400"> (Owed to Driver)</span>
                  </div>
              </ExampleBox>
              
              <TipBox>
                  This single entry reconciles the Bank Account, recognizes Revenue, updates the Customer's withdrawable balance, and records the Driver's earnings simultaneously.
              </TipBox>
            </Card>
          </section>
        )}

        {/* 8. Period Closing */}
        {canView('closing') && (
          <section id="closing" className="scroll-mt-24">
            <Card>
              <SectionTitle>8. Period Closing Procedures</SectionTitle>
              <P>
                Closing the books ensures that your financial reports (Income Statement and Balance Sheet) are finalized and accurate. 
                Doorstep provides tools to automate Month-End and Year-End processes.
              </P>

              <div className="space-y-8 mt-6">
                  
                  {/* Month-End */}
                  <div className="bg-white border-l-4 border-indigo-500 pl-6 py-2">
                      <h4 className="text-xl font-bold text-indigo-900 mb-4">A. Month-End Closing</h4>
                      <P>
                          Perform these steps after the last day of the month to lock in your results.
                      </P>
                      <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700">
                          <li>
                              <strong>Reconcile Accounts:</strong> 
                              <br/>Check that "Cash on Hand" and "Bank" balances in the <em>Banking</em> dashboard match your actual physical cash and bank statements.
                          </li>
                          <li>
                              <strong>Process Fixed Assets:</strong>
                              <br/>Go to <em>Closing Dashboard</em>. Check "Run Monthly Depreciation". This will automatically calculate depreciation expenses for all active assets for the month.
                          </li>
                          <li>
                              <strong>Review Unposted Transactions:</strong>
                              <br/>The Health Check panel will alert you if there are unposted Draft Invoices or Bills. Finalize or delete them.
                          </li>
                          <li>
                              <strong>Generate Closing Entry (Optional):</strong>
                              <br/>If you want to zero out P&L accounts monthly (not required for standard SMEs, usually done yearly), check "Generate P&L Closing Entry".
                          </li>
                          <li>
                              <strong>Lock the Period:</strong>
                              <br/>Select the last day of the month (e.g., 31st Jan) in the "Close Books Through" field and click <strong>Run Processes & Lock</strong>.
                              <br/><em>Effect: No users can add, edit, or delete transactions dated on or before this date.</em>
                          </li>
                      </ol>
                  </div>

                  {/* Year-End */}
                  <div className="bg-white border-l-4 border-purple-500 pl-6 py-2">
                      <h4 className="text-xl font-bold text-purple-900 mb-4">B. Year-End Closing</h4>
                      <P>
                          Perform these steps at the end of the Fiscal Year (e.g., Dec 31st). This resets your Income Statement for the new year.
                      </P>
                      <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700">
                          <li>
                              <strong>Complete Month-End:</strong> Ensure December (or your final month) is closed and locked first.
                          </li>
                          <li>
                              <strong>Go to Year-End Tab:</strong> Navigate to <em>Period Closing &gt; Year-End Closing</em>.
                          </li>
                          <li>
                              <strong>Preview Closing Entry:</strong> 
                              <br/>Select the Fiscal Year. The system will display a preview of the Journal Entry. 
                              <br/>It will Debit all Revenue accounts and Credit all Expense accounts (or vice versa) to zero them out.
                              <br/>The difference (Net Profit/Loss) is booked to <strong>Retained Earnings (Equity)</strong>.
                          </li>
                          <li>
                              <strong>Confirm Closing:</strong>
                              <br/>Click "Close Fiscal Year". The system will post the entry and extend the Lock Date to Dec 31st of that year.
                          </li>
                      </ol>
                  </div>

                  {/* Troubleshooting */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h5 className="font-bold text-gray-800 mb-2 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Troubleshooting & Corrections
                      </h5>
                      <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
                          <li>
                              <strong>Health Check Errors:</strong> If the closing dashboard shows "Unbalanced Journal" errors, you cannot close. Go to the Journal list and locate the transaction ID to fix it.
                          </li>
                          <li>
                              <strong>Making Corrections after Closing:</strong> If you find a mistake in a locked period:
                              <br/>1. Go to the <strong>Adjustments</strong> tab in Period Closing.
                              <br/>2. Enter the corrective journal entry.
                              <br/>3. Submitting this form will temporarily unlock the period for 1 second, post the entry, and immediately re-lock it.
                          </li>
                      </ul>
                  </div>

              </div>
            </Card>
          </section>
        )}

      </div>
    </div>
  );
};
