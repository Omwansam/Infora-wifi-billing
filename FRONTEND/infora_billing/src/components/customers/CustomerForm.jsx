import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Phone, MapPin, Wifi, Copy, Shield } from 'lucide-react';
import { customerService } from '../../services/customerService';
import { getActivePlans } from '../../services/planService';
import toast from 'react-hot-toast';

export default function CustomerForm() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    service_plan_id: '',
    status: 'active',
    device_count: 1,
  });
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getActivePlans();
        if (result.success) {
          const list = result.data.plans || [];
          setPlans(list);
          if (list.length > 0) {
            setFormData((prev) => ({ ...prev, service_plan_id: String(list[0].id) }));
          }
        }
      } catch {
        toast.error('Could not load service plans');
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  const selectedPlan = plans.find((p) => String(p.id) === String(formData.service_plan_id));

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.service_plan_id) {
      toast.error('Select a service plan');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        service_plan_id: Number(formData.service_plan_id),
        package: selectedPlan?.name,
        status: formData.status,
        device_count: formData.device_count,
      };

      const result = await customerService.createCustomer(payload);

      if (result.success) {
        const data = result.data;
        const radiusPassword = data.radius_password;
        const radiusProvisioned = data.radius_provisioned;
        const wireguardProvisioned = data.wireguard_provisioned;
        const provisionReason = data.radius_provision_reason;

        if (radiusPassword && formData.status === 'active' && radiusProvisioned) {
          setCredentials({
            username: formData.email.trim().toLowerCase(),
            password: radiusPassword,
          });
          toast.success('Customer created — RADIUS provisioned');
        } else if (wireguardProvisioned) {
          toast.success('Customer created — WireGuard provisioned');
          navigate('/customers');
        } else if (formData.status === 'active' && provisionReason) {
          toast.error(provisionReason);
          navigate('/customers');
        } else {
          toast.success('Customer added successfully');
          navigate('/customers');
        }
      } else {
        toast.error(result.error || 'Failed to add customer');
      }
    } catch (error) {
      toast.error('Failed to add customer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Credentials copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (credentials) {
    return (
      <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">RADIUS provisioned</h2>
              <p className="text-sm text-slate-500">Share these PPPoE / hotspot credentials</p>
            </div>
          </div>
          <dl className="space-y-4 mb-6">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium text-slate-500 uppercase">Username</dt>
              <dd className="font-mono text-slate-900 mt-1">{credentials.username}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium text-slate-500 uppercase">Password</dt>
              <dd className="font-mono text-slate-900 mt-1">{credentials.password}</dd>
            </div>
          </dl>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={copyCredentials}
              className="flex-1 inline-flex items-center justify-center py-2.5 rounded-xl border border-slate-200 text-sm font-medium"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </button>
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/customers"
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Customer</h1>
              <p className="text-gray-600 mt-2">Creates account and provisions FreeRADIUS access</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+254700123456" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email (RADIUS username) *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Used as PPPoE / hotspot login (lowercased)</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                Address
              </h3>
              <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} required className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="123 Main Street, Nairobi" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Wifi className="h-5 w-5 mr-2 text-blue-600" />
                Service & RADIUS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="service_plan_id" className="block text-sm font-medium text-gray-700 mb-2">Service Plan *</label>
                  <select
                    id="service_plan_id"
                    name="service_plan_id"
                    value={formData.service_plan_id}
                    onChange={handleChange}
                    required
                    disabled={plansLoading}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {plans.length === 0 && <option value="">No plans — create one first</option>}
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.speed} (KES {Number(plan.price).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select id="status" name="status" value={formData.status} onChange={handleChange} className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="active">Active (provision RADIUS)</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="device_count" className="block text-sm font-medium text-gray-700 mb-2">Device Count</label>
                  <input type="number" id="device_count" name="device_count" value={formData.device_count} onChange={handleChange} min="1" max="10" className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <Link to="/customers" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</Link>
              <button type="submit" disabled={loading || plans.length === 0} className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {loading ? 'Provisioning...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
