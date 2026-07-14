export function resolveTextInputAccessibilityLabel(
  visibleLabel: string,
  accessibilityLabel: string | undefined,
) {
  return accessibilityLabel ?? visibleLabel;
}
