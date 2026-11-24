/** "Nov 24" this year, "Nov 24, 2025" otherwise, in the owner's timezone. */
export function formatVisitDate(iso: string, timeZone: string, now = new Date()): string {
  const yearOf = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(d);
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: yearOf(date) === yearOf(now) ? undefined : 'numeric',
    timeZone
  }).format(date);
}

export function daysAgoLabel(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
