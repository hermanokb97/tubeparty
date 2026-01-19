import React, { useState } from 'react';
import { Search, X, ListMusic, Plus, Loader2, Music2, Sparkles } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import { CURATED_PLAYLISTS, getPlaylistsByCategory, CuratedPlaylist } from '../constants';

interface PlaylistBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlaylist: (playlistId: string, title: string) => void;
}

export const PlaylistBrowser: React.FC<PlaylistBrowserProps> = ({
    isOpen,
    onClose,
    onSelectPlaylist,
}) => {
    const [activeTab, setActiveTab] = useState<'curated' | 'search'>('curated');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<youtubeService.PlaylistSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);

    const playlistsByCategory = getPlaylistsByCategory();

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-gray-900 to-brand-dark rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700/50 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-700/50 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-brand-red/20">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-purple-600 rounded-lg">
                                <ListMusic size={24} />
                            </div>
                            재생목록 탐색
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">원하는 재생목록을 선택하면 모든 곡이 추가됩니다</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700/50 bg-gray-900/50">
                    <button
                        onClick={() => setActiveTab('curated')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'curated'
                                ? 'text-white bg-gradient-to-r from-purple-600/20 to-transparent border-b-2 border-purple-500'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <Sparkles size={18} />
                        추천 재생목록
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'search'
                                ? 'text-white bg-gradient-to-r from-brand-red/20 to-transparent border-b-2 border-brand-red'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <Search size={18} />
                        재생목록 검색
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {activeTab === 'curated' ? (
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
                                                className="group relative rounded-xl overflow-hidden bg-gray-800/50 hover:bg-gray-700/70 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10"
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
                                                            <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
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
                    ) : (
                        <div className="space-y-5">
                            {/* Search Input */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 flex items-center bg-gray-800/80 rounded-xl px-4 py-3 border border-gray-600 focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20 transition-all">
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
                                    className="bg-brand-red hover:bg-red-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-xl transition-colors font-medium flex items-center gap-2"
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
                                            className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 hover:bg-gray-700/70 transition-all text-left group hover:scale-[1.02]"
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
                                    <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                                        <ListMusic size={48} className="opacity-50" />
                                    </div>
                                    <p className="text-lg">재생목록을 검색하세요</p>
                                    <p className="text-sm mt-2 text-gray-500">
                                        예: "lofi playlist", "kpop 2024", "workout music"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
