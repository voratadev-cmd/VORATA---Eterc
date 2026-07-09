import type { CSSProperties, ReactNode } from "react";

export type IconProps = {
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

type InternalIconProps = IconProps & { path: string | ReactNode };

export function Icon({
  path,
  size = 18,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 1.75,
  style,
  className,
  ...aria
}: InternalIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      {...aria}
    >
      {typeof path === "string" ? <path d={path} /> : path}
    </svg>
  );
}

type IconFn = (p?: IconProps) => ReactNode;

export const I: Record<string, IconFn> = {
  // ── Navegação ──
  home: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2z" />
        </>
      }
    />
  ),
  wallet: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M3 10h18M17 15h2" />
        </>
      }
    />
  ),
  calendar: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </>
      }
    />
  ),
  check: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="m8 12 3 3 5-6" />
        </>
      }
    />
  ),
  note: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4z" />
          <path d="M16 4v4h4M8 13h8M8 17h5" />
        </>
      }
    />
  ),
  cart: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M3 4h2l2.5 12h11L21 8H6" />
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="17" cy="20" r="1.4" />
        </>
      }
    />
  ),
  lock: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      }
    />
  ),
  logout: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </>
      }
    />
  ),
  doc: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M15 3v4h4" />
        </>
      }
    />
  ),
  heart: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </>
      }
    />
  ),
  house: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 21V12h6v9" />
        </>
      }
    />
  ),
  book: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
          <path d="M4 17a3 3 0 0 1 3-3h11" />
        </>
      }
    />
  ),
  users: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 11a3 3 0 0 0 0-6" />
          <path d="M21 20a5.5 5.5 0 0 0-4-5.3" />
        </>
      }
    />
  ),
  plane: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
        </>
      }
    />
  ),
  settings: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      }
    />
  ),

  // ── Topbar ──
  search: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      }
    />
  ),
  plus: (p) => <Icon {...p} path="M12 5v14M5 12h14" />,
  bell: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </>
      }
    />
  ),
  sun: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      }
    />
  ),
  moon: (p) => <Icon {...p} path="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  menu: (p) => <Icon {...p} path="M4 6h16M4 12h16M4 18h16" />,

  // ── Ações ──
  chevDown: (p) => <Icon {...p} path="m6 9 6 6 6-6" />,
  chevRight: (p) => <Icon {...p} path="m9 6 6 6-6 6" />,
  chevLeft: (p) => <Icon {...p} path="m15 6-6 6 6 6" />,
  chevUp: (p) => <Icon {...p} path="m6 15 6-6 6 6" />,
  arrowUp: (p) => <Icon {...p} path="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: (p) => <Icon {...p} path="M12 5v14M19 12l-7 7-7-7" />,
  arrowRight: (p) => <Icon {...p} path="M5 12h14M12 5l7 7-7 7" />,
  arrowLeft: (p) => <Icon {...p} path="M19 12H5M12 19l-7-7 7-7" />,
  download: (p) => <Icon {...p} path="M12 3v12M8 11l4 4 4-4M5 21h14" />,
  chevron: (p) => <Icon {...p} path="m6 9 6 6 6-6" />,
  trendUp: (p) => <Icon {...p} path="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  trendDown: (p) => <Icon {...p} path="M3 7l6 6 4-4 8 8M14 17h7v-7" />,
  repeat: (p) => (
    <Icon
      {...p}
      path="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"
    />
  ),
  close: (p) => <Icon {...p} path="M18 6 6 18M6 6l12 12" />,
  more: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </>
      }
    />
  ),
  moreV: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </>
      }
    />
  ),
  filter: (p) => <Icon {...p} path="M3 5h18l-7 9v6l-4-2v-4L3 5z" />,
  pin: (p) => <Icon {...p} path="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z" />,
  trash: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
          <path d="M10 11v7M14 11v7" />
        </>
      }
    />
  ),
  edit: (p) => <Icon {...p} path="M4 20h4l11-11-4-4L4 16zM14 6l4 4" />,
  eye: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
    />
  ),
  eyeOff: (p) => (
    <Icon
      {...p}
      path="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 22 12c-.7 1.3-1.7 2.6-2.9 3.6M6.1 6.1A10.6 10.6 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.3 4.3-.9M9.9 9.9a3 3 0 1 0 4.2 4.2"
    />
  ),
  copy: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </>
      }
    />
  ),
  share: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </>
      }
    />
  ),
  link: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </>
      }
    />
  ),
  pkg: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7M3 7l9 4 9-4M12 11v10" />
        </>
      }
    />
  ),
  tag: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L3 13.3V4h9.3l7.7 7.7a2 2 0 0 1 0 .8z" />
          <circle cx="8" cy="9" r="1.2" />
        </>
      }
    />
  ),
  pill: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)" />
          <path d="m8.5 8.5 7 7" />
        </>
      }
    />
  ),
  stethoscope: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M6 3v6a4 4 0 0 0 8 0V3M9 21a4 4 0 0 0 4-4v-2M9 21a4 4 0 0 1-4-4v-2" />
          <circle cx="17" cy="14" r="2" />
        </>
      }
    />
  ),
  trending: (p) => <Icon {...p} path="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  fire: (p) => (
    <Icon
      {...p}
      path="M12 22a6 6 0 0 0 6-6c0-3-2-5-3-7-1 2-3 3-3 5 0-2-2-3-2-5-2 2-4 4-4 7a6 6 0 0 0 6 6z"
    />
  ),
  star: (p) => (
    <Icon {...p} path="m12 3 2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 18l-5.9 3.1L7.3 14.6 2.5 9.9 9.1 9z" />
  ),
  // glifo da IA (chat) — sparkle de 4 pontas arredondado
  sparkle: (p) => (
    <Icon
      {...p}
      path="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"
    />
  ),
  // parar geração (chat) — quadrado de cantos suaves
  stop: (p) => <Icon {...p} path="M7 7h10v10H7z" />,
  // toggle de painel lateral (recolher/abrir threads do chat)
  panelLeft: (p) => (
    <Icon
      {...p}
      path="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18"
    />
  ),
  // toggle do painel direito (resumo de dados-chave do chat)
  panelRight: (p) => (
    <Icon
      {...p}
      path="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v18"
    />
  ),
  // balão de conversa (item de nav do Chat) — com 2 pontos
  chat: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="13" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="17" cy="10" r="1" fill="currentColor" stroke="none" />
        </>
      }
    />
  ),
  gift: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="3" y="8" width="18" height="4" />
          <rect x="4" y="12" width="16" height="10" />
          <path d="M12 8v14M12 8s-3-5-5-3 1 4 5 3zM12 8s3-5 5-3-1 4-5 3z" />
        </>
      }
    />
  ),
  utensils: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v6M7 3v6M15 3c0 4 1 6 4 6v12" />
        </>
      }
    />
  ),
  film: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 8h18M3 16h18M8 3v18M16 3v18" />
        </>
      }
    />
  ),
  map: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M3 6v14l6-3 6 3 6-3V3l-6 3-6-3-6 3z" />
          <path d="M9 3v15M15 6v15" />
        </>
      }
    />
  ),
  shield: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z" />
          <path d="m9 12 2 2 4-4" />
        </>
      }
    />
  ),
  laptop: (p) => (
    <Icon
      {...p}
      path={
        <>
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M2 20h20" />
        </>
      }
    />
  ),
  car: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M5 16h14l-2-7H7zM3 16v4M21 16v4M3 16h18" />
          <circle cx="7" cy="20" r="1.5" />
          <circle cx="17" cy="20" r="1.5" />
        </>
      }
    />
  ),
  clock: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      }
    />
  ),
  user: (p) => (
    <Icon
      {...p}
      path={
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      }
    />
  ),
  flag: (p) => (
    <Icon
      {...p}
      path={
        <>
          <path d="M4 22V4M4 4h12l-2 4 2 4H4" />
        </>
      }
    />
  ),
};

export type IconName = keyof typeof I;
