const FADE_STEPS = 24;

export const mediaHeroFadeColors = Array.from({ length: FADE_STEPS }, (_, index) => {
  const progress = index / (FADE_STEPS - 1);
  const opacity = Math.round(progress * progress * 1000) / 1000;
  return `rgba(9, 12, 19, ${opacity})`;
});
