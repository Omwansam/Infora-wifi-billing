import React, { useState } from 'react';
import { Pencil, Boxes, Plug, Bell, CreditCard, Radio, Globe, FileText, KeyRound, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import GeneralSettings from './tabs/GeneralSettings';
import ModulesSettings from './tabs/ModulesSettings';
import IntegrationsSettings from './tabs/IntegrationsSettings';
import NotificationsSettings from './tabs/NotificationsSettings';
import PaymentsSettings from './tabs/PaymentsSettings';
import RadiusSettings from './tabs/RadiusSettings';
import CaptivePortalSettings from './tabs/CaptivePortalSettings';
import SubscriptionSettings from './tabs/SubscriptionSettings';
import ApiKeysSettings from './tabs/ApiKeysSettings';
import AccountSettings from './tabs/AccountSettings';

const TABS = [
  { id: 'general', name: 'General', icon: Pencil },
  { id: 'modules', name: 'Modules', icon: Boxes },
  { id: 'integrations', name: 'Integrations', icon: Plug },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'payments', name: 'Payments', icon: CreditCard },
  { id: 'radius', name: 'RADIUS', icon: Radio },
  { id: 'portal', name: 'Captive Portal', icon: Globe },
  { id: 'subscription', name: 'Subscription', icon: FileText },
  { id: 'apikeys', name: 'API Keys', icon: KeyRound },
  { id: 'account', name: 'Account', icon: UserCog },
];

export default function SettingsPage() {
  const [active, setActive] = useState('general');
  const { isAdmin } = useAuth();
  const admin = typeof isAdmin === 'function' ? isAdmin() : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your organization's configuration and preferences</p>
        </div>

        <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const on = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  on ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            );
          })}
        </div>

        <div>
          {active === 'general' && <GeneralSettings />}
          {active === 'modules' && <ModulesSettings isAdmin={admin} />}
          {active === 'integrations' && <IntegrationsSettings />}
          {active === 'notifications' && <NotificationsSettings />}
          {active === 'payments' && <PaymentsSettings />}
          {active === 'radius' && <RadiusSettings />}
          {active === 'portal' && <CaptivePortalSettings />}
          {active === 'subscription' && <SubscriptionSettings />}
          {active === 'apikeys' && <ApiKeysSettings />}
          {active === 'account' && <AccountSettings />}
        </div>
      </div>
    </div>
  );
}
