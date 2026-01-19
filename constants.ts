import { Video } from './types';

export type GenreType = 'lofi' | 'kpop' | 'ballad' | 'pop' | 'random';

export interface GenreOption {
    id: GenreType;
    name: string;
    emoji: string;
    description: string;
}

export const GENRE_OPTIONS: GenreOption[] = [
    { id: 'lofi', name: 'Lofi', emoji: '🎹', description: '편안한 비트' },
    { id: 'kpop', name: 'KPOP', emoji: '🎤', description: '인기 K-POP' },
    { id: 'ballad', name: '발라드', emoji: '💜', description: '감성 발라드' },
    { id: 'pop', name: '팝송', emoji: '🎵', description: '글로벌 히트' },
    { id: 'random', name: '랜덤', emoji: '🎲', description: '랜덤 장르' },
];

// Real YouTube video IDs for each genre
export const GENRE_VIDEOS: Record<GenreType, Video[]> = {
    lofi: [
        { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio - beats to relax/study to', channelTitle: 'Lofi Girl', thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg' },
        { id: '5qap5aO4i9A', title: 'lofi hip hop radio - beats to sleep/chill to', channelTitle: 'Lofi Girl', thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/mqdefault.jpg' },
        { id: 'rUxyKA_-grg', title: 'Chillhop Radio - jazzy & lofi hip hop beats', channelTitle: 'Chillhop Music', thumbnail: 'https://img.youtube.com/vi/rUxyKA_-grg/mqdefault.jpg' },
        { id: 'lTRiuFIWV54', title: 'Coffee Shop Radio - 24/7 lofi hip hop', channelTitle: 'STEEZYASFUCK', thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/mqdefault.jpg' },
    ],
    kpop: [
        { id: '3YqPKLZF_WU', title: 'BTS (방탄소년단) - Dynamite', channelTitle: 'HYBE LABELS', thumbnail: 'https://img.youtube.com/vi/3YqPKLZF_WU/mqdefault.jpg' },
        { id: 'gdZLi9oWNZg', title: 'BLACKPINK - How You Like That', channelTitle: 'BLACKPINK', thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg' },
        { id: 'AAbokV76tkU', title: 'NewJeans - Super Shy', channelTitle: 'HYBE LABELS', thumbnail: 'https://img.youtube.com/vi/AAbokV76tkU/mqdefault.jpg' },
        { id: 'kOHB85vDuow', title: 'aespa - Supernova', channelTitle: 'SMTOWN', thumbnail: 'https://img.youtube.com/vi/kOHB85vDuow/mqdefault.jpg' },
        { id: 'pBuZEGYXA6E', title: 'IVE - LOVE DIVE', channelTitle: 'Starship Entertainment', thumbnail: 'https://img.youtube.com/vi/pBuZEGYXA6E/mqdefault.jpg' },
    ],
    ballad: [
        { id: 'nPt8bK2gbaU', title: '폴킴 (Paul Kim) - 비', channelTitle: 'Stone Music Entertainment', thumbnail: 'https://img.youtube.com/vi/nPt8bK2gbaU/mqdefault.jpg' },
        { id: 'VPeIGmHJNIs', title: '아이유 (IU) - 밤편지', channelTitle: 'EDAM Entertainment', thumbnail: 'https://img.youtube.com/vi/VPeIGmHJNIs/mqdefault.jpg' },
        { id: 'O9TUnkqwSzc', title: '성시경 - 너의 모든 순간', channelTitle: 'Stone Music Entertainment', thumbnail: 'https://img.youtube.com/vi/O9TUnkqwSzc/mqdefault.jpg' },
        { id: 'HEYOsR1DlWE', title: '멜로망스 - 사랑인가 봐', channelTitle: 'Kakao Entertainment', thumbnail: 'https://img.youtube.com/vi/HEYOsR1DlWE/mqdefault.jpg' },
    ],
    pop: [
        { id: 'kTJczUoc26U', title: 'The Weeknd - Blinding Lights', channelTitle: 'The Weeknd', thumbnail: 'https://img.youtube.com/vi/kTJczUoc26U/mqdefault.jpg' },
        { id: 'ZbZSe6N_BXs', title: 'Pharrell Williams - Happy', channelTitle: 'Pharrell Williams', thumbnail: 'https://img.youtube.com/vi/ZbZSe6N_BXs/mqdefault.jpg' },
        { id: 'fRh_vgS2dFE', title: 'Justin Bieber - Sorry', channelTitle: 'Justin Bieber', thumbnail: 'https://img.youtube.com/vi/fRh_vgS2dFE/mqdefault.jpg' },
        { id: 'JGwWNGJdvx8', title: 'Ed Sheeran - Shape of You', channelTitle: 'Ed Sheeran', thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg' },
    ],
    random: [] // Will be populated at runtime
};

// Get random video from a genre
export const getRandomVideoFromGenre = (genre: GenreType): Video => {
    let videos: Video[];

    if (genre === 'random') {
        // Combine all genres for random
        videos = [
            ...GENRE_VIDEOS.lofi,
            ...GENRE_VIDEOS.kpop,
            ...GENRE_VIDEOS.ballad,
            ...GENRE_VIDEOS.pop
        ];
    } else {
        videos = GENRE_VIDEOS[genre];
    }

    return videos[Math.floor(Math.random() * videos.length)];
};

// Popular Playlists by Category
export interface CuratedPlaylist {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    category: string;
}

export const CURATED_PLAYLISTS: CuratedPlaylist[] = [
    // Lofi & Chill
    { id: 'PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo', title: 'Lofi Hip Hop Mix', description: '공부할 때 듣기 좋은 로파이', thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg', category: '🎹 Lofi' },
    { id: 'PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl', title: 'Chill Vibes', description: '편안한 분위기의 음악', thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/mqdefault.jpg', category: '🎹 Lofi' },

    // KPOP
    { id: 'PLgzTt0k8mXzGh3Bfxq3OBw6Y8x0kZQ4OD', title: 'KPOP 2024 Hits', description: '최신 케이팝 히트곡', thumbnail: 'https://img.youtube.com/vi/AAbokV76tkU/mqdefault.jpg', category: '🎤 KPOP' },
    { id: 'PL0H_J7bVm7AjlHkQDIX8z3B4TqL8e4Q1Z', title: 'KPOP Dance', description: '신나는 댄스곡 모음', thumbnail: 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg', category: '🎤 KPOP' },

    // Ballad
    { id: 'PLNAiluTgSsZXvqHTbmH_O_TGxqfT_dqDT', title: '감성 발라드 모음', description: '드라마 OST 명곡들', thumbnail: 'https://img.youtube.com/vi/VPeIGmHJNIs/mqdefault.jpg', category: '💜 발라드' },
    { id: 'PLcLjz5F8xpMOyhMBKLjRvnGVF1FKXQ4bJ', title: '카페 음악', description: '카페에서 듣기 좋은 음악', thumbnail: 'https://img.youtube.com/vi/nPt8bK2gbaU/mqdefault.jpg', category: '💜 발라드' },

    // Pop
    { id: 'PLDcnymzs18LU4Kexrs91TVdfnplU3I5zs', title: 'Global Top 50', description: '전세계 인기차트', thumbnail: 'https://img.youtube.com/vi/kTJczUoc26U/mqdefault.jpg', category: '🎵 팝송' },
    { id: 'PLYAYp5OI4lRLf0DQRJmH_fy0tVvVpqU1a', title: 'Throwback Hits', description: '추억의 팝송', thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg', category: '🎵 팝송' },

    // Party & Workout
    { id: 'PLhd1HyMTk3f5yNrpjAqx3kkbWRR_EjWnM', title: 'Party Mix', description: '파티용 신나는 음악', thumbnail: 'https://img.youtube.com/vi/fRh_vgS2dFE/mqdefault.jpg', category: '🎉 파티' },
    { id: 'PLCD0445C57F2B7F41', title: 'Workout Mix', description: '운동할 때 듣는 음악', thumbnail: 'https://img.youtube.com/vi/ZbZSe6N_BXs/mqdefault.jpg', category: '💪 운동' },
];

// Get playlists by category
export const getPlaylistsByCategory = (): Record<string, CuratedPlaylist[]> => {
    const grouped: Record<string, CuratedPlaylist[]> = {};
    CURATED_PLAYLISTS.forEach(playlist => {
        if (!grouped[playlist.category]) {
            grouped[playlist.category] = [];
        }
        grouped[playlist.category].push(playlist);
    });
    return grouped;
};
