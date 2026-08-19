import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';

/**
 * Fiber plant, field side.
 *
 * The office can draw plant on a map from aerial imagery, but only someone
 * standing at the pole knows where the box actually is. This is that half:
 * list what has no coordinates, and pin it from the phone's GPS.
 */

export interface FiberNodeDTO {
  id: number;
  name: string;
  code: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  placed: boolean;
  status: string;
  address: string | null;
  ports?: { total: number; used: number; free: number | null };
}

const DEMO_NODES: FiberNodeDTO[] = [
  { id: 1, name: 'ODB-14 Ruiru', code: 'ODB14', kind: 'odb', latitude: null, longitude: null, placed: false, status: 'planned', address: 'Behind Total, Ruiru' },
  { id: 2, name: 'SPL-3 Kimbo', code: 'SPL3', kind: 'splitter', latitude: null, longitude: null, placed: false, status: 'planned', address: 'Kimbo stage' },
  { id: 3, name: 'FDT-1 Githurai', code: 'FDT1', kind: 'cabinet', latitude: null, longitude: null, placed: false, status: 'planned', address: null },
];

export async function listNodes(): Promise<FiberNodeDTO[]> {
  if (!IS_LIVE) return DEMO_NODES;
  const res = await http.get<{ nodes: FiberNodeDTO[] }>(ENDPOINTS.fiberNodes);
  return res.nodes ?? [];
}

export async function listUnplaced(): Promise<FiberNodeDTO[]> {
  return (await listNodes()).filter((node) => !node.placed);
}

/** Pin a node, ONT or subscriber premises at the device's current position. */
export async function place(
  kind: 'node' | 'ont' | 'customer',
  id: number,
  latitude: number,
  longitude: number,
): Promise<void> {
  if (!IS_LIVE) return;
  await http.post(ENDPOINTS.fiberPlace, { kind, id, latitude, longitude });
}
