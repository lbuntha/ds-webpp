
import { useData } from '../../shared/contexts/DataContext';
import { ParcelServiceSetup } from '../../../components/parcels/ParcelServiceSetup';

export default function ParcelsServiceSetupView() {
    const { accounts, taxRates } = useData();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Service Configuration</h1>
            <p className="text-gray-600">Configure parcel delivery services, pricing, and accounting mappings.</p>

            <ParcelServiceSetup
                accounts={accounts}
                taxRates={taxRates}
            />
        </div>
    );
}
