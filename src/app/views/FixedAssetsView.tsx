import { useData } from '../../shared/contexts/DataContext';
import { FixedAssetsDashboard } from '../../components/fixed_assets/FixedAssetsDashboard';

export default function FixedAssetsView() {
  const { accounts, branches } = useData();

  return <FixedAssetsDashboard accounts={accounts} branches={branches} />;
}
