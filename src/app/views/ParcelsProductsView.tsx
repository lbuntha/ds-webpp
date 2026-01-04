import { ParcelServiceSetup } from '../../../components/parcels/ParcelServiceSetup';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';

export default function ParcelsProductsView() {
    const { accounts, taxRates } = useData();
    const { t } = useLanguage();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('products')}</h2>
                <p className="text-sm text-gray-500">Manage parcel service types</p>
            </div>

            <ParcelServiceSetup
                accounts={accounts}
                taxRates={taxRates}
                onBookService={() => { }} // Not needed in this view
            />
        </div>
    );
}
