export function resolveOpinionTriggerLayout(fontScale: number) {
  return {
    actionsStacked: fontScale >= 2.8,
  } as const;
}
