import { format, formatDistanceToNowStrict, isValid } from 'date-fns';

const RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function formatPostTimestamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return null;

  const ageMs = Date.now() - date.getTime();
  let label = format(date, 'MMM d');

  if (ageMs >= 0 && ageMs <= RELATIVE_WINDOW_MS) {
    const distance = formatDistanceToNowStrict(date);
    label = distance === 'less than a minute'
      ? 'now'
      : distance.replace(/^(\d+)\s+(seconds?|minutes?|hours?|days?|months?|years?)$/, (_match, amount: string, unit: string) => {
        const suffix = unit.startsWith('month') ? 'mo' : unit[0];
        return `${amount}${suffix}`;
      });
  }

  return {
    label,
    title: format(date, "MMMM d, yyyy 'at' h:mm:ss a"),
    dateTime: date.toISOString(),
  };
}