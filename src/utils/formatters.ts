/**
 * Display formatters for dates, numbers, and relative times.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Returns a human-readable relative time string (e.g., "2h", "3d", "1w").
 */
export function timeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compact number format (e.g., 1200 → "1.2K", 1500000 → "1.5M").
 */
export function compactNumber(num: number): string {
  if (num < 1000) return String(num);
  if (num < 1_000_000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0')
      ? `${Math.floor(num / 1000)}K`
      : `${formatted}K`;
  }
  const formatted = (num / 1_000_000).toFixed(1);
  return formatted.endsWith('.0')
    ? `${Math.floor(num / 1_000_000)}M`
    : `${formatted}M`;
}

/**
 * Format a date for chat message timestamps (e.g., "2:30 PM").
 */
export function formatMessageTime(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date for section headers (e.g., "Today", "Yesterday", "Apr 5").
 */
export function formatSectionDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < DAY && now.getDate() === date.getDate()) return 'Today';
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < WEEK) return 'This Week';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
