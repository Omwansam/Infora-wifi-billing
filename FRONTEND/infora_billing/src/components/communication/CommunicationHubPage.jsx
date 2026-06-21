import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Mail,
  Megaphone,
  Send,
  Users,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import CommunicationLayout from './CommunicationLayout';

const CHANNELS = [
  {
    title: 'SMS',
    description: 'Payment reminders, outages, and transactional texts',
    path: '/communication/sms',
    icon: MessageSquare,
    accent: 'from-emerald-500 to-teal-600',
    stats: { campaigns: 2, delivered: '96%', recipients: 175 },
  },
  {
    title: 'Email',
    description: 'Newsletters, billing notices, and onboarding sequences',
    path: '/communication/emails',
    icon: Mail,
    accent: 'from-indigo-500 to-violet-600',
    stats: { campaigns: 2, openRate: '68%', recipients: 700 },
  },
  {
    title: 'Campaigns',
    description: 'Multi-channel launches, retention, and promotions',
    path: '/communication/campaigns',
    icon: Megaphone,
    accent: 'from-fuchsia-500 to-pink-600',
    stats: { campaigns: 3, active: 1, budget: 'KES 11,000' },
  },
];

const OVERVIEW_STATS = [
  { title: 'Messages Sent', value: '1,660', subtitle: 'Across all channels this month', icon: Send, accent: 'from-cyan-500 to-blue-600' },
  { title: 'Reach', value: '875', subtitle: 'Unique customers contacted', icon: Users, accent: 'from-violet-500 to-purple-600' },
  { title: 'Avg Delivery', value: '94%', subtitle: 'SMS and email combined', icon: TrendingUp, accent: 'from-emerald-500 to-teal-600' },
];

export default function CommunicationHubPage() {
  return (
    <CommunicationLayout
      title="Communication Center"
      subtitle="SMS, email, and campaigns in one place"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {OVERVIEW_STATS.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-fuchsia-900 text-white p-6 mb-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-fuchsia-200 text-sm font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              Unified messaging
            </div>
            <h2 className="text-xl font-bold">Reach customers on the right channel</h2>
            <p className="text-slate-300 mt-2 max-w-xl">
              Manage SMS blasts, email templates, and cross-channel campaigns without leaving the billing platform.
            </p>
          </div>
          <Link
            to="/communication/campaigns"
            className="inline-flex items-center self-start px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
          >
            Launch campaign
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {CHANNELS.map((channel, index) => (
          <motion.div
            key={channel.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Link
              to={channel.path}
              className="block h-full rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${channel.accent} text-white mb-4`}>
                <channel.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-fuchsia-700 transition-colors">
                {channel.title}
              </h3>
              <p className="text-sm text-slate-600 mt-2">{channel.description}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                {Object.entries(channel.stats).map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-2.5">
                    <dt className="text-[10px] uppercase tracking-wide text-slate-500">{key}</dt>
                    <dd className="text-sm font-semibold text-slate-900 mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>
              <span className="inline-flex items-center mt-5 text-sm font-semibold text-fuchsia-700">
                Open {channel.title}
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </CommunicationLayout>
  );
}
