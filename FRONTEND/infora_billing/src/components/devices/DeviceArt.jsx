import React from 'react';

/* -------------------------------------------------------------------------
 * Illustrations of the router in the rack.
 *
 * Drawn rather than fetched. Hotlinking product photography off a vendor CDN
 * would put a network round trip (and someone else's uptime, and someone
 * else's licence) between an operator and a page that has to render on a
 * phone in a van. These are a few hundred bytes each, work offline, and cannot
 * 404.
 *
 * The classifier keys off the model string RouterOS reports, so a router
 * self-identifies into the right silhouette on its first successful sync with
 * nothing for the operator to pick. Anything unrecognised falls back to a
 * generic chassis instead of a broken image.
 * ---------------------------------------------------------------------- */

export const FORM_FACTORS = {
  rackmount: 'Rackmount router',
  desktop: 'Desktop router',
  ap: 'Indoor access point',
  outdoor: 'Outdoor CPE',
  switch: 'Switch',
  generic: 'RouterOS device',
};

/** Model string -> silhouette. Order matters: the specific tests come first. */
export function deviceFormFactor(model) {
  const m = String(model || '').toLowerCase().replace(/[\s_-]/g, '');

  if (/^(crs|css)/.test(m) || m.includes('switch')) return 'switch';
  if (/(lhg|sxt|qrt|disc|dynadish|ldf|sextant)/.test(m)) return 'outdoor';
  // hAP/cAP/wAP have antennas; hEX does not. 'hexlite' must not be caught by
  // the 'hap...lite' family — it is a bare desktop box.
  if (/(hap|cap|wap|audience|^map)/.test(m)) return 'ap';
  if (/(ccr|rb1100|rb2011|rb3011|rb4011|rb5009|rb1009|netmetal)/.test(m)) return 'rackmount';
  if (/(hex|rb75|rb76|rb96|rbm|groove|ltap)/.test(m)) return 'desktop';
  if (/^(rb|ccr)/.test(m)) return 'rackmount';
  return 'generic';
}

/* Fixed device colours, not theme tokens: a router is a dark object under any
   theme, and these read against both the light and dark card surfaces. */
const C = {
  shell: '#3f4653',
  shellDark: '#242a33',
  shellLight: '#5b6472',
  port: '#161a20',
  portRim: '#6b7482',
  led: '#34d399',
  ledDim: '#64748b',
  text: '#9aa3b1',
};

function Ports({ count, x, y, w = 11, h = 9, gap = 2.5 }) {
  // Coerce: a caller passing x="66" would otherwise hit string concatenation —
  // "66" + 13.5 is "6613.5", and every port lands off-canvas while the chassis
  // still draws, so the device renders as a blank slab.
  const x0 = Number(x);
  const y0 = Number(y);
  const width = Number(w);
  const height = Number(h);
  const pitch = width + Number(gap);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          <rect x={x0 + i * pitch} y={y0} width={width} height={height} rx="1.5" fill={C.port} stroke={C.portRim} strokeWidth="0.6" />
          <rect x={x0 + i * pitch + 3.2} y={y0 - 1.4} width={width - 6.4} height="1.8" rx="0.6" fill={C.port} stroke={C.portRim} strokeWidth="0.5" />
        </g>
      ))}
    </g>
  );
}

function Rackmount({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="55%" stopColor={C.shell} />
          <stop offset="100%" stopColor={C.shellDark} />
        </linearGradient>
      </defs>
      <rect x="6" y="16" width="228" height="34" rx="3" fill={`url(#g${id})`} />
      {/* rack ears */}
      <rect x="2" y="18" width="6" height="30" rx="1.5" fill={C.shellDark} />
      <rect x="232" y="18" width="6" height="30" rx="1.5" fill={C.shellDark} />
      <circle cx="5" cy="23" r="1.2" fill={C.portRim} />
      <circle cx="5" cy="43" r="1.2" fill={C.portRim} />
      <circle cx="235" cy="23" r="1.2" fill={C.portRim} />
      <circle cx="235" cy="43" r="1.2" fill={C.portRim} />
      <rect x="6" y="16" width="228" height="1.6" fill="#ffffff" opacity="0.14" />
      <Ports count={10} x={16} y={30} />
      {/* SFP cage + status LEDs */}
      <rect x="164" y="29" width="18" height="11" rx="1.5" fill={C.port} stroke={C.portRim} strokeWidth="0.6" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={196 + i * 7} cy="34.5" r="1.8" fill={i === 0 ? C.led : C.ledDim} opacity={i === 0 ? 1 : 0.5} />
      ))}
      <rect x="16" y="21" width="34" height="3" rx="1.5" fill={C.text} opacity="0.35" />
    </>
  );
}

function Desktop({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="100%" stopColor={C.shellDark} />
        </linearGradient>
      </defs>
      <rect x="52" y="14" width="136" height="38" rx="6" fill={`url(#g${id})`} />
      <rect x="52" y="14" width="136" height="1.6" rx="1" fill="#ffffff" opacity="0.16" />
      <Ports count={5} x={66} y={30} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={140 + i * 8} cy="34.5" r="1.9" fill={i === 0 ? C.led : C.ledDim} opacity={i === 0 ? 1 : 0.5} />
      ))}
      <rect x="66" y="21" width="28" height="3" rx="1.5" fill={C.text} opacity="0.35" />
    </>
  );
}

function AccessPoint({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="100%" stopColor={C.shellDark} />
        </linearGradient>
      </defs>
      {/* antennas */}
      <rect x="78" y="6" width="4" height="20" rx="2" fill={C.shellDark} transform="rotate(-18 80 16)" />
      <rect x="158" y="6" width="4" height="20" rx="2" fill={C.shellDark} transform="rotate(18 160 16)" />
      <rect x="62" y="22" width="116" height="30" rx="6" fill={`url(#g${id})`} />
      <rect x="62" y="22" width="116" height="1.6" rx="1" fill="#ffffff" opacity="0.16" />
      <Ports count={4} x={74} y={34} w={10} h={8} />
      {[0, 1].map((i) => (
        <circle key={i} cx={144 + i * 8} cy="38" r="1.9" fill={i === 0 ? C.led : C.ledDim} opacity={i === 0 ? 1 : 0.5} />
      ))}
      <rect x="74" y="28" width="24" height="2.6" rx="1.3" fill={C.text} opacity="0.35" />
    </>
  );
}

function Outdoor({ id }) {
  return (
    <>
      <defs>
        <radialGradient id={`g${id}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="100%" stopColor={C.shellDark} />
        </radialGradient>
      </defs>
      {/* dish + feed arm + mount */}
      <ellipse cx="104" cy="33" rx="34" ry="24" fill={`url(#g${id})`} />
      <ellipse cx="104" cy="33" rx="25" ry="17" fill="none" stroke={C.portRim} strokeWidth="0.9" opacity="0.5" />
      <rect x="136" y="30" width="34" height="5" rx="2.5" fill={C.shellDark} />
      <rect x="166" y="22" width="20" height="21" rx="4" fill={C.shell} />
      <circle cx="176" cy="32.5" r="2" fill={C.led} />
      <rect x="186" y="14" width="6" height="38" rx="3" fill={C.shellDark} />
    </>
  );
}

function Switch({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="55%" stopColor={C.shell} />
          <stop offset="100%" stopColor={C.shellDark} />
        </linearGradient>
      </defs>
      <rect x="6" y="18" width="228" height="30" rx="3" fill={`url(#g${id})`} />
      <rect x="2" y="20" width="6" height="26" rx="1.5" fill={C.shellDark} />
      <rect x="232" y="20" width="6" height="26" rx="1.5" fill={C.shellDark} />
      <rect x="6" y="18" width="228" height="1.6" fill="#ffffff" opacity="0.14" />
      <Ports count={12} x={14} y={24} w={8.5} h={7} gap={2} />
      <Ports count={12} x={14} y={36} w={8.5} h={7} gap={2} />
      <rect x="152" y="24" width="16" height="19" rx="1.5" fill={C.port} stroke={C.portRim} strokeWidth="0.6" />
      <rect x="172" y="24" width="16" height="19" rx="1.5" fill={C.port} stroke={C.portRim} strokeWidth="0.6" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={200 + i * 8} cy="33" r="1.8" fill={i === 0 ? C.led : C.ledDim} opacity={i === 0 ? 1 : 0.5} />
      ))}
    </>
  );
}

function Generic({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.shellLight} />
          <stop offset="100%" stopColor={C.shellDark} />
        </linearGradient>
      </defs>
      <rect x="46" y="16" width="148" height="34" rx="5" fill={`url(#g${id})`} />
      <rect x="46" y="16" width="148" height="1.6" rx="1" fill="#ffffff" opacity="0.16" />
      <Ports count={6} x={60} y={31} />
      <circle cx="172" cy="35.5" r="2" fill={C.led} />
      <rect x="60" y="22" width="30" height="3" rx="1.5" fill={C.text} opacity="0.35" />
    </>
  );
}

const SHAPES = {
  rackmount: Rackmount,
  desktop: Desktop,
  ap: AccessPoint,
  outdoor: Outdoor,
  switch: Switch,
  generic: Generic,
};

/**
 * Silhouette of a router, picked from its model string.
 *
 * `offline` desaturates it rather than hiding it — the operator still needs to
 * recognise which box is dark.
 */
export default function DeviceArt({ model, offline = false, className = '', title }) {
  const kind = deviceFormFactor(model);
  const Shape = SHAPES[kind] || Generic;
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 240 66"
      className={`${className} ${offline ? 'opacity-60 grayscale' : ''}`}
      role="img"
      aria-label={title || `${model || 'RouterOS device'} — ${FORM_FACTORS[kind]}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title || `${model || 'RouterOS device'} — ${FORM_FACTORS[kind]}`}</title>
      <Shape id={id} />
    </svg>
  );
}
