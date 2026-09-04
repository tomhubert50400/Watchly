export function formatCompactHours(minutes: number) {
  if (minutes <= 0) {
    return '0m';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;

  return `${hours}h${remainingMinutes}`;
}

export function formatStoryTime(minutes: number) {
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} watching stories and making memories`;
  }

  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} watching stories and making memories`;
}

export function formatViewCount(count: number) {
  return `${count} ${count === 1 ? 'view' : 'views'}`;
}
