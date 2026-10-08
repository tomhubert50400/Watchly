export type DragPoint = { x: number; y: number };
export type DragRect = DragPoint & { width: number; height: number };

export function draggedPosterCenter(point: DragPoint, poster: { gripX: number; gripY: number; width: number }) {
  return { x: point.x - poster.gripX + poster.width / 2, y: point.y - poster.gripY + poster.width * 0.75 };
}

export function isInsideTrash(point: DragPoint, rect: DragRect | null) {
  return Boolean(rect && rect.width > 0 && rect.height > 0
    && point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height);
}
