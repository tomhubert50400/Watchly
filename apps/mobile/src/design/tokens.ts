export const colors = {
  accent: '#D43A5C',
  accentBorder: 'rgba(212, 58, 92, 0.42)',
  accentPressed: '#B92A4C',
  accentSoft: 'rgba(212, 58, 92, 0.14)',
  accentText: '#FFB8C7',
  background: '#090C13',
  border: 'rgba(255, 255, 255, 0.11)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  danger: '#FF7888',
  dangerBorder: 'rgba(255, 120, 136, 0.36)',
  dangerBackground: 'rgba(255, 120, 136, 0.13)',
  muted: '#A2AAB8',
  overlay: 'rgba(9, 12, 19, 0.72)',
  panel: '#0F131D',
  panelElevated: '#151A25',
  panelSoft: '#111822',
  rating: '#D43A5C',
  ratingBorder: 'rgba(212, 58, 92, 0.42)',
  ratingSoft: 'rgba(212, 58, 92, 0.14)',
  ratingText: '#FFB8C7',
  segmentSelected: '#1B1E26',
  segmentSelectedBorder: 'rgba(255, 255, 255, 0.10)',
  segmentSelectedText: '#F7F8FA',
  secondary: '#7672F0',
  success: '#4CDB99',
  successBorder: 'rgba(76, 219, 153, 0.34)',
  successBackground: 'rgba(76, 219, 153, 0.13)',
  text: '#F6F7FB',
  textMuted: '#C8CFDB',
  textOnAccent: '#FFF7FA',
  textSubtle: '#7F8796',
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
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

export const touchTargets = {
  min: 44,
} as const;

export const typography = {
  body: {
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 23,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 37,
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 25,
  },
} as const;

export const shadows = {
  panel: {
    elevation: 4,
    shadowColor: '#02040A',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
  },
  raised: {
    elevation: 8,
    shadowColor: '#02040A',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
  },
} as const;
