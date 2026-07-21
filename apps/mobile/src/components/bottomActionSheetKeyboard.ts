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
