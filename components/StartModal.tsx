import React, { useState, useEffect } from 'react';
import { Music, FolderOpen, X, Loader2, Search, TrendingUp, Flame, RefreshCw } from 'lucide-react';
import { Video, SavedPlaylist } from '../types';
import { GenreType, GENRE_OPTIONS } from '../constants';
import * as youtubeService from '../services/youtubeService';

interface StartModalProps {
    savedPlaylists: SavedPlaylist[];
    isLoading: boolean;
    onSelectGenre: (genre: GenreType) => void;
    onSelectPlaylist: (playlist: SavedPlaylist) => void;
    onSelectRanking: () => void;
    onSelectVideo: (video: Video) => void;
    onClose: () => void;
}

export const StartModal: React.FC<StartModalProps> = ({
    savedPlaylists,
    isLoading,
    onSelectGenre,
    onSelectPlaylist,
    onSelectRanking,
    onSelectVideo,
    onClose
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<youtubeService.YouTubeSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<'recommend' | 'search'>('recommend');

    // Dynamic trending recommendations
    const [trendingVideos, setTrendingVideos] = useState<youtubeService.YouTubeSearchResult[]>([]);
    const [isTrendingLoading, setIsTrendingLoading] = useState(true);

    // Fetch trending videos on mount
    useEffect(() => {
        fetchTrendingVideos();
    }, []);

    const fetchTrendingVideos = async () => {
        setIsTrendingLoading(true);
        try {
            // Get popular music videos from Korea
            const videos = await youtubeService.getPopularVideos('KR', 8);
            setTrendingVideos(videos);
        } catch (error) {
            console.error('Trending fetch error:', error);
            setTrendingVideos([]);
        } finally {
            setIsTrendingLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const results = await youtubeService.searchYouTube(searchQuery.trim(), 8);
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = (result: youtubeService.YouTubeSearchResult) => {
        const video: Video = {
            id: result.id,
            title: result.title,
            channelTitle: result.channelTitle,
            thumbnail: result.thumbnail,
        };
        onSelectVideo(video);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Music size={20} className="text-brand-red" />
                            시작할 음악 선택
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">어떤 음악으로 시작할까요?</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        disabled={isLoading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700 bg-gray-800/50">
                    <button
                        onClick={() => setActiveTab('recommend')}
                        className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'recommend'
                                ? 'text-white bg-gray-700/50 border-b-2 border-brand-red'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <TrendingUp size={16} />
                        추천/장르
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'search'
                                ? 'text-white bg-gray-700/50 border-b-2 border-brand-red'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <Search size={16} />
                        곡 검색
                    </button>
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 rounded-2xl">
                        <div className="text-center">
                            <Loader2 size={40} className="text-brand-red animate-spin mx-auto mb-3" />
                            <p className="text-white font-medium">AI가 추천 중...</p>
                            <p className="text-gray-400 text-sm">잠시만 기다려주세요</p>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-6">
                    {activeTab === 'recommend' ? (
                        <>
                            {/* Saved Playlists - Show first if available */}
                            {savedPlaylists.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                        <FolderOpen size={14} className="text-purple-400" />
                                        내 저장된 플레이리스트
                                    </h3>
                                    <div className="space-y-2">
                                        {savedPlaylists.map((pl) => (
                                            <button
                                                key={pl.id}
                                                onClick={() => onSelectPlaylist(pl)}
                                                disabled={isLoading}
                                                className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-purple-900/30 to-gray-800 hover:from-purple-800/40 hover:to-gray-700 rounded-xl border border-purple-500/30 hover:border-purple-400 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center">
                                                    <FolderOpen size={18} className="text-purple-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-medium text-sm truncate">{pl.name}</p>
                                                    <p className="text-purple-300 text-xs">{pl.videos.length}개 영상</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Real-time Trending Videos */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <Flame size={14} className="text-orange-400" />
                                        지금 인기 있는 음악
                                    </h3>
                                    <button
                                        onClick={fetchTrendingVideos}
                                        disabled={isTrendingLoading}
                                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCw size={12} className={isTrendingLoading ? 'animate-spin' : ''} />
                                        새로고침
                                    </button>
                                </div>

                                {isTrendingLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 size={24} className="text-orange-400 animate-spin" />
                                    </div>
                                ) : trendingVideos.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {trendingVideos.map((video, index) => (
                                            <button
                                                key={video.id}
                                                onClick={() => handleSelectSearchResult(video)}
                                                disabled={isLoading}
                                                className="w-full flex items-center gap-3 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-xl transition-all text-left group"
                                            >
                                                <span className="text-sm font-bold text-orange-400 w-5">{index + 1}</span>
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title}
                                                    className="w-12 h-9 object-cover rounded"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-xs font-medium line-clamp-1 group-hover:text-orange-400 transition-colors">
                                                        {video.title}
                                                    </p>
                                                    <p className="text-gray-500 text-xs">{video.channelTitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm text-center py-4">인기 음악을 불러올 수 없습니다</p>
                                )}
                            </div>

                            {/* Genre Selection */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-300 mb-3">🎵 장르로 시작 (AI 추천)</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {GENRE_OPTIONS.map((genre) => (
                                        <button
                                            key={genre.id}
                                            onClick={() => onSelectGenre(genre.id)}
                                            disabled={isLoading}
                                            className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 hover:border-brand-red transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="text-2xl">{genre.emoji}</span>
                                            <div>
                                                <p className="text-white font-medium text-sm">{genre.name}</p>
                                                <p className="text-gray-500 text-xs">{genre.description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Popular Chart Button */}
                            <div>
                                <button
                                    onClick={onSelectRanking}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🏆</span>
                                    <div>
                                        <p className="text-white font-bold text-lg">인기 차트 (Top 50)</p>
                                        <p className="text-white/80 text-xs text-left">지금 한국에서 가장 인기 있는 음악</p>
                                    </div>
                                </button>
                            </div>

                            {/* Help text if no saved playlists */}
                            {savedPlaylists.length === 0 && (
                                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <p className="text-gray-400 text-sm text-center">
                                        💡 플레이리스트를 저장하면 다음에 바로 사용할 수 있어요!
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Search Tab */
                        <div className="space-y-4">
                            {/* Search Input */}
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center bg-gray-800 rounded-xl px-4 py-3 border border-gray-600 focus-within:border-brand-red focus-within:ring-1 focus-within:ring-brand-red/30 transition-all">
                                    <Search size={18} className="text-gray-400 mr-3" />
                                    <input
                                        type="text"
                                        placeholder="노래 제목, 아티스트 검색..."
                                        className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-500"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-gray-500 hover:text-white">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching || !searchQuery.trim()}
                                    className="bg-brand-red hover:bg-red-600 disabled:bg-gray-700 text-white px-5 py-3 rounded-xl transition-colors font-medium flex items-center gap-2"
                                >
                                    {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                </button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-gray-400 text-xs">검색 결과 {searchResults.length}개</p>
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleSelectSearchResult(result)}
                                            className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all text-left group"
                                        >
                                            <img
                                                src={result.thumbnail}
                                                alt={result.title}
                                                className="w-16 h-12 object-cover rounded-lg"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium text-sm line-clamp-1 group-hover:text-brand-red transition-colors">
                                                    {result.title}
                                                </p>
                                                <p className="text-gray-500 text-xs">{result.channelTitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery && !isSearching ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <Search size={40} className="opacity-30 mb-3" />
                                    <p className="text-sm">검색 버튼을 눌러주세요</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <Music size={40} className="opacity-30 mb-3" />
                                    <p className="text-sm">듣고 싶은 노래를 검색해보세요</p>
                                    <p className="text-xs text-gray-500 mt-1">예: "BTS", "아이유 밤편지"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
