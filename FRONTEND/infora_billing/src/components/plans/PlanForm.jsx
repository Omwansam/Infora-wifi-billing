import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save, Wifi, Star, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createPlan, updatePlan, getPlan } from '../../services/planService';
import { normalizePlanFeatures } from '../../lib/planUtils';
import PlanFeatureIcon from './PlanFeatureIcon';

export default function PlanForm({ planId = null, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    speed: '',
    price: '',
    features: [''],
    popular: false,
    is_active: true,
  });

  useEffect(() => {
    if (planId) loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const response = await getPlan(planId);
      if (response.success) {
        const plan = response.data;
        const features = normalizePlanFeatures(plan.features);
        setFormData({
          name: plan.name || '',
          speed: plan.speed || '',
          price: plan.price || '',
          features: features.length > 0 ? features : [''],
          popular: plan.popular || false,
          is_active: plan.is_active !== undefined ? plan.is_active : true,
        });
      }
    } catch {
      toast.error('Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData((prev) => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index) => {
    if (formData.features.length > 1) {
      setFormData((prev) => ({
        ...prev,
        features: prev.features.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

    const filteredFeatures = formData.features.filter((feature) => feature.trim() !== '');
    if (filteredFeatures.length === 0) {
      toast.error('At least one feature is required');
      return;
    }

    try {
      setLoading(true);
      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        features: filteredFeatures,
      };
      const response = planId
        ? await updatePlan(planId, submitData)
        : await createPlan(submitData);
      if (response.success) {
        toast.success(planId ? 'Plan updated' : 'Plan created');
        onSuccess?.(response.data);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const previewFeatures = formData.features.filter((feature) => feature.trim() !== '');

  if (loading && planId && !formData.name) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-600 border-t-transparent mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Service Plan</p>
            <h2 className="text-xl font-bold text-slate-900">{planId ? 'Edit Plan' : 'Create Plan'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="Premium 100Mbps"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Speed *</label>
                  <input
                    type="text"
                    name="speed"
                    value={formData.speed}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="100 Mbps"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monthly price (KES) *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
                  placeholder="2999"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Features *</label>
                <div className="space-y-2">
                  {formData.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => handleFeatureChange(index, e.target.value)}
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
                        placeholder="Unlimited data, 24/7 support..."
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeature(index)}
                          className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFeature}
                    className="inline-flex items-center text-sm font-medium text-cyan-700 hover:text-cyan-800"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add feature
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="popular"
                    checked={formData.popular}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-slate-700">Mark as popular</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-slate-700">Active plan</span>
                </label>
              </div>
            </div>

            <div className="p-6 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Live preview</p>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                {formData.popular && (
                  <div className="-mt-6 -mx-6 mb-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold text-center py-1.5 rounded-t-2xl">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-cyan-100">
                    <Wifi className="h-5 w-5 text-cyan-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{formData.name || 'Plan name'}</h3>
                    <p className="text-sm text-slate-500">{formData.speed || 'Speed tier'}</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900">
                  {formData.price ? `KES ${Number(formData.price).toLocaleString()}` : '—'}
                  <span className="text-sm font-normal text-slate-500 ml-1">/mo</span>
                </p>
                <div className="mt-4 space-y-2">
                  {previewFeatures.length > 0 ? (
                    previewFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-slate-700">
                        <PlanFeatureIcon feature={feature} />
                        {feature}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Add features to preview the package</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
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
