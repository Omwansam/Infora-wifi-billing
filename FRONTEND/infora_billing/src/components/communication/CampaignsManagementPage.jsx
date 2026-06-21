import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Megaphone, Target, BarChart3, Calendar, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';
import CommunicationLayout from './CommunicationLayout';
import CampaignStatusBadge from './CampaignStatusBadge';

const INITIAL_CAMPAIGNS = [
  {
    id: 1,
    name: 'Q1 Promotional Campaign',
    type: 'Multi-Channel',
    status: 'Active',
    channels: ['Email', 'SMS'],
    converted: 45,
    clicked: 180,
    budget: 5000,
    spent: 3200,
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    category: 'Promotional',
  },
  {
    id: 2,
    name: 'Customer Retention',
    type: 'Email',
    status: 'Completed',
    channels: ['Email'],
    converted: 25,
    clicked: 95,
    budget: 2000,
    spent: 1800,
    startDate: '2024-01-15',
    endDate: '2024-02-15',
    category: 'Retention',
  },
  {
    id: 3,
    name: 'New Service Launch',
    type: 'Multi-Channel',
    status: 'Scheduled',
    channels: ['Email', 'SMS'],
    converted: 0,
    clicked: 0,
    budget: 4000,
    spent: 0,
    startDate: '2024-02-01',
    endDate: '2024-04-30',
    category: 'Product Launch',
  },
];

export default function CampaignsManagementPage() {
  const [campaigns] = useState(INITIAL_CAMPAIGNS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [campaigns, searchTerm, statusFilter]
  );

  const stats = useMemo(
    () => ({
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'Active').length,
      budget: campaigns.reduce((sum, c) => sum + c.budget, 0),
      spent: campaigns.reduce((sum, c) => sum + c.spent, 0),
    }),
    [campaigns]
  );

  return (
    <CommunicationLayout
      title="Campaigns"
      subtitle="Multi-channel marketing and retention programs"
      action={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 self-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { title: 'Campaigns', value: stats.total, icon: Megaphone, accent: 'from-fuchsia-500 to-pink-600' },
          { title: 'Active', value: stats.active, icon: Target, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Budget', value: formatCurrency(stats.budget), icon: BarChart3, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Spent', value: formatCurrency(stats.spent), icon: Calendar, accent: 'from-amber-500 to-orange-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.title}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'Active', 'Completed', 'Scheduled'].map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium ${
                  statusFilter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {value === 'all' ? 'All' : value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filtered.map((campaign, index) => {
          const conversionRate = campaign.clicked > 0 ? Math.round((campaign.converted / campaign.clicked) * 100) : 0;
          const budgetUsed = campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0;
          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900">{campaign.name}</h3>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                  <p className="text-sm text-slate-500">{campaign.type} · {campaign.category}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-fuchsia-50 text-fuchsia-700">
                  <Megaphone className="h-5 w-5" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {campaign.channels.map((channel) => (
                  <span key={channel} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {channel}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{campaign.converted}</p>
                  <p className="text-xs text-slate-500">Conversions</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-fuchsia-600">{conversionRate}%</p>
                  <p className="text-xs text-slate-500">Conv. rate</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{budgetUsed}%</p>
                  <p className="text-xs text-slate-500">Budget used</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                <span>{campaign.startDate} → {campaign.endDate}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(campaign.spent)} / {formatCurrency(campaign.budget)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">New Campaign</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input placeholder="Campaign name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                  <option>Multi-Channel</option>
                  <option>Email</option>
                  <option>SMS</option>
                </select>
                <input type="number" placeholder="Budget (KES)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                  <input type="date" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 font-medium">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Campaign created');
                    setShowForm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 text-white font-semibold"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CommunicationLayout>
  );
}
