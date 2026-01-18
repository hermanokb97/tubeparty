import React, { useState } from 'react';
import { Play, Sparkles, Shuffle, Repeat, Repeat1, Save, FolderOpen, X, Trash2 } from 'lucide-react';
import { Video, SavedPlaylist } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlaylistProps {
  videos: Video[];
  currentVideoId: string;
  onSelectVideo: (video: Video) => void;
  onGenerateRecommendations: () => void;
  isGenerating: boolean;
  isShuffleOn?: boolean;
  repeatMode?: RepeatMode;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  savedPlaylists?: SavedPlaylist[];
  onSavePlaylist?: (name: string) => void;
  onLoadPlaylist?: (playlist: SavedPlaylist) => void;
  onDeletePlaylist?: (id: string) => void;
  onRemoveVideo?: (id: string) => void;
}

export const Playlist: React.FC<PlaylistProps> = ({
  videos,
  currentVideoId,
  onSelectVideo,
  onGenerateRecommendations,
  isGenerating,
  isShuffleOn = false,
  repeatMode = 'off',
  onToggleShuffle,
  onToggleRepeat,
  savedPlaylists = [],
  onSavePlaylist,
  onLoadPlaylist,
  onDeletePlaylist,
  onRemoveVideo
}) => {
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const handleSave = () => {
    if (playlistName.trim() && onSavePlaylist) {
      onSavePlaylist(playlistName.trim());
      setPlaylistName('');
      setShowSaveModal(false);
    }
  };

  const handleLoad = (playlist: SavedPlaylist) => {
    if (onLoadPlaylist) {
      onLoadPlaylist(playlist);
      setShowLoadModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-gray/30 rounded-lg border border-brand-gray overflow-hidden relative">
      {/* Save Modal */}
      {showSaveModal && (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-xs border border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-white font-semibold">플레이리스트 저장</h4>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              placeholder="플레이리스트 이름..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-brand-red"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!playlistName.trim()}
              className="w-full bg-brand-red hover:bg-red-600 disabled:bg-gray-600 text-white py-2 rounded text-sm transition-colors"
            >
              저장하기
            </button>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-xs border border-gray-600 max-h-[80%] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-white font-semibold">플레이리스트 불러오기</h4>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {savedPlaylists.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">저장된 플레이리스트가 없습니다.</p>
              ) : (
                savedPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between bg-gray-700 rounded p-2 hover:bg-gray-600 transition-colors"
                  >
                    <button
                      onClick={() => handleLoad(pl)}
                      className="flex-1 text-left"
                    >
                      <p className="text-white text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-gray-400 text-xs">{pl.videos.length}개 영상</p>
                    </button>
                    <button
                      onClick={() => onDeletePlaylist?.(pl.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors ml-2"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-b border-brand-gray bg-brand-dark/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Play size={16} className="text-brand-red" fill="currentColor" />
            재생 목록
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleShuffle}
              className={`p-1.5 rounded transition-colors ${isShuffleOn
                ? 'bg-green-600/30 text-green-400'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              title="랜덤 재생"
            >
              <Shuffle size={14} />
            </button>
            <button
              onClick={onToggleRepeat}
              className={`p-1.5 rounded transition-colors ${repeatMode !== 'off'
                ? 'bg-green-600/30 text-green-400'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              title={repeatMode === 'off' ? '반복 끔' : repeatMode === 'all' ? '전체 반복' : '한곡 반복'}
            >
              <RepeatIcon size={14} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={videos.length === 0}
              className="p-1.5 rounded transition-colors text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
              title="플레이리스트 저장"
            >
              <Save size={14} />
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="p-1.5 rounded transition-colors text-gray-400 hover:text-white hover:bg-white/10"
              title="플레이리스트 불러오기"
            >
              <FolderOpen size={14} />
            </button>
          </div>
        </div>
        <button
          onClick={onGenerateRecommendations}
          disabled={isGenerating}
          className="text-xs flex items-center gap-1 bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/30 transition-colors disabled:opacity-50"
        >
          <Sparkles size={12} />
          {isGenerating ? '생성 중...' : 'AI 추천 받기'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {videos.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 p-4">
            <p className="mb-2">재생 목록이 비어있습니다.</p>
            <p className="text-sm">"AI 추천 받기"를 눌러보세요!</p>
          </div>
        ) : (
          videos.map((video) => (
            <div
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-colors group
                ${currentVideoId === video.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              <div className="relative w-32 aspect-video bg-gray-800 rounded overflow-hidden flex-shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                {currentVideoId === video.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></div>
                    <span className="text-[10px] text-white font-bold">NOW</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h4 className={`text-sm font-medium truncate ${currentVideoId === video.id ? 'text-brand-red' : 'text-gray-200'}`}>
                  {video.title}
                </h4>
                <p className="text-xs text-gray-400 truncate mt-1">
                  {video.channelTitle}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveVideo?.(video.id);
                }}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center h-fit self-center"
                title="목록에서 삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};