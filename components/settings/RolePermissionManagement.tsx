import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Permission, UserRole, PermissionGroup } from '../../types';
import { PERMISSION_GROUPS } from '../../constants';
import { usePermissions } from '../../contexts/PermissionsContext';
import { firebaseService } from '../../services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

const ROLES: UserRole[] = ['system-admin', 'accountant', 'finance-manager', 'warehouse', 'driver', 'customer'];

const GROUP_LABELS: Record<PermissionGroup, string> = {
    FINANCE: '💰 Finance & Accounting',
    LOGISTICS: '📦 Logistics & Operations',
    REPORTS: '📊 Reports & Analytics',
    SETTINGS: '⚙️ Settings & Configuration',
    SYSTEM: '🔧 System Administration',
    DRIVER: '🚗 Driver Features',
    CUSTOMER: '👤 Customer Features'
};

const GROUP_COLORS: Record<PermissionGroup, string> = {
    FINANCE: 'bg-green-50 border-green-200',
    LOGISTICS: 'bg-blue-50 border-blue-200',
    REPORTS: 'bg-purple-50 border-purple-200',
    SETTINGS: 'bg-orange-50 border-orange-200',
    SYSTEM: 'bg-red-50 border-red-200',
    DRIVER: 'bg-yellow-50 border-yellow-200',
    CUSTOMER: 'bg-pink-50 border-pink-200'
};

export const RolePermissionManagement: React.FC = () => {
    const { permissions, setPermissions, refreshPermissions } = usePermissions();
    const [localPermissions, setLocalPermissions] = useState(permissions);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<PermissionGroup, boolean>>({
        FINANCE: true,
        LOGISTICS: true,
        REPORTS: false,
        SETTINGS: false,
        SYSTEM: false
    });

    // Sync local state when context updates (e.g. on mount)
    React.useEffect(() => {
        setLocalPermissions(permissions);
    }, [permissions]);

    const togglePermission = (role: UserRole, permission: Permission) => {
        const currentRolePerms = localPermissions[role] || [];
        const hasPerm = currentRolePerms.includes(permission);

        let newRolePerms;
        if (hasPerm) {
            newRolePerms = currentRolePerms.filter(p => p !== permission);
        } else {
            newRolePerms = [...currentRolePerms, permission];
        }

        const updated = {
            ...localPermissions,
            [role]: newRolePerms
        };

        setLocalPermissions(updated);
        setHasChanges(true);
    };

    const toggleGroup = (group: PermissionGroup) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await firebaseService.updateRolePermissions(localPermissions);
            setPermissions(localPermissions); // Optimistic update context
            await refreshPermissions(); // Ensure sync
            setHasChanges(false);
            toast.success("Permissions updated successfully.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save permissions.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card
            title="Role-Based Feature Access Control"
            action={
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    disabled={!hasChanges && !saving}
                    variant={hasChanges ? 'primary' : 'outline'}
                >
                    Save Changes
                </Button>
            }
        >
            <div className="space-y-4">
                {(Object.keys(PERMISSION_GROUPS) as PermissionGroup[]).map(group => {
                    const groupPerms = PERMISSION_GROUPS[group];
                    const isExpanded = expandedGroups[group];

                    return (
                        <div key={group} className={`border rounded-lg overflow-hidden ${GROUP_COLORS[group]}`}>
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group)}
                                className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-lg font-bold">{GROUP_LABELS[group]}</span>
                                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                                        {groupPerms.length} permissions
                                    </span>
                                </div>
                                <svg
                                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Group Content */}
                            {isExpanded && (
                                <div className="bg-white border-t">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                                                        Permission
                                                    </th>
                                                    {ROLES.map(role => (
                                                        <th key={role} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[100px]">
                                                            {role.replace('-', ' ')}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {groupPerms.map((permission) => (
                                                    <tr key={permission} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-gray-400 font-mono">{permission}</span>
                                                            </div>
                                                        </td>
                                                        {ROLES.map(role => {
                                                            const isSystemAdmin = role === 'system-admin';
                                                            const hasPerm = (localPermissions[role] || []).includes(permission);

                                                            return (
                                                                <td key={`${role}-${permission}`} className="px-4 py-3 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSystemAdmin ? true : hasPerm}
                                                                        disabled={isSystemAdmin}
                                                                        onChange={() => togglePermission(role, permission)}
                                                                        className={`w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${isSystemAdmin ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer'}`}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                <strong>💡 Tip:</strong> Permissions control what features users can access. Use the <strong>Menu Builder</strong> (Settings → Menu Builder) to control which menu items are visible in the sidebar.
            </div>

            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                <strong>Note:</strong> System Admin permissions are immutable and include full access to all features.
                Changes to other roles apply immediately upon save, but users may need to refresh their browser to see updated menus.
            </div>
        </Card>
    );
};
