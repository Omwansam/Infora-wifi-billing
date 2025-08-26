import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import { createPlan, updatePlan, getPlan } from '../../services/planService';
import { toast } from 'react-hot-toast';

export default function PlanForm({ planId = null, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    speed: '',
    price: '',
    features: [''],
    popular: false,
    is_active: true
  });

  // Load plan data if editing
  useEffect(() => {
    if (planId) {
      loadPlan();
    }
  }, [planId]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const response = await getPlan(planId);
      if (response.success) {
        const plan = response.data;
        setFormData({
          name: plan.name || '',
          speed: plan.speed || '',
          price: plan.price || '',
          features: plan.features && Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : [''],
          popular: plan.popular || false,
          is_active: plan.is_active !== undefined ? plan.is_active : true
        });
      }
    } catch (error) {
      toast.error('Failed to load plan details');
      console.error('Error loading plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const removeFeature = (index) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, features: newFeatures }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (!formData.speed.trim()) {
      toast.error('Speed is required');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    // Filter out empty features
    const filteredFeatures = formData.features.filter(feature => feature.trim() !== '');
    if (filteredFeatures.length === 0) {
      toast.error('At least one feature is required');
      return;
    }

    try {
      setLoading(true);
      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        features: filteredFeatures
      };

      let response;
      if (planId) {
        response = await updatePlan(planId, submitData);
        toast.success('Plan updated successfully');
      } else {
        response = await createPlan(submitData);
        toast.success('Plan created successfully');
      }

      if (response.success && onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save plan');
      console.error('Error saving plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && planId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plan details...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="mr-3 p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {planId ? 'Edit Plan' : 'Create New Plan'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="e.g., Premium Plan"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speed *
              </label>
              <input
                type="text"
                name="speed"
                value={formData.speed}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="e.g., 100 Mbps"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (USD) *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="29.99"
              required
            />
          </div>

                     {/* Features */}
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Features *
             </label>
             
             {/* Show existing features in a nice format if editing */}
             {planId && formData.features.length > 0 && formData.features[0] !== '' && (
               <div className="mb-4">
                 <p className="text-sm text-gray-600 mb-2">Current Features:</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                   {formData.features.filter(f => f.trim() !== '').map((feature, index) => (
                     <div key={index} className="flex items-center p-2 bg-green-50 rounded-lg border border-green-200">
                       <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                       <span className="text-sm text-green-700 font-medium">{feature}</span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             
             <div className="space-y-3">
               {formData.features.map((feature, index) => (
                 <div key={index} className="flex gap-2">
                   <input
                     type="text"
                     value={feature}
                     onChange={(e) => handleFeatureChange(index, e.target.value)}
                     className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                     placeholder="e.g., Unlimited Data, 24/7 Support, Free Router"
                   />
                   {formData.features.length > 1 && (
                     <button
                       type="button"
                       onClick={() => removeFeature(index)}
                       className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                     >
                       <Trash2 className="h-4 w-4" />
                     </button>
                   )}
                 </div>
               ))}
               <button
                 type="button"
                 onClick={addFeature}
                 className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
               >
                 <Plus className="h-4 w-4 mr-1" />
                 Add Feature
               </button>
             </div>
           </div>

          {/* Status Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="popular"
                checked={formData.popular}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Mark as Popular
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Active Plan
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {planId ? 'Update Plan' : 'Create Plan'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
