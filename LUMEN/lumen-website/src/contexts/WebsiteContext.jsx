import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BRAND as STATIC_BRAND, STATS as STATIC_STATS, CHANGELOG_FALLBACK } from '../lib/brand';
import {
  fetchWebsiteChangelog,
  fetchWebsiteConfig,
  fetchWebsiteStats,
} from '../services/websiteService';

const WebsiteContext = createContext(null);

export function WebsiteProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(STATIC_STATS);
  const [changelog, setChangelog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [configData, statsData, changelogData] = await Promise.all([
          fetchWebsiteConfig().catch(() => null),
          fetchWebsiteStats().catch(() => null),
          fetchWebsiteChangelog().catch(() => null),
        ]);

        if (cancelled) return;
        if (configData) setConfig(configData);
        if (statsData?.stats?.length) setStats(statsData.stats);
        if (changelogData?.length) setChangelog(changelogData);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const brand = useMemo(
    () => ({
      ...STATIC_BRAND,
      ...(config || {}),
      signupUrl: STATIC_BRAND.signupUrl,
      loginUrl: STATIC_BRAND.loginUrl,
      demoUrl: STATIC_BRAND.demoUrl,
      portalUrl: STATIC_BRAND.portalUrl,
      appUrl: STATIC_BRAND.appUrl,
    }),
    [config]
  );

  return (
    <WebsiteContext.Provider
      value={{
        brand,
        stats,
        changelog: changelog || CHANGELOG_FALLBACK,
        loading,
        error,
      }}
    >
      {children}
    </WebsiteContext.Provider>
  );
}

export function useWebsite() {
  const ctx = useContext(WebsiteContext);
  if (!ctx) {
    throw new Error('useWebsite must be used within WebsiteProvider');
  }
  return ctx;
}

export function useBrand() {
  const { brand } = useWebsite();
  return brand;
}
