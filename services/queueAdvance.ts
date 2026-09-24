import type { Video } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueAdvance {
  playlist: Video[];
  video: Video | null;
}

const findIndexById = (playlist: Video[], currentId: string): number =>
  playlist.findIndex((video) => video.id === currentId);

/** Next track when the current video finishes. */
export const advanceQueue = (
  playlist: Video[],
  currentId: string,
  repeatMode: RepeatMode,
  isShuffleOn: boolean,
  randomIndex: (length: number) => number = (length) => Math.floor(Math.random() * length),
): QueueAdvance => {
  const current = playlist.find((video) => video.id === currentId) ?? null;

  if (repeatMode === 'one' && current) {
    return { playlist, video: current };
  }

  if (isShuffleOn) {
    const others = playlist.filter((video) => video.id !== currentId);
    if (others.length === 0) {
      return { playlist, video: playlist[0] ?? null };
    }
    const index = Math.min(Math.max(randomIndex(others.length), 0), others.length - 1);
    return { playlist, video: others[index] ?? null };
  }

  const currentIndex = findIndexById(playlist, currentId);
  const nextIndex = currentIndex + 1;
  if (currentIndex >= 0 && nextIndex < playlist.length) {
    return { playlist, video: playlist[nextIndex] };
  }
  if (repeatMode === 'all' && playlist.length > 0) {
    return { playlist, video: playlist[0] };
  }
  return { playlist, video: null };
};

/** Manual skip. A one-item queue replays that item. */
export const skipQueue = (playlist: Video[], currentId: string): QueueAdvance => {
  if (playlist.length === 0) return { playlist, video: null };
  if (playlist.length === 1) return { playlist, video: playlist[0] };
  const currentIndex = findIndexById(playlist, currentId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % playlist.length;
  return { playlist, video: playlist[nextIndex] ?? null };
};

/**
 * Drop an unplayable video and continue with the item that slid into its place.
 * Keeps the broken video when there is nowhere else to go, so the player does not loop on it.
 */
export const skipUnplayable = (
  playlist: Video[],
  currentId: string,
  repeatMode: RepeatMode,
): QueueAdvance => {
  const currentIndex = findIndexById(playlist, currentId);
  const remaining = playlist.filter((video) => video.id !== currentId);
  if (remaining.length === 0) return { playlist, video: null };

  if (currentIndex >= 0 && currentIndex < remaining.length) {
    return { playlist: remaining, video: remaining[currentIndex] };
  }
  if (repeatMode === 'all' || currentIndex < 0) {
    return { playlist: remaining, video: remaining[0] };
  }
  return { playlist, video: null };
};
