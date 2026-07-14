export function resolveOpinionTriggerLayout(hasLoadError: boolean, fontScale: number) {
  return {
    actionMaxWidth: 148,
    actionsStacked: fontScale >= 2.8,
    contentStacked: hasLoadError || fontScale >= 2,
  } as const;
}
