import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import platformSubscriptionService from '../services/platformSubscriptionService';
import { SUBSCRIPTION_LOCK_EVENT } from '../utils/api';

const SubscriptionContext = createContext(null);

/**
 * Platform-subscription state for the whole console.
 *
 * Fail-open on purpose: a request that errors, or a backend that predates this
 * feature, leaves `locked` false. Locking the console because a fetch failed
 * would be worse than briefly letting an expired tenant in — the API returns
 * 402 either way, so the server still has the final say.
 */
export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [canPay, setCanPay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return null;
    setLoading(true);
    try {
      const data = await platformSubscriptionService.get();
      setState(data?.subscription || null);
      setInvoices(data?.invoices || []);
      setTenant(data?.tenant || null);
      setCanPay(Boolean(data?.can_pay));
      return data;
    } catch (error) {
      // A 402 carries the state we need in its own body — the gate still works.
      const payload = error?.payload?.subscription;
      if (payload) setState(payload);
      return null;
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setState(null);
      setInvoices([]);
      setTenant(null);
      setLoaded(false);
      return undefined;
    }
    refresh();
    // Watchdog: the gate holds the console until this state is known, so a
    // request that never settles must not leave the app spinning forever.
    const watchdog = setTimeout(() => setLoaded(true), 10_000);
    return () => clearTimeout(watchdog);
  }, [user, refresh]);

  // Any 402 anywhere in the app means the tenant just crossed the line.
  useEffect(() => {
    const onLock = (event) => {
      const payload = event.detail?.subscription;
      if (payload) setState(payload);
      else refresh();
    };
    window.addEventListener(SUBSCRIPTION_LOCK_EVENT, onLock);
    return () => window.removeEventListener(SUBSCRIPTION_LOCK_EVENT, onLock);
  }, [refresh]);

  const value = useMemo(() => ({
    subscription: state,
    invoices,
    tenant,
    canPay,
    loading,
    loaded,
    locked: Boolean(state?.locked),
    expired: Boolean(state?.expired),
    daysLeft: state?.days_left ?? null,
    amountDue: state?.amount_due ?? 0,
    currency: state?.currency || 'KES',
    refresh,
  }), [state, invoices, tenant, canPay, loading, loaded, refresh]);

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  // Usable outside the provider (login screen, portal) — nothing is locked there.
  return context || {
    subscription: null, invoices: [], tenant: null, canPay: false,
    loading: false, loaded: false, locked: false, expired: false,
    daysLeft: null, amountDue: 0, currency: 'KES', refresh: async () => null,
  };
}
