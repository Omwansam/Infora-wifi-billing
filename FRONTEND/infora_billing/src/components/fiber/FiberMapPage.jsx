import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Cable, Crosshair, Layers, Loader2, MapPin, Plus, Radio,
  RefreshCw, Ruler, Search, Trash2, Upload, X, Zap,
} from 'lucide-react';

import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.Default.css';

import FiberLayout from './FiberLayout';
import {
  CABLE_TYPES, DEFAULT_CENTER, DEFAULT_ZOOM, HEALTH_COLOR, HEALTH_LABEL,
  NODE_KINDS, customerIcon, formatLength, nodeIcon, nodeMeta, ontIcon,
} from './fiberMeta';
import fiberService from '../../services/fiberService';
import { useConfirm } from '../../contexts/ConfirmContext';

// OSM's tiles are the free option and carry a usage policy: attribution is
// required, and heavy commercial traffic should move to self-hosted tiles.
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Straight-line metres — enough for the live readout while drawing. */
function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) total += haversine(points[i], points[i + 1]);
  return total;
}

/** Click/keyboard plumbing — react-leaflet exposes map events only via a child. */
function MapEvents({ onClick, onEscape }) {
  useMapEvents({
    click: (event) => onClick?.([event.latlng.lat, event.latlng.lng]),
    keydown: (event) => { if (event.originalEvent.key === 'Escape') onEscape?.(); },
  });
  return null;
}

/** Fit to content once, on first load only — refitting on every poll fights the operator's panning. */
function FitBounds({ bounds }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !bounds) return;
    try {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
      done.current = true;
    } catch { /* degenerate bounds (a single point) — leave the default view */ }
  }, [bounds, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500';

export default function FiberMapPage() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [faults, setFaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [layers, setLayers] = useState({ plant: true, cables: true, onts: true, customers: false });
  const [mode, setMode] = useState('view');          // view | add | draw
  const [draftNode, setDraftNode] = useState(null);  // { kind, name, latitude, longitude, ... }
  const [draftPath, setDraftPath] = useState([]);
  const [draftCable, setDraftCable] = useState({ name: '', cable_type: 'distribution', from_node_id: '', to_node_id: '', fiber_count: '' });
  const [selected, setSelected] = useState(null);    // { type, id }
  const [trace, setTrace] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [map, faultData] = await Promise.all([
        fiberService.getMap(),
        fiberService.getFaults().catch(() => ({ suspects: [] })),
      ]);
      setData(map);
      setFaults(faultData?.suspects || []);
    } catch (error) {
      toast.error(error.message || 'Could not load the fiber map');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nodes = data?.nodes || [];
  const cables = data?.cables || [];
  const onts = data?.onts || [];
  const customers = data?.customers || [];
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const suspectIds = useMemo(() => new Set(faults.map((f) => f.node_id)), [faults]);

  const placedNodes = useMemo(() => nodes.filter((n) => n.latitude != null && n.longitude != null), [nodes]);
  const placedOnts = useMemo(() => onts.filter((o) => o.latitude != null && o.longitude != null), [onts]);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return [
      ...placedNodes.filter((n) => `${n.name} ${n.code || ''}`.toLowerCase().includes(needle))
        .map((n) => ({ type: 'node', id: n.id, label: n.name, sub: nodeMeta(n.kind).label, pos: [n.latitude, n.longitude] })),
      ...placedOnts.filter((o) => `${o.serial_number} ${o.customer_name || ''}`.toLowerCase().includes(needle))
        .map((o) => ({ type: 'ont', id: o.id, label: o.serial_number, sub: o.customer_name || 'Unlinked', pos: [o.latitude, o.longitude] })),
    ].slice(0, 8);
  }, [search, placedNodes, placedOnts]);

  // --- selection -----------------------------------------------------------
  const selectNode = useCallback(async (node) => {
    setSelected({ type: 'node', id: node.id });
    setTrace(null);
    try {
      setTrace(await fiberService.traceNode(node.id));
    } catch (error) {
      toast.error(error.message || 'Could not trace this node');
    }
  }, []);

  // --- map click: depends on mode -----------------------------------------
  const handleMapClick = useCallback((latlng) => {
    if (mode === 'add') {
      setDraftNode((prev) => ({
        kind: prev?.kind || 'odb',
        name: prev?.name || '',
        code: prev?.code || '',
        port_count: prev?.port_count || '',
        split_ratio: prev?.split_ratio || '',
        parent_id: prev?.parent_id || '',
        latitude: latlng[0],
        longitude: latlng[1],
      }));
    } else if (mode === 'draw') {
      setDraftPath((prev) => [...prev, latlng]);
    }
  }, [mode]);

  const cancelMode = useCallback(() => {
    setMode('view');
    setDraftNode(null);
    setDraftPath([]);
  }, []);

  // --- writes --------------------------------------------------------------
  const saveNode = async () => {
    if (!draftNode?.name?.trim()) { toast.error('Give the node a name'); return; }
    if (draftNode.latitude == null) { toast.error('Click the map to place it'); return; }
    setBusy(true);
    try {
      await fiberService.createNode({
        ...draftNode,
        parent_id: draftNode.parent_id || null,
        port_count: draftNode.port_count || null,
        split_ratio: draftNode.split_ratio || null,
      });
      toast.success(`${draftNode.name} placed`);
      cancelMode();
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not save the node');
    } finally { setBusy(false); }
  };

  const saveCable = async () => {
    if (draftPath.length < 2) { toast.error('Click at least two points to draw a route'); return; }
    if (!draftCable.from_node_id) { toast.error('Choose the node this cable starts from'); return; }
    setBusy(true);
    try {
      const result = await fiberService.createCable({
        ...draftCable,
        to_node_id: draftCable.to_node_id || null,
        fiber_count: draftCable.fiber_count || null,
        path: draftPath,
      });
      toast.success(`Cable saved — ${formatLength(result?.cable?.length_m)} of route`);
      setDraftCable({ name: '', cable_type: 'distribution', from_node_id: '', to_node_id: '', fiber_count: '' });
      cancelMode();
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not save the cable');
    } finally { setBusy(false); }
  };

  /** Dragging a marker is the fastest way to correct a pin, so it writes through. */
  const moveNode = async (node, latlng) => {
    try {
      await fiberService.updateNode(node.id, { latitude: latlng.lat, longitude: latlng.lng });
      setData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === node.id
          ? { ...n, latitude: latlng.lat, longitude: latlng.lng } : n)),
      }));
    } catch (error) {
      toast.error(error.message || 'Could not move the node');
      await load(); // snap back to whatever the server actually holds
    }
  };

  const removeNode = async (node) => {
    const ok = await confirm({
      title: `Delete ${node.name}?`,
      message: 'Its cables and port assignments go with it. Any ONT hanging off it becomes unassigned.',
      confirmText: 'Delete node',
      destructive: true,
    });
    if (!ok) return;
    try {
      await fiberService.deleteNode(node.id);
      toast.success('Node deleted');
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not delete the node');
    }
  };

  const runGeocode = async () => {
    setBusy(true);
    try {
      const result = await fiberService.geocodeBatch(25);
      toast.success(result.message || `Placed ${result.placed}`);
      if (result.failed?.length) {
        toast(`${result.failed.length} address(es) could not be matched`, { icon: '⚠️' });
      }
      await load();
    } catch (error) {
      toast.error(error.message || 'Geocoding failed');
    } finally { setBusy(false); }
  };

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const preview = await fiberService.importSurvey(file, { dryRun: true });
      const ok = await confirm({
        title: 'Import this survey?',
        message: `${preview.nodes} node(s) and ${preview.cables} cable(s), ${formatLength(preview.total_length_m)} of route. They arrive as "planned" and unattached — you connect them to your plant afterwards.`,
        confirmText: 'Import',
      });
      if (!ok) return;
      const result = await fiberService.importSurvey(file, { dryRun: false });
      toast.success(result.message || 'Imported');
      await load();
    } catch (error) {
      toast.error(error.message || 'Import failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const selectedNode = selected?.type === 'node' ? nodesById[selected.id] : null;
  const stats = data?.stats;
  const draftMetres = pathLength(draftPath);

  return (
    <FiberLayout
      bleed
      title="Fiber map"
      subtitle="Your outside plant, and what the optics say about it"
      action={(
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".kml,.geojson,.json"
            className="hidden"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Upload className="mr-2 h-4 w-4" /> Import survey
          </button>
          <button
            onClick={runGeocode}
            disabled={busy}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <MapPin className="mr-2 h-4 w-4" /> Geocode addresses
          </button>
          <button
            onClick={load}
            className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      )}
    >
      <div className="relative h-[calc(100vh-13rem)] min-h-[560px] w-full overflow-hidden border-y border-slate-200 dark:border-slate-800">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className={`h-full w-full ${mode !== 'view' ? '[&_.leaflet-container]:cursor-crosshair' : ''}
            [&_.leaflet-tile-pane]:dark:[filter:invert(1)_hue-rotate(180deg)_brightness(0.92)_contrast(0.9)]`}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
          <FitBounds bounds={data?.bounds} />
          <FlyTo target={flyTarget} />
          <MapEvents onClick={handleMapClick} onEscape={cancelMode} />

          {layers.cables && cables.map((cable) => {
            const meta = CABLE_TYPES[cable.cable_type] || CABLE_TYPES.distribution;
            if (!cable.path?.length) return null;
            return (
              <Polyline
                key={`cable-${cable.id}`}
                positions={cable.path}
                pathOptions={{
                  color: meta.color,
                  weight: meta.weight,
                  opacity: cable.status === 'planned' ? 0.55 : 0.9,
                  dashArray: cable.status === 'planned' ? '8 6' : undefined,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{cable.name || `Cable ${cable.id}`}</p>
                    <p className="text-slate-500">{meta.label} · {formatLength(cable.length_m)}</p>
                    {cable.fiber_count && <p className="text-slate-500">{cable.fiber_count} fibres</p>}
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* The route being drawn, so the operator sees the shape as it forms */}
          {draftPath.length > 0 && (
            <>
              <Polyline positions={draftPath} pathOptions={{ color: '#0d9488', weight: 4, dashArray: '6 6' }} />
              {draftPath.map((point, index) => (
                <Marker
                  key={`draft-${index}`}
                  position={point}
                  icon={ontIcon({ optical_health: 'good' })}
                />
              ))}
            </>
          )}

          {layers.plant && placedNodes.map((node) => (
            <Marker
              key={`node-${node.id}`}
              position={[node.latitude, node.longitude]}
              icon={nodeIcon(node, {
                selected: selected?.type === 'node' && selected.id === node.id,
                suspect: suspectIds.has(node.id),
              })}
              draggable={mode === 'view'}
              eventHandlers={{
                click: () => selectNode(node),
                dragend: (event) => moveNode(node, event.target.getLatLng()),
              }}
            />
          ))}

          {draftNode?.latitude != null && (
            <Marker
              position={[draftNode.latitude, draftNode.longitude]}
              icon={nodeIcon({ kind: draftNode.kind, status: 'planned' }, { selected: true })}
            />
          )}

          {layers.onts && (
            <MarkerClusterGroup chunkedLoading maxClusterRadius={45} disableClusteringAtZoom={17}>
              {placedOnts.map((ont) => (
                <Marker
                  key={`ont-${ont.id}`}
                  position={[ont.latitude, ont.longitude]}
                  icon={ontIcon(ont)}
                >
                  <Popup>
                    <div className="min-w-[190px] text-xs">
                      <p className="font-mono font-semibold">{ont.serial_number}</p>
                      <p className="text-slate-500">{ont.customer_name || 'Unlinked'}</p>
                      <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                        <p>
                          Measured{' '}
                          <span className="font-semibold" style={{ color: HEALTH_COLOR[ont.optical_health] || '#64748b' }}>
                            {ont.rx_power_dbm ?? '—'} dBm
                          </span>
                          {ont.optical_health && ` · ${HEALTH_LABEL[ont.optical_health]}`}
                        </p>
                        {ont.predicted_rx_dbm !== null && ont.predicted_rx_dbm !== undefined && (
                          <p className="text-slate-500">Plant predicts {ont.predicted_rx_dbm} dBm</p>
                        )}
                        {ont.discrepancy_db !== null && ont.discrepancy_db !== undefined
                          && Math.abs(ont.discrepancy_db) >= 3 && (
                          <p className="mt-1 font-semibold text-red-600">
                            {ont.discrepancy_db > 0 ? '+' : ''}{ont.discrepancy_db} dB off budget
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {layers.customers && (
            <MarkerClusterGroup chunkedLoading maxClusterRadius={60} disableClusteringAtZoom={18}>
              {customers.map((customer) => (
                <Marker
                  key={`cust-${customer.id}`}
                  position={[customer.latitude, customer.longitude]}
                  icon={customerIcon(customer)}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">{customer.name}</p>
                      <p className="text-slate-500">{customer.package} · {customer.connection_type}</p>
                      {customer.geo_source === 'geocode' && (
                        <p className="mt-1 text-amber-600">Approximate — from the address text</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}
        </MapContainer>

        {/* ---- floating controls ---- */}
        <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col justify-between p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Search + layers */}
            <div className="pointer-events-auto w-64 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a node or ONT…"
                  className="w-full rounded-lg border border-slate-200 bg-white/95 py-2 pl-8 pr-2 text-sm shadow-sm backdrop-blur outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900/95 dark:text-white"
                />
              </div>
              {matches.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  {matches.map((match) => (
                    <button
                      key={`${match.type}-${match.id}`}
                      onClick={() => { setFlyTarget(match.pos); setSearch(''); if (match.type === 'node') selectNode(nodesById[match.id]); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="truncate font-medium text-slate-900 dark:text-white">{match.label}</span>
                      <span className="ml-2 shrink-0 text-slate-400">{match.sub}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Layers className="h-3 w-3" /> Layers
                </p>
                {[
                  { key: 'plant', label: 'Plant nodes', count: placedNodes.length },
                  { key: 'cables', label: 'Cable routes', count: cables.length },
                  { key: 'onts', label: 'ONTs (optical)', count: placedOnts.length },
                  { key: 'customers', label: 'Subscribers', count: customers.length },
                ].map((layer) => (
                  <label key={layer.key} className="flex cursor-pointer items-center justify-between py-0.5 text-xs text-slate-700 dark:text-slate-200">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={layers[layer.key]}
                        onChange={() => setLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {layer.label}
                    </span>
                    <span className="tabular-nums text-slate-400">{layer.count}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fault suspects */}
            {faults.length > 0 && (
              <div className="pointer-events-auto w-72 rounded-lg border border-red-200 bg-white/95 shadow-lg backdrop-blur dark:border-red-500/40 dark:bg-slate-900/95">
                <div className="flex items-center gap-2 border-b border-red-100 px-3 py-2 dark:border-red-500/30">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200">
                    {faults.length} branch{faults.length === 1 ? '' : 'es'} degraded
                  </p>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {faults.map((fault) => (
                    <button
                      key={fault.node_id}
                      onClick={() => {
                        if (fault.latitude != null) setFlyTarget([fault.latitude, fault.longitude]);
                        const node = nodesById[fault.node_id];
                        if (node) selectNode(node);
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-red-50/60 dark:border-slate-800 dark:hover:bg-red-500/10"
                    >
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{fault.node_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {fault.affected}/{fault.total_onts} ONTs degraded · worst {fault.worst_dbm} dBm
                      </p>
                    </button>
                  ))}
                </div>
                <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:border-slate-800">
                  A whole branch dimming at once points at that node or its feed — not at each subscriber.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            {/* Legend + counters */}
            <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {Object.entries(NODE_KINDS).slice(0, 5).map(([key, meta]) => (
                  <span key={key} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                ))}
                <span className="mx-1 h-3 w-px bg-slate-200 dark:bg-slate-700" />
                {Object.entries(HEALTH_LABEL).slice(0, 3).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_COLOR[key] }} />
                    {label}
                  </span>
                ))}
              </div>
              {stats && (
                <div className="mt-2 flex gap-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <Stat label="Nodes" value={`${stats.placed_nodes}/${stats.nodes}`} />
                  <Stat label="Route" value={formatLength(stats.cable_length_m)} />
                  <Stat label="ONTs mapped" value={`${stats.onts_mapped}/${stats.onts_total}`} />
                </div>
              )}
            </div>

            {/* Mode toolbar */}
            <div className="pointer-events-auto flex gap-2">
              {mode === 'view' ? (
                <>
                  <button
                    onClick={() => { setMode('add'); setDraftNode({ kind: 'odb', name: '' }); }}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add node
                  </button>
                  <button
                    onClick={() => { setMode('draw'); setDraftPath([]); }}
                    className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:bg-teal-700"
                  >
                    <Cable className="mr-1.5 h-4 w-4" /> Draw cable
                  </button>
                </>
              ) : (
                <button
                  onClick={cancelMode}
                  className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                >
                  <X className="mr-1.5 h-4 w-4" /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---- right rail: draft forms and the selected node ---- */}
        {(mode !== 'view' || selectedNode) && (
          <div className="absolute right-3 top-20 z-[1001] w-80 max-h-[calc(100%-7rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white/97 p-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/97 sm:right-4">
            {mode === 'add' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">New node</h3>
                  <Crosshair className="h-4 w-4 text-teal-600" />
                </div>
                <p className="text-xs text-slate-500">
                  {draftNode?.latitude != null
                    ? `Placed at ${draftNode.latitude.toFixed(5)}, ${draftNode.longitude.toFixed(5)} — click again to move it.`
                    : 'Click the map to drop it.'}
                </p>
                <div>
                  <label className={labelCls}>Kind</label>
                  <select
                    value={draftNode?.kind || 'odb'}
                    onChange={(e) => setDraftNode((p) => ({ ...p, kind: e.target.value }))}
                    className={inputCls}
                  >
                    {Object.entries(NODE_KINDS).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    value={draftNode?.name || ''}
                    onChange={(e) => setDraftNode((p) => ({ ...p, name: e.target.value }))}
                    placeholder="ODB-14 Ruiru"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Ports</label>
                    <input
                      type="number" min="0"
                      value={draftNode?.port_count || ''}
                      onChange={(e) => setDraftNode((p) => ({ ...p, port_count: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Split</label>
                    <select
                      value={draftNode?.split_ratio || ''}
                      onChange={(e) => setDraftNode((p) => ({ ...p, split_ratio: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {['1:2', '1:4', '1:8', '1:16', '1:32', '1:64'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fed from</label>
                  <select
                    value={draftNode?.parent_id || ''}
                    onChange={(e) => setDraftNode((p) => ({ ...p, parent_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— nothing upstream (an OLT) —</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>{nodeMeta(n.kind).short} · {n.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">
                    Setting this is what lets the loss budget and fault analysis work.
                  </p>
                </div>
                <button
                  onClick={saveNode}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Save node
                </button>
              </div>
            )}

            {mode === 'draw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Draw cable</h3>
                  <Ruler className="h-4 w-4 text-teal-600" />
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">
                    {draftPath.length} point{draftPath.length === 1 ? '' : 's'} · route length
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatLength(draftMetres)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Follow the real route, not a straight line — this is the number you order cable by.
                  </p>
                </div>
                {draftPath.length > 0 && (
                  <button
                    onClick={() => setDraftPath((p) => p.slice(0, -1))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    Undo last point
                  </button>
                )}
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    value={draftCable.name}
                    onChange={(e) => setDraftCable((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Feeder A → FDT-2"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      value={draftCable.cable_type}
                      onChange={(e) => setDraftCable((p) => ({ ...p, cable_type: e.target.value }))}
                      className={inputCls}
                    >
                      {Object.entries(CABLE_TYPES).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Fibres</label>
                    <input
                      type="number" min="0"
                      value={draftCable.fiber_count}
                      onChange={(e) => setDraftCable((p) => ({ ...p, fiber_count: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>From node</label>
                  <select
                    value={draftCable.from_node_id}
                    onChange={(e) => setDraftCable((p) => ({ ...p, from_node_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— choose —</option>
                    {nodes.map((n) => <option key={n.id} value={n.id}>{nodeMeta(n.kind).short} · {n.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>To node</label>
                  <select
                    value={draftCable.to_node_id}
                    onChange={(e) => setDraftCable((p) => ({ ...p, to_node_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— open end —</option>
                    {nodes.map((n) => <option key={n.id} value={n.id}>{nodeMeta(n.kind).short} · {n.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={saveCable}
                  disabled={busy || draftPath.length < 2}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cable className="mr-2 h-4 w-4" />}
                  Save cable
                </button>
              </div>
            )}

            {mode === 'view' && selectedNode && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: nodeMeta(selectedNode.kind).color }}>
                      {nodeMeta(selectedNode.kind).label}
                    </p>
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{selectedNode.name}</h3>
                  </div>
                  <button onClick={() => { setSelected(null); setTrace(null); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {selectedNode.ports?.total > 0 && (
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Ports</span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {selectedNode.ports.used}/{selectedNode.ports.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full ${selectedNode.ports.free === 0 ? 'bg-red-500' : 'bg-teal-500'}`}
                        style={{ width: `${(selectedNode.ports.used / selectedNode.ports.total) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {selectedNode.ports.free === 0 ? 'Full — no spare ports' : `${selectedNode.ports.free} free`}
                    </p>
                  </div>
                )}

                {!trace ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tracing upstream…
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <Zap className="h-3 w-3" /> Loss budget
                      </p>
                      {trace.predicted_rx_dbm === null ? (
                        <p className="text-xs text-slate-500">No upstream path recorded yet.</p>
                      ) : (
                        <>
                          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                            {trace.predicted_rx_dbm} <span className="text-sm font-medium text-slate-400">dBm predicted</span>
                          </p>
                          <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                            <div className="flex justify-between"><span>Fibre ({formatLength(trace.loss_breakdown.fiber_m)})</span><span className="tabular-nums">{trace.loss_breakdown.fiber_db} dB</span></div>
                            <div className="flex justify-between"><span>Splitters</span><span className="tabular-nums">{trace.loss_breakdown.splitter_db} dB</span></div>
                            <div className="flex justify-between"><span>Connectors</span><span className="tabular-nums">{trace.loss_breakdown.connector_db} dB</span></div>
                            <div className="flex justify-between"><span>Splices</span><span className="tabular-nums">{trace.loss_breakdown.splice_db} dB</span></div>
                            <div className="flex justify-between border-t border-slate-100 pt-0.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                              <span>Total loss</span><span className="tabular-nums">{trace.loss_breakdown.total_loss_db} dB</span>
                            </div>
                          </div>
                          {!trace.within_budget && (
                            <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
                              Below the {trace.sensitivity_dbm} dBm ONT sensitivity — this branch cannot work as designed.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {trace.upstream?.length > 1 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Upstream path</p>
                        <div className="space-y-0.5">
                          {trace.upstream.slice().reverse().map((hop) => (
                            <div key={hop.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: nodeMeta(hop.kind).color }} />
                              <span className="truncate">{hop.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {trace.onts?.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {trace.onts.length} ONT{trace.onts.length === 1 ? '' : 's'} below
                        </p>
                        <div className="max-h-32 space-y-0.5 overflow-y-auto">
                          {trace.onts.map((ont) => (
                            <div key={ont.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HEALTH_COLOR[ont.optical_health] || '#94a3b8' }} />
                                <span className="truncate text-slate-600 dark:text-slate-300">{ont.customer_name || ont.serial_number}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-500">{ont.rx_power_dbm ?? '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={() => removeNode(selectedNode)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-300 hover:text-red-700 dark:border-slate-700 dark:text-slate-300"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete node
                </button>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-[1002] flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-slate-950/60">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading plant…
            </span>
          </div>
        )}

        {mode !== 'view' && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[1001] -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {mode === 'add' ? 'Click the map to place the node' : 'Click along the route — Esc to cancel'}
          </div>
        )}
      </div>

      {data && data.stats.onts_total > 0 && data.stats.onts_mapped === 0 && (
        <div className="mx-4 my-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10 sm:mx-6">
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              None of your {data.stats.onts_total} ONTs are on the map yet
            </p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              Assign each one to an ODB port on the Splice plan tab. That link is what turns
              optical readings into fault localisation — until then the map draws plant, not health.
            </p>
          </div>
        </div>
      )}
    </FiberLayout>
  );
}
