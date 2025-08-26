import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Users, 
  Star, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  DollarSign,
  Wifi,
  Zap,
  Shield,
  Globe,
  Smartphone,
  Headphones,
  Gift,
  Award,
  Settings,
  Router,
  Network,
  Download,
  Upload
} from 'lucide-react';
import { getPlan, deletePlan, togglePlanActive, togglePlanPopular, getPlanCustomers } from '../../services/planService';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';

// Function to get appropriate icon for each feature
const getFeatureIcon = (feature) => {
  const featureLower = feature.toLowerCase();
  
  if (featureLower.includes('speed') || featureLower.includes('mbps') || featureLower.includes('gbps')) {
    return <Zap className="h-5 w-5 text-blue-500" />;
  }
  if (featureLower.includes('download')) {
    return <Download className="h-5 w-5 text-green-500" />;
  }
  if (featureLower.includes('upload')) {
    return <Upload className="h-5 w-5 text-purple-500" />;
  }
  if (featureLower.includes('device') || featureLower.includes('unlimited')) {
    return <Smartphone className="h-5 w-5 text-indigo-500" />;
  }
  if (featureLower.includes('support')) {
    return <Headphones className="h-5 w-5 text-orange-500" />;
  }
  if (featureLower.includes('data')) {
    return <Globe className="h-5 w-5 text-cyan-500" />;
  }
  if (featureLower.includes('static ip') || featureLower.includes('ip address')) {
    return <Network className="h-5 w-5 text-red-500" />;
  }
  if (featureLower.includes('router') || featureLower.includes('free router')) {
    return <Router className="h-5 w-5 text-yellow-500" />;
  }
  if (featureLower.includes('sla') || featureLower.includes('guarantee')) {
    return <Shield className="h-5 w-5 text-emerald-500" />;
  }
  if (featureLower.includes('dedicated')) {
    return <Award className="h-5 w-5 text-pink-500" />;
  }
  if (featureLower.includes('discount') || featureLower.includes('student') || featureLower.includes('senior')) {
    return <Gift className="h-5 w-5 text-rose-500" />;
  }
  if (featureLower.includes('setup') || featureLower.includes('easy')) {
    return <Settings className="h-5 w-5 text-gray-500" />;
  }
  
  // Default icon for other features
  return <CheckCircle className="h-5 w-5 text-green-500" />;
};

export default function PlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPlanDetails();
  }, [planId]);

  const loadPlanDetails = async () => {
    try {
      setLoading(true);
      const [planResponse, customersResponse] = await Promise.all([
        getPlan(planId),
        getPlanCustomers(planId)
      ]);

      if (planResponse.success) {
        setPlan(planResponse.data);
      }

      if (customersResponse.success) {
        setCustomers(customersResponse.data.customers || []);
      }
    } catch (error) {
      toast.error('Failed to load plan details');
      console.error('Error loading plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      setActionLoading(true);
      const response = await togglePlanActive(planId);
      if (response.success) {
        setPlan(response.data);
        toast.success(`Plan ${response.data.is_active ? 'activated' : 'deactivated'} successfully`);
      }
    } catch (error) {
      toast.error('Failed to toggle plan status');
      console.error('Error toggling plan status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePopular = async () => {
    try {
      setActionLoading(true);
      const response = await togglePlanPopular(planId);
      if (response.success) {
        setPlan(response.data);
        toast.success(`Plan ${response.data.popular ? 'marked as popular' : 'unmarked as popular'} successfully`);
      }
    } catch (error) {
      toast.error('Failed to toggle popular status');
      console.error('Error toggling popular status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await deletePlan(planId);
      if (response.success) {
        toast.success('Plan deleted successfully');
        navigate('/plans');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete plan');
      console.error('Error deleting plan:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/plans/${planId}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading plan details...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Plan not found</h2>
          <p className="mt-2 text-gray-600">The plan you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/plans')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/plans')}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-gray-600 mt-1">Plan Details & Analytics</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEdit}
                disabled={actionLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Plan Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Wifi className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                    <p className="text-gray-600">{plan.speed}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-gray-500">/month</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {plan.popular && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3 mr-1" />
                        Popular
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      plan.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {plan.is_active ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plan.features && Array.isArray(plan.features) && plan.features.length > 0 ? (
                    plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                        <div className="flex-shrink-0 mr-3">
                          {getFeatureIcon(feature)}
                        </div>
                        <span className="text-gray-700 font-medium">{feature}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8">
                      <div className="text-gray-400 mb-3">
                        <Wifi className="h-12 w-12 mx-auto" />
                      </div>
                      <p className="text-gray-500">Features available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={handleToggleActive}
                  disabled={actionLoading}
                  className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    plan.is_active
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={handleTogglePopular}
                  disabled={actionLoading}
                  className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    plan.popular
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  {plan.popular ? 'Remove Popular' : 'Mark Popular'}
                </button>
              </div>
            </motion.div>

            {/* Customers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Customers Using This Plan</h3>
                <div className="flex items-center text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  {customers.length} customers
                </div>
              </div>

              {customers.length > 0 ? (
                <div className="space-y-3">
                  {customers.slice(0, 5).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{customer.full_name}</p>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customer.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {customer.status}
                      </span>
                    </div>
                  ))}
                  {customers.length > 5 && (
                    <p className="text-sm text-gray-600 text-center">
                      +{customers.length - 5} more customers
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No customers are using this plan yet.</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-gray-700">Customers</span>
                  </div>
                  <span className="font-semibold text-gray-900">{customers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-gray-700">Monthly Revenue</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(plan.price * customers.length)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-purple-600 mr-3" />
                    <span className="text-gray-700">Status</span>
                  </div>
                  <span className={`font-semibold ${
                    plan.is_active ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Plan Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Information</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium text-gray-900">
                    {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="font-medium text-gray-900">
                    {plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Plan ID</p>
                  <p className="font-medium text-gray-900">#{plan.id}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
