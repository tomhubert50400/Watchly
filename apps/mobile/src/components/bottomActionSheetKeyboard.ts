type KeyboardFrame = {
  height: number;
  screenY: number;
  width: number;
};

type ScreenSize = {
  height: number;
  width: number;
};

const MAX_DOCKED_BOTTOM_GAP = 64;

export function resolveBottomSheetKeyboardInset(frame: KeyboardFrame, screen: ScreenSize) {
  const bottomGap = screen.height - (frame.screenY + frame.height);
  const fillsScreenWidth = frame.width >= screen.width - 1;
  const isDocked = frame.height > 0
    && fillsScreenWidth
    && bottomGap >= -1
    && bottomGap <= MAX_DOCKED_BOTTOM_GAP;

  return isDocked ? Math.max(0, screen.height - frame.screenY) : 0;
}

export function resolveFocusedFieldScrollOffset({
  scrollOffset,
  viewportTop,
  viewportHeight,
  fieldTop,
  fieldHeight,
  gap = 8,
  keyboardTop,
}: {
  scrollOffset: number;
  viewportTop: number;
  viewportHeight: number;
  fieldTop: number;
  fieldHeight: number;
  gap?: number;
  keyboardTop?: number;
}) {
  if (viewportHeight <= 0 || fieldHeight <= 0) return scrollOffset;
  const visibleTop = viewportTop + gap;
  const visibleBottom = Math.min(viewportTop + viewportHeight, keyboardTop ?? Infinity) - gap;
  // An oversized field must keep its beginning visible instead of scrolling it above the viewport.
  if (fieldTop < visibleTop || fieldHeight > visibleBottom - visibleTop) {
    return Math.max(0, scrollOffset + fieldTop - visibleTop);
  }
  if (fieldTop + fieldHeight > visibleBottom) {
    return Math.max(0, scrollOffset + fieldTop + fieldHeight - visibleBottom);
  }
  return scrollOffset;
}
