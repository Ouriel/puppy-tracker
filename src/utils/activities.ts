

/** Sort activities by timestamp descending (newest first) */
export function sortByTimestampDesc<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Sort activities by timestamp ascending (oldest first) */
export function sortByTimestampAsc<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
