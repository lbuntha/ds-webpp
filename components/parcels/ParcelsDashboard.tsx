
import React, { useState, useEffect } from 'react';
import { Account, Branch, ParcelServiceType, Customer, TaxRate } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { ParcelBookingForm } from './ParcelBookingForm';
import { ParcelList } from './ParcelList';
import { ParcelServiceSetup } from './ParcelServiceSetup';
import { ParcelPromotionSetup } from './ParcelPromotionSetup';
import { ParcelStatusSetup } from './ParcelStatusSetup';
import { ParcelOperations } from './ParcelOperations';
import { DriverManagement } from './DriverManagement';
import { DispatchConsole } from './DispatchConsole';
import { WarehouseOperations } from './WarehouseOperations';
import { PlaceManagement } from './PlaceManagement'; // Import
import { firebaseService } from '../../src/shared/services/firebaseService';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';
import { InTransitAgingReport } from '../reports/InTransitAgingReport';
import { CustomerRetentionReport } from '../reports/CustomerRetentionReport'; // Import

interface Props {
  accounts: Account[];
  branches: Branch[];
  customers?: Customer[];
  taxRates?: TaxRate[];
  initialView?: string; // New prop for external control
}

export const ParcelsDashboard: React.FC<Props> = ({ accounts, branches, customers = [], taxRates = [], initialView }) => {
  const { t } = useLanguage();
  const [view, setView] = useState<'LIST' | 'NEW' | 'OPS' | 'WAREHOUSE' | 'DISPATCH' | 'FLEET' | 'SETUP' | 'PROMOS' | 'STATUS' | 'AGING' | 'PLACES' | 'RETENTION'>('LIST');
  const [services, setServices] = useState<ParcelServiceType[]>([]);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string>('');

  useEffect(() => {
      if (initialView) {
          setView(initialView as any);
      }
  }, [initialView]);

  const loadServices = async () => {
      const data = await firebaseService.getParcelServices();
      setServices(data);
  };

  useEffect(() => {
      if (view === 'NEW') {
          loadServices();
      }
  }, [view]);

  const handleBookService = (serviceId: string) => {
      setPreSelectedServiceId(serviceId);
      setView('NEW');
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('parcels')}</h2>
                <p className="text-sm text-gray-500">Manage bookings, delivery fleet, and revenue.</p>
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-2 max-w-full">
                <Button 
                    variant={view === 'LIST' ? 'primary' : 'outline'} 
                    onClick={() => setView('LIST')}
                    className="whitespace-nowrap"
                >
                    {t('overview')}
                </Button>
                <Button 
                    variant={view === 'NEW' ? 'primary' : 'outline'} 
                    onClick={() => { setPreSelectedServiceId(''); setView('NEW'); }}
                    className="whitespace-nowrap"
                >
                    {t('new_booking_admin')}
                </Button>
                <Button 
                    variant={view === 'OPS' ? 'primary' : 'outline'} 
                    onClick={() => setView('OPS')}
                    className="whitespace-nowrap bg-indigo-50 text-indigo-700 border-indigo-200"
                >
                    {t('operations')}
                </Button>
                <Button 
                    variant={view === 'WAREHOUSE' ? 'primary' : 'outline'} 
                    onClick={() => setView('WAREHOUSE')}
                    className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-200"
                >
                    {t('warehouse')}
                </Button>
                <Button 
                    variant={view === 'DISPATCH' ? 'primary' : 'outline'} 
                    onClick={() => setView('DISPATCH')}
                    className="whitespace-nowrap bg-orange-50 text-orange-700 border-orange-200"
                >
                    {t('dispatch')}
                </Button>
                <Button 
                    variant={view === 'RETENTION' ? 'primary' : 'outline'} 
                    onClick={() => setView('RETENTION')}
                    className="whitespace-nowrap bg-red-50 text-red-700 border-red-200"
                >
                    Retention
                </Button>
                <Button 
                    variant={view === 'AGING' ? 'primary' : 'outline'} 
                    onClick={() => setView('AGING')}
                    className="whitespace-nowrap bg-purple-50 text-purple-700 border-purple-200"
                >
                    {t('aging_report')}
                </Button>
                <Button 
                    variant={view === 'FLEET' ? 'primary' : 'outline'} 
                    onClick={() => setView('FLEET')}
                    className="whitespace-nowrap"
                >
                    {t('fleet')}
                </Button>
                <Button 
                    variant={view === 'PLACES' ? 'primary' : 'outline'} 
                    onClick={() => setView('PLACES')}
                    className="whitespace-nowrap"
                >
                    Places
                </Button>
                <Button 
                    variant={view === 'SETUP' ? 'primary' : 'outline'} 
                    onClick={() => setView('SETUP')}
                    className="whitespace-nowrap"
                >
                    {t('products')}
                </Button>
            </div>
        </div>

        <div className="animate-fade-in-up">
            {view === 'LIST' && <ParcelList />}
            
            {view === 'NEW' && (
                <ParcelBookingForm 
                    services={services}
                    branches={branches}
                    accounts={accounts}
                    customers={customers}
                    taxRates={taxRates}
                    initialServiceTypeId={preSelectedServiceId}
                    onComplete={() => {
                        setPreSelectedServiceId('');
                        setView('LIST');
                    }}
                />
            )}

            {view === 'OPS' && <ParcelOperations />}

            {view === 'WAREHOUSE' && <WarehouseOperations />}

            {view === 'DISPATCH' && <DispatchConsole />}

            {view === 'AGING' && <InTransitAgingReport />}
            
            {view === 'RETENTION' && <CustomerRetentionReport />}

            {view === 'FLEET' && <DriverManagement branches={branches} />}
            
            {view === 'PLACES' && <PlaceManagement />}

            {view === 'PROMOS' && <ParcelPromotionSetup />}

            {view === 'STATUS' && <ParcelStatusSetup />}

            {view === 'SETUP' && (
                <div className="space-y-8">
                    <ParcelServiceSetup 
                        accounts={accounts} 
                        taxRates={taxRates} 
                        onBookService={handleBookService}
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
            )}
        </div>
    </div>
  );
};
