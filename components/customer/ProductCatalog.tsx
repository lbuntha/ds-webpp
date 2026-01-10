import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, X, Check, Camera, Search } from 'lucide-react';
import { useAuth } from '../../src/shared/contexts/AuthContext';
import { stockService } from '../../src/shared/services/stockService';
import { toast } from '../../src/shared/utils/toast';
import { CustomerProduct } from '../../src/shared/types';

interface ProductForm {
    id: string;
    productName: string;
    sku?: string;

    attributes: { name: string; value: string }[];
    description?: string;
    defaultPrice?: number;
    priceCurrency?: 'USD' | 'KHR';
    image?: string;
    isActive: boolean;
}

const emptyForm: ProductForm = {
    id: '',
    productName: '',
    sku: '',

    attributes: [
        { name: 'Model', value: '' },
        { name: 'Color', value: '' },
        { name: 'Size', value: '' }
    ],
    description: '',
    defaultPrice: undefined,
    priceCurrency: 'USD',
    image: '',
    isActive: true
};

export const ProductCatalog: React.FC = () => {
    const { user } = useAuth();

    // State
    const [products, setProducts] = useState<CustomerProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductForm | null>(null);
    const [form, setForm] = useState<ProductForm>(emptyForm);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    // Auto-generate SKU
    useEffect(() => {
        const parts = form.attributes.map(a => a.value).filter(p => p && p.trim());
        if (parts.length > 0) {
            const autoSku = parts.join('-').toUpperCase().replace(/\s+/g, '');
            setForm(prev => ({ ...prev, sku: autoSku }));
        }
    }, [form.attributes]);

    // Handle attribute change
    const updateAttribute = (index: number, field: 'name' | 'value', val: string) => {
        setForm(prev => {
            const newAttrs = [...prev.attributes];
            newAttrs[index] = { ...newAttrs[index], [field]: val };
            return { ...prev, attributes: newAttrs };
        });
    };

    // Add attribute
    const addAttribute = () => {
        setForm(prev => ({
            ...prev,
            attributes: [...prev.attributes, { name: '', value: '' }]
        }));
    };

    // Remove attribute
    const removeAttribute = (index: number) => {
        setForm(prev => ({
            ...prev,
            attributes: prev.attributes.filter((_, i) => i !== index)
        }));
    };

    // Load products
    useEffect(() => {
        loadProducts();
    }, [user]);

    // Get customer ID (linked customer or user's own ID)
    const getCustomerId = () => user?.linkedCustomerId || user?.uid;

    const loadProducts = async () => {
        const customerId = getCustomerId();
        if (!customerId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const list = await stockService.getCustomerProducts(customerId);
            setProducts(list);
        } catch (error) {
            console.error('Error loading products:', error);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Open add modal
    const handleAdd = () => {
        setForm({
            ...emptyForm,
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        setEditingProduct(null);
        setShowModal(true);
    };

    // Open edit modal
    const handleEdit = (product: CustomerProduct) => {
        setForm({
            id: product.id,
            productName: product.productName,
            sku: product.sku || '',

            attributes: product.attributes || [
                { name: 'Model', value: '' },
                { name: 'Color', value: '' },
                { name: 'Size', value: '' }
            ],
            description: product.description || '',
            defaultPrice: product.defaultPrice,
            priceCurrency: product.priceCurrency || 'USD',
            image: product.image || '',
            isActive: product.isActive
        });
        setEditingProduct(form);
        setShowModal(true);
    };

    // Save product
    const handleSave = async () => {
        if (!form.productName.trim()) {
            toast.warning('Please enter a product name');
            return;
        }

        const customerId = getCustomerId();
        if (!customerId) {
            toast.error('Customer account not found');
            return;
        }

        setSaving(true);
        try {
            // Upload image if base64
            let imageUrl = form.image;
            if (form.image && form.image.startsWith('data:')) {
                imageUrl = await stockService.uploadImage(form.image);
            }

            const product: CustomerProduct = {
                id: form.id,
                customerId: getCustomerId()!,
                customerName: user?.name || '',
                productName: form.productName.trim(),
                sku: form.sku?.trim() || undefined,

                attributes: form.attributes.filter(a => a.name.trim() && a.value.trim()),
                description: form.description?.trim() || undefined,
                defaultPrice: form.defaultPrice,
                priceCurrency: form.priceCurrency,
                image: imageUrl || undefined,
                isActive: form.isActive,
                createdAt: editingProduct ? (products.find(p => p.id === form.id)?.createdAt || Date.now()) : Date.now(),
                updatedAt: Date.now()
            };

            await stockService.saveProduct(product);
            toast.success(editingProduct ? 'Product updated!' : 'Product added!');
            setShowModal(false);
            setForm(emptyForm);
            loadProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    // Delete product
    const handleDelete = async () => {
        if (!deleteConfirm) return;

        setProcessing(true);
        try {
            await stockService.deleteProduct(deleteConfirm);
            toast.success('Product deleted');
            setDeleteConfirm(null);
            loadProducts();
        } catch (error: any) {
            console.error('Error deleting product:', error);
            toast.error(error.message || 'Failed to delete product');
        } finally {
            setProcessing(false);
        }
    };

    // Image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            setForm(prev => ({ ...prev, image: evt.target?.result as string }));
        };
        reader.readAsDataURL(file);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-red-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
                        <p className="text-gray-500">Manage your product catalog for stock requests</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Product
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500">No products registered</p>
                    <p className="text-sm text-gray-400 mt-1">Add products to your catalog to create stock requests</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className={`bg-white rounded-lg shadow border ${product.isActive ? 'border-gray-200' : 'border-gray-300 opacity-60'} overflow-hidden`}
                        >
                            {/* Image */}
                            <div className="h-40 bg-gray-100 flex items-center justify-center">
                                {product.image ? (
                                    <img
                                        src={product.image}
                                        alt={product.productName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="w-12 h-12 text-gray-300" />
                                )}
                            </div>

                            {/* Details */}
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{product.productName}</h3>
                                        {product.sku && (
                                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                        )}
                                    </div>
                                    {!product.isActive && (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Inactive</span>
                                    )}
                                </div>

                                {product.description && (
                                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{product.description}</p>
                                )}

                                {product.defaultPrice && (
                                    <p className="text-lg font-semibold text-red-600 mt-2">
                                        {product.defaultPrice} {product.priceCurrency || 'USD'}
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => handleEdit(product)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(product.id)}
                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold">
                                {editingProduct ? 'Edit Product' : 'Add Product'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Section: Basic Information */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Basic Information</h3>
                                <div className="flex gap-4">
                                    {/* Image Upload - Left Side */}
                                    <div className="w-1/3">
                                        <label className="cursor-pointer block">
                                            <div className="aspect-square bg-gray-50 rounded-lg flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 hover:border-red-400 hover:bg-gray-100 transition-colors">
                                                {form.image ? (
                                                    <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                                        <span className="text-xs text-gray-500 font-medium">Click to upload photo</span>
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageUpload}
                                            />
                                        </label>
                                    </div>

                                    {/* Name & Desc - Right Side */}
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                                            <input
                                                type="text"
                                                value={form.productName}
                                                onChange={e => setForm(prev => ({ ...prev, productName: e.target.value }))}
                                                placeholder="e.g. Cotton T-Shirt"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                value={form.description || ''}
                                                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder="Enter product description..."
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Product Variants & Identity */}
                            <div>
                                <div className="flex items-center justify-between mb-4 border-b pb-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Variants & Identity</h3>
                                </div>

                                <div className="space-y-4">
                                    {/* SKU */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            SKU / Barcode
                                            <span className="ml-2 text-xs text-gray-400 font-normal">(Auto-generated from attributes)</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={form.sku || ''}
                                                onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))}
                                                placeholder="e.g. PRODUCT-SIZE-COLOR"
                                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Dynamic Attributes */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-medium text-gray-900">Defining Attributes</label>
                                            <button
                                                onClick={addAttribute}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
                                            >
                                                <Plus className="w-3 h-3" /> Add Attribute
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {form.attributes.map((attr, index) => (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <div className="w-1/3">
                                                        <input
                                                            type="text"
                                                            value={attr.name}
                                                            onChange={e => updateAttribute(index, 'name', e.target.value)}
                                                            placeholder="Name (e.g. Size)"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                                                        />
                                                    </div>
                                                    <span className="text-gray-400">:</span>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={attr.value}
                                                            onChange={e => updateAttribute(index, 'value', e.target.value)}
                                                            placeholder="Value (e.g. XL)"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeAttribute(index)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Remove attribute"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {form.attributes.length === 0 && (
                                                <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                                                    <p className="text-sm text-gray-500">No attributes defined.</p>
                                                    <p className="text-xs text-gray-400 mt-1">Add attributes like Size, Color, or Weight to define this product.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Inventory & Pricing */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Financials & Status</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Price</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={form.defaultPrice || ''}
                                                onChange={e => setForm(prev => ({ ...prev, defaultPrice: parseFloat(e.target.value) || undefined }))}
                                                placeholder="0.00"
                                                className="w-full pl-3 pr-16 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                                            />
                                            <div className="absolute right-1 top-1 bottom-1">
                                                <select
                                                    value={form.priceCurrency || 'USD'}
                                                    onChange={e => setForm(prev => ({ ...prev, priceCurrency: e.target.value as 'USD' | 'KHR' }))}
                                                    className="h-full px-2 bg-gray-50 border-l border-gray-200 text-sm text-gray-600 rounded-r-md focus:outline-none"
                                                >
                                                    <option value="USD">USD</option>
                                                    <option value="KHR">KHR</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center">
                                        <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors w-full h-[42px] mt-6">
                                            <input
                                                type="checkbox"
                                                checked={form.isActive}
                                                onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                                                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                            />
                                            <span className="text-sm font-medium text-gray-900">Active Status</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Save Product
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Product?</h3>
                        <p className="text-gray-600 mb-6">Are you sure you want to delete this product from your catalog?</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={processing}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={processing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {processing && (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductCatalog;
