import L from 'leaflet';

/**
 * Shared vocabulary for the fiber plant.
 *
 * Markers are Leaflet `divIcon`s (styled HTML) rather than image icons on
 * purpose: Leaflet's default PNG markers resolve their URLs relative to the
 * stylesheet and 404 under Vite's bundler, and HTML markers let a node carry
 * its health colour and port state without shipping a sprite per combination.
 */

/** Ordered head-end → premises. `level` drives z-order and marker size. */
export const NODE_KINDS = {
  olt: { label: 'OLT', short: 'OLT', color: '#4338ca', level: 0, size: 26 },
  cabinet: { label: 'Cabinet / FDT', short: 'FDT', color: '#7c3aed', level: 1, size: 22 },
  splitter: { label: 'Splitter', short: 'SPL', color: '#0891b2', level: 2, size: 20 },
  odb: { label: 'ODB / FAT', short: 'ODB', color: '#0d9488', level: 3, size: 18 },
  joint: { label: 'Joint / closure', short: 'JNT', color: '#65a30d', level: 4, size: 15 },
  pole: { label: 'Pole', short: 'POL', color: '#a16207', level: 5, size: 13 },
  handhole: { label: 'Handhole', short: 'HH', color: '#78716c', level: 5, size: 13 },
  customer: { label: 'Premises', short: 'CX', color: '#e11d48', level: 6, size: 13 },
};

export const CABLE_TYPES = {
  backbone: { label: 'Backbone', color: '#4338ca', weight: 5 },
  feeder: { label: 'Feeder', color: '#7c3aed', weight: 4 },
  distribution: { label: 'Distribution', color: '#0891b2', weight: 3 },
  drop: { label: 'Drop', color: '#94a3b8', weight: 2 },
};

export const NODE_STATUS = {
  active: { label: 'Active', color: '#10b981' },
  planned: { label: 'Planned', color: '#94a3b8' },
  fault: { label: 'Fault', color: '#ef4444' },
  retired: { label: 'Retired', color: '#78716c' },
};

/** Same bands the ACS classifies on — deliberately identical to tr069Meta. */
export const HEALTH_COLOR = {
  good: '#10b981',
  marginal: '#f59e0b',
  critical: '#ef4444',
  too_strong: '#f59e0b',
};

export const HEALTH_LABEL = {
  good: 'Healthy', marginal: 'Marginal', critical: 'Critical', too_strong: 'Too strong',
};

export function nodeMeta(kind) {
  return NODE_KINDS[kind] || NODE_KINDS.odb;
}

export function formatLength(metres) {
  if (metres === null || metres === undefined) return '—';
  const value = Number(metres);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`;
}

/**
 * Plant node marker. Full ports and fault status are shown on the marker
 * itself — an operator scanning for somewhere to hang a new subscriber should
 * not have to click each box to find out it is full.
 */
export function nodeIcon(node, { selected = false, suspect = false } = {}) {
  const meta = nodeMeta(node.kind);
  const size = selected ? meta.size + 8 : meta.size;
  const unplacedRing = node.status === 'planned' ? 'border-style:dashed;' : '';
  const full = node.ports && node.ports.free === 0 && node.ports.total > 0;
  const ring = suspect ? '#ef4444' : selected ? '#0f172a' : '#ffffff';
  const ringWidth = suspect || selected ? 3 : 2;

  return L.divIcon({
    className: 'fiber-node-marker',
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:6px;
        background:${meta.color};
        border:${ringWidth}px solid ${ring};${unplacedRing}
        box-shadow:0 1px 4px rgba(15,23,42,.4);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:${Math.max(7, size / 2.6)}px;font-weight:700;
        font-family:ui-sans-serif,system-ui,sans-serif;line-height:1;
      ">${meta.short}</div>
      ${full ? '<div style="position:absolute;top:-4px;right:-4px;width:9px;height:9px;border-radius:50%;background:#ef4444;border:2px solid #fff"></div>' : ''}
      ${suspect ? '<div class="fiber-pulse"></div>' : ''}
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** ONT marker — a circle coloured by measured optical health. */
export function ontIcon(ont, { selected = false } = {}) {
  const color = HEALTH_COLOR[ont.optical_health] || '#94a3b8';
  const size = selected ? 18 : 13;
  // A reading far from what the plant predicts gets a ring: the number may
  // look acceptable while still being wrong for this node's distance and split.
  const off = ont.discrepancy_db !== null && ont.discrepancy_db !== undefined
    && Math.abs(ont.discrepancy_db) >= 3;
  return L.divIcon({
    className: 'fiber-ont-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:${off ? 3 : 2}px solid ${off ? '#0f172a' : '#ffffff'};
      box-shadow:0 1px 3px rgba(15,23,42,.35);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Subscriber premises — hollow, so it never reads as a piece of plant. */
export function customerIcon(customer) {
  // A geocoded pin is approximate; showing it identically to a surveyed one
  // would quietly turn a guess into a fact on the map.
  const approximate = customer.geo_source === 'geocode';
  return L.divIcon({
    className: 'fiber-customer-marker',
    html: `<div style="
      width:11px;height:11px;border-radius:50%;
      background:${approximate ? 'transparent' : '#ffffff'};
      border:2px ${approximate ? 'dashed' : 'solid'} #64748b;
      box-shadow:0 1px 2px rgba(15,23,42,.25);
    "></div>`,
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
  });
}

/** Where to open the map when the tenant has no plant yet. Nairobi. */
export const DEFAULT_CENTER = [-1.286389, 36.817223];
export const DEFAULT_ZOOM = 12;
