import { useAuth } from '../../shared/contexts/AuthContext';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { UserProfileView as UserProfileComponent } from '../../components/UserProfile';

export default function UserProfileView() {
  const { user } = useAuth();
  const { refreshData } = useData();

  if (!user) return null;

  return (
    <UserProfileComponent
      user={user}
      onUpdateProfile={async (name) => {
        await firebaseService.updateUserProfile(name);
        await refreshData();
      }}
    />
  );
}
