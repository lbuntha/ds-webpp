import { useState, useEffect } from 'react';
import { firebaseService } from '../../shared/services/firebaseService';
import { ROLE_PERMISSIONS, DEFAULT_NAVIGATION } from '../../shared/constants';
import { Card } from '../../../components/ui/Card';

/**
 * Admin utility to seed role permissions and menu items to Firebase
 * This syncs the code constants to Firebase
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
            // Import Firestore functions dynamically
            const { getFirestore, doc, setDoc, collection, getDocs, writeBatch } = await import('firebase/firestore');
            const db = getFirestore();

            // 1. Seed Permissions
            await setDoc(doc(db, 'settings', 'permissions'), ROLE_PERMISSIONS);

            // 2. Seed Navigation Menu
            // First, delete existing menu items to avoid duplicates
            const menuRef = collection(db, 'navigation_menu');
            const menuSnap = await getDocs(menuRef);
            const batch = writeBatch(db);

            menuSnap.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Add new menu items
            DEFAULT_NAVIGATION.forEach((item) => {
                const newDocRef = doc(menuRef, item.id); // Use item.id as doc ID for stability
                batch.set(newDocRef, item);
            });

            await batch.commit();

            setMessage('✅ Permissions & Menu seeded successfully! Reloading...');

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
            <Card title="Seed System Configuration">
                <div className="space-y-6">
                    <p className="text-gray-600">
                        This will update Firebase with the default values from the code:
                        <ul className="list-disc ml-5 mt-2">
                            <li><strong>Permissions:</strong> <code className="bg-gray-100 px-2 py-1 rounded">settings/permissions</code></li>
                            <li><strong>Navigation Menu:</strong> <code className="bg-gray-100 px-2 py-1 rounded">navigation_menu</code> collection</li>
                        </ul>
                    </p>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            <strong>Warning:</strong> This will overwrite any custom permissions or menu items you've created in Firebase.
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
                            <h4 className="font-semibold text-gray-900">Code Constants (To be seeded):</h4>
                            <div className="bg-blue-50 p-4 rounded text-xs overflow-auto max-h-96 border border-blue-200 space-y-4">
                                <div>
                                    <strong>Permissions:</strong>
                                    <pre>{JSON.stringify(ROLE_PERMISSIONS, null, 2)}</pre>
                                </div>
                                <div className="border-t border-blue-200 pt-4">
                                    <strong>Menu Items ({DEFAULT_NAVIGATION.length}):</strong>
                                    <pre>{JSON.stringify(DEFAULT_NAVIGATION.map(n => n.label), null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSeed}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 w-full"
                    >
                        {loading ? 'Seeding Configuration...' : 'Seed Permissions & Menu to Firebase'}
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
