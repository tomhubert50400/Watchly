export function isReleasedDate(value: string | null) {
  if (!value) {
    return true;
  }

  return value <= new Date().toISOString().slice(0, 10);
}
