import React, { useState, useEffect, useCallback } from 'react';
import { Message, User, Video, TabType, SyncAction, SavedPlaylist, Room } from './types';
import { VideoPlayer } from './components/VideoPlayer';
import { ChatRoom } from './components/ChatRoom';
import { Playlist, RepeatMode } from './components/Playlist';
import { Onboarding } from './components/Onboarding';
import { StartModal } from './components/StartModal';
import { extractVideoId, getAiChatResponse, getVideoRecommendations, getGenreRecommendations } from './services/geminiService';
import * as syncService from './services/syncService';
import * as playlistStorage from './services/playlistStorage';
import * as firebaseService from './services/firebaseService';
import { GenreType, GENRE_OPTIONS } from './constants';
import { MonitorPlay, MessageSquare, ListVideo, Link as LinkIcon, Plus, Share2, Check, Copy } from 'lucide-react';

// Initial Data
const SYSTEM_AI: User = { id: 'ai-1', name: 'TubeBot', avatar: '', isAi: true };

const INITIAL_VIDEO: Video = {
  id: 'jfKfPfyJRdk', // lofi hip hop radio
  title: 'lofi hip hop radio - beats to relax/study to',
  channelTitle: 'Lofi Girl',
  thumbnail: 'https://picsum.photos/seed/lofi/320/180'
};

const App: React.FC = () => {
  // --- State ---
  const [hasJoined, setHasJoined] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [users, setUsers] = useState<User[]>([SYSTEM_AI]);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', userId: 'ai-1', text: '안녕! TubeParty에 온 걸 환영해! 👋', timestamp: Date.now() }
  ]);
  const [playlist, setPlaylist] = useState<Video[]>([INITIAL_VIDEO]);
  const [currentVideo, setCurrentVideo] = useState<Video>(INITIAL_VIDEO);

  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(TabType.CHAT);

  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Shuffle & Repeat State
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  // Saved Playlists State
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);

  // Room State
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  // Start Modal State
  const [showStartModal, setShowStartModal] = useState(false);
  const [isStartLoading, setIsStartLoading] = useState(false);

  // --- Sync Logic (Local Tabs) ---
  useEffect(() => {
    if (!hasJoined) return;

    // Listen to sync events from other tabs
    const unsubscribe = syncService.listen((action: SyncAction) => {
      switch (action.type) {
        case 'JOIN':
          if (!users.some(u => u.id === action.payload.user.id)) {
            setUsers(prev => [...prev, action.payload.user]);
            setMessages(prev => [...prev, {
              id: `sys-${Date.now()}`,
              userId: 'ai-1',
              text: `${action.payload.user.name}님이 입장했어! 🎉`,
              timestamp: Date.now()
            }]);
          }
          break;
        case 'CHAT':
          setMessages(prev => {
            if (prev.some(m => m.id === action.payload.message.id)) return prev;
            return [...prev, action.payload.message];
          });
          break;
        case 'VIDEO_CHANGE':
          setCurrentVideo(action.payload.video);
          setPlaylist(prev => {
            if (prev.some(v => v.id === action.payload.video.id)) return prev;
            return [action.payload.video, ...prev];
          });
          setMessages(prev => [...prev, {
            id: `sys-vid-${Date.now()}`,
            userId: 'ai-1',
            text: `영상이 변경되었어! 📺: ${action.payload.video.title}`,
            timestamp: Date.now()
          }]);
          break;
      }
    });

    return () => unsubscribe();
  }, [hasJoined, users]);

  // --- Firebase Real-time Sync ---
  useEffect(() => {
    if (!hasJoined || !currentRoom) return;

    // Subscribe to room updates from Firebase
    const unsubscribe = firebaseService.subscribeToRoom(currentRoom.id, (data) => {
      if (data.currentVideo && data.currentVideo.id !== currentVideo.id) {
        setCurrentVideo(data.currentVideo);
      }
      if (data.playlist && data.playlist.length > 0) {
        setPlaylist(data.playlist);
      }
    });

    return () => unsubscribe();
  }, [hasJoined, currentRoom?.id]);

  // --- Handlers ---

  const handleCreateRoom = async (nickname: string, apiKey: string) => {
    try {
      const newRoom = await firebaseService.createRoom(apiKey, nickname);
      setCurrentRoom(newRoom);

      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: nickname,
        avatar: '',
        isAi: false
      };
      setCurrentUser(newUser);
      setUsers(prev => [...prev, newUser]);
      setHasJoined(true);
      setShowStartModal(true);

      // Welcome message with room code
      setMessages(prev => [...prev, {
        id: `room-created-${Date.now()}`,
        userId: 'ai-1',
        text: `방이 생성됐어! 방 코드: 📋 ${newRoom.id}`,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('방 생성에 실패했어요. 다시 시도해주세요.');
    }
  };

  const handleJoinRoom = async (nickname: string, roomCode: string) => {
    try {
      const room = await firebaseService.getRoom(roomCode.toUpperCase());
      if (!room) {
        alert('존재하지 않는 방 코드입니다.');
        return;
      }

      setCurrentRoom(room);

      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: nickname,
        avatar: '',
        isAi: false
      };
      setCurrentUser(newUser);
      setUsers(prev => [...prev, newUser]);
      setHasJoined(true);

      // Welcome message
      setMessages(prev => [...prev, {
        id: `joined-${Date.now()}`,
        userId: 'ai-1',
        text: `${nickname}님이 입장했어! 환영해! 🎉`,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to join room:', error);
      alert('방 참가에 실패했어요. 다시 시도해주세요.');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser) return;

    const newMessage: Message = {
      id: `${currentUser.id}-${Date.now()}`,
      userId: currentUser.id,
      text,
      timestamp: Date.now()
    };

    // Update local and broadcast
    setMessages(prev => [...prev, newMessage]);
    syncService.broadcast({ type: 'CHAT', payload: { message: newMessage } });

    // AI Logic
    const shouldAiReply = text.includes('@AI') || text.includes('추천') || Math.random() < 0.2;

    if (shouldAiReply) {
      setIsAiTyping(true);
      const history = messages.slice(-5).map(m => ({
        role: users.find(u => u.id === m.userId)?.isAi ? 'ai' : 'user',
        text: m.text
      }));
      history.push({ role: 'user', text });

      const reply = await getAiChatResponse(history, currentVideo.title, currentRoom?.apiKey || '');

      const aiMessage: Message = {
        id: `ai-reply-${Date.now()}`,
        userId: 'ai-1',
        text: reply,
        timestamp: Date.now()
      };

      setIsAiTyping(false);
      setMessages(prev => [...prev, aiMessage]);
      syncService.broadcast({ type: 'CHAT', payload: { message: aiMessage } });
    }
  };

  const handleAddVideo = () => {
    const videoId = extractVideoId(urlInput);
    if (videoId) {
      const newVideo: Video = {
        id: videoId,
        title: `YouTube Video (${videoId})`,
        channelTitle: 'Unknown Channel',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      };

      handleVideoChange(newVideo);
      setUrlInput('');
    } else {
      alert('올바른 유튜브 링크가 아닙니다.');
    }
  };

  const handleVideoChange = (video: Video) => {
    setCurrentVideo(video);
    setPlaylist(prev => {
      const newPlaylist = prev.some(v => v.id === video.id) ? prev : [video, ...prev];
      // Sync to Firebase
      if (currentRoom) {
        firebaseService.updateCurrentVideo(currentRoom.id, video);
        firebaseService.updatePlaylist(currentRoom.id, newPlaylist);
      }
      return newPlaylist;
    });

    // Broadcast video change (for local tabs)
    syncService.broadcast({ type: 'VIDEO_CHANGE', payload: { video } });
  };

  const handleGenerateRecommendations = async () => {
    setIsGenerating(true);
    const recs = await getVideoRecommendations(currentVideo.title, "재미있는 영상이나 유사한 분위기", currentRoom?.apiKey || '');

    const newRecs = recs.filter(r => !playlist.some(p => p.id === r.id));

    if (newRecs.length > 0) {
      const updatedPlaylist = [...playlist, ...newRecs];
      setPlaylist(updatedPlaylist);

      // Sync to Firebase
      if (currentRoom) {
        firebaseService.updatePlaylist(currentRoom.id, updatedPlaylist);
      }
      const msg: Message = {
        id: `sys-rec-${Date.now()}`,
        userId: 'ai-1',
        text: `AI 추천 영상 ${newRecs.length}개를 추가했어! 🎵`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, msg]);
      syncService.broadcast({ type: 'CHAT', payload: { message: msg } });
    }
    setIsGenerating(false);
  };

  const handleShare = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.id);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    }
  };

  // Shuffle & Repeat Handlers
  const handleToggleShuffle = () => {
    setIsShuffleOn(prev => !prev);
  };

  const handleToggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const handleVideoEnd = useCallback(() => {
    if (repeatMode === 'one') {
      // Re-trigger same video by changing key (handled in VideoPlayer)
      setCurrentVideo({ ...currentVideo });
      return;
    }

    const currentIndex = playlist.findIndex(v => v.id === currentVideo.id);

    if (isShuffleOn) {
      // Random selection (excluding current)
      const otherVideos = playlist.filter(v => v.id !== currentVideo.id);
      if (otherVideos.length > 0) {
        const randomVideo = otherVideos[Math.floor(Math.random() * otherVideos.length)];
        handleVideoChange(randomVideo);
      }
    } else {
      // Sequential playback
      const nextIndex = currentIndex + 1;
      if (nextIndex < playlist.length) {
        handleVideoChange(playlist[nextIndex]);
      } else if (repeatMode === 'all' && playlist.length > 0) {
        handleVideoChange(playlist[0]);
      }
    }
  }, [currentVideo, playlist, isShuffleOn, repeatMode]);

  // Load saved playlists on mount
  useEffect(() => {
    setSavedPlaylists(playlistStorage.loadPlaylists());
  }, []);

  // Playlist Storage Handlers
  const handleSavePlaylist = (name: string) => {
    playlistStorage.savePlaylist(name, playlist);
    setSavedPlaylists(playlistStorage.loadPlaylists());

    const msg: Message = {
      id: `sys-save-${Date.now()}`,
      userId: 'ai-1',
      text: `플레이리스트 "${name}"가 저장되었어! 💾`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleLoadPlaylist = (savedPlaylist: SavedPlaylist) => {
    setPlaylist(savedPlaylist.videos);
    if (savedPlaylist.videos.length > 0) {
      setCurrentVideo(savedPlaylist.videos[0]);
    }

    const msg: Message = {
      id: `sys-load-${Date.now()}`,
      userId: 'ai-1',
      text: `플레이리스트 "${savedPlaylist.name}"를 불러왔어! 📂`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleDeletePlaylist = (id: string) => {
    playlistStorage.deletePlaylist(id);
    setSavedPlaylists(playlistStorage.loadPlaylists());
  };

  // Start Selection Handlers
  const handleStartWithGenre = async (genre: GenreType) => {
    if (!currentRoom?.apiKey) return;

    setIsStartLoading(true);
    try {
      const videos = await getGenreRecommendations(genre, currentRoom.apiKey);

      if (videos.length > 0) {
        setCurrentVideo(videos[0]);
        setPlaylist(videos);

        // Sync to Firebase
        firebaseService.updateCurrentVideo(currentRoom.id, videos[0]);
        firebaseService.updatePlaylist(currentRoom.id, videos);

        const genreInfo = GENRE_OPTIONS.find(g => g.id === genre);
        const genreName = genreInfo ? `${genreInfo.emoji} ${genreInfo.name}` : '🎵';

        const msg: Message = {
          id: `sys-start-${Date.now()}`,
          userId: 'ai-1',
          text: `${genreName} 장르 음악 ${videos.length}개 AI 추천 완료! 🎵`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      } else {
        const msg: Message = {
          id: `sys-error-${Date.now()}`,
          userId: 'ai-1',
          text: `추천을 가져오지 못했어 😢 다시 시도해줘!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      }
    } catch (error) {
      console.error('Genre recommendation error:', error);
    } finally {
      setIsStartLoading(false);
      setShowStartModal(false);
    }
  };

  const handleStartWithPlaylist = (savedPlaylist: SavedPlaylist) => {
    setPlaylist(savedPlaylist.videos);
    if (savedPlaylist.videos.length > 0) {
      setCurrentVideo(savedPlaylist.videos[0]);
    }
    setShowStartModal(false);

    const msg: Message = {
      id: `sys-start-${Date.now()}`,
      userId: 'ai-1',
      text: `"${savedPlaylist.name}" 플레이리스트로 시작! 📂`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  // --- Render ---

  if (!hasJoined) {
    return <Onboarding onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col font-sans">
      {/* Start Modal */}
      {showStartModal && (
        <StartModal
          savedPlaylists={savedPlaylists}
          isLoading={isStartLoading}
          onSelectGenre={handleStartWithGenre}
          onSelectPlaylist={handleStartWithPlaylist}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* Toast */}
      {showCopiedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check size={16} /> 방 코드가 복사되었습니다!
        </div>
      )}

      {/* Navbar */}
      <nav className="h-16 border-b border-brand-gray bg-black/90 backdrop-blur sticky top-0 z-50 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MonitorPlay className="text-brand-red" size={28} />
          <h1 className="text-xl font-bold tracking-tight text-white hidden md:block">TubeParty <span className="text-brand-red">AI</span></h1>
          {currentRoom && (
            <span className="ml-2 bg-gray-700 text-gray-300 text-xs font-mono px-2 py-1 rounded hidden md:inline-flex items-center gap-1">
              <Copy size={10} />
              {currentRoom.id}
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center bg-gray-800 rounded-full px-4 py-2 border border-gray-700 w-96 mx-4">
          <LinkIcon size={16} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="유튜브 링크 붙여넣기..."
            className="bg-transparent border-none focus:outline-none text-sm text-white w-full"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddVideo()}
          />
          <button onClick={handleAddVideo} className="ml-2 hover:bg-gray-700 p-1 rounded-full transition-colors">
            <Plus size={18} className="text-brand-red" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Invite Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-brand-gray hover:bg-gray-700 text-white px-3 py-1.5 rounded-full text-sm transition-colors border border-gray-600"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">초대하기</span>
          </button>

          <div className="flex -space-x-2">
            {users.slice(0, 5).map((u, i) => (
              <div key={u.id} className={`w-8 h-8 rounded-full border-2 border-brand-dark flex items-center justify-center text-xs text-white font-bold
                  ${u.isAi ? 'bg-gradient-to-tr from-purple-600 to-blue-600' : 'bg-gray-600'}`}
                style={{ zIndex: 10 - i }}
                title={u.name}
              >
                {u.name[0]}
              </div>
            ))}
            {users.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-brand-dark bg-gray-800 flex items-center justify-center text-xs text-gray-400 font-bold z-0">
                +{users.length - 5}
              </div>
            )}
          </div>

          <button className="md:hidden text-white ml-2" onClick={() => setActiveTab(activeTab === TabType.CHAT ? TabType.PLAYLIST : TabType.CHAT)}>
            {activeTab === TabType.CHAT ? <ListVideo /> : <MessageSquare />}
          </button>
        </div>
      </nav>

      {/* Mobile Input */}
      <div className="md:hidden p-3 bg-brand-gray/20">
        <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
          <input
            type="text"
            placeholder="유튜브 링크 추가..."
            className="bg-transparent border-none focus:outline-none text-sm text-white w-full"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button onClick={handleAddVideo} className="ml-2">
            <Plus size={20} className="text-brand-red" />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 flex flex-col gap-4">
          <VideoPlayer videoId={currentVideo.id} onVideoEnd={handleVideoEnd} />

          <div className="bg-brand-gray/30 p-4 rounded-lg border border-brand-gray flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white mb-1 line-clamp-1">{currentVideo.title}</h2>
              <p className="text-gray-400 text-sm">{currentVideo.channelTitle}</p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 h-[600px] lg:h-auto flex flex-col gap-4">
          <div className="flex lg:hidden bg-gray-800 rounded-lg p-1 mb-2">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === TabType.CHAT ? 'bg-brand-gray text-white shadow' : 'text-gray-400'}`}
              onClick={() => setActiveTab(TabType.CHAT)}
            >
              채팅
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === TabType.PLAYLIST ? 'bg-brand-gray text-white shadow' : 'text-gray-400'}`}
              onClick={() => setActiveTab(TabType.PLAYLIST)}
            >
              재생 목록
            </button>
          </div>

          <div className={`flex-1 min-h-0 ${activeTab === TabType.CHAT ? 'block' : 'hidden lg:block'}`}>
            <ChatRoom
              messages={messages}
              users={users}
              currentUser={currentUser!}
              onSendMessage={handleSendMessage}
              isAiTyping={isAiTyping}
            />
          </div>

          <div className={`h-1/3 lg:h-1/3 min-h-[200px] ${activeTab === TabType.PLAYLIST ? 'block h-full' : 'hidden lg:block'}`}>
            <Playlist
              videos={playlist}
              currentVideoId={currentVideo.id}
              onSelectVideo={handleVideoChange}
              onGenerateRecommendations={handleGenerateRecommendations}
              isGenerating={isGenerating}
              isShuffleOn={isShuffleOn}
              repeatMode={repeatMode}
              onToggleShuffle={handleToggleShuffle}
              onToggleRepeat={handleToggleRepeat}
              savedPlaylists={savedPlaylists}
              onSavePlaylist={handleSavePlaylist}
              onLoadPlaylist={handleLoadPlaylist}
              onDeletePlaylist={handleDeletePlaylist}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;