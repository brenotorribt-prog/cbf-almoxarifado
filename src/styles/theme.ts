export const theme = {
  colors: {
    primary: {
      deep: '#193375',
      vivid: '#0a67c1',
      light: '#dde3f4',
      lightHover: '#c8d1ed',
    },
    accent: {
      yellow: '#ffdc02',
      yellowDark: '#CCB002',
      green: '#19AE47',
      greenDark: '#006E29',
    },
    neutral: {
      white: '#ffffff',
      50: '#f7f8fc',
      100: '#eef0f7',
      200: '#dde3f4',
      300: '#b8c3e0',
      400: '#8a9cc4',
      500: '#5c72a0',
      600: '#3d5585',
      700: '#295082',
      800: '#1e3a63',
      900: '#122444',
      black: '#0a1628',
    },
    status: {
      success: '#00B347',
      successBg: 'rgba(0,179,71,0.12)',
      successBorder: 'rgba(0,179,71,0.3)',

      warning: '#FFDC02',
      warningBg: 'rgba(255,220,2,0.12)',
      warningBorder: 'rgba(255,220,2,0.3)',

      error: '#E53935',
      errorBg: 'rgba(229,57,53,0.12)',
      errorBorder: 'rgba(229,57,53,0.3)',

      info: '#3D7DFF',
      infoBg: 'rgba(61,125,255,0.12)',
      infoBorder: 'rgba(61,125,255,0.3)',

      purple: '#a78bfa',
      purpleBg: 'rgba(167,139,250,0.12)',
      purpleBorder: 'rgba(167,139,250,0.3)',
    },
    // Cor "de marca" por especialidade. Usada como fallback quando a API
    // não retorna uma `specialty.color` própria. Trocar de cliente = trocar
    // só este objeto (ou os valores que vierem do backend).
    specialty: {
      ELECTRICIAN: '#3D7DFF',
      REFRIGERATION: '#60b8d4',
      MECHANIC: '#a78bfa',
      HYDRAULIC: '#00B347',
      PAINTER: '#FFDC02',
      CIVIL: '#8a9cc4',
      IT_TECHNICIAN: '#00B347',
      GENERAL: '#5c72a0',
    } as Record<string, string>,
    // Paleta usada para gerar a cor de avatar de cada usuário (hash do id).
    // Centralizada aqui para que outro cliente possa ter sua própria
    // paleta sem precisar tocar em nenhuma página.
    avatarPalette: [
      '#295082', '#0a67c1', '#5c72a0', '#5a9160',
      '#8a9cc4', '#3d5585', '#c9a800', '#2e8b7a',
    ] as string[],
    surface: {
      background: '#060d1f',
      card: 'rgba(3,7,18,0.82)',
      sidebar: '#0a1628',
      sidebarActive: '#1e3a63',
      header: '#0a1628',
      border: 'rgba(255,255,255,0.06)',
      borderStrong: 'rgba(109,191,160,0.3)',
      overlay: 'rgba(3,7,18,0.7)',
      glass: 'rgba(255,255,255,0.04)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255,255,255,0.7)',
      muted: 'rgba(255,255,255,0.35)',
      onDark: '#ffffff',
      onDarkMuted: 'rgba(255,255,255,0.45)',
      link: '#009c3b',
      linkHover: '#8ed4b8',
    },
  },
  typography: {
    fontFamily: {
      sans: "var(--font-inter), 'Segoe UI', sans-serif",
      mono: "var(--font-jetbrains), 'Fira Code', monospace",
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  spacing: {
    px: '1px',
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
  },
  radii: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },
  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.3)',
    sm: '0 2px 4px rgba(0,0,0,0.4)',
    md: '0 4px 12px rgba(0,0,0,0.5)',
    lg: '0 8px 24px rgba(0,0,0,0.5)',
    xl: '0 16px 40px rgba(0,0,0,0.6)',
    card: '0 4px 24px rgba(0,0,0,0.4)',
    cardHover: '0 0 0 1px rgba(109,191,160,0.3), 0 0 32px rgba(109,191,160,0.15), 0 16px 48px rgba(0,0,0,0.5)',
    sidebar: '4px 0 32px rgba(0,0,0,0.5)',
  },
  transitions: {
    fast: '100ms ease',
    base: '200ms ease',
    slow: '350ms ease',
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  zIndex: {
    base: 0,
    raised: 10,
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  layout: {
    sidebarWidth: '260px',
    sidebarCollapsed: '72px',
    headerHeight: '64px',
    maxWidth: '1440px',
    contentPadding: '2rem',
  },
} as const

export type Theme = typeof theme

// Helper de cor — gera rgba a partir de qualquer hex do tema
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}