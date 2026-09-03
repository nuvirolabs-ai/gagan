export function formatAge(hours: number | null): string {
  if (hours == null) return "";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function formatDue(iso: string | null): string {
  if (!iso) return "";
  const due = new Date(iso);
  const hours = Math.round((due.getTime() - Date.now()) / 3_600_000);
  if (hours < 0) return `${formatAge(-hours)} overdue`;
  return `due ${formatAge(hours)}`;
}
