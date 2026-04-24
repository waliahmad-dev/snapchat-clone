export function streakEmoji(count: number): string {
  if (count >= 100) return '💯';
  if (count >= 50) return '🔥';
  return '🔥';
}

export function streakLabel(count: number): string {
  if (count === 0) return '';
  return `${count}`;
}

export function formatTtl(secondsLeft: number): string {
  if (secondsLeft <= 0) return '';
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

export function isStreakAtRisk(secondsLeft: number): boolean {
  return secondsLeft > 0 && secondsLeft < 3600 * 3;
}
