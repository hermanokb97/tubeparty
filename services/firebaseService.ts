import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    push,
    update,
    remove,
    onDisconnect,
    Database,
} from "firebase/database";
import { Video, Message, Room } from '../types';

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

let firebaseReadyPromise: Promise<void> | null = null;

export const ensureFirebaseReady = async (): Promise<void> => {
    if (auth.currentUser) return;

    if (!firebaseReadyPromise) {
        firebaseReadyPromise = signInAnonymously(auth)
            .then(() => undefined)
            .catch((error) => {
                firebaseReadyPromise = null;
                throw error;
            });
    }

    await firebaseReadyPromise;
};

export const getFirebaseDatabase = (): Database => database;

const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

interface FirebaseRoom {
    apiKey: string;
    hostName: string;
    createdAt: number;
    currentVideo: Video | null;
    playlist: Video[];
    currentVideoUpdatedAt?: number;
    currentVideoUpdatedBy?: string;
    playlistUpdatedAt?: number;
    playlistUpdatedBy?: string;
}

interface RoomSnapshot {
    currentVideo: Video | null;
    playlist: Video[];
    currentVideoUpdatedAt?: number;
    currentVideoUpdatedBy?: string;
    playlistUpdatedAt?: number;
    playlistUpdatedBy?: string;
}

const mapRoom = (roomId: string, data: FirebaseRoom): Room => ({
    id: roomId,
    apiKey: data.apiKey,
    hostName: data.hostName,
    createdAt: data.createdAt,
    currentVideo: data.currentVideo || undefined,
    playlist: data.playlist || undefined,
    currentVideoUpdatedAt: data.currentVideoUpdatedAt,
    currentVideoUpdatedBy: data.currentVideoUpdatedBy,
    playlistUpdatedAt: data.playlistUpdatedAt,
    playlistUpdatedBy: data.playlistUpdatedBy,
});

const subscribeAfterReady = (
    attach: () => () => void,
    onError?: (error: unknown) => void
): (() => void) => {
    let didUnsubscribe = false;
    let detach: (() => void) | null = null;

    ensureFirebaseReady()
        .then(() => {
            if (didUnsubscribe) return;
            detach = attach();
        })
        .catch((error) => {
            if (!didUnsubscribe) {
                console.error('Firebase initialization failed:', error);
                onError?.(error);
            }
        });

    return () => {
        didUnsubscribe = true;
        detach?.();
    };
};

export const createRoom = async (apiKey: string, hostName: string): Promise<Room> => {
    await ensureFirebaseReady();

    const roomId = generateRoomCode();
    const now = Date.now();
    const roomData: FirebaseRoom = {
        apiKey,
        hostName,
        createdAt: now,
        currentVideo: null,
        playlist: [],
        currentVideoUpdatedAt: now,
        playlistUpdatedAt: now,
    };

    await set(ref(database, `rooms/${roomId}`), roomData);
    return mapRoom(roomId, roomData);
};

export const getRoom = async (roomId: string): Promise<Room | null> => {
    await ensureFirebaseReady();

    const snapshot = await get(ref(database, `rooms/${roomId}`));
    if (!snapshot.exists()) return null;
    return mapRoom(roomId, snapshot.val() as FirebaseRoom);
};

export const updateCurrentVideo = async (roomId: string, video: Video, actorId: string): Promise<void> => {
    await ensureFirebaseReady();

    await update(ref(database, `rooms/${roomId}`), {
        currentVideo: video,
        currentVideoUpdatedAt: Date.now(),
        currentVideoUpdatedBy: actorId,
    });
};

export const updatePlaylist = async (roomId: string, playlist: Video[], actorId: string): Promise<void> => {
    await ensureFirebaseReady();

    await update(ref(database, `rooms/${roomId}`), {
        playlist,
        playlistUpdatedAt: Date.now(),
        playlistUpdatedBy: actorId,
    });
};

export const addMessage = async (roomId: string, message: Message): Promise<void> => {
    await ensureFirebaseReady();
    await push(ref(database, `rooms/${roomId}/messages`), message);
};

export const subscribeToRoom = (
    roomId: string,
    onUpdate: (data: RoomSnapshot) => void,
    onError?: (error: unknown) => void
): (() => void) => subscribeAfterReady(() => {
    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val() as FirebaseRoom;
        onUpdate({
            currentVideo: data.currentVideo || null,
            playlist: data.playlist || [],
            currentVideoUpdatedAt: data.currentVideoUpdatedAt,
            currentVideoUpdatedBy: data.currentVideoUpdatedBy,
            playlistUpdatedAt: data.playlistUpdatedAt,
            playlistUpdatedBy: data.playlistUpdatedBy,
        });
    }, (error) => {
        console.error('Firebase room subscription failed:', error);
        onError?.(error);
    });
}, onError);

export const subscribeToMessages = (
    roomId: string,
    onNewMessage: (messages: Message[]) => void,
    onError?: (error: unknown) => void
): (() => void) => subscribeAfterReady(() => {
    const messagesRef = ref(database, `rooms/${roomId}/messages`);
    return onValue(messagesRef, (snapshot) => {
        if (!snapshot.exists()) {
            onNewMessage([]);
            return;
        }
        const data = snapshot.val();
        const messages = Object.values(data) as Message[];
        onNewMessage(messages.sort((a, b) => a.timestamp - b.timestamp));
    }, (error) => {
        console.error('Firebase messages subscription failed:', error);
        onError?.(error);
    });
}, onError);

interface RoomUser {
    id: string;
    name: string;
    joinedAt: number;
}

export const addUserToRoom = async (roomId: string, user: { id: string; name: string }): Promise<void> => {
    await ensureFirebaseReady();

    const userRef = ref(database, `rooms/${roomId}/users/${user.id}`);
    await set(userRef, {
        id: user.id,
        name: user.name,
        joinedAt: Date.now()
    });
    await onDisconnect(userRef).remove();
};

export const removeUserFromRoom = async (roomId: string, userId: string): Promise<void> => {
    await ensureFirebaseReady();
    await remove(ref(database, `rooms/${roomId}/users/${userId}`));
};

export const subscribeToUsers = (
    roomId: string,
    onUpdate: (users: RoomUser[]) => void,
    onError?: (error: unknown) => void
): (() => void) => subscribeAfterReady(() => {
    const usersRef = ref(database, `rooms/${roomId}/users`);
    return onValue(usersRef, (snapshot) => {
        if (!snapshot.exists()) {
            onUpdate([]);
            return;
        }
        const data = snapshot.val();
        const users = Object.values(data) as RoomUser[];
        onUpdate(users.sort((a, b) => a.joinedAt - b.joinedAt));
    }, (error) => {
        console.error('Firebase users subscription failed:', error);
        onError?.(error);
    });
}, onError);

export const deleteRoom = async (roomId: string): Promise<void> => {
    await ensureFirebaseReady();
    await remove(ref(database, `rooms/${roomId}`));
};

export interface PlaybackState {
    currentTime: number;
    isPlaying: boolean;
    videoId: string;
    syncedBy: string;
    syncedAt: number;
}

export const updatePlaybackState = async (
    roomId: string,
    state: PlaybackState
): Promise<void> => {
    await ensureFirebaseReady();
    await set(ref(database, `rooms/${roomId}/playbackState`), state);
};

export const subscribeToPlaybackState = (
    roomId: string,
    onUpdate: (state: PlaybackState | null) => void,
    onError?: (error: unknown) => void
): (() => void) => subscribeAfterReady(() => {
    const playbackRef = ref(database, `rooms/${roomId}/playbackState`);
    return onValue(playbackRef, (snapshot) => {
        onUpdate(snapshot.exists() ? snapshot.val() as PlaybackState : null);
    }, (error) => {
        console.error('Firebase playback subscription failed:', error);
        onError?.(error);
    });
}, onError);
