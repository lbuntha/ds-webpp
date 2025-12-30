import { useNavigate } from 'react-router-dom';
import { firebaseService } from '../../shared/services/firebaseService';
import { OnboardingWizard } from '../../../components/setup/OnboardingWizard';
import { Account, Branch, SystemSettings } from '../../shared/types';
import { toast } from '../../shared/utils/toast';

export default function OnboardingView() {
    const navigate = useNavigate();

    const handleComplete = async (
        settings: SystemSettings,
        accounts: Account[],
        branches: Branch[],
        shouldReset?: boolean
    ) => {
        try {
            // If shouldReset is true, clear data first
            if (shouldReset) {
                await firebaseService.clearFinancialAndLogisticsData();
            }

            // Import accounts
            if (accounts.length > 0) {
                for (const acc of accounts) {
                    try {
                        await firebaseService.addAccount(acc);
                    } catch (e) {
                        // Account might already exist, try updating
                        await firebaseService.updateAccount(acc);
                    }
                }
            }

            // Import branches
            if (branches.length > 0) {
                for (const br of branches) {
                    try {
                        await firebaseService.addBranch(br);
                    } catch (e) {
                        await firebaseService.updateBranch(br);
                    }
                }
            }

            // Save settings
            await firebaseService.updateSettings(settings);

            toast.success('Setup completed successfully!');
            navigate('/app');
        } catch (e: any) {
            console.error('Setup failed:', e);
            toast.error(`Setup failed: ${e.message || 'Unknown error'}`);
            throw e;
        }
    };

    return <OnboardingWizard onComplete={handleComplete} />;
}
