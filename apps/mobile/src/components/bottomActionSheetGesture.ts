const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.9;
const DRAG_ACTIVATION_DISTANCE = 6;
const UPWARD_DRAG_RESISTANCE = 0.16;

export function getBottomSheetDragOffset(distanceY: number) {
  return distanceY >= 0 ? distanceY : distanceY * UPWARD_DRAG_RESISTANCE;
}

export function shouldCaptureBottomSheetDrag(distanceX: number, distanceY: number) {
  return distanceY > DRAG_ACTIVATION_DISTANCE && Math.abs(distanceY) > Math.abs(distanceX);
}

export function shouldDismissBottomSheet(distanceY: number, velocityY: number) {
  return distanceY >= DISMISS_DISTANCE || velocityY >= DISMISS_VELOCITY;
}
