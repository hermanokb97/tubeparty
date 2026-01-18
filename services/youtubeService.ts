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
            `part=snippet&type=video&videoCategoryId=10&` +
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
