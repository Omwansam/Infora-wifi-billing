/**
 * The Lumen mark and wordmark.
 *
 * Ported from FRONTEND/infora_billing/src/components/brand/LumenLogo.jsx: a
 * rounded tile with the amber→violet gradient, two WiFi arcs, and the stylised
 * `L` light beam.
 *
 * Two things could not come across as-is. react-native-svg has no filter
 * primitives, so the beam's Gaussian glow is drawn as a wider, low-opacity
 * stroke underneath it — same read, no filter. And React Native cannot clip
 * text to a gradient, so the wordmark is solid rather than `bg-clip-text`; the
 * gradient stays where it is legible at 56px, on the tile.
 */
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { mono } from '@/lib/auth-theme';

export function LumenMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="lumenBg" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F59E0B" />
          <Stop offset="0.45" stopColor="#F97316" />
          <Stop offset="1" stopColor="#8B5CF6" />
        </LinearGradient>
        <LinearGradient id="lumenBeam" x1="32" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#FEF3C7" />
          <Stop offset="0.5" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#A5F3FC" stopOpacity="0.9" />
        </LinearGradient>
        <LinearGradient id="lumenRing" x1="12" y1="52" x2="52" y2="12" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#22D3EE" />
          <Stop offset="1" stopColor="#A78BFA" />
        </LinearGradient>
      </Defs>

      <Rect x="4" y="4" width="56" height="56" rx="16" fill="url(#lumenBg)" />
      <Rect
        x="4.5"
        y="4.5"
        width="55"
        height="55"
        rx="15.5"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
        fill="none"
      />

      {/* WiFi signal arcs */}
      <Path
        d="M18 38 C22 30, 42 30, 46 38"
        stroke="url(#lumenRing)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M22 42 C25 36, 39 36, 42 42"
        stroke="url(#lumenRing)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity={0.65}
      />

      {/* Light beam — stylised L. The wide pass underneath stands in for the
          Gaussian glow the web mark gets from an SVG filter. */}
      <Path
        d="M26 18 L26 46 L40 46"
        stroke="#FFFFFF"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.14}
      />
      <Path
        d="M26 18 L26 46 L40 46"
        stroke="url(#lumenBeam)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="32" cy="18" r="6.5" fill="#FEF9C3" opacity={0.25} />
      <Circle cx="32" cy="18" r="4" fill="#FEF9C3" />
      <Path
        d="M32 8 L32 14 M26 10 L30 14 M38 10 L34 14"
        stroke="#FDE68A"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.9}
      />
    </Svg>
  );
}

interface LumenLogoProps {
  size?: number;
  /** Wordmark colour — pass the scope's `text` token. */
  color: string;
  /** Tagline colour — pass the scope's `accent` or `textDim`. */
  subtitleColor: string;
  subtitle?: string;
  orientation?: 'vertical' | 'horizontal';
}

export function LumenLogo({
  size = 56,
  color,
  subtitleColor,
  subtitle = 'WiFi Billing',
  orientation = 'vertical',
}: LumenLogoProps) {
  const vertical = orientation === 'vertical';
  return (
    <View
      style={{
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: vertical ? 10 : 12,
      }}>
      <LumenMark size={size} />
      <View style={{ alignItems: vertical ? 'center' : 'flex-start' }}>
        <Text
          style={{
            color,
            fontSize: size >= 48 ? 26 : 17,
            fontWeight: '800',
            letterSpacing: -0.5,
          }}>
          Lumen
        </Text>
        {subtitle ? (
          <Text
            style={{
              ...mono,
              color: subtitleColor,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 2.2,
              marginTop: 3,
            }}>
            {subtitle.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
