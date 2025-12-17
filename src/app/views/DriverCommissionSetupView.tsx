
import { DriverCommissionSetup } from '../../../components/settings/DriverCommissionSetup';

export default function DriverCommissionSetupView() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Driver Commission Rules</h1>
            <p className="text-gray-600">Configure automated commission rules based on delivery types, zones, and distance.</p>

            <DriverCommissionSetup />
        </div>
    );
}
