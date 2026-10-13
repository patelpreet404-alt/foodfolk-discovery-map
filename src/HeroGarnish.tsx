import type { PointerEvent } from 'react'

/**
 * Decorative dimensional garnish that floats around the hero food art.
 * Each piece is a hand-drawn SVG that echoes the burnt-orange print palette
 * and creates a tangible sense of depth around the central bowl.
 */
type Piece = {
  id: string
  className: string
  variant: 'lime' | 'half' | 'wedge' | 'leaf' | 'sprig' | 'peel'
}

const pieces: Piece[] = [
  { id: 'g1', className: 'garnish g-lime-top', variant: 'lime' },
  { id: 'g2', className: 'garnish g-half-bottom', variant: 'half' },
  { id: 'g3', className: 'garnish g-leaf-left', variant: 'leaf' },
  { id: 'g4', className: 'garnish g-sprig-right', variant: 'sprig' },
  { id: 'g5', className: 'garnish g-wedge-tl', variant: 'wedge' },
  { id: 'g6', className: 'garnish g-peel-tr', variant: 'peel' },
]

function Lime() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="g-lime" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#e9a579" />
          <stop offset="55%" stopColor="#D5360C" />
          <stop offset="100%" stopColor="#7c240b" />
        </radialGradient>
        <radialGradient id="g-lime-spot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#101010" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <ellipse cx="62" cy="105" rx="42" ry="6" fill="#101010" opacity="0.32" />
      <circle cx="60" cy="58" r="46" fill="url(#g-lime)" />
      {[18, 30, 44, 55, 70, 78].map((cx, i) => (
        <ellipse key={i} cx={cx} cy={36 + (i % 3) * 20} rx="3" ry="2.2" fill="#101010" opacity={0.55 - i * 0.05} />
      ))}
      <ellipse cx="50" cy="44" rx="14" ry="9" fill="#E6D5BD" opacity="0.28" />
      <ellipse cx="52" cy="68" rx="6" ry="3" fill="url(#g-lime-spot)" opacity="0.35" />
    </svg>
  )
}

function Half() {
  return (
    <svg viewBox="0 0 140 140" aria-hidden="true">
      <defs>
        <radialGradient id="g-half" cx="48%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#e6b394" />
          <stop offset="50%" stopColor="#D5360C" />
          <stop offset="100%" stopColor="#7c240b" />
        </radialGradient>
      </defs>
      <ellipse cx="70" cy="124" rx="46" ry="6" fill="#101010" opacity="0.32" />
      <path d="M14 70 A56 56 0 0 1 126 70 Z" fill="#ab390f" />
      <path d="M22 70 A48 48 0 0 1 118 70 Z" fill="url(#g-half)" />
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI
        return <line key={i} x1="70" y1="70" x2={70 + 46 * Math.cos(a)} y2={70 + 46 * Math.sin(a)} stroke="#7c240b" strokeWidth="1.4" opacity="0.6" />
      })}
      <ellipse cx="60" cy="48" rx="12" ry="7" fill="#E6D5BD" opacity="0.32" />
    </svg>
  )
}

function Wedge() {
  return (
    <svg viewBox="0 0 110 110" aria-hidden="true">
      <ellipse cx="55" cy="95" rx="34" ry="5" fill="#101010" opacity="0.3" />
      <path d="M12 78 L98 78 L75 14 Z" fill="#D5360C" />
      <path d="M18 75 L92 75 L72 22 Z" fill="#e6b394" />
      <path d="M55 75 L72 75 L72 25 Z" fill="#e58a53" />
      {[24, 36, 48, 60].map((y, i) => (
        <line key={i} x1="22" y1={y} x2={88 - i * 2} y2={y} stroke="#ab390f" strokeWidth="0.8" opacity="0.6" />
      ))}
    </svg>
  )
}

function Leaf() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <defs>
        <linearGradient id="g-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a0300c" />
          <stop offset="50%" stopColor="#D5360C" />
          <stop offset="100%" stopColor="#75220a" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="100" rx="56" ry="5" fill="#101010" opacity="0.32" />
      <path d="M16 64 C 30 6, 130 6, 144 64 C 130 110, 30 110, 16 64 Z" fill="url(#g-leaf)" />
      <path d="M22 64 C 80 36, 80 36, 138 64" stroke="#75220a" strokeWidth="2" fill="none" opacity="0.7" />
      {[30, 46, 62, 78, 94].map((y, i) => (
        <path key={i} d={`M28 ${y} Q 80 ${y - 10} 132 ${y}`} stroke="#75220a" strokeWidth="1" fill="none" opacity={0.5 - i * 0.05} />
      ))}
      <ellipse cx="60" cy="50" rx="14" ry="6" fill="#E6D5BD" opacity="0.18" />
    </svg>
  )
}

function Sprig() {
  return (
    <svg viewBox="0 0 180 200" aria-hidden="true">
      <defs>
        <linearGradient id="g-sprig" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D5360C" />
          <stop offset="100%" stopColor="#75220a" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="190" rx="32" ry="4" fill="#101010" opacity="0.32" />
      <path d="M88 188 Q 92 110 88 22" stroke="#75220a" strokeWidth="3" fill="none" />
      {[
        { y: 30, side: -1, size: 1 },
        { y: 55, side: 1, size: 1.1 },
        { y: 80, side: -1, size: 1 },
        { y: 110, side: 1, size: 1.05 },
        { y: 140, side: -1, size: 0.95 },
        { y: 168, side: 1, size: 0.9 },
      ].map((p, i) => (
        <g key={i} transform={`translate(88 ${p.y}) scale(${p.size})`}>
          <path
            d={`M0 0 Q ${p.side * 30} -10 ${p.side * 50} -22`}
            stroke="url(#g-sprig)"
            strokeWidth="2"
            fill="none"
            opacity="0.9"
          />
          <ellipse
            cx={p.side * 50}
            cy={-22}
            rx={22 * p.size}
            ry={11 * p.size}
            fill="#a0300c"
            transform={`rotate(${-25 * p.side} ${p.side * 50} -22)`}
          />
          <ellipse
            cx={p.side * 50}
            cy={-24}
            rx={12 * p.size}
            ry={5 * p.size}
            fill="#e69b67"
            transform={`rotate(${-25 * p.side} ${p.side * 50} -22)`}
            opacity="0.7"
          />
        </g>
      ))}
    </svg>
  )
}

function Peel() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="g-peel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6b394" />
          <stop offset="100%" stopColor="#D5360C" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="34" ry="4" fill="#101010" opacity="0.3" />
      <path d="M20 76 C 30 30, 92 20, 102 78 L 86 92 C 78 70, 44 64, 30 88 Z" fill="url(#g-peel)" />
      <path d="M22 72 C 50 50, 86 50, 100 76" stroke="#ab390f" strokeWidth="1" fill="none" opacity="0.7" />
    </svg>
  )
}

function Piece({ variant }: { variant: Piece['variant'] }) {
  if (variant === 'lime') return <Lime />
  if (variant === 'half') return <Half />
  if (variant === 'wedge') return <Wedge />
  if (variant === 'leaf') return <Leaf />
  if (variant === 'sprig') return <Sprig />
  return <Peel />
}

/** Renders floating dimensional garnish around the hero plate. */
export default function HeroGarnish() {
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = event.currentTarget.parentElement
    if (!root) return
    const bounds = root.getBoundingClientRect()
    root.style.setProperty('--hero-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 8}deg`)
    root.style.setProperty('--hero-y', `${(0.5 - (event.clientY - bounds.top) / bounds.height) * 6}deg`)
  }
  const reset = (event: PointerEvent<HTMLDivElement>) => {
    const root = event.currentTarget.parentElement
    if (!root) return
    root.style.setProperty('--hero-x', '0deg')
    root.style.setProperty('--hero-y', '0deg')
  }
  return (
    <div className="hero-garnish" aria-hidden="true">
      {pieces.map((p) => (
        <div key={p.id} className={p.className} onPointerMove={tilt} onPointerLeave={reset}>
          <Piece variant={p.variant} />
        </div>
      ))}
    </div>
  )
}
