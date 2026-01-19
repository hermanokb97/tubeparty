import React, { useState } from 'react';
import { Search, X, Play, Plus, Loader2 } from 'lucide-react';
import * as youtubeService from '../services/youtubeService';
import { Video } from '../types';

interface YouTubeSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectVideo: (video: Video) => void;
}

interface SearchResult {
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
}

export const YouTubeSearchModal: React.FC<YouTubeSearchModalProps> = ({
    isOpen,
    onClose,
    onSelectVideo,
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setHasSearched(true);

        try {
            const searchResults = await youtubeService.searchYouTube(query.trim(), 10);
            setResults(searchResults);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSelectVideo = (result: SearchResult) => {
        const video: Video = {
            id: result.id,
            title: result.title,
            channelTitle: result.channelTitle,
            thumbnail: result.thumbnail,
        };
        onSelectVideo(video);
        onClose();
        setQuery('');
        setResults([]);
        setHasSearched(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-brand-gray/95 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700 shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Search size={20} className="text-brand-red" />
                        YouTube 검색
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center bg-gray-800 rounded-xl px-4 py-3 border border-gray-600 focus-within:border-brand-red transition-colors">
                        <Search size={18} className="text-gray-400 mr-3" />
                        <input
                            type="text"
                            placeholder="노래 제목, 아티스트, 키워드 검색..."
                            className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading || !query.trim()}
                            className="ml-3 bg-brand-red hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium"
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            검색
                        </button>
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Loader2 size={32} className="animate-spin mb-3" />
                            <p>검색 중...</p>
                        </div>
                    ) : results.length > 0 ? (
                        results.map((result) => (
                            <div
                                key={result.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/70 transition-colors cursor-pointer group"
                                onClick={() => handleSelectVideo(result)}
                            >
                                <div className="relative flex-shrink-0">
                                    <img
                                        src={result.thumbnail}
                                        alt={result.title}
                                        className="w-24 h-14 object-cover rounded-lg"
                                    />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                        <Play size={20} className="text-white" fill="white" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-medium line-clamp-1 group-hover:text-brand-red transition-colors">
                                        {result.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm line-clamp-1">
                                        {result.channelTitle}
                                    </p>
                                </div>
                                <button className="flex-shrink-0 p-2 bg-brand-red/20 hover:bg-brand-red text-brand-red hover:text-white rounded-full transition-colors">
                                    <Plus size={18} />
                                </button>
                            </div>
                        ))
                    ) : hasSearched ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Search size={48} className="mb-3 opacity-50" />
                            <p>검색 결과가 없습니다.</p>
                            <p className="text-sm mt-1">다른 키워드로 시도해보세요.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Search size={48} className="mb-3 opacity-50" />
                            <p>원하는 노래를 검색하세요!</p>
                            <p className="text-sm mt-1 text-gray-500">
                                노래 제목, 아티스트 이름 등으로 검색할 수 있어요
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer hint */}
                <div className="p-3 border-t border-gray-700 text-center text-xs text-gray-500">
                    클릭하면 바로 재생됩니다 • AI 추천곡이 재생되지 않을 때 사용하세요
                </div>
            </div>
        </div>
    );
};
