import React, { useState } from 'react';
import { Play, Sparkles, Shuffle, Repeat, Repeat1, Save, FolderOpen, X, Trash2, Music, GripVertical } from 'lucide-react';
import { Video, SavedPlaylist } from '../types';
import { useI18n } from '../services/i18n';
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
  const { t } = useI18n();
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
          ? 'bg-brand-red/15 border border-brand-red/40'
          : 'hover:bg-white/[0.07] border border-transparent'}`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
        title={t('dragToReorder')}
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
        className="relative w-20 h-12 bg-white/10 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        {currentVideoId === video.id && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-[9px] text-white font-semibold bg-brand-red px-1.5 py-0.5 rounded">NOW</span>
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
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-gray-500 transition-all hover:bg-red-500/10 hover:text-red-500 lg:h-8 lg:w-8 lg:opacity-0 lg:group-hover:opacity-100"
        title={t('removeFromList')}
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
  hasApiKey?: boolean;
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
  onBrowse?: () => void;
}

export const Playlist: React.FC<PlaylistProps> = ({
  videos,
  currentVideoId,
  onSelectVideo,
  onGenerateRecommendations,
  isGenerating,
  hasApiKey = true,
  isShuffleOn = false,
  repeatMode = 'off',
  onToggleShuffle,
  onToggleRepeat,
  savedPlaylists = [],
  onSavePlaylist,
  onLoadPlaylist,
  onDeletePlaylist,
  onRemoveVideo,
  onReorderPlaylist,
  onBrowse,
}) => {
  const { t } = useI18n();
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-none apple-surface shadow-none">
      {/* Save Modal */}
      {showSaveModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4">
          <div className="apple-surface-strong rounded-lg p-4 w-full max-w-xs">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-white font-semibold">{t('savePlaylist')}</h4>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              placeholder={t('playlistNamePlaceholder')}
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full apple-control apple-focus rounded px-3 py-2 text-white text-sm mb-3"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!playlistName.trim()}
              className="w-full bg-brand-red hover:bg-[#2997ff] disabled:bg-gray-600 text-white py-2 rounded text-sm transition-colors"
            >
              {t('save')}
            </button>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4">
          <div className="apple-surface-strong rounded-lg p-4 w-full max-w-xs max-h-[80%] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-white font-semibold">{t('loadPlaylist')}</h4>
              <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {savedPlaylists.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('noSavedPlaylists')}</p>
              ) : (
                savedPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between bg-white/10 rounded p-2 hover:bg-white/15 transition-colors"
                  >
                    <button
                      onClick={() => handleLoad(pl)}
                      className="flex-1 text-left"
                    >
                      <p className="text-white text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-gray-400 text-xs">{pl.videos.length}{t('videos')}</p>
                    </button>
                    <button
                      onClick={() => onDeletePlaylist?.(pl.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors ml-2"
                      title={t('delete')}
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
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/25 p-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/15">
            <Play size={14} className="text-brand-red" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{t('playlistTitle')}</h3>
            <p className="truncate text-xs text-gray-500">{videos.length} {t('songs')} {currentIndex >= 0 && `• ${currentIndex + 1}${t('nowPlaying')}`}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onBrowse && (
            <button
              onClick={onBrowse}
              className="flex h-11 items-center gap-1 rounded-lg px-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
              title={t('browseMusic')}
            >
              <Music size={16} />
              <span className="hidden sm:inline">{t('browseMusic')}</span>
            </button>
          )}
          <button
            onClick={onToggleShuffle}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${isShuffleOn
              ? 'bg-[#30D158]/15 text-[#30D158]'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            title={t('randomPlay')}
          >
            <Shuffle size={16} />
          </button>
          <button
            onClick={onToggleRepeat}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${repeatMode !== 'off'
              ? 'bg-[#30D158]/15 text-[#30D158]'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            title={repeatMode === 'off' ? t('repeatOff') : repeatMode === 'all' ? t('repeatAll') : t('repeatOne')}
          >
            <RepeatIcon size={16} />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1"></div>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={videos.length === 0}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            title={t('savePlaylist')}
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            title={t('loadPlaylist')}
          >
            <FolderOpen size={16} />
          </button>
        </div>
      </div>

      {/* AI Recommend Button - API 키가 있을 때만 활성화 */}
      <div className="p-2 border-b border-white/10 bg-white/[0.035]">
        <button
          onClick={onGenerateRecommendations}
          disabled={isGenerating || !hasApiKey}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-all ${
            hasApiKey 
              ? 'bg-[#5E5CE6]/15 hover:bg-[#5E5CE6]/25 text-[#BFBEFF] border-[#5E5CE6]/30 disabled:opacity-50'
              : 'bg-white/5 text-gray-500 border-white/10 cursor-not-allowed'
          }`}
          title={!hasApiKey ? 'API 키가 없어 AI 추천을 사용할 수 없습니다' : ''}
        >
          <Sparkles size={16} className={isGenerating ? 'animate-spin' : ''} />
          {isGenerating ? t('aiRecommending') : hasApiKey ? t('aiRecommendButton') : '🔒 AI 추천 (API 필요)'}
        </button>
      </div>

      {/* Video List - 스크롤 활성화 */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {videos.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-white/10">
              <Music size={32} className="opacity-50" />
            </div>
            <p className="text-sm leading-relaxed">{t('emptyPlaylist')}</p>
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
