import { ParcelServiceSetup } from '../../../components/parcels/ParcelServiceSetup';
import { ParcelPromotionSetup } from '../../../components/parcels/ParcelPromotionSetup';
import { ParcelStatusSetup } from '../../../components/parcels/ParcelStatusSetup';
import { useData } from '../../shared/contexts/DataContext';
import { useLanguage } from '../../shared/contexts/LanguageContext';

export default function ParcelsProductsView() {
    const { accounts, taxRates } = useData();
    const { t } = useLanguage();

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('products')}</h2>
                <p className="text-sm text-gray-500">Manage parcel service types, promotions, and workflow statuses</p>
            </div>

            <ParcelServiceSetup
                accounts={accounts}
                taxRates={taxRates}
                onBookService={() => { }} // Not needed in this view
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-t pt-4">
                    <h3 className="font-bold text-gray-700 mb-4">{t('promotions')}</h3>
                    <ParcelPromotionSetup />
                </div>
                <div className="border-t pt-4">
                    <h3 className="font-bold text-gray-700 mb-4">{t('workflow')}</h3>
                    <ParcelStatusSetup />
                </div>
            </div>
        </div>
    );
}
