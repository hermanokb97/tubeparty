export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  isAi?: boolean;
}

export interface Message {
  id: string;
  userId: string;
  userName?: string; // For displaying sender name in real-time chat
  text: string;
  timestamp: number;
}

export interface ChatState {
  users: User[];
  messages: Message[];
}

export enum TabType {
  CHAT = 'CHAT',
  PLAYLIST = 'PLAYLIST'
}

export type SyncAction =
  | { type: 'JOIN'; payload: { user: User } }
  | { type: 'CHAT'; payload: { message: Message } }
  | { type: 'VIDEO_CHANGE'; payload: { video: Video } };

export interface SavedPlaylist {
  id: string;
  name: string;
  videos: Video[];
  createdAt: number;
}

export interface Room {
  id: string;           // 6자리 방 코드
  apiKey: string;       // Gemini API 키
  hostName: string;     // 호스트 닉네임
  createdAt: number;
  currentVideo?: Video;  // 현재 재생 중인 비디오
  playlist?: Video[];    // 플레이리스트
  currentVideoUpdatedAt?: number;
  currentVideoUpdatedBy?: string;
  playlistUpdatedAt?: number;
  playlistUpdatedBy?: string;
}
