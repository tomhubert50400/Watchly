const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.9;
const UPWARD_DRAG_RESISTANCE = 0.16;

export function getBottomSheetDragOffset(distanceY: number) {
  return distanceY >= 0 ? distanceY : distanceY * UPWARD_DRAG_RESISTANCE;
}

export function shouldDismissBottomSheet(distanceY: number, velocityY: number) {
  return distanceY >= DISMISS_DISTANCE || velocityY >= DISMISS_VELOCITY;
}
