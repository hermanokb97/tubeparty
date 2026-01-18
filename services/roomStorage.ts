import { Room } from '../types';

const STORAGE_KEY = 'tubeparty_rooms';

// Generate a random 6-character room code
const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

export const createRoom = (apiKey: string, hostName: string): Room => {
    const rooms = getAllRooms();

    // Generate unique room code
    let roomId = generateRoomCode();
    while (rooms.some(r => r.id === roomId)) {
        roomId = generateRoomCode();
    }

    const newRoom: Room = {
        id: roomId,
        apiKey,
        hostName,
        createdAt: Date.now()
    };

    rooms.push(newRoom);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));

    return newRoom;
};

export const getRoom = (roomId: string): Room | undefined => {
    return getAllRooms().find(r => r.id === roomId.toUpperCase());
};

export const getAllRooms = (): Room[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const deleteRoom = (roomId: string): void => {
    const rooms = getAllRooms().filter(r => r.id !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
};
