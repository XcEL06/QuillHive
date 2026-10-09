import { format, formatDistanceToNowStrict, isValid } from 'date-fns';
import type { HTMLAttributes } from 'react';

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

type TimestampProps = Omit<HTMLAttributes<HTMLTimeElement>, 'children'> & {
  value: string | Date | null | undefined;
  mode?: 'relative' | 'date' | 'datetime';
};

export function Timestamp({ value, mode = 'relative', ...props }: TimestampProps) {
  if (value == null) return null;

  const timestamp = formatPostTimestamp(value);
  if (!timestamp) return null;

  const label = mode === 'date'
    ? format(new Date(value), 'MMM d, yyyy')
    : mode === 'datetime'
      ? format(new Date(value), 'MMM d, yyyy, h:mm a')
      : timestamp.label;

  return (
    <time dateTime={timestamp.dateTime} title={timestamp.title} {...props}>
      {label}
    </time>
  );
}