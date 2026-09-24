/** Ignore room snapshots that were written before a local playback change. */
export const isStaleRemoteUpdate = (
  pendingAt: number | null,
  incomingAt: number,
  now: number,
  maxAgeMs = 8000,
): boolean => {
  if (pendingAt == null) return false;
  if (now - pendingAt > maxAgeMs) return false;
  return incomingAt < pendingAt;
};
