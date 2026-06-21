import React, { useState, useEffect } from 'react';
import { Search, X, ListMusic, Plus, Loader2, Sparkles, TrendingUp, Music, RefreshCw, Play, ListPlus } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import { getPlaylistsByCategory } from '../constants';
import { Video } from '../types';

// Genre definitions for top 50
const GENRE_CHARTS = [
    { id: 'kpop', name: 'KPOP', emoji: '🎤', query: 'kpop 2024 official mv', color: 'from-pink-500 to-purple-600' },
    { id: 'jpop', name: 'JPOP', emoji: '🇯🇵', query: 'jpop 2024 official mv', color: 'from-red-400 to-pink-500' },
    { id: 'pop', name: 'Pop', emoji: '🎵', query: 'pop music 2024 official', color: 'from-blue-500 to-cyan-600' },
    { id: 'hiphop', name: 'Hip-Hop', emoji: '🎤', query: 'hip hop 2024 official mv', color: 'from-orange-500 to-red-600' },
    { id: 'rnb', name: 'R&B', emoji: '💜', query: 'rnb music 2024', color: 'from-purple-500 to-pink-600' },
    { id: 'ballad', name: '발라드', emoji: '💕', query: '한국 발라드 2024', color: 'from-rose-400 to-pink-500' },
    { id: 'edm', name: 'EDM', emoji: '🎧', query: 'edm electronic music 2024', color: 'from-cyan-500 to-blue-600' },
    { id: 'lofi', name: 'Lofi', emoji: '🎹', query: 'lofi hip hop chill beats', color: 'from-indigo-400 to-purple-500' },
    { id: 'indie', name: 'Indie', emoji: '🎸', query: 'indie music 2024', color: 'from-green-500 to-teal-600' },
];

export type AddMode = 'playNow' | 'playNext';

interface PlaylistBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlaylist: (playlistId: string, title: string) => void;
    onSelectVideos?: (videos: Video[], mode: AddMode) => void;
}

export const PlaylistBrowser: React.FC<PlaylistBrowserProps> = ({
    isOpen,
    onClose,
    onSelectPlaylist,
    onSelectVideos,
}) => {
    const [activeTab, setActiveTab] = useState<'charts' | 'curated' | 'search' | 'songSearch'>('charts');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<youtubeService.PlaylistSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);

    // Genre charts state
    const [selectedGenre, setSelectedGenre] = useState(GENRE_CHARTS[0]);
    const [genreVideos, setGenreVideos] = useState<youtubeService.YouTubeSearchResult[]>([]);
    const [isGenreLoading, setIsGenreLoading] = useState(false);
    const [selectedGenreVideos, setSelectedGenreVideos] = useState<Set<string>>(new Set());

    // Song search state
    const [songSearchQuery, setSongSearchQuery] = useState('');
    const [songSearchResults, setSongSearchResults] = useState<youtubeService.YouTubeSearchResult[]>([]);
    const [isSongSearchLoading, setIsSongSearchLoading] = useState(false);
    const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

    // Action modal state for Play Now / Play Next selection
    const [actionModalVideo, setActionModalVideo] = useState<youtubeService.YouTubeSearchResult | null>(null);

    const playlistsByCategory = getPlaylistsByCategory();

    // Fetch genre videos when selected genre changes
    useEffect(() => {
        if (activeTab === 'charts') {
            fetchGenreVideos();
        }
    }, [selectedGenre, activeTab]);

    const fetchGenreVideos = async () => {
        setIsGenreLoading(true);
        setSelectedGenreVideos(new Set()); // Reset selection on genre change
        try {
            const videos = await youtubeService.searchYouTube(selectedGenre.query, 50);
            setGenreVideos(videos);
        } catch (error) {
            console.error('Genre fetch error:', error);
            setGenreVideos([]);
        } finally {
            setIsGenreLoading(false);
        }
    };

    const toggleGenreVideoSelection = (videoId: string) => {
        setSelectedGenreVideos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(videoId)) {
                newSet.delete(videoId);
            } else {
                newSet.add(videoId);
            }
            return newSet;
        });
    };

    const handleAddSelectedGenreVideos = (mode: AddMode) => {
        if (onSelectVideos && selectedGenreVideos.size > 0) {
            const videos: Video[] = genreVideos
                .filter(v => selectedGenreVideos.has(v.id))
                .map(v => ({
                    id: v.id,
                    title: v.title,
                    channelTitle: v.channelTitle,
                    thumbnail: v.thumbnail
                }));
            onSelectVideos(videos, mode);
            onClose();
        }
    };

    const selectAllGenreVideos = () => {
        setSelectedGenreVideos(new Set(genreVideos.map(v => v.id)));
    };

    const deselectAllGenreVideos = () => {
        setSelectedGenreVideos(new Set());
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        try {
            const results = await youtubeService.searchPlaylists(searchQuery.trim(), 10);
            setSearchResults(results);
        } catch (error) {
            console.error('Playlist search error:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPlaylist = async (playlistId: string, title: string) => {
        setLoadingPlaylistId(playlistId);
        await onSelectPlaylist(playlistId, title);
        setLoadingPlaylistId(null);
        onClose();
    };

    const handleSelectAllGenreVideos = (mode: AddMode) => {
        if (onSelectVideos && genreVideos.length > 0) {
            const videos: Video[] = genreVideos.map(v => ({
                id: v.id,
                title: v.title,
                channelTitle: v.channelTitle,
                thumbnail: v.thumbnail
            }));
            onSelectVideos(videos, mode);
            onClose();
        }
    };

    // Show action modal for single video selection
    const showVideoActionModal = (video: youtubeService.YouTubeSearchResult) => {
        setActionModalVideo(video);
    };

    const handleSelectSingleVideo = (video: youtubeService.YouTubeSearchResult, mode: AddMode) => {
        if (onSelectVideos) {
            onSelectVideos([{
                id: video.id,
                title: video.title,
                channelTitle: video.channelTitle,
                thumbnail: video.thumbnail
            }], mode);
            setActionModalVideo(null);
            onClose();
        }
    };

    // Song search handlers
    const handleSongSearch = async () => {
        if (!songSearchQuery.trim()) return;

        setIsSongSearchLoading(true);
        setSelectedSongs(new Set()); // Reset selection on new search
        try {
            const results = await youtubeService.searchYouTube(songSearchQuery.trim(), 20);
            setSongSearchResults(results);
        } catch (error) {
            console.error('Song search error:', error);
            setSongSearchResults([]);
        } finally {
            setIsSongSearchLoading(false);
        }
    };

    const toggleSongSelection = (videoId: string) => {
        setSelectedSongs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(videoId)) {
                newSet.delete(videoId);
            } else {
                newSet.add(videoId);
            }
            return newSet;
        });
    };

    const handleAddSelectedSongs = (mode: AddMode) => {
        if (onSelectVideos && selectedSongs.size > 0) {
            const videos: Video[] = songSearchResults
                .filter(v => selectedSongs.has(v.id))
                .map(v => ({
                    id: v.id,
                    title: v.title,
                    channelTitle: v.channelTitle,
                    thumbnail: v.thumbnail
                }));
            onSelectVideos(videos, mode);
            onClose();
        }
    };

    const selectAllSongs = () => {
        setSelectedSongs(new Set(songSearchResults.map(v => v.id)));
    };

    const deselectAllSongs = () => {
        setSelectedSongs(new Set());
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            onClick={(e) => {
                // 바깥쪽 클릭 시 닫기
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="apple-surface rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                            <div className="p-2 bg-[#5E5CE6] rounded-lg">
                                <ListMusic size={24} />
                            </div>
                            재생목록 탐색
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">장르별 인기 차트와 재생목록을 탐색하세요</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="m-4 mb-0 flex apple-control rounded-lg overflow-hidden">
                    <button
                        onClick={() => setActiveTab('charts')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'charts'
                            ? 'text-white bg-brand-red'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <TrendingUp size={18} />
                        장르별 Top 50
                    </button>
                    <button
                        onClick={() => setActiveTab('curated')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'curated'
                            ? 'text-white bg-brand-red'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Sparkles size={18} />
                        추천 재생목록
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'search'
                            ? 'text-white bg-brand-red'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <ListMusic size={18} />
                        재생목록 검색
                    </button>
                    <button
                        onClick={() => setActiveTab('songSearch')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'songSearch'
                            ? 'text-white bg-brand-red'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        <Search size={18} />
                        🎵 노래 검색
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {activeTab === 'charts' ? (
                        <div className="space-y-5">
                            {/* Genre Selector */}
                            <div className="flex flex-wrap gap-2">
                                {GENRE_CHARTS.map((genre) => (
                                    <button
                                        key={genre.id}
                                        onClick={() => setSelectedGenre(genre)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${selectedGenre.id === genre.id
                                            ? `bg-gradient-to-r ${genre.color} text-white shadow-lg`
                                            : 'bg-white/[0.07] text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        <span>{genre.emoji}</span>
                                        <span>{genre.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Selected Genre Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{selectedGenre.emoji}</span>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedGenre.name} Top 50</h3>
                                        <p className="text-gray-400 text-sm">실시간 인기 음악</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={fetchGenreVideos}
                                        disabled={isGenreLoading}
                                        className="px-3 py-2 apple-control rounded-lg text-sm text-gray-300 flex items-center gap-2 transition-colors"
                                    >
                                        <RefreshCw size={14} className={isGenreLoading ? 'animate-spin' : ''} />
                                        새로고침
                                    </button>
                                    {onSelectVideos && genreVideos.length > 0 && (
                                        <button
                                            onClick={() => handleSelectAllGenreVideos('playNow')}
                                            className={`px-4 py-2 bg-gradient-to-r ${selectedGenre.color} rounded-lg text-sm text-white font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg`}
                                        >
                                            <Plus size={16} />
                                            전체 추가 ({genreVideos.length}곡)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Selection Controls for Genre Videos */}
                            {genreVideos.length > 0 && (
                                <div className="flex items-center justify-between apple-control rounded-lg px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-400">
                                            {selectedGenreVideos.size > 0 ? (
                                                <span className="text-orange-400 font-medium">{selectedGenreVideos.size}곡 선택됨</span>
                                            ) : (
                                                '곡을 선택하세요'
                                            )}
                                        </span>
                                        <button
                                            onClick={selectAllGenreVideos}
                                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                                        >
                                            전체 선택
                                        </button>
                                        <button
                                            onClick={deselectAllGenreVideos}
                                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                                        >
                                            선택 해제
                                        </button>
                                    </div>
                                    {selectedGenreVideos.size > 0 && onSelectVideos && (
                                        <button
                                            onClick={() => handleAddSelectedGenreVideos('playNow')}
                                            className={`bg-gradient-to-r ${selectedGenre.color} text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg`}
                                        >
                                            <Plus size={16} />
                                            선택한 {selectedGenreVideos.size}곡 추가
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Genre Videos List */}
                            {isGenreLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 size={40} className="text-orange-400 animate-spin" />
                                </div>
                            ) : genreVideos.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2">
                                    {genreVideos.map((video, index) => (
                                        <button
                                            key={video.id}
                                            onClick={() => toggleGenreVideoSelection(video.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left group ${selectedGenreVideos.has(video.id)
                                                ? 'bg-orange-600/20 border-2 border-orange-500'
                                                : 'bg-white/[0.055] hover:bg-white/10 border-2 border-transparent'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all ${selectedGenreVideos.has(video.id)
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-white/10 border border-white/15'
                                                }`}>
                                                {selectedGenreVideos.has(video.id) && (
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className={`text-lg font-bold w-6 text-center ${index < 3 ? 'text-orange-400' : 'text-gray-500'}`}>
                                                {index + 1}
                                            </span>
                                            <img
                                                src={video.thumbnail}
                                                alt={video.title}
                                                className="w-16 h-12 object-cover rounded-lg"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium line-clamp-1 transition-colors ${selectedGenreVideos.has(video.id) ? 'text-orange-400' : 'text-white group-hover:text-orange-400'
                                                    }`}>
                                                    {video.title}
                                                </p>
                                                <p className="text-gray-500 text-xs">{video.channelTitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <Music size={48} className="opacity-30 mb-3" />
                                    <p className="text-lg">음악을 불러올 수 없습니다</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'curated' ? (
                        <div className="space-y-8">
                            {Object.entries(playlistsByCategory).map(([category, playlists]) => (
                                <div key={category}>
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="text-2xl">{category.split(' ')[0]}</span>
                                        <span>{category.split(' ').slice(1).join(' ')}</span>
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {playlists.map((playlist) => (
                                            <button
                                                key={playlist.id}
                                                onClick={() => handleSelectPlaylist(playlist.id, playlist.title)}
                                                disabled={loadingPlaylistId === playlist.id}
                                                className="group relative rounded-lg overflow-hidden bg-white/[0.055] hover:bg-white/10 transition-all hover:shadow-xl hover:shadow-black/20"
                                            >
                                                {/* Thumbnail */}
                                                <div className="aspect-video relative">
                                                    <img
                                                        src={playlist.thumbnail}
                                                        alt={playlist.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                                    {/* Play overlay */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                                        {loadingPlaylistId === playlist.id ? (
                                                            <Loader2 size={40} className="text-white animate-spin" />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-lg bg-[#5E5CE6] flex items-center justify-center shadow-lg">
                                                                <Plus size={28} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="p-3">
                                                    <h4 className="text-white font-semibold text-sm line-clamp-1 group-hover:text-purple-400 transition-colors">
                                                        {playlist.title}
                                                    </h4>
                                                    <p className="text-gray-500 text-xs mt-1 line-clamp-1">
                                                        {playlist.description}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'search' ? (
                        <div className="space-y-5">
                            {/* Search Input */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 flex items-center apple-control apple-focus rounded-lg px-4 py-3 transition-all">
                                    <Search size={20} className="text-gray-400 mr-3" />
                                    <input
                                        type="text"
                                        placeholder="재생목록 검색... (예: kpop playlist, workout music)"
                                        className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-500 text-lg"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-white mr-2">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    className="bg-brand-red hover:bg-[#2997ff] disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                                    검색
                                </button>
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {searchResults.map((playlist) => (
                                        <button
                                            key={playlist.id}
                                            onClick={() => handleSelectPlaylist(playlist.id, playlist.title)}
                                            disabled={loadingPlaylistId === playlist.id}
                                            className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.055] hover:bg-white/10 transition-all text-left group"
                                        >
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={playlist.thumbnail}
                                                    alt={playlist.title}
                                                    className="w-28 h-20 object-cover rounded-lg"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg">
                                                    {loadingPlaylistId === playlist.id ? (
                                                        <Loader2 size={24} className="text-white animate-spin" />
                                                    ) : (
                                                        <Plus size={24} className="text-white" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-semibold line-clamp-2 group-hover:text-brand-red transition-colors">
                                                    {playlist.title}
                                                </h4>
                                                <p className="text-gray-500 text-sm mt-1">
                                                    {playlist.channelTitle}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <div className="w-24 h-24 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                                        <ListMusic size={48} className="opacity-50" />
                                    </div>
                                    <p className="text-lg">재생목록을 검색하세요</p>
                                    <p className="text-sm mt-2 text-gray-500">
                                        예: "lofi playlist", "kpop 2024", "workout music"
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'songSearch' ? (
                        <div className="space-y-5">
                            {/* Song Search Input */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 flex items-center apple-control apple-focus rounded-lg px-4 py-3 transition-all">
                                    <Search size={20} className="text-gray-400 mr-3" />
                                    <input
                                        type="text"
                                        placeholder="노래 검색... (예: IU 밤편지, BTS Dynamite)"
                                        className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-500 text-lg"
                                        value={songSearchQuery}
                                        onChange={(e) => setSongSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSongSearch()}
                                        autoFocus={activeTab === 'songSearch'}
                                    />
                                    {songSearchQuery && (
                                        <button onClick={() => setSongSearchQuery('')} className="text-gray-500 hover:text-white mr-2">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSongSearch}
                                    disabled={isSongSearchLoading}
                                    className="bg-[#30D158] hover:bg-[#32D74B] disabled:bg-gray-600 text-black px-6 py-3 rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    {isSongSearchLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                                    검색
                                </button>
                            </div>

                            {/* Selection Controls */}
                            {songSearchResults.length > 0 && (
                                <div className="flex items-center justify-between apple-control rounded-lg px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-400">
                                            {selectedSongs.size > 0 ? (
                                                <span className="text-green-400 font-medium">{selectedSongs.size}곡 선택됨</span>
                                            ) : (
                                                '노래를 선택하세요'
                                            )}
                                        </span>
                                        <button
                                            onClick={selectAllSongs}
                                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                                        >
                                            전체 선택
                                        </button>
                                        <button
                                            onClick={deselectAllSongs}
                                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                                        >
                                            선택 해제
                                        </button>
                                    </div>
                                    {selectedSongs.size > 0 && onSelectVideos && (
                                        <button
                                            onClick={() => handleAddSelectedSongs('playNow')}
                                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg"
                                        >
                                            <Plus size={16} />
                                            선택한 {selectedSongs.size}곡 추가
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Song Search Results */}
                            {isSongSearchLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 size={40} className="text-green-400 animate-spin" />
                                </div>
                            ) : songSearchResults.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                    {songSearchResults.map((video, index) => (
                                        <button
                                            key={video.id}
                                            onClick={() => toggleSongSelection(video.id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left group ${selectedSongs.has(video.id)
                                                ? 'bg-green-600/20 border-2 border-green-500'
                                                : 'bg-white/[0.055] hover:bg-white/10 border-2 border-transparent'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all ${selectedSongs.has(video.id)
                                                ? 'bg-green-500 text-white'
                                                : 'bg-white/10 border border-white/15'
                                                }`}>
                                                {selectedSongs.has(video.id) && (
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <img
                                                src={video.thumbnail}
                                                alt={video.title}
                                                className="w-16 h-12 object-cover rounded-lg"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium line-clamp-1 transition-colors ${selectedSongs.has(video.id) ? 'text-green-400' : 'text-white group-hover:text-green-400'
                                                    }`}>
                                                    {video.title}
                                                </p>
                                                <p className="text-gray-500 text-xs">{video.channelTitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <div className="w-24 h-24 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                                        <Music size={48} className="opacity-50" />
                                    </div>
                                    <p className="text-lg">노래를 검색하세요</p>
                                    <p className="text-sm mt-2 text-gray-500">
                                        여러 곡을 선택해서 한 번에 추가할 수 있어요!
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
