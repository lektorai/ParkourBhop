/** Иконки интерфейса: инлайновые SVG в одном стиле, со скруглёнными линиями. */
import type { ComponentChildren } from 'preact';

interface IconProps {
  class?: string;
}

function Stroke({ children, class: className }: IconProps & { children: ComponentChildren }) {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconBack = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M19 12H5.5" />
    <path d="M11 5.5 4.5 12l6.5 6.5" />
  </Stroke>
);

export const IconNext = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12h13.5" />
    <path d="M13 5.5l6.5 6.5-6.5 6.5" />
  </Stroke>
);

export const IconChevron = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 5.5l6.5 6.5L9 18.5" />
  </Stroke>
);

export const IconPlus = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" stroke-width="3.2" />
  </Stroke>
);

export const IconClose = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const IconCheck = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4.5 12.5l5 5L19.5 7" stroke-width="3" />
  </Stroke>
);

export const IconShuffle = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 7h3.5c2.2 0 3.6 1 4.8 2.8l1.4 2.4c1.2 1.800 2.600 2.800 4.800 2.800H21" />
    <path d="M3 17h3.500c1.500 0 2.600-.500 3.500-1.400M14.200 8.300c.900-.800 2-1.300 3.300-1.300H21" />
    <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
  </Stroke>
);

export const IconBulb = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 17.500h6" />
    <path d="M10 21h4" />
    <path d="M8.200 14.500A6.500 6.500 0 1 1 15.800 14.500c-.500.400-.800 1-.800 1.600V17.500H9v-1.400c0-.600-.300-1.200-.800-1.600z" />
  </Stroke>
);

export const IconErase = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M8.500 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.500a2 2 0 0 1-1.500-.700L2.500 12 7 5.700A2 2 0 0 1 8.500 5z" />
    <path d="M11.500 9.500l5 5M16.500 9.500l-5 5" />
  </Stroke>
);

export const IconGear = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="2.6" />
    <circle cx="12" cy="12" r="6.4" />
    <path
      d="M12 2.4v3.2M12 18.4v3.2M21.6 12h-3.2M5.6 12H2.4M18.8 5.2l-2.3 2.3M7.5 16.5l-2.3 2.3M18.8 18.8l-2.3-2.3M7.5 7.5L5.2 5.2"
      stroke-width="3.4"
    />
  </Stroke>
);

export const IconLock = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="10.500" width="14" height="10" rx="2.500" />
    <path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" />
  </Stroke>
);

export const IconGrid = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3.500" y="3.500" width="7" height="7" rx="1.800" />
    <rect x="13.500" y="3.500" width="7" height="7" rx="1.800" />
    <rect x="3.500" y="13.500" width="7" height="7" rx="1.800" />
    <rect x="13.500" y="13.500" width="7" height="7" rx="1.800" />
  </Stroke>
);

export const IconPalette = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.400 0 2-.900 2-1.800 0-1.700-1.200-1.900-1.200-3.200 0-1 .800-1.700 1.900-1.700H17a4 4 0 0 0 4-4C21 6.100 17 3 12 3z" />
    <circle cx="7.800" cy="11.500" r="1" />
    <circle cx="10.500" cy="7.500" r="1" />
    <circle cx="15" cy="7.500" r="1" />
  </Stroke>
);

export const IconCart = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 4h2.500l2.200 10.500h10.600L20.500 7.500H6.500" />
    <circle cx="9" cy="19" r="1.400" />
    <circle cx="17" cy="19" r="1.400" />
  </Stroke>
);

export const IconVideo = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10.200 9.200v5.600l4.800-2.800z" fill="currentColor" />
  </Stroke>
);

export const IconSound = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 9.500h3l4.500-4v13l-4.500-4H4z" />
    <path d="M15.500 9a4.500 4.500 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11" />
  </Stroke>
);

export const IconMusic = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 18V6l11-2.500v12" />
    <circle cx="6.500" cy="18" r="2.500" />
    <circle cx="17.500" cy="15.500" r="2.500" />
  </Stroke>
);

export const IconVibration = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="8" y="3.500" width="8" height="17" rx="2" />
    <path d="M4.500 9v6M19.500 9v6M2 10.500v3M22 10.500v3" />
  </Stroke>
);

export const IconHelp = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.500 9.500a2.600 2.600 0 1 1 3.700 2.400c-.800.400-1.200 1-1.200 1.900" />
    <path d="M12 17.200v.100" stroke-width="3" />
  </Stroke>
);

export const IconShield = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3l7.500 3v5.500c0 4.500-3 8-7.500 9.500-4.500-1.500-7.500-5-7.500-9.500V6z" />
    <path d="M9 12l2.200 2.200L15.200 10" />
  </Stroke>
);

export const IconInfo = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <path d="M12 7.300v.100" stroke-width="3" />
  </Stroke>
);

export const IconUser = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.500 20.500c.800-4 3.800-6 7.500-6s6.700 2 7.500 6" />
  </Stroke>
);

export const IconGift = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3.500" y="9" width="17" height="4" rx="1" />
    <path d="M5.500 13v7.500h13V13M12 9v11.500" />
    <path d="M12 9C9 9 7 7.800 7 6a2 2 0 0 1 2-2c2 0 3 2.500 3 5zM12 9c3 0 5-1.200 5-3a2 2 0 0 0-2-2c-2 0-3 2.500-3 5z" />
  </Stroke>
);

export const IconNoAds = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M4 20L20 4" />
  </Stroke>
);

/** Указатель для обучения. */
export const IconPointer = (p: IconProps) => (
  <svg class={p.class} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M9 11.500V4.800a1.800 1.800 0 0 1 3.600 0v5l5.600 1.100c1.300.300 2.200 1.500 2 2.900l-.700 4.700a4 4 0 0 1-4 3.500h-3.300a4 4 0 0 1-3.200-1.600l-4-5.400a1.700 1.700 0 0 1 2.500-2.300z"
      fill="currentColor"
      stroke="#333"
      stroke-width="1.200"
      stroke-linejoin="round"
    />
  </svg>
);

export function IconStar({ on, class: className }: IconProps & { on?: boolean }) {
  return (
    <svg class={`star${on ? ' on' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.600l2.800 5.900 6.400.800c.700.100 1 .900.500 1.400l-4.700 4.500 1.200 6.400c.100.700-.600 1.200-1.200.900L12 19.400l-5.700 3.100c-.600.300-1.300-.200-1.200-.900l1.200-6.400-4.700-4.500c-.500-.500-.200-1.300.500-1.400l6.400-.800z"
        fill="currentColor"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** Монета: золотой кружок со звездой, как на референсе. */
export function IconCoin({ class: className }: IconProps) {
  return (
    <svg class={`coin-icon${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.500" fill="#f6b21d" stroke="#c97a0a" stroke-width="1.500" />
      <circle cx="12" cy="12" r="7.600" fill="#fcd34d" />
      <path
        d="M12 6.800l1.500 3.200 3.500.400-2.600 2.400.700 3.500-3.100-1.700-3.100 1.700.700-3.500L7 10.400l3.500-.400z"
        fill="#f59e0b"
        stroke="#d97706"
        stroke-width=".600"
        stroke-linejoin="round"
      />
    </svg>
  );
}
