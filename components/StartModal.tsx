import React, { useState } from 'react';
import { Music, FolderOpen, X, Loader2 } from 'lucide-react';
import { Video, SavedPlaylist } from '../types';
import { GenreType, GENRE_OPTIONS } from '../constants';

interface StartModalProps {
    savedPlaylists: SavedPlaylist[];
    isLoading: boolean;
    onSelectGenre: (genre: GenreType) => void;
    onSelectPlaylist: (playlist: SavedPlaylist) => void;
    onClose: () => void;
}

export const StartModal: React.FC<StartModalProps> = ({
    savedPlaylists,
    isLoading,
    onSelectGenre,
    onSelectPlaylist,
    onClose
}) => {
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

                    {/* Saved Playlists */}
                    {savedPlaylists.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                <FolderOpen size={14} />
                                내 저장된 플레이리스트
                            </h3>
                            <div className="space-y-2">
                                {savedPlaylists.map((pl) => (
                                    <button
                                        key={pl.id}
                                        onClick={() => onSelectPlaylist(pl)}
                                        disabled={isLoading}
                                        className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 hover:border-purple-500 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                                            <FolderOpen size={18} className="text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium text-sm truncate">{pl.name}</p>
                                            <p className="text-gray-500 text-xs">{pl.videos.length}개 영상</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
