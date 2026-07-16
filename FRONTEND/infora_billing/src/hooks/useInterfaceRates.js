import { useEffect, useRef, useState } from 'react';
import deviceService from '../services/deviceService';
import { getAccessToken } from '../utils/authToken';

/**
 * Poll a device's interface byte counters and derive per-port throughput.
 *
 * Returns { [interfaceName]: { rx_bps, tx_bps } } — empty until two samples
 * have arrived. Polling only runs while `enabled` is true.
 */
export function useInterfaceRates(deviceId, enabled, intervalMs = 5000) {
  const [rates, setRates] = useState({});
  const prevRef = useRef(null);

  useEffect(() => {
    if (!enabled || !deviceId) {
      prevRef.current = null;
      setRates({});
      return undefined;
    }
    let active = true;
    const poll = async () => {
      try {
        const token = getAccessToken();
        const sample = await deviceService.getInterfaceTraffic(token, deviceId);
        if (!active || !sample?.stats?.length) return;
        const prev = prevRef.current;
        prevRef.current = sample;
        if (!prev) return;
        const dt = Math.max(0.5, sample.at - prev.at);
        const prevByName = Object.fromEntries(prev.stats.map((s) => [s.name, s]));
        const next = {};
        sample.stats.forEach((s) => {
          const p = prevByName[s.name];
          if (!p) return;
          next[s.name] = {
            rx_bps: Math.max(0, ((s.rx_bytes - p.rx_bytes) * 8) / dt),
            tx_bps: Math.max(0, ((s.tx_bytes - p.tx_bytes) * 8) / dt),
          };
        });
        setRates(next);
      } catch {
        /* router offline — keep last known rates */
      }
    };
    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [deviceId, enabled, intervalMs]);

  return rates;
}

/** Compact bits-per-second label: 950 → "950", 1.2e6 → "1.2M". */
export function formatBps(bps) {
  if (!Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)}G`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)}M`;
  if (bps >= 1e3) return `${Math.round(bps / 1e3)}k`;
  return `${Math.round(bps)}`;
}
