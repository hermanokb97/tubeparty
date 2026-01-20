import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, push, update, remove, DatabaseReference } from "firebase/database";
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

// Delete room (optional cleanup)
export const deleteRoom = async (roomId: string): Promise<void> => {
    await remove(ref(database, `rooms/${roomId}`));
};
