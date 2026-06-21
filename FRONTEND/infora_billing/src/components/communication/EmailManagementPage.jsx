import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Mail, Send, Users, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CommunicationLayout from './CommunicationLayout';
import CampaignStatusBadge from './CampaignStatusBadge';

const INITIAL_CAMPAIGNS = [
  {
    id: 1,
    name: 'Monthly Newsletter',
    subject: 'Lumen — January Newsletter',
    status: 'Active',
    recipients: 500,
    sent: 485,
    delivered: 470,
    opened: 320,
    scheduledDate: '2024-01-15 09:00',
    category: 'Newsletter',
  },
  {
    id: 2,
    name: 'Service Maintenance Alert',
    subject: 'Scheduled maintenance — service interruption notice',
    status: 'Completed',
    recipients: 200,
    sent: 200,
    delivered: 195,
    opened: 150,
    scheduledDate: '2024-01-10 14:00',
    category: 'Maintenance',
  },
];

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Scheduled', label: 'Scheduled' },
];

export default function EmailManagementPage() {
  const [campaigns] = useState(INITIAL_CAMPAIGNS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const matchesSearch =
          campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          campaign.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [campaigns, searchTerm, statusFilter]
  );

  const stats = useMemo(
    () => ({
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'Active').length,
      recipients: campaigns.reduce((sum, c) => sum + c.recipients, 0),
    }),
    [campaigns]
  );

  return (
    <CommunicationLayout
      title="Email"
      subtitle="Newsletters, billing notices, and templates"
      action={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 self-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Email Campaign
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Campaigns', value: stats.total, icon: Mail, accent: 'from-indigo-500 to-violet-600' },
          { title: 'Active', value: stats.active, icon: Send, accent: 'from-blue-500 to-cyan-600' },
          { title: 'Recipients', value: stats.recipients, icon: Users, accent: 'from-fuchsia-500 to-pink-600' },
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
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search email campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium ${
                  statusFilter === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((campaign, index) => {
          const openRate = campaign.delivered > 0 ? Math.round((campaign.opened / campaign.delivered) * 100) : 0;
          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex gap-4 min-w-0">
                  <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                      <CampaignStatusBadge status={campaign.status} />
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{campaign.subject}</p>
                    <p className="text-xs text-slate-400 mt-2">{campaign.category} · {campaign.scheduledDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">{campaign.recipients}</p>
                    <p className="text-xs text-slate-500">Sent to</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-indigo-600">{openRate}%</p>
                    <p className="text-xs text-slate-500">Open rate</p>
                  </div>
                  <button className="p-2 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
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
                <h2 className="text-xl font-bold text-slate-900">New Email Campaign</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <input placeholder="Campaign name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input placeholder="Subject line" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                  <option>Newsletter</option>
                  <option>Maintenance</option>
                  <option>Welcome</option>
                </select>
                <input type="datetime-local" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 font-medium">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Email campaign created');
                    setShowForm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold"
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
