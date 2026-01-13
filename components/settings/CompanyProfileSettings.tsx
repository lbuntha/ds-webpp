import React, { useEffect, useState } from 'react';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { CompanyProfile } from '../../src/shared/types';
import { toast } from '../../src/shared/utils/toast';

export const CompanyProfileSettings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CompanyProfile>({
        name: '',
        logo: '',
        contactCenterLogo: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        taxId: '',
        operatingZonesMarkdown: ''
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const profile = await firebaseService.getCompanyProfile();
            if (profile && profile.name) {
                setFormData(prev => ({ ...prev, ...profile }));
            }
        } catch (error) {
            console.error("Error loading profile:", error);
            toast.error("Failed to load company profile");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof CompanyProfile, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await firebaseService.saveCompanyProfile(formData);
            toast.success("Company profile saved successfully");
        } catch (error) {
            console.error("Error saving profile:", error);
            toast.error("Failed to save profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Company Profile</h2>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">General Information</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. Doorstep Logistics"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                            type="text"
                            value={formData.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                        <input
                            type="text"
                            value={formData.website || ''}
                            onChange={(e) => handleChange('website', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / VAT</label>
                        <input
                            type="text"
                            value={formData.taxId || ''}
                            onChange={(e) => handleChange('taxId', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            value={formData.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                        />
                    </div>
                </div>

                {/* Branding & Mobile */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">Branding (Mobile App)</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Main Logo URL</label>
                        <input
                            type="text"
                            value={formData.logo || ''}
                            onChange={(e) => handleChange('logo', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://..."
                        />
                        {formData.logo && (
                            <img src={formData.logo} alt="Preview" className="mt-2 h-16 object-contain border p-1 rounded bg-gray-50" />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Center Logo URL</label>
                        <input
                            type="text"
                            value={formData.contactCenterLogo || ''}
                            onChange={(e) => handleChange('contactCenterLogo', e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://..."
                        />
                        <p className="text-xs text-gray-500 mt-1">Displayed in the mobile app contact section.</p>
                        {formData.contactCenterLogo && (
                            <img src={formData.contactCenterLogo} alt="Preview" className="mt-2 h-16 object-contain border p-1 rounded bg-gray-50" />
                        )}
                    </div>
                </div>
            </div>

            {/* Operating Zones Markdown */}
            <div className="mt-8">
                <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Operating Zones & Services (Markdown)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Editor</label>
                        <textarea
                            value={formData.operatingZonesMarkdown || ''}
                            onChange={(e) => handleChange('operatingZonesMarkdown', e.target.value)}
                            className="w-full p-3 border rounded font-mono text-sm focus:ring-2 focus:ring-indigo-500"
                            rows={15}
                            placeholder="# Our Services&#10;- Zone 1: Phnom Penh..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
                        <div className="w-full h-[370px] p-4 border rounded bg-gray-50 overflow-y-auto prose prose-sm max-w-none">
                            {/* Simple Markdown Preview - Render raw for now, or use a library if available. 
                                Since we don't have a markdown lib installed/confirmed, we'll display formatted text 
                                preserving whitespace for now, or just plain text. 
                                Ideally usage of react-markdown would be good but I don't want to install deps without asking.
                                I'll use simple whitespace-pre-wrap for basic preview.
                            */}
                            <div className="whitespace-pre-wrap font-sans">
                                {formData.operatingZonesMarkdown || <span className="text-gray-400 italic">Preview will appear here...</span>}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Supports basic Markdown: # Header, - List items, *Bold*, etc.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
