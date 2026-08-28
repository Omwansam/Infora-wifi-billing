/**
 * The backdrop behind sign-in and sign-up.
 *
 * A port of FRONTEND/infora_billing/src/components/brand/AuthBackdrop.jsx, and
 * it carries the same argument: instead of the dot constellation every SaaS
 * login has, it draws something that means something for this product — signal
 * propagating from a mast, and the distribution runs that hang off it.
 *
 *   · concentric arcs radiate from a single origin off the lower-left corner,
 *     the way coverage does;
 *   · straight runs leave that origin at fixed bearings, with a subscriber node
 *     dropped where each run crosses an arc — so the nodes sit on real geometry
 *     rather than at random, which is what stops it reading as decoration;
 *   · the texture underneath is a dot matrix, not a ruled grid.
 *
 * The web version stretches a 100x100 viewBox with preserveAspectRatio="none".
 * That is not portable here: react-native-svg has no `vector-effect`, so a
 * non-uniform stretch would thin the strokes along one axis and thicken them
 * along the other. Geometry is computed in real pixels from the window size
 * instead, which keeps every stroke honest at any screen shape.
 */
import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { AuthPalette } from '@/lib/auth-theme';

// Arc radii as multiples of a base unit. Spacing widens outward the way real
// propagation rings do rather than stepping evenly.
const RADII = [24, 38, 55, 75, 98, 124, 153];
// Bearings of the distribution runs, in degrees anticlockwise from east.
const BEARINGS = [12, 27, 44, 62, 78];
const DOT_SPACING = 22;

export function AuthBackdrop({ palette }: { palette: AuthPalette }) {
  const { width, height } = useWindowDimensions();

  const { origin, unit, runs, nodes } = useMemo(() => {
    // Off-canvas, lower left — the same relative position as the web version.
    const o = { x: -0.12 * width, y: 1.12 * height };
    const u = Math.hypot(width, height) / 100;

    const polar = (deg: number, r: number) => {
      const rad = (deg * Math.PI) / 180;
      return { x: o.x + Math.cos(rad) * r * u, y: o.y - Math.sin(rad) * r * u };
    };

    const outer = RADII[RADII.length - 1] + 20;
    const built = BEARINGS.map((deg) => polar(deg, outer));
    // One node per run, on a different ring each time, so the eye reads a
    // sequence of hops rather than a row.
    const dots = BEARINGS.map((deg, i) => {
      const r = RADII[(i + 2) % RADII.length];
      return { ...polar(deg, r), key: `${deg}-${r}` };
    });
    return { origin: o, unit: u, runs: built, nodes: dots };
  }, [width, height]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="authDots"
            x="0"
            y="0"
            width={DOT_SPACING}
            height={DOT_SPACING}
            patternUnits="userSpaceOnUse">
            <Circle cx="1" cy="1" r="1" fill={palette.dot} />
          </Pattern>
          <RadialGradient id="authGlow" cx="0.12" cy="0.9" r="0.85">
            <Stop offset="0" stopColor={palette.accent} stopOpacity="0.16" />
            <Stop offset="0.55" stopColor={palette.accent} stopOpacity="0.05" />
            <Stop offset="1" stopColor={palette.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={width} height={height} fill="url(#authDots)" opacity={0.55} />

        {RADII.map((r) => (
          <Circle
            key={r}
            cx={origin.x}
            cy={origin.y}
            r={r * unit}
            fill="none"
            stroke={palette.accent}
            strokeWidth={1}
            opacity={0.14}
          />
        ))}

        {runs.map((p, i) => (
          <Line
            key={BEARINGS[i]}
            x1={origin.x}
            y1={origin.y}
            x2={p.x}
            y2={p.y}
            stroke={palette.accent}
            strokeWidth={1}
            opacity={0.1}
          />
        ))}

        {nodes.map((n) => (
          <Circle key={n.key} cx={n.x} cy={n.y} r={2.4} fill={palette.accent} opacity={0.5} />
        ))}

        <Rect x="0" y="0" width={width} height={height} fill="url(#authGlow)" />
      </Svg>
    </View>
  );
}
