import { Video, SavedPlaylist } from '../types';
import { getBrowserId } from './browserStorage';

const getStorageKey = () => `tubeparty_playlists_${getBrowserId()}`;

export const savePlaylist = (name: string, videos: Video[]): SavedPlaylist => {
    const playlists = loadPlaylists();

    const newPlaylist: SavedPlaylist = {
        id: `playlist-${Date.now()}`,
        name,
        videos,
        createdAt: Date.now()
    };

    playlists.push(newPlaylist);
    localStorage.setItem(getStorageKey(), JSON.stringify(playlists));

    return newPlaylist;
};

export const loadPlaylists = (): SavedPlaylist[] => {
    try {
        const data = localStorage.getItem(getStorageKey());
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const deletePlaylist = (id: string): void => {
    const playlists = loadPlaylists().filter(p => p.id !== id);
    localStorage.setItem(getStorageKey(), JSON.stringify(playlists));
};

export const loadPlaylistById = (id: string): SavedPlaylist | undefined => {
    return loadPlaylists().find(p => p.id === id);
};
