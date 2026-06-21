import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '../utils/authToken';
import deviceService from '../services/deviceService';
import { mapMikrotikDevice } from '../lib/deviceUtils';

export function useMikrotikDevices() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const [devicesRes, statsRes] = await Promise.all([
        deviceService.getDevices(token, { per_page: 100 }),
        deviceService.getDeviceStats(token).catch(() => null),
      ]);
      setDevices((devicesRes.devices || []).map(mapMikrotikDevice));
      if (statsRes) setStats(statsRes);
    } catch {
      setDevices([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return { devices, stats, loading, loadDevices };
}
