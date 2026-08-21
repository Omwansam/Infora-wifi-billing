import React, { useMemo } from 'react';
import './authBackdrop.css';

/* -------------------------------------------------------------------------
 * The backdrop behind sign-in and sign-up.
 *
 * It replaces a generic dot-constellation — the kind every SaaS login has —
 * with something that means something for this product: signal propagating
 * from a tower, and the distribution runs that hang off it.
 *
 *   · concentric arcs radiate from a single origin off the lower-left corner,
 *     the way coverage does from a mast;
 *   · a few straight runs leave that origin at fixed bearings, with a
 *     subscriber node dropped where each run crosses an arc — so the nodes sit
 *     on real geometry rather than at random, which is what stops it reading
 *     as scattered decoration;
 *   · the texture underneath is a dot matrix rather than a ruled grid, because
 *     a ruled grid is the thing everyone else is using.
 *
 * Geometry is computed once from the intersection maths, so the arcs and the
 * nodes can never drift apart. Everything is a fraction of a 100x100 viewBox
 * stretched with preserveAspectRatio="none": no media queries, and it fills
 * any window without reflowing.
 * ---------------------------------------------------------------------- */

// Where the signal comes from — off-canvas, lower left.
const ORIGIN = { x: -12, y: 112 };
// Arc radii, in viewBox units. Spacing widens outward the way real
// propagation rings do rather than stepping evenly.
const RADII = [24, 38, 55, 75, 98, 124, 153];
// Bearings of the distribution runs, in degrees anticlockwise from east.
const BEARINGS = [12, 27, 44, 62, 78];

function polar(deg, r) {
  const rad = (deg * Math.PI) / 180;
  return { x: ORIGIN.x + Math.cos(rad) * r, y: ORIGIN.y - Math.sin(rad) * r };
}

export default function AuthBackdrop() {
  const { runs, nodes } = useMemo(() => {
    const outer = RADII[RADII.length - 1] + 20;
    const built = BEARINGS.map((deg) => polar(deg, outer));

    // One node per run, on a different ring each time, so the eye reads a
    // sequence of hops rather than a row.
    const dots = BEARINGS.map((deg, i) => {
      const r = RADII[(i + 2) % RADII.length];
      return { ...polar(deg, r), key: `${deg}-${r}` };
    });
    return { runs: built, nodes: dots };
  }, []);

  return (
    <div className="authbg" aria-hidden="true">
      <div className="authbg__dots" />
      <svg className="authbg__signal" viewBox="0 0 100 100" preserveAspectRatio="none">
        {RADII.map((r) => (
          <circle key={r} className="authbg__arc" cx={ORIGIN.x} cy={ORIGIN.y} r={r} />
        ))}
        {runs.map((p, i) => (
          <line
            key={BEARINGS[i]}
            className="authbg__run"
            x1={ORIGIN.x} y1={ORIGIN.y} x2={p.x} y2={p.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {nodes.map((n) => (
          <circle key={n.key} className="authbg__node" cx={n.x} cy={n.y} r="0.55" />
        ))}
      </svg>
      <div className="authbg__glow" />
    </div>
  );
}
