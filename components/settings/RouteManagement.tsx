import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { UserRole, Permission } from '../../types';
import { AppRoute } from '../../routing/routeRegistry';
import { firebaseService } from '../../services/firebaseService';
import { toast } from '../../src/shared/utils/toast';

const ROLES: UserRole[] = ['system-admin', 'accountant', 'finance-manager', 'warehouse', 'driver', 'customer'];

const SECTION_LABELS: Record<string, string> = {
    finance: '💰 Finance',
    logistics: '📦 Logistics',
    configuration: '⚙️ Configuration',
    reports: '📊 Reports',
    staff: '👥 Staff',
    system: '🔧 System'
};

export const RouteManagement: React.FC = () => {
    const [routes, setRoutes] = useState<AppRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [localRoutes, setLocalRoutes] = useState<AppRoute[]>([]);

    useEffect(() => {
        loadRoutes();
    }, []);

    const loadRoutes = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getRoutes();
            setRoutes(data);
            setLocalRoutes(JSON.parse(JSON.stringify(data))); // Deep copy
        } catch (e) {
            console.error(e);
            toast.error('Failed to load routes');
        } finally {
            setLoading(false);
        }
    };

    const toggleRouteForRole = (routeId: string, role: UserRole) => {
        const updatedRoutes = localRoutes.map(route => {
            if (route.id === routeId) {
                const allowedRoles = route.allowedRoles.includes(role)
                    ? route.allowedRoles.filter(r => r !== role)
                    : [...route.allowedRoles, role];
                return { ...route, allowedRoles };
            }
            return route;
        });
        setLocalRoutes(updatedRoutes);
        setHasChanges(true);
    };

    const toggleRouteActive = (routeId: string) => {
        const updatedRoutes = localRoutes.map(route => {
            if (route.id === routeId) {
                return { ...route, isActive: !route.isActive };
            }
            return route;
        });
        setLocalRoutes(updatedRoutes);
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save all modified routes
            for (const route of localRoutes) {
                await firebaseService.saveRoute(route);
            }
            setRoutes(localRoutes);
            setHasChanges(false);
            toast.success('Routes updated successfully');
        } catch (e) {
            console.error(e);
            toast.error('Failed to save routes');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setLocalRoutes(JSON.parse(JSON.stringify(routes)));
        setHasChanges(false);
    };

    // Group routes by section
    const groupedRoutes = localRoutes.reduce((acc, route) => {
        const section = route.section || 'other';
        if (!acc[section]) acc[section] = [];
        acc[section].push(route);
        return acc;
    }, {} as Record<string, AppRoute[]>);

    if (loading) {
        return <Card title="Route Management"><div className="p-8 text-center text-gray-500">Loading routes...</div></Card>;
    }

    return (
        <Card
            title="Route Management"
            action={
                <div className="flex gap-2">
                    {hasChanges && (
                        <Button onClick={handleReset} variant="outline">
                            Reset
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        isLoading={saving}
                        disabled={!hasChanges}
                        variant={hasChanges ? 'primary' : 'outline'}
                    >
                        Save Changes
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {Object.entries(groupedRoutes).map(([section, sectionRoutes]) => (
                    <div key={section} className="border rounded-lg overflow-hidden">
                        {/* Section Header */}
                        <div className="bg-gray-50 px-4 py-2 border-b">
                            <h3 className="font-bold text-gray-700">{SECTION_LABELS[section] || section}</h3>
                        </div>

                        {/* Routes Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-8">
                                            Active
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Route
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
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
                                    {sectionRoutes.map((route) => (
                                        <tr key={route.id} className={`hover:bg-gray-50 transition-colors ${!route.isActive ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={route.isActive !== false}
                                                    onChange={() => toggleRouteActive(route.id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                {route.label}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                                {route.requiredPermission}
                                            </td>
                                            {ROLES.map(role => (
                                                <td key={`${route.id}-${role}`} className="px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={route.allowedRoles.includes(role)}
                                                        onChange={() => toggleRouteForRole(route.id, role)}
                                                        disabled={!route.isActive}
                                                        className={`w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${route.isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                <strong>💡 How it works:</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                    <li><strong>Active</strong>: Toggle to enable/disable a route globally</li>
                    <li><strong>Role Checkboxes</strong>: Control which roles can see this route in the sidebar</li>
                    <li><strong>Permission</strong>: Users must have this permission AND be in an allowed role to access the route</li>
                    <li>Changes are saved to Firebase and apply immediately after save</li>
                </ul>
            </div>
        </Card>
    );
};
