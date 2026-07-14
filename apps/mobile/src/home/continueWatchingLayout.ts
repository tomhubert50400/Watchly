export type ContinueWatchingLayout = {
  artworkMinHeight: number;
  cardWidth: number;
  metaNumberOfLines: 1 | 2;
  titleNumberOfLines: 1 | 2;
};

export function resolveContinueWatchingLayout(fontScale: number): ContinueWatchingLayout {
  if (fontScale >= 2.8) {
    return {
      artworkMinHeight: 280,
      cardWidth: 320,
      metaNumberOfLines: 2,
      titleNumberOfLines: 2,
    };
  }

  if (fontScale >= 1.6) {
    return {
      artworkMinHeight: 210,
      cardWidth: 300,
      metaNumberOfLines: 2,
      titleNumberOfLines: 2,
    };
  }

  return {
    artworkMinHeight: 146,
    cardWidth: 266,
    metaNumberOfLines: 1,
    titleNumberOfLines: 1,
  };
}
