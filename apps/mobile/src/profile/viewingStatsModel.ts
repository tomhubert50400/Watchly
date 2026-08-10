export function formatCompactHours(minutes: number) {
  if (minutes <= 0) {
    return '0';
  }

  const hours = minutes / 60;

  if (hours < 10 && !Number.isInteger(hours)) {
    return hours.toFixed(1);
  }

  return String(Math.floor(hours));
}

export function formatWatchTime(minutes: number, estimated: boolean) {
  const prefix = estimated ? '~' : '';

  if (minutes < 60) {
    return `${prefix}${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${prefix}${hours} h`
    : `${prefix}${hours} h ${remainingMinutes} min`;
}

export function formatViewCount(count: number) {
  return `${count} ${count === 1 ? 'view' : 'views'}`;
}
