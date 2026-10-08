export type PosterMenuAnchor = { x: number; y: number; width: number; height: number };

export function posterMenuPosition(anchor: PosterMenuAnchor, viewport: { width: number; height: number },
  insets: { top: number; bottom: number; left: number; right: number }, menuHeight: number) {
  const gap = 10;
  const leftEdge = insets.left + 12;
  const rightEdge = viewport.width - insets.right - 12;
  const topEdge = insets.top + 12;
  const bottomEdge = viewport.height - insets.bottom - 12;
  const width = Math.min(260, rightEdge - leftEdge);
  // The card remains at 96% scale while its menu is open.
  const top = anchor.y + anchor.height * 0.02;
  const bottom = anchor.y + anchor.height * 0.98;
  const below = Math.max(0, bottomEdge - bottom - gap);
  const above = Math.max(0, top - topEdge - gap);
  const placement = below >= menuHeight || below >= above ? 'below' : 'above';
  const maxHeight = placement === 'below' ? below : above;
  const height = Math.min(menuHeight, maxHeight);
  const centerX = anchor.x + anchor.width / 2;
  const x = Math.max(leftEdge, Math.min(centerX - width / 2, rightEdge - width));
  return { x, y: placement === 'below' ? bottom + gap : top - gap - height,
    width, maxHeight, placement, arrowX: Math.max(16, Math.min(centerX - x, width - 16)) };
}
