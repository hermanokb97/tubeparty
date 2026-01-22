import React, { useState } from 'react';
import { Play, Sparkles, Shuffle, Repeat, Repeat1, Save, FolderOpen, X, Trash2, Music, GripVertical } from 'lucide-react';
import { Video, SavedPlaylist } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type RepeatMode = 'off' | 'all' | 'one';

// Sortable Video Item Component
interface SortableVideoItemProps {
  video: Video;
  index: number;
  currentVideoId: string;
  onSelectVideo: (video: Video) => void;
  onRemoveVideo?: (id: string) => void;
}

const SortableVideoItem: React.FC<SortableVideoItemProps> = ({
  video,
  index,
  currentVideoId,
  onSelectVideo,
  onRemoveVideo,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-3 p-2 rounded-lg transition-all group
        ${currentVideoId === video.id
          ? 'bg-brand-red/20 border border-brand-red/50'
          : 'hover:bg-white/5 border border-transparent'}`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
        title="드래그해서 순서 변경"
      >
        <GripVertical size={16} />
      </button>

      {/* Number */}
      <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs">
        {currentVideoId === video.id ? (
          <div className="w-3 h-3 bg-brand-red rounded-full animate-pulse"></div>
        ) : (
          <span className="text-gray-500">{index + 1}</span>
        )}
      </div>

      {/* Thumbnail - Clickable */}
      <div
        onClick={() => onSelectVideo(video)}
        className="relative w-20 h-12 bg-gray-800 rounded overflow-hidden flex-shrink-0 cursor-pointer"
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        {currentVideoId === video.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[9px] text-white font-bold bg-brand-red px-1.5 py-0.5 rounded">NOW</span>
          </div>
        )}
      </div>

      {/* Info - Clickable */}
      <div
        onClick={() => onSelectVideo(video)}
        className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer"
      >
        <h4 className={`text-sm font-medium line-clamp-1 ${currentVideoId === video.id ? 'text-brand-red' : 'text-gray-200'}`}>
          {video.title}
        </h4>
        <p className="text-xs text-gray-500 line-clamp-1">
          {video.channelTitle}
        </p>
      </div>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemoveVideo?.(video.id);
        }}
        className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
        title="목록에서 삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

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
  onReorderPlaylist?: (newOrder: Video[]) => void;
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
  onRemoveVideo,
  onReorderPlaylist
}) => {
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = videos.findIndex((v) => v.id === active.id);
      const newIndex = videos.findIndex((v) => v.id === over.id);
      const newOrder = arrayMove(videos, oldIndex, newIndex);
      onReorderPlaylist?.(newOrder);
    }
  };

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

  const currentIndex = videos.findIndex(v => v.id === currentVideoId);

  return (
    <div className="flex flex-col bg-brand-gray/30 rounded-xl border border-brand-gray overflow-hidden relative">
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

      {/* Header */}
      <div className="p-3 border-b border-brand-gray bg-gradient-to-r from-brand-dark to-gray-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-red/20 flex items-center justify-center">
              <Play size={14} className="text-brand-red" fill="currentColor" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">재생 목록</h3>
              <p className="text-xs text-gray-500">{videos.length}곡 {currentIndex >= 0 && `• ${currentIndex + 1}번째 재생 중`}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleShuffle}
            className={`p-2 rounded-lg transition-colors ${isShuffleOn
              ? 'bg-green-600/30 text-green-400'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            title="랜덤 재생"
          >
            <Shuffle size={16} />
          </button>
          <button
            onClick={onToggleRepeat}
            className={`p-2 rounded-lg transition-colors ${repeatMode !== 'off'
              ? 'bg-green-600/30 text-green-400'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            title={repeatMode === 'off' ? '반복 끔' : repeatMode === 'all' ? '전체 반복' : '한곡 반복'}
          >
            <RepeatIcon size={16} />
          </button>
          <div className="w-px h-5 bg-gray-600 mx-1"></div>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={videos.length === 0}
            className="p-2 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50"
            title="플레이리스트 저장"
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="p-2 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/10"
            title="플레이리스트 불러오기"
          >
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      {/* AI Recommend Button */}
      <div className="p-2 border-b border-brand-gray bg-gray-900/50">
        <button
          onClick={onGenerateRecommendations}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 text-purple-300 px-3 py-2 rounded-lg transition-all disabled:opacity-50 border border-purple-500/30"
        >
          <Sparkles size={16} className={isGenerating ? 'animate-spin' : ''} />
          {isGenerating ? 'AI가 추천곡을 찾고 있어요...' : '✨ AI 추천 받기'}
        </button>
      </div>

      {/* Video List - 스크롤 활성화 */}
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: '400px', minHeight: '200px' }}
      >
        {videos.length === 0 ? (
          <div className="text-center text-gray-500 py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
              <Music size={32} className="opacity-50" />
            </div>
            <p className="font-medium mb-1">재생 목록이 비어있습니다</p>
            <p className="text-sm text-gray-600">위의 "AI 추천 받기"를 눌러보세요!</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={videos.map(v => v.id)} strategy={verticalListSortingStrategy}>
              <div className="p-2 space-y-1">
                {videos.map((video, index) => (
                  <SortableVideoItem
                    key={video.id}
                    video={video}
                    index={index}
                    currentVideoId={currentVideoId}
                    onSelectVideo={onSelectVideo}
                    onRemoveVideo={onRemoveVideo}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};