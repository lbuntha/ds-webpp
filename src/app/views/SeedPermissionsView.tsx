import { useState, useEffect } from 'react';
import { firebaseService } from '../../shared/services/firebaseService';
import { ROLE_PERMISSIONS } from '../../shared/constants';
import { Card } from '../../../components/ui/Card';

/**
 * Admin utility to seed role permissions to Firebase
 * This syncs the ROLE_PERMISSIONS constant to Firebase
 */
export default function SeedPermissionsView() {
    const [loading, setLoading] = useState(false);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [message, setMessage] = useState('');
    const [currentPermissions, setCurrentPermissions] = useState<any>(null);

    useEffect(() => {
        loadCurrentPermissions();
    }, []);

    const loadCurrentPermissions = async () => {
        setLoadingCurrent(true);
        try {
            const perms = await firebaseService.getRolePermissions();
            setCurrentPermissions(perms);
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setLoadingCurrent(false);
        }
    };

    const handleSeed = async () => {
        setLoading(true);
        setMessage('');

        try {
            // Directly update the settings/permissions document in Firebase
            const { getFirestore, doc, setDoc } = await import('firebase/firestore');
            const db = getFirestore();
            await setDoc(doc(db, 'settings', 'permissions'), ROLE_PERMISSIONS);

            setMessage('✅ Permissions seeded successfully! Reloading...');

            // Reload to show updated permissions
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card title="Seed Role Permissions to Firebase">
                <div className="space-y-6">
                    <p className="text-gray-600">
                        This will update Firebase (<code className="bg-gray-100 px-2 py-1 rounded">settings/permissions</code>) with the default role permissions from the code.
                        Use this if customer/driver users can't access their menu items.
                    </p>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            <strong>Warning:</strong> This will overwrite any custom permissions you've set in Firebase.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900">Current Firebase Permissions:</h4>
                            {loadingCurrent ? (
                                <div className="text-gray-500">Loading...</div>
                            ) : (
                                <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96 border">
                                    {JSON.stringify(currentPermissions, null, 2)}
                                </pre>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900">Code Constants (ROLE_PERMISSIONS):</h4>
                            <pre className="bg-blue-50 p-4 rounded text-xs overflow-auto max-h-96 border border-blue-200">
                                {JSON.stringify(ROLE_PERMISSIONS, null, 2)}
                            </pre>
                        </div>
                    </div>

                    <button
                        onClick={handleSeed}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Seeding...' : 'Seed Permissions to Firebase'}
                    </button>

                    {message && (
                        <div className={`p-4 rounded-lg ${message.startsWith('✅')
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                            {message}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
