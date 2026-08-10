const FADE_STEPS = 24;

export const mediaHeroFadeColors = Array.from({ length: FADE_STEPS }, (_, index) => {
  const progress = index / (FADE_STEPS - 1);
  const opacity = Math.round(progress * progress * 1000) / 1000;
  return `rgba(9, 12, 19, ${opacity})`;
});

export const mediaHeroGradientStops = [
  { offset: '0', opacity: 0 },
  { offset: '0.46', opacity: 0.12 },
  { offset: '0.78', opacity: 0.72 },
  { offset: '0.94', opacity: 1 },
  { offset: '1', opacity: 1 },
] as const;
