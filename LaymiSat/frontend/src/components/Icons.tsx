/** Íconos propios (trazo 2 px, 24×24, currentColor). Ver docs/ESTILO.md › Íconos. */
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Helada (AHS) */
export const FrostIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5" />
    <path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2" />
  </Svg>
)

/** Agua / lluvia (AEH) */
export const DropIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.5S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0c0-4.4-6.5-11.5-6.5-11.5Z" />
  </Svg>
)

/** Calendario ancestral (ADS) */
export const CalendarIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
)

export const ArrowDownIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </Svg>
)

export const PrintIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </Svg>
)

export const PinIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
)

export const ALERT_ICONS = { AHS: FrostIcon, AEH: DropIcon, ADS: CalendarIcon } as const
