import { DriverManagement } from '../../components/parcels/DriverManagement';
import { useData } from '../../shared/contexts/DataContext';

export default function ParcelsFleetView() {
    const { branches } = useData();

    return <DriverManagement branches={branches} />;
}
