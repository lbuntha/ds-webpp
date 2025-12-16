import { useData } from '../../shared/contexts/DataContext';
import { ParcelsDashboard } from '../../../components/parcels/ParcelsDashboard';
import { useLocation } from 'react-router-dom';

export default function ParcelsView() {
  const { accounts, branches, customers, taxRates } = useData();
  const location = useLocation();

  // Determine initial view from route
  const getInitialView = () => {
    if (location.pathname.includes('/new')) return 'NEW';
    if (location.pathname.includes('/dispatch')) return 'DISPATCH';
    if (location.pathname.includes('/warehouse')) return 'WAREHOUSE';
    if (location.pathname.includes('/fleet')) return 'FLEET';
    if (location.pathname.includes('/setup')) return 'SETUP';
    return 'LIST';
  };

  return (
    <ParcelsDashboard
      accounts={accounts}
      branches={branches}
      customers={customers}
      taxRates={taxRates}
      initialView={getInitialView()}
    />
  );
}
