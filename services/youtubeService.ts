// YouTube Data API Service
const YOUTUBE_API_KEY = 'AIzaSyDdwIG3-XPi1WyWX0_9ctVGaeFLf8-6nJ4';

export interface YouTubeSearchResult {
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
}

// Search YouTube for videos
export const searchYouTube = async (query: string, maxResults: number = 5): Promise<YouTubeSearchResult[]> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=video&` +
            `videoEmbeddable=true&videoSyndicated=true&` +
            `q=${encodeURIComponent(query)}&` +
            `maxResults=${maxResults}&` +
            `key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) {
            console.error('YouTube API error:', response.status);
            return [];
        }

        const data = await response.json();

        return data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        }));
    } catch (error) {
        console.error('YouTube search error:', error);
        return [];
    }
};

// Get video details by ID
export const getVideoDetails = async (videoId: string): Promise<YouTubeSearchResult | null> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?` +
            `part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        if (data.items.length === 0) return null;

        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        };
    } catch (error) {
        console.error('YouTube get video error:', error);
        return null;
    }
};

// Fetch videos from a specific playlist
export const fetchPlaylistItems = async (playlistId: string, maxResults: number = 50): Promise<YouTubeSearchResult[]> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?` +
            `part=snippet&` +
            `playlistId=${playlistId}&` +
            `maxResults=${maxResults}&` +
            `key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) {
            console.error('YouTube API error (playlistItems):', response.status);
            return [];
        }

        const data = await response.json();

        return data.items
            .filter((item: any) => item.snippet.resourceId.videoId) // Filter out items without video ID
            .map((item: any) => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
            }));
    } catch (error) {
        console.error('YouTube playlist items error:', error);
        return [];
    }
};

// Get popular music videos (KR region)
export const getPopularVideos = async (regionCode: string = 'KR', maxResults: number = 50): Promise<YouTubeSearchResult[]> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?` +
            `part=snippet&` +
            `chart=mostPopular&` +
            `regionCode=${regionCode}&` +
            `videoCategoryId=10&` + // 10 is Music category
            `maxResults=${maxResults}&` +
            `key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) {
            console.error('YouTube API error (popular):', response.status);
            return [];
        }

        const data = await response.json();

        return data.items.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        }));
    } catch (error) {
        console.error('YouTube popular videos error:', error);
        return [];
    }
};

// Playlist search result interface
export interface PlaylistSearchResult {
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    itemCount?: number;
}

// Search YouTube for playlists
export const searchPlaylists = async (query: string, maxResults: number = 10): Promise<PlaylistSearchResult[]> => {
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=playlist&` +
            `q=${encodeURIComponent(query)}&` +
            `maxResults=${maxResults}&` +
            `key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) {
            console.error('YouTube API error (playlist search):', response.status);
            return [];
        }

        const data = await response.json();

        return data.items.map((item: any) => ({
            id: item.id.playlistId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        }));
    } catch (error) {
        console.error('YouTube playlist search error:', error);
        return [];
    }
};
