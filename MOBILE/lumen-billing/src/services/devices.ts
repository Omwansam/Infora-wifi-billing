import { DEVICES, SESSIONS } from '@/data/mock';
import type { Device, Session } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';
import { mapDevice, mapSession, type DeviceDTO, type SessionDTO } from './mappers';

export async function listDevices(): Promise<Device[]> {
  if (!IS_LIVE) return DEVICES;
  const res = await http.get<{ devices: DeviceDTO[] } | DeviceDTO[]>(ENDPOINTS.devices);
  const items = Array.isArray(res) ? res : (res.devices ?? []);
  return items.map(mapDevice);
}

export async function listSessions(): Promise<Session[]> {
  if (!IS_LIVE) return SESSIONS;
  const res = await http.get<{ sessions: SessionDTO[] } | SessionDTO[]>(ENDPOINTS.activeSessions);
  const items = Array.isArray(res) ? res : (res.sessions ?? []);
  return items.map(mapSession);
}
