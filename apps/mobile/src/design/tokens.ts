export const colors = {
  accent: '#E11D48',
  accentPressed: '#BE123C',
  background: '#10131C',
  border: '#2A2F3B',
  danger: '#FF6B7A',
  dangerBackground: '#2A1018',
  muted: '#9CA3AF',
  panel: '#141720',
  panelElevated: '#1B1F2A',
  panelSoft: '#111C24',
  secondary: '#6D6AF7',
  success: '#2AD181',
  successBackground: '#0D251B',
  text: '#F8FAFC',
  textOnAccent: '#FFFFFF',
} as const;

export const radii = {
  sm: 8,
  md: 8,
  lg: 8,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const typography = {
  body: {
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 23,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 38,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 25,
  },
} as const;

export const shadows = {
  panel: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
  },
} as const;
