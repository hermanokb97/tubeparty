import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, push, update, remove, onDisconnect } from "firebase/database";
import { Video, Message, Room } from '../types';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4B5o4LjTK7vFGSJKtZT_Oh4JWSBRE1Zc",
    authDomain: "smart-setting-463812-s6.firebaseapp.com",
    databaseURL: "https://smart-setting-463812-s6-default-rtdb.firebaseio.com",
    projectId: "smart-setting-463812-s6",
    storageBucket: "smart-setting-463812-s6.firebasestorage.app",
    messagingSenderId: "349083731090",
    appId: "1:349083731090:web:5ac99cf397d2676368124b",
    measurementId: "G-DMLW9PFZ71"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Generate random room code
const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Room interface for Firebase
interface FirebaseRoom {
    apiKey: string;
    hostName: string;
    createdAt: number;
    currentVideo: Video | null;
    playlist: Video[];
}

// Create a new room
export const createRoom = async (apiKey: string, hostName: string): Promise<Room> => {
    const roomId = generateRoomCode();
    const roomData: FirebaseRoom = {
        apiKey,
        hostName,
        createdAt: Date.now(),
        currentVideo: null,
        playlist: []
    };

    await set(ref(database, `rooms/${roomId}`), roomData);

    return {
        id: roomId,
        apiKey,
        hostName,
        createdAt: roomData.createdAt
    };
};

// Get room by code
export const getRoom = async (roomId: string): Promise<Room | null> => {
    const snapshot = await get(ref(database, `rooms/${roomId}`));
    if (snapshot.exists()) {
        const data = snapshot.val();
        return {
            id: roomId,
            apiKey: data.apiKey,
            hostName: data.hostName,
            createdAt: data.createdAt,
            currentVideo: data.currentVideo || undefined,
            playlist: data.playlist || undefined
        };
    }
    return null;
};

// Update current video
export const updateCurrentVideo = async (roomId: string, video: Video): Promise<void> => {
    await update(ref(database, `rooms/${roomId}`), { currentVideo: video });
};

// Update playlist
export const updatePlaylist = async (roomId: string, playlist: Video[]): Promise<void> => {
    await update(ref(database, `rooms/${roomId}`), { playlist });
};

// Add message to room
export const addMessage = async (roomId: string, message: Message): Promise<void> => {
    await push(ref(database, `rooms/${roomId}/messages`), message);
};

// Subscribe to room changes
export const subscribeToRoom = (
    roomId: string,
    onUpdate: (data: { currentVideo: Video | null; playlist: Video[] }) => void
): (() => void) => {
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            onUpdate({
                currentVideo: data.currentVideo || null,
                playlist: data.playlist || []
            });
        }
    });
    return unsubscribe;
};

// Subscribe to messages
export const subscribeToMessages = (
    roomId: string,
    onNewMessage: (messages: Message[]) => void
): (() => void) => {
    const messagesRef = ref(database, `rooms/${roomId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const messages = Object.values(data) as Message[];
            onNewMessage(messages.sort((a, b) => a.timestamp - b.timestamp));
        }
    });
    return unsubscribe;
};

// User management for room
interface RoomUser {
    id: string;
    name: string;
    joinedAt: number;
}

// Add user to room (with automatic cleanup on disconnect)
export const addUserToRoom = async (roomId: string, user: { id: string; name: string }): Promise<void> => {
    const userRef = ref(database, `rooms/${roomId}/users/${user.id}`);
    
    // Set user data
    await set(userRef, {
        id: user.id,
        name: user.name,
        joinedAt: Date.now()
    });
    
    // Set up automatic removal when connection is lost (browser closed, network lost, etc.)
    // This is handled server-side by Firebase, so it works even if the browser crashes
    await onDisconnect(userRef).remove();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ec787ced-0267-41e0-98e1-e1b366dcec00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebaseService.ts:addUserToRoom',message:'User added with onDisconnect handler',data:{roomId,userId:user.id,userName:user.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H3'})}).catch(()=>{});
    // #endregion
};

// Remove user from room
export const removeUserFromRoom = async (roomId: string, odedUserId: string): Promise<void> => {
    await remove(ref(database, `rooms/${roomId}/users/${odedUserId}`));
};

// Subscribe to room users
export const subscribeToUsers = (
    roomId: string,
    onUpdate: (users: RoomUser[]) => void
): (() => void) => {
    const usersRef = ref(database, `rooms/${roomId}/users`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const users = Object.values(data) as RoomUser[];
            onUpdate(users.sort((a, b) => a.joinedAt - b.joinedAt));
        } else {
            onUpdate([]);
        }
    });
    return unsubscribe;
};

// Delete room (optional cleanup)
export const deleteRoom = async (roomId: string): Promise<void> => {
    await remove(ref(database, `rooms/${roomId}`));
};

// ===== Playback Sync (재생 구간 동기화) =====

export interface PlaybackState {
    currentTime: number;      // 현재 재생 시간 (초)
    isPlaying: boolean;       // 재생 중 여부
    videoId: string;          // 현재 비디오 ID
    syncedBy: string;         // 동기화를 트리거한 유저 ID
    syncedAt: number;         // 동기화 시점 (timestamp)
}

// Update playback state (seek, play/pause)
export const updatePlaybackState = async (
    roomId: string,
    state: PlaybackState
): Promise<void> => {
    await set(ref(database, `rooms/${roomId}/playbackState`), state);
};

// Subscribe to playback state changes
export const subscribeToPlaybackState = (
    roomId: string,
    onUpdate: (state: PlaybackState | null) => void
): (() => void) => {
    const playbackRef = ref(database, `rooms/${roomId}/playbackState`);
    const unsubscribe = onValue(playbackRef, (snapshot) => {
        if (snapshot.exists()) {
            onUpdate(snapshot.val() as PlaybackState);
        } else {
            onUpdate(null);
        }
    });
    return unsubscribe;
};