import { useState } from 'react';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../shared/services/firebaseService';
import { SettingsDashboard } from '../../../components/settings/SettingsDashboard';
import { toast } from '../../shared/utils/toast';

export default function SettingsView() {
  const { settings, accounts, branches, currencies, taxRates, transactions, refreshData } = useData();
  const [loading, setLoading] = useState(false);

  const handleClearData = async () => {
    setLoading(true);
    try {
      await firebaseService.clearFinancialAndLogisticsData();
      await refreshData();
      toast.success('Data cleared successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to clear data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsDashboard
      settings={settings}
      accounts={accounts}
      branches={branches}
      currencies={currencies}
      taxRates={taxRates}
      transactions={transactions}
      onAddAccount={async (a) => {
        await firebaseService.addAccount(a);
        await refreshData();
      }}
      onUpdateAccount={async (a) => {
        await firebaseService.updateAccount(a);
        await refreshData();
      }}
      onDeleteAccount={async (id) => {
        await firebaseService.deleteAccount(id);
        await refreshData();
      }}
      onAddBranch={async (b) => {
        await firebaseService.addBranch(b);
        await refreshData();
      }}
      onUpdateBranch={async (b) => {
        await firebaseService.updateBranch(b);
        await refreshData();
      }}
      onDeleteBranch={async (id) => {
        await firebaseService.deleteBranch(id);
        await refreshData();
      }}
      onAddCurrency={async (c) => {
        await firebaseService.addCurrency(c);
        await refreshData();
      }}
      onUpdateCurrency={async (c) => {
        await firebaseService.updateCurrency(c);
        await refreshData();
      }}
      onAddTaxRate={async (t) => {
        await firebaseService.addTaxRate(t);
        await refreshData();
      }}
      onUpdateTaxRate={async (t) => {
        await firebaseService.updateTaxRate(t);
        await refreshData();
      }}
      onRunSetup={() => {
        firebaseService.updateSettings({ ...settings, setupComplete: false });
        refreshData();
      }}
      onUpdateSettings={async (s) => {
        await firebaseService.updateSettings(s);
        await refreshData();
      }}
      onClearData={handleClearData}
    />
  );
}
