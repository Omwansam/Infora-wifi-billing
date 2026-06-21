import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Send, Users, MessageSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';
import CommunicationLayout from './CommunicationLayout';
import CampaignStatusBadge from './CampaignStatusBadge';

const INITIAL_CAMPAIGNS = [
  {
    id: 1,
    name: 'Payment Reminder',
    message: 'Dear customer, your payment of KES 2,999 is due on the 15th.',
    status: 'Active',
    recipients: 150,
    sent: 145,
    delivered: 140,
    failed: 5,
    scheduledDate: '2024-01-15 10:00',
    category: 'Billing',
  },
  {
    id: 2,
    name: 'Welcome Message',
    message: 'Welcome to Lumen! Your account has been activated.',
    status: 'Completed',
    recipients: 25,
    sent: 25,
    delivered: 23,
    failed: 2,
    scheduledDate: '2024-01-12 09:00',
    category: 'Welcome',
  },
];

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Scheduled', label: 'Scheduled' },
];

export default function SmsManagementPage() {
  const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
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
      recipients: campaigns.reduce((sum, c) => sum + c.recipients, 0),
    }),
    [campaigns]
  );

  const handleCreate = (e) => {
    e.preventDefault();
    toast.success('SMS campaign created');
    setShowForm(false);
  };

  return (
    <CommunicationLayout
      title="SMS"
      subtitle="Transactional and bulk SMS campaigns"
      action={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 self-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          New SMS Campaign
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Campaigns', value: stats.total, icon: MessageSquare, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Active', value: stats.active, icon: Send, accent: 'from-cyan-500 to-blue-600' },
          { title: 'Recipients', value: stats.recipients, icon: Users, accent: 'from-violet-500 to-purple-600' },
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
              placeholder="Search SMS campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
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
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No SMS campaigns</h3>
            <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Create campaign
            </button>
          </div>
        ) : (
          filtered.map((campaign, index) => {
            const deliveryRate = campaign.sent > 0 ? Math.round((campaign.delivered / campaign.sent) * 100) : 0;
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                        <CampaignStatusBadge status={campaign.status} />
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {campaign.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{campaign.message}</p>
                      <p className="text-xs text-slate-400 mt-2">Scheduled {campaign.scheduledDate}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 lg:gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">{campaign.recipients}</p>
                      <p className="text-xs text-slate-500">Recipients</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-600">{deliveryRate}%</p>
                      <p className="text-xs text-slate-500">Delivered</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-rose-600">{campaign.failed}</p>
                      <p className="text-xs text-slate-500">Failed</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
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
            <motion.form
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              onSubmit={handleCreate}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">New SMS Campaign</h2>
                <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              <div className="space-y-4">
                <input required placeholder="Campaign name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <textarea required rows={4} placeholder="SMS message..." className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
                  <option>Billing</option>
                  <option>Welcome</option>
                  <option>Maintenance</option>
                  <option>Promotional</option>
                </select>
                <input type="datetime-local" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
                  Create Campaign
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </CommunicationLayout>
  );
}
