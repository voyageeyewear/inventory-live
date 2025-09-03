import { useState } from 'react';
import Layout from '../components/Layout';
import { Package, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function AddProduct() {
  const [formData, setFormData] = useState({
    sku: '',
    product_name: '',
    quantity: '',
    image_url: ''
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sku || !formData.product_name || !formData.quantity) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0) {
      toast.error('Quantity must be a valid number');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post('/api/products', {
        sku: formData.sku.trim(),
        product_name: formData.product_name.trim(),
        quantity: parseInt(formData.quantity),
        image_url: formData.image_url.trim()
      });

      toast.success('Product created successfully!');
      router.push('/');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      sku: '',
      product_name: '',
      quantity: '',
      image_url: ''
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="text-gray-600">Create a new product in your inventory</p>
          </div>
        </div>

        {/* Form */}
        <div className="card max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Package className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Product Information</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SKU */}
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter unique SKU (e.g., ABC123)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Stock Keeping Unit - must be unique across all products
              </p>
            </div>

            {/* Product Name */}
            <div>
              <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="product_name"
                name="product_name"
                value={formData.product_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter product name"
                required
              />
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                Initial Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Starting inventory quantity for this product
              </p>
            </div>

            {/* Image URL */}
            <div>
              <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL (Optional)
              </label>
              <input
                type="url"
                id="image_url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL to product image (optional)
              </p>
            </div>

            {/* Image Preview */}
            {formData.image_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Preview
                </label>
                <div className="border border-gray-300 rounded-md p-4">
                  <img
                    src={formData.image_url}
                    alt="Product preview"
                    className="h-32 w-32 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4 pt-6 border-t">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'Creating...' : 'Create Product'}
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Reset Form
              </button>

              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Tips for Adding Products:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• SKU must be unique - it's used to identify products across systems</li>
            <li>• Use descriptive product names for easy identification</li>
            <li>• Set initial quantity to 0 if you'll add stock later</li>
            <li>• Image URLs should be publicly accessible web links</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
