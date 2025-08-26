import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Wifi,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Eye,
  Star,
  RefreshCw,
  AlertCircle,
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
import { getPlans, getPlanStats, deletePlan, togglePlanActive, togglePlanPopular } from '../../services/planService';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import PlanForm from './PlanForm';

// Function to get appropriate icon for each feature
const getFeatureIcon = (feature) => {
  const featureLower = feature.toLowerCase();
  
  if (featureLower.includes('speed') || featureLower.includes('mbps') || featureLower.includes('gbps')) {
    return <Zap className="h-4 w-4 text-blue-500" />;
  }
  if (featureLower.includes('download')) {
    return <Download className="h-4 w-4 text-green-500" />;
  }
  if (featureLower.includes('upload')) {
    return <Upload className="h-4 w-4 text-purple-500" />;
  }
  if (featureLower.includes('device') || featureLower.includes('unlimited')) {
    return <Smartphone className="h-4 w-4 text-indigo-500" />;
  }
  if (featureLower.includes('support')) {
    return <Headphones className="h-4 w-4 text-orange-500" />;
  }
  if (featureLower.includes('data')) {
    return <Globe className="h-4 w-4 text-cyan-500" />;
  }
  if (featureLower.includes('static ip') || featureLower.includes('ip address')) {
    return <Network className="h-4 w-4 text-red-500" />;
  }
  if (featureLower.includes('router') || featureLower.includes('free router')) {
    return <Router className="h-4 w-4 text-yellow-500" />;
  }
  if (featureLower.includes('sla') || featureLower.includes('guarantee')) {
    return <Shield className="h-4 w-4 text-emerald-500" />;
  }
  if (featureLower.includes('dedicated')) {
    return <Award className="h-4 w-4 text-pink-500" />;
  }
  if (featureLower.includes('discount') || featureLower.includes('student') || featureLower.includes('senior')) {
    return <Gift className="h-4 w-4 text-rose-500" />;
  }
  if (featureLower.includes('setup') || featureLower.includes('easy')) {
    return <Settings className="h-4 w-4 text-gray-500" />;
  }
  
  // Default icon for other features
  return <CheckCircle className="h-4 w-4 text-green-500" />;
};

export default function ServicePlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    loadPlans();
    loadStats();
  }, [pagination.current_page, pagination.per_page]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current_page,
        per_page: pagination.per_page,
        search: searchTerm || undefined,
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        popular: statusFilter === 'popular' ? true : undefined
      };

      const response = await getPlans(params);
      if (response.success) {
        const plansData = response.data.plans || [];
        console.log('📋 Plans loaded:', plansData.length, 'plans');
        plansData.forEach(plan => {
          console.log(`Plan: ${plan.name} - Features:`, plan.features);
          console.log(`Plan: ${plan.name} - Features type:`, typeof plan.features);
          console.log(`Plan: ${plan.name} - Features isArray:`, Array.isArray(plan.features));
          console.log(`Plan: ${plan.name} - Features keys:`, plan.features ? Object.keys(plan.features) : 'null');
        });
        setPlans(plansData);
        setPagination(prev => ({
          ...prev,
          current_page: response.data.current_page || 1,
          total: response.data.total || 0,
          pages: response.data.pages || 0
        }));
      }
    } catch (error) {
      toast.error('Failed to load plans');
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getPlanStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current_page: 1 }));
    loadPlans();
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    setPagination(prev => ({ ...prev, current_page: 1 }));
    loadPlans();
  };

  const handleRefresh = () => {
    loadPlans();
    loadStats();
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleViewPlan = (planId) => {
    navigate(`/plans/${planId}`);
  };

  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Are you sure you want to delete "${planName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await deletePlan(planId);
      if (response.success) {
        toast.success('Plan deleted successfully');
        loadPlans();
        loadStats();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete plan');
      console.error('Error deleting plan:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (planId) => {
    try {
      setActionLoading(true);
      const response = await togglePlanActive(planId);
      if (response.success) {
        toast.success(`Plan ${response.data.is_active ? 'activated' : 'deactivated'} successfully`);
        loadPlans();
        loadStats();
      }
    } catch (error) {
      toast.error('Failed to toggle plan status');
      console.error('Error toggling plan status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePopular = async (planId) => {
    try {
      setActionLoading(true);
      const response = await togglePlanPopular(planId);
      if (response.success) {
        toast.success(`Plan ${response.data.popular ? 'marked as popular' : 'unmarked as popular'} successfully`);
        loadPlans();
        loadStats();
      }
    } catch (error) {
      toast.error('Failed to toggle popular status');
      console.error('Error toggling popular status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPlan(null);
    loadPlans();
    loadStats();
  };

  const getStatusBadge = (plan) => {
    if (plan.popular) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Star className="h-3 w-3 mr-1" />
          Popular
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Standard
      </span>
    );
  };

  const getStatusIcon = (isActive) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const statsCards = [
    {
      title: 'Total Plans',
      value: stats.total_plans || 0,
      change: '+2',
      icon: Wifi,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Plans',
      value: stats.active_plans || 0,
      change: '+12%',
      icon: CheckCircle,
      color: 'bg-green-500'
    },
    {
      title: 'Popular Plans',
      value: stats.popular_plans || 0,
      change: '+18%',
      icon: Star,
      color: 'bg-yellow-500'
    },
    {
      title: 'Average Price',
      value: stats.average_price ? formatCurrency(stats.average_price) : '$0',
      change: '+5%',
      icon: DollarSign,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Service Plans</h1>
              <p className="text-gray-600 mt-2">Manage internet service packages and pricing</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleCreatePlan}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
              <Plus className="h-4 w-4 mr-2" />
              Add Plan
            </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change} from last month</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search plans by name or speed..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">All Plans</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="popular">Popular</option>
              </select>
              <button
                onClick={handleSearch}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading plans...</p>
          </div>
        )}

        {/* Service Plans Grid */}
        {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                plan.popular ? 'border-blue-500 relative' : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500 text-white">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    {getStatusBadge(plan)}
                </div>
                
                <div className="mb-6">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-gray-500">/month</span>
                  </div>
                  <div className="text-lg text-gray-600 mb-4">{plan.speed}</div>
                  
                  <div className="space-y-3">
                      {plan.features && Array.isArray(plan.features) && plan.features.length > 0 ? (
                        <>
                          {plan.features.slice(0, 4).map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-center p-2 bg-gray-50 rounded-lg">
                              <div className="flex-shrink-0 mr-3">
                                {getFeatureIcon(feature)}
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{feature}</span>
                      </div>
                    ))}
                          {plan.features.length > 4 && (
                            <div className="text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                +{plan.features.length - 4} more features
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-gray-400 mb-2">
                            <Wifi className="h-8 w-8 mx-auto" />
                          </div>
                          <p className="text-sm text-gray-500">Features available</p>
                        </div>
                      )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewPlan(plan.id)}
                        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                      <Eye className="h-4 w-4" />
                    </button>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-50 rounded"
                        title="Edit Plan"
                      >
                      <Edit className="h-4 w-4" />
                    </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id, plan.name)}
                        disabled={actionLoading}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete Plan"
                      >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(plan.is_active)}
                      <span className="text-sm text-gray-600">
                        {plan.customers_count || 0} customers
                      </span>
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        )}

        {/* Empty State */}
        {!loading && plans.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-12"
          >
            <Wifi className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No plans found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
            <button
              onClick={handleCreatePlan}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </button>
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && pagination.pages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8"
          >
            <div className="text-sm text-gray-700">
              Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{' '}
              {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page - 1 }))}
                disabled={pagination.current_page === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
            </button>
              <span className="px-3 py-2 text-sm text-gray-700">
                Page {pagination.current_page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page + 1 }))}
                disabled={pagination.current_page === pagination.pages}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
            </button>
          </div>
        </motion.div>
        )}

        {/* Plan Form Modal */}
        <AnimatePresence>
          {showForm && (
            <PlanForm
              planId={editingPlan?.id}
              onClose={() => {
                setShowForm(false);
                setEditingPlan(null);
              }}
              onSuccess={handleFormSuccess}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
