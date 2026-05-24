/**
 * KITMark — SeKondBrain brand logomark for Kanvas for Kit
 *
 * Accurate SVG recreation of the brand mark:
 *   • Gradient sphere  (blue → purple → magenta)
 *   • 300° aurora arc  (blue → purple → magenta → peach)
 *   • Three lilac dots in the gap (ascending diagonal)
 *
 * Animated states (from brand book §Motion):
 *   idle     — static
 *   thinking — dots pulse in staggered sequence
 *   working  — aurora ring rotates
 *   speaking — sphere emits concentric pulse rings
 */

import React from 'react';

export type KITMarkState = 'idle' | 'thinking' | 'working' | 'speaking';

interface KITMarkProps {
  /** Diameter in px (default 32) */
  size?: number;
  state?: KITMarkState;
  className?: string;
}

export function KITMark({ size = 32, state = 'idle', className = '' }: KITMarkProps): React.ReactElement {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="KIT"
      role="img"
    >
      <defs>
        {/* Sphere: radial gradient, blue highlight top-left → purple → magenta edge */}
        <radialGradient id={`sg-${id}`} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#5FC4F0" />
          <stop offset="30%" stopColor="#1A8AF6" />
          <stop offset="65%" stopColor="#8B78F5" />
          <stop offset="100%" stopColor="#E24AF2" />
        </radialGradient>

        {/* Aurora ring: linear gradient following arc direction (NE → NW clockwise through S) */}
        <linearGradient id={`rg-${id}`} x1="85%" y1="5%" x2="15%" y2="92%">
          <stop offset="0%" stopColor="#1A8AF6" />
          <stop offset="28%" stopColor="#8B78F5" />
          <stop offset="58%" stopColor="#E24AF2" />
          <stop offset="100%" stopColor="#F28B68" />
        </linearGradient>

        {/* Clip for working-state ring rotation (rotate around center) */}
        {state === 'working' && (
          <style>{`
            @keyframes kit-ring-rotate {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            .kit-ring-${id} {
              transform-origin: 50px 50px;
              animation: kit-ring-rotate 2.8s linear infinite;
            }
          `}</style>
        )}
        {state === 'thinking' && (
          <style>{`
            @keyframes kit-dot-pulse {
              0%, 100% { transform: scale(1);   opacity: 0.75; }
              50%       { transform: scale(1.55) translateY(-2px); opacity: 1; }
            }
            .kit-dot1-${id} { transform-origin: 26px 20px; animation: kit-dot-pulse 1.6s ease-in-out infinite 0.0s; }
            .kit-dot2-${id} { transform-origin: 36px 12px; animation: kit-dot-pulse 1.6s ease-in-out infinite 0.2s; }
            .kit-dot3-${id} { transform-origin: 46px  6px; animation: kit-dot-pulse 1.6s ease-in-out infinite 0.4s; }
          `}</style>
        )}
        {state === 'speaking' && (
          <style>{`
            @keyframes kit-pulse-out {
              0%   { transform: scale(1);   opacity: 0.55; }
              100% { transform: scale(2.0); opacity: 0; }
            }
            .kit-pulse1-${id} { transform-origin: 50px 50px; animation: kit-pulse-out 2.4s ease-out infinite 0.0s; }
            .kit-pulse2-${id} { transform-origin: 50px 50px; animation: kit-pulse-out 2.4s ease-out infinite 0.8s; }
            .kit-pulse3-${id} { transform-origin: 50px 50px; animation: kit-pulse-out 2.4s ease-out infinite 1.6s; }
          `}</style>
        )}
      </defs>

      {/* ── Speaking: pulse rings behind sphere ── */}
      {state === 'speaking' && (
        <>
          <circle cx="50" cy="50" r="22" fill="none" stroke="#8B78F5" strokeWidth="2" className={`kit-pulse1-${id}`} />
          <circle cx="50" cy="50" r="22" fill="none" stroke="#1A8AF6" strokeWidth="2" className={`kit-pulse2-${id}`} />
          <circle cx="50" cy="50" r="22" fill="none" stroke="#E24AF2" strokeWidth="2" className={`kit-pulse3-${id}`} />
        </>
      )}

      {/* ── Aurora ring (300° arc, gap at top-left) ── */}
      {/*  Start at ~40° from top (1 o'clock):  x=50+42*sin40=77, y=50-42*cos40=18  */}
      {/*  End   at ~320° from top (11 o'clock): x=50+42*sin(-40)=23, y=50-42*cos40=18 */}
      <path
        d="M 77 18 A 42 42 0 1 1 23 18"
        fill="none"
        stroke={`url(#rg-${id})`}
        strokeWidth="9"
        strokeLinecap="round"
        className={state === 'working' ? `kit-ring-${id}` : undefined}
      />

      {/* ── Sphere ── */}
      <circle cx="50" cy="52" r="23" fill={`url(#sg-${id})`} />

      {/* ── Three lilac dots in the gap (ascending from lower-left to upper-right) ── */}
      <circle cx="26" cy="20" r="4.0" fill="#A88AF8" opacity="0.92" className={state === 'thinking' ? `kit-dot1-${id}` : undefined} />
      <circle cx="36" cy="12" r="2.8" fill="#A88AF8" opacity="0.78" className={state === 'thinking' ? `kit-dot2-${id}` : undefined} />
      <circle cx="46" cy="7"  r="2.0" fill="#A88AF8" opacity="0.62" className={state === 'thinking' ? `kit-dot3-${id}` : undefined} />
    </svg>
  );
}

/**
 * KITMarkContainer — wraps KITMark in a light paper background circle
 * matching the sidebar icon rail aesthetic.
 */
export function KITMarkContainer({
  size = 36,
  state = 'idle',
  className = '',
}: KITMarkProps): React.ReactElement {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <KITMark size={Math.round(size * 0.72)} state={state} />
    </div>
  );
}
