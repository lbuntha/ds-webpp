import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useData } from '../../shared/contexts/DataContext';
import { firebaseService } from '../../services/firebaseService';
import { UserList } from '../../components/UserList';
import { UserProfile } from '../../types';
import { ROLE_PERMISSIONS } from '../../constants';

export default function UsersView() {
  const { user: currentUser } = useAuth();
  const { branches, rolePermissions } = useData();
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const u = await firebaseService.getUsers();
    setUsers(u);
  };

  if (!currentUser) return null;

  return (
    <UserList
      users={users}
      branches={branches}
      rolePermissions={rolePermissions || ROLE_PERMISSIONS}
      onUpdateRole={async (uid, role) => {
        await firebaseService.updateUserRole(uid, role);
        await loadUsers();
      }}
      onUpdateStatus={async (uid, status) => {
        await firebaseService.updateUserStatus(uid, status);
        await loadUsers();
      }}
      onUpdateProfile={async (uid, name, extra) => {
        await firebaseService.configService.updateUserProfile(uid, name, extra);
        await loadUsers();
      }}
      onUpdatePermissions={async (perms) => {
        await firebaseService.updateRolePermissions(perms);
        // Permissions updated, might need to refresh
      }}
    />
  );
}
