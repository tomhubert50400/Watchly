export type DynamicTypeLayout = {
  headerStacked: boolean;
  headerTitleMaxFontSizeMultiplier?: number;
  segmentMinHeight: number;
  segmentNumberOfLines: 1 | 2;
  segmentStacked: boolean;
};

export type DetailMetadataLayout = {
  genreNumberOfLines: 1 | 2;
};

export function resolveDetailMetadataLayout(fontScale: number): DetailMetadataLayout {
  return { genreNumberOfLines: fontScale >= 2.8 ? 2 : 1 };
}

export type TrackingStatusLayout = {
  iconVisible: boolean;
  maxFontSizeMultiplier?: number;
  numberOfLines: 1 | 2;
};

export function resolveTrackingStatusLayout(fontScale: number): TrackingStatusLayout {
  return fontScale >= 2.8
    ? { iconVisible: false, maxFontSizeMultiplier: 2, numberOfLines: 2 }
    : { iconVisible: true, maxFontSizeMultiplier: undefined, numberOfLines: 1 };
}

export function resolveDynamicTypeLayout(fontScale: number): DynamicTypeLayout {
  if (fontScale >= 2.8) {
    return {
      headerStacked: true,
      headerTitleMaxFontSizeMultiplier: 2,
      segmentMinHeight: 76,
      segmentNumberOfLines: 2,
      segmentStacked: true,
    };
  }
  if (fontScale >= 1.6) {
    return {
      headerStacked: true,
      headerTitleMaxFontSizeMultiplier: undefined,
      segmentMinHeight: 64,
      segmentNumberOfLines: 2,
      segmentStacked: false,
    };
  }
  return {
    headerStacked: false,
    headerTitleMaxFontSizeMultiplier: undefined,
    segmentMinHeight: 44,
    segmentNumberOfLines: 1,
    segmentStacked: false,
  };
}
