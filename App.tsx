import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, User, Video, TabType, SyncAction, SavedPlaylist, Room } from './types';
import { VideoPlayer, PlaybackSyncState } from './components/VideoPlayer';
import { ChatRoom } from './components/ChatRoom';
import { Playlist, RepeatMode } from './components/Playlist';
import { Onboarding } from './components/Onboarding';
import { StartModal } from './components/StartModal';
import { YouTubeSearchModal } from './components/YouTubeSearchModal';
import { PlaylistBrowser } from './components/PlaylistBrowser';
import { VoiceChat } from './components/VoiceChat';
import { extractVideoId, getAiChatResponse, getVideoRecommendations } from './services/geminiService';
import * as syncService from './services/syncService';
import * as playlistStorage from './services/playlistStorage';
import * as firebaseService from './services/firebaseService';
import { GenreType, GENRE_OPTIONS } from './constants';
import * as youtubeService from './services/youtubeService';
import { MonitorPlay, MessageSquare, ListVideo, Link as LinkIcon, Plus, Share2, Check, Copy, Search, Loader2, X, ListMusic, LogOut, Users, UserX } from 'lucide-react';

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

  // YouTube Search Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Inline Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; channelTitle: string; thumbnail: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<'search' | 'link'>('search');

  // Playlist Browser State
  const [showPlaylistBrowser, setShowPlaylistBrowser] = useState(false);

  // Playback Sync State (재생 구간 동기화)
  const [playbackSyncState, setPlaybackSyncState] = useState<PlaybackSyncState | null>(null);
  const [isSyncEnabled, setIsSyncEnabled] = useState(true);

  // 이전 사용자 목록 (입장/퇴장 감지용)
  const prevUsersRef = useRef<Set<string>>(new Set());

  // currentRoom을 ref로 추적하여 stale closure 방지
  const currentRoomRef = useRef(currentRoom);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // --- Session Restore on Page Load ---
  useEffect(() => {
    const restoreSession = async () => {
      const savedSession = sessionStorage.getItem('tubePartySession');
      if (!savedSession) return;

      try {
        const { roomId, nickname, userId } = JSON.parse(savedSession);
        if (!roomId || !nickname) return;

        const room = await firebaseService.getRoom(roomId);
        if (!room) {
          // Room no longer exists, clear session
          sessionStorage.removeItem('tubePartySession');
          return;
        }

        // Restore the session
        setCurrentRoom(room);
        const restoredUser: User = {
          id: userId || `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: nickname,
          avatar: '',
          isAi: false
        };
        setCurrentUser(restoredUser);
        setUsers(prev => [...prev, restoredUser]);
        setHasJoined(true);

        // Re-register user in Firebase (in case they disconnected)
        await firebaseService.addUserToRoom(roomId, { id: restoredUser.id, name: restoredUser.name });

        // Load room data
        if (room.currentVideo) {
          setCurrentVideo(room.currentVideo);
        }
        if (room.playlist && room.playlist.length > 0) {
          setPlaylist(room.playlist);
        }

        // Reconnected message
        setMessages(prev => [...prev, {
          id: `reconnected-${Date.now()}`,
          userId: 'ai-1',
          text: `🔄 세션이 복원되었어! ${nickname}님, 다시 돌아온 걸 환영해!`,
          timestamp: Date.now()
        }]);
      } catch (error) {
        console.error('Failed to restore session:', error);
        sessionStorage.removeItem('tubePartySession');
      }
    };

    restoreSession();
  }, []);

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

  // currentVideo를 ref로 추적하여 stale closure 방지
  const currentVideoRef = useRef(currentVideo);
  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  // --- Firebase Real-time Sync ---
  useEffect(() => {
    if (!hasJoined || !currentRoom) return;

    // Subscribe to room updates from Firebase
    const unsubscribe = firebaseService.subscribeToRoom(currentRoom.id, (data) => {
      // ref를 사용하여 항상 최신 currentVideo와 비교
      if (data.currentVideo && data.currentVideo.id !== currentVideoRef.current.id) {
        setCurrentVideo(data.currentVideo);
      }
      if (data.playlist && data.playlist.length > 0) {
        // 함수형 업데이트로 playlist 비교
        setPlaylist(prev => {
          // 내용이 같으면 업데이트하지 않음
          if (prev.length === data.playlist.length && 
              prev.every((v, i) => v.id === data.playlist[i]?.id)) {
            return prev;
          }
          return data.playlist;
        });
      }
    });

    return () => unsubscribe();
  }, [hasJoined, currentRoom?.id]);

  // --- Firebase Real-time Chat ---
  useEffect(() => {
    if (!hasJoined || !currentRoom) return;

    // Subscribe to messages from Firebase
    const unsubscribe = firebaseService.subscribeToMessages(currentRoom.id, (firebaseMessages) => {
      // Replace messages with Firebase data, preserving local system messages
      setMessages(prev => {
        // Keep only local system messages (ai-1 messages that aren't in Firebase)
        const systemMessages = prev.filter(m =>
          m.userId === 'ai-1' && !firebaseMessages.some(fm => fm.id === m.id)
        );

        // Merge: system messages + Firebase messages
        const allMessages = [...systemMessages, ...firebaseMessages];

        // Remove duplicates and sort by timestamp
        const uniqueMessages = allMessages.reduce((acc, msg) => {
          if (!acc.some(m => m.id === msg.id)) {
            acc.push(msg);
          }
          return acc;
        }, [] as typeof allMessages);

        return uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    return () => unsubscribe();
  }, [hasJoined, currentRoom?.id, currentUser?.id]);

  // --- Firebase Real-time Users ---
  useEffect(() => {
    if (!hasJoined || !currentRoom || !currentUser) return;

    // Subscribe to users from Firebase
    const unsubscribe = firebaseService.subscribeToUsers(currentRoom.id, (firebaseUsers) => {
      const currentUserIds = new Set(firebaseUsers.map(u => u.id));
      const prevUserIds = prevUsersRef.current;

      // 입장한 사용자 찾기 (이전에 없었는데 지금 있는 사용자)
      firebaseUsers.forEach(fu => {
        // 자기 자신은 제외, 이전에 없었던 사용자만
        if (fu.id !== currentUser.id && !prevUserIds.has(fu.id)) {
          setMessages(prev => [...prev, {
            id: `join-${fu.id}-${Date.now()}`,
            userId: 'ai-1',
            text: `👋 ${fu.name}님이 입장했습니다!`,
            timestamp: Date.now()
          }]);
        }
      });

      // 퇴장한 사용자 찾기 (이전에 있었는데 지금 없는 사용자)
      prevUserIds.forEach(prevId => {
        // 자기 자신은 제외
        if (prevId !== currentUser.id && !currentUserIds.has(prevId)) {
          // 이전 사용자 이름 찾기 (users state에서)
          const leftUser = users.find(u => u.id === prevId);
          const userName = leftUser?.name || '알 수 없는 사용자';
          
          setMessages(prev => [...prev, {
            id: `leave-${prevId}-${Date.now()}`,
            userId: 'ai-1',
            text: `🚪 ${userName}님이 퇴장했습니다.`,
            timestamp: Date.now()
          }]);
        }
      });

      // 현재 사용자 목록 저장
      prevUsersRef.current = currentUserIds;

      // Keep the AI user and add Firebase users
      setUsers(prev => {
        const aiUser = prev.find(u => u.isAi);
        const usersList: User[] = aiUser ? [aiUser] : [SYSTEM_AI];

        firebaseUsers.forEach(fu => {
          usersList.push({
            id: fu.id,
            name: fu.name,
            avatar: '',
            isAi: false
          });
        });

        return usersList;
      });
    });

    return () => unsubscribe();
  }, [hasJoined, currentRoom?.id, currentUser?.id]);

  // --- Firebase Real-time Playback Sync ---
  useEffect(() => {
    if (!hasJoined || !currentRoom || !isSyncEnabled) return;

    // Subscribe to playback state from Firebase
    const unsubscribe = firebaseService.subscribeToPlaybackState(currentRoom.id, (state) => {
      if (state) {
        setPlaybackSyncState(state);
      }
    });

    return () => unsubscribe();
  }, [hasJoined, currentRoom?.id, isSyncEnabled]);

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

      // Register user in Firebase
      await firebaseService.addUserToRoom(newRoom.id, { id: newUser.id, name: newUser.name });

      // Save session to sessionStorage for F5 restore
      sessionStorage.setItem('tubePartySession', JSON.stringify({
        roomId: newRoom.id,
        nickname: nickname,
        userId: newUser.id
      }));

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

      // Register user in Firebase
      await firebaseService.addUserToRoom(room.id, { id: newUser.id, name: newUser.name });

      // Save session to sessionStorage for F5 restore
      sessionStorage.setItem('tubePartySession', JSON.stringify({
        roomId: room.id,
        nickname: nickname,
        userId: newUser.id
      }));

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
      userName: currentUser.name, // Include user name for Firebase chat
      text,
      timestamp: Date.now()
    };

    // Update local and broadcast to other tabs
    setMessages(prev => [...prev, newMessage]);
    syncService.broadcast({ type: 'CHAT', payload: { message: newMessage } });

    // Send to Firebase for real-time sync across users
    if (currentRoom) {
      firebaseService.addMessage(currentRoom.id, newMessage);
    }

    // Check if user wants to add a song
    const addSongPatterns = [
      /(.+?)\s*(노래|곡|음악)\s*(추가|틀어|넣어|검색|재생)/i,
      /(추가|틀어|넣어|검색|재생).*?(.+?)\s*(노래|곡|음악)/i,
      /(.+?)\s*(틀어줘|추가해줘|넣어줘|검색해줘|재생해줘)/i,
      /(?:play|add)\s+(.+)/i
    ];

    let songQuery = '';
    for (const pattern of addSongPatterns) {
      const match = text.match(pattern);
      if (match) {
        songQuery = match[1] || match[2] || '';
        break;
      }
    }

    // If song add request detected, search and add
    if (songQuery && songQuery.trim().length > 1) {
      setIsAiTyping(true);

      const results = await youtubeService.searchYouTube(songQuery.trim(), 1);

      if (results.length > 0) {
        const video: Video = {
          id: results[0].id,
          title: results[0].title,
          channelTitle: results[0].channelTitle,
          thumbnail: results[0].thumbnail
        };

        handleVideoChange(video);

        const aiMessage: Message = {
          id: `ai-add-${Date.now()}`,
          userId: 'ai-1',
          text: `"${results[0].title}" 추가했어! 🎵 지금 재생할게!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsAiTyping(false);
        return;
      } else {
        const aiMessage: Message = {
          id: `ai-notfound-${Date.now()}`,
          userId: 'ai-1',
          text: `"${songQuery}" 검색 결과가 없어 😢 다른 키워드로 시도해줘!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsAiTyping(false);
        return;
      }
    }

    // AI Logic (normal chat)
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

  const handleAddVideo = async () => {
    // 1. Check for Playlist URL
    const listMatch = urlInput.match(/[?&]list=([^#\&\?]+)/);
    if (listMatch) {
      const playlistId = listMatch[1];
      setIsGenerating(true); // Reuse generating state for loading UI
      const videos = await youtubeService.fetchPlaylistItems(playlistId);

      if (videos.length > 0) {
        setPlaylist(prev => {
          // Avoid duplicates
          const newVideos = videos.filter(v => !prev.some(p => p.id === v.id));
          return [...prev, ...newVideos];
        });

        if (currentRoom) {
          // Sync new playlist to Firebase (merging with existing)
          // Note: In a real app we might want to handle this more carefully to avoid overwrites
          // but for now we'll append. 
          // However, we can't easily get the 'latest' firebase state here without listening.
          // We'll rely on our local state being up to date via the listener.
          const currentPlaylist = playlist; // This might be stale if there are many updates?
          // Actually state updates are async. 
          // Let's rely on the setPlaylist callback result if possible, 
          // but we need to trigger the side effect.

          // Better approach: Calculate new list then update both.
          const newVideos = videos.filter(v => !playlist.some(p => p.id === v.id));
          const updatedPlaylist = [...playlist, ...newVideos];

          if (newVideos.length > 0) {
            firebaseService.updatePlaylist(currentRoom.id, updatedPlaylist);
          }
        }

        const msg: Message = {
          id: `sys-plist-${Date.now()}`,
          userId: 'ai-1',
          text: `플레이리스트에서 영상 ${videos.length}개를 가져왔어! 📚`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
        syncService.broadcast({ type: 'CHAT', payload: { message: msg } });
        setUrlInput('');
      } else {
        alert('플레이리스트를 불러올 수 없거나 비어있습니다.');
      }
      setIsGenerating(false);
      return;
    }

    // 2. Check for Single Video URL
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

  const handleVideoChange = useCallback((video: Video) => {
    // currentVideoRef 업데이트 (Firebase sync에서 중복 방지용)
    currentVideoRef.current = video;
    setCurrentVideo(video);

    // Calculate new playlist first to avoid side effects in setter
    let updatedPlaylist: Video[] = [];
    setPlaylist(prev => {
      const isVideoInPlaylist = prev.some(v => v.id === video.id);
      updatedPlaylist = isVideoInPlaylist ? prev : [video, ...prev];
      return updatedPlaylist;
    });

    // Sync to Firebase (after state update) - ref를 사용하여 최신 room 참조
    setTimeout(() => {
      const room = currentRoomRef.current;
      if (room && updatedPlaylist.length > 0) {
        firebaseService.updateCurrentVideo(room.id, video);
        firebaseService.updatePlaylist(room.id, updatedPlaylist);
      }
    }, 0);

    // Broadcast local
    syncService.broadcast({ type: 'VIDEO_CHANGE', payload: { video } });
  }, []);

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

  // Inline YouTube Search
  const handleInlineSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await youtubeService.searchYouTube(searchQuery.trim(), 5);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { id: string; title: string; channelTitle: string; thumbnail: string }) => {
    const video: Video = {
      id: result.id,
      title: result.title,
      channelTitle: result.channelTitle,
      thumbnail: result.thumbnail,
    };
    handleVideoChange(video);
    setSearchQuery('');
    setSearchResults([]);
    setMessages(prev => [...prev, {
      id: `search-${Date.now()}`,
      userId: 'ai-1',
      text: `🔍 "${video.title}" 검색해서 추가했어! 바로 재생할게!`,
      timestamp: Date.now()
    }]);
  };

  // Handle adding a playlist from browser
  const handleAddPlaylist = async (playlistId: string, title: string) => {
    const videos = await youtubeService.fetchPlaylistItems(playlistId, 50);
    if (videos.length > 0) {
      const videoList = videos.map(v => ({
        id: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnail: v.thumbnail
      }));

      setPlaylist(prev => [...prev, ...videoList]);

      // Play first video of the playlist
      handleVideoChange(videoList[0]);

      // Update Firebase if in a room
      if (currentRoom) {
        firebaseService.updatePlaylist(currentRoom.id, [...playlist, ...videoList]);
      }

      setMessages(prev => [...prev, {
        id: `playlist-${Date.now()}`,
        userId: 'ai-1',
        text: `📋 "${title}" 재생목록에서 ${videos.length}곡을 추가했어! 🎵`,
        timestamp: Date.now()
      }]);
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
    console.log('handleVideoEnd called. Mode:', repeatMode, 'Shuffle:', isShuffleOn);
    if (repeatMode === 'one') {
      // 현재 비디오 ref를 사용하여 최신 값 참조
      setCurrentVideo(prev => ({ ...prev }));
      return;
    }

    const currentVid = currentVideoRef.current;
    const currentIndex = playlist.findIndex(v => v.id === currentVid.id);
    console.log('Current Index:', currentIndex, 'Playlist Length:', playlist.length);

    if (isShuffleOn) {
      const otherVideos = playlist.filter(v => v.id !== currentVid.id);
      if (otherVideos.length > 0) {
        const randomVideo = otherVideos[Math.floor(Math.random() * otherVideos.length)];
        handleVideoChange(randomVideo);
      }
    } else {
      const nextIndex = currentIndex + 1;
      if (nextIndex < playlist.length) {
        console.log('Playing next video:', playlist[nextIndex]);
        handleVideoChange(playlist[nextIndex]);
      } else if (repeatMode === 'all' && playlist.length > 0) {
        console.log('Looping to first video');
        handleVideoChange(playlist[0]);
      } else {
        console.log('End of playlist');
      }
    }
  }, [playlist, isShuffleOn, repeatMode, handleVideoChange]);

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
    setIsStartLoading(true);
    try {
      // Use YouTube API for genre search (embeddable videos only)
      const genreQueries: Record<string, string> = {
        lofi: 'lofi hip hop chill beats',
        kpop: 'kpop music video official',
        ballad: '한국 발라드 인기곡',
        pop: 'pop music official video',
        random: 'trending music video 2024'
      };

      const query = genreQueries[genre] || genre;
      const videos = await youtubeService.searchYouTube(query, 5);

      if (videos.length > 0) {
        const videoList = videos.map(v => ({
          id: v.id,
          title: v.title,
          channelTitle: v.channelTitle,
          thumbnail: v.thumbnail
        }));

        setCurrentVideo(videoList[0]);
        setPlaylist(videoList);

        // Sync to Firebase
        if (currentRoom) {
          firebaseService.updateCurrentVideo(currentRoom.id, videoList[0]);
          firebaseService.updatePlaylist(currentRoom.id, videoList);
        }

        const genreInfo = GENRE_OPTIONS.find(g => g.id === genre);
        const genreName = genreInfo ? `${genreInfo.emoji} ${genreInfo.name}` : '🎵';

        const msg: Message = {
          id: `sys-start-${Date.now()}`,
          userId: 'ai-1',
          text: `${genreName} 장르 음악 ${videoList.length}개 추천 완료! 🎵`,
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



  const handleStartWithRanking = async () => {
    setIsStartLoading(true);
    try {
      const videos = await youtubeService.getPopularVideos('KR'); // Korea by default

      if (videos.length > 0) {
        const videoList = videos.map(v => ({
          id: v.id,
          title: v.title,
          channelTitle: v.channelTitle,
          thumbnail: v.thumbnail
        }));

        setCurrentVideo(videoList[0]);
        setPlaylist(videoList);

        if (currentRoom) {
          firebaseService.updateCurrentVideo(currentRoom.id, videoList[0]);
          firebaseService.updatePlaylist(currentRoom.id, videoList);
        }

        const msg: Message = {
          id: `sys-ranking-${Date.now()}`,
          userId: 'ai-1',
          text: `🔥 대한민국 인기 급상승 차트 50곡을 가져왔어!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      } else {
        const msg: Message = {
          id: `sys-error-${Date.now()}`,
          userId: 'ai-1',
          text: `차트를 가져오지 못했어 😢 다시 시도해줘!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      }
    } catch (error) {
      console.error('Ranking load error:', error);
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

  const handleStartWithVideo = (video: Video) => {
    setCurrentVideo(video);
    setPlaylist([video]);
    setShowStartModal(false);

    // Sync to Firebase
    if (currentRoom) {
      firebaseService.updateCurrentVideo(currentRoom.id, video);
      firebaseService.updatePlaylist(currentRoom.id, [video]);
    }

    const msg: Message = {
      id: `sys-start-${Date.now()}`,
      userId: 'ai-1',
      text: `🔍 "${video.title}" 검색해서 시작! 🎵`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleRemoveVideo = (videoId: string) => {
    const newPlaylist = playlist.filter(v => v.id !== videoId);
    setPlaylist(newPlaylist);

    if (currentRoom) {
      firebaseService.updatePlaylist(currentRoom.id, newPlaylist);

      // If we removed the current video, play the next one (or stop/none)
      if (videoId === currentVideo.id) {
        if (newPlaylist.length > 0) {
          const nextVideo = newPlaylist[0];
          setCurrentVideo(nextVideo);
          firebaseService.updateCurrentVideo(currentRoom.id, nextVideo);
        }
      }
    }
  };

  const handleReorderPlaylist = (newOrder: Video[]) => {
    setPlaylist(newOrder);
    if (currentRoom) {
      firebaseService.updatePlaylist(currentRoom.id, newOrder);
    }
  };

  // Playback Sync Handler
  const handlePlaybackSync = useCallback((state: Omit<PlaybackSyncState, 'syncedAt'>) => {
    if (!currentRoom || !isSyncEnabled) return;
    
    const fullState: firebaseService.PlaybackState = {
      ...state,
      syncedAt: Date.now()
    };
    
    firebaseService.updatePlaybackState(currentRoom.id, fullState);
  }, [currentRoom, isSyncEnabled]);

  // Toggle Sync
  const handleToggleSync = () => {
    setIsSyncEnabled(prev => !prev);
  };

  // Chat Handlers ---

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
          onSelectRanking={handleStartWithRanking}
          onSelectVideo={handleStartWithVideo}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* YouTube Search Modal */}
      <YouTubeSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectVideo={(video) => {
          handleVideoChange(video);
          setMessages(prev => [...prev, {
            id: `search-${Date.now()}`,
            userId: 'ai-1',
            text: `🔍 "${video.title}" 검색해서 추가했어! 바로 재생할게!`,
            timestamp: Date.now()
          }]);
        }}
      />

      {/* Playlist Browser Modal */}
      <PlaylistBrowser
        isOpen={showPlaylistBrowser}
        onClose={() => setShowPlaylistBrowser(false)}
        onSelectPlaylist={handleAddPlaylist}
        onSelectVideos={(videos) => {
          // Add videos to playlist
          setPlaylist(prev => {
            const newVideos = videos.filter(v => !prev.some(p => p.id === v.id));
            return [...prev, ...newVideos];
          });
          // Play first video
          if (videos.length > 0) {
            handleVideoChange(videos[0]);
          }
          // Sync to Firebase
          if (currentRoom && videos.length > 0) {
            firebaseService.updatePlaylist(currentRoom.id, [...playlist, ...videos]);
          }
          // Notify
          setMessages(prev => [...prev, {
            id: `genre-${Date.now()}`,
            userId: 'ai-1',
            text: `🎵 ${videos.length}곡이 추가되었어! 바로 재생할게!`,
            timestamp: Date.now()
          }]);
        }}
      />

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

        {/* Search / Link Input - Single Row */}
        <div className="hidden md:flex items-center relative mx-4 md-force-flex">
          {/* Toggle Buttons */}
          <div className="flex mr-2">
            <button
              onClick={() => { setInputMode('search'); setSearchResults([]); }}
              className={`px-3 py-2 text-xs rounded-l-lg transition-colors border ${inputMode === 'search'
                ? 'bg-brand-red text-white border-brand-red'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
            >
              <Search size={14} className="inline" />
            </button>
            <button
              onClick={() => { setInputMode('link'); setSearchResults([]); }}
              className={`px-3 py-2 text-xs rounded-r-lg transition-colors border-t border-r border-b ${inputMode === 'link'
                ? 'bg-brand-red text-white border-brand-red'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
            >
              <LinkIcon size={14} className="inline" />
            </button>
          </div>

          {/* Input Box */}
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 w-[320px]">
            {inputMode === 'search' ? (
              <>
                <input
                  type="text"
                  placeholder="노래 검색..."
                  className="bg-transparent border-none focus:outline-none text-sm text-white w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInlineSearch()}
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="mr-1 text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
                <button
                  onClick={handleInlineSearch}
                  disabled={isSearching}
                  className="bg-brand-red hover:bg-red-700 disabled:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors"
                >
                  {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="유튜브 링크..."
                  className="bg-transparent border-none focus:outline-none text-sm text-white w-full"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVideo()}
                />
                <button onClick={handleAddVideo} className="hover:bg-gray-700 p-1 rounded transition-colors">
                  <Plus size={16} className="text-brand-red" />
                </button>
              </>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && inputMode === 'search' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectSearchResult(result)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-800 transition-colors text-left"
                >
                  <img src={result.thumbnail} alt={result.title} className="w-16 h-10 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm line-clamp-1">{result.title}</p>
                    <p className="text-gray-500 text-xs line-clamp-1">{result.channelTitle}</p>
                  </div>
                  <Plus size={16} className="text-brand-red flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Playlist Browser Button */}
          <button
            onClick={() => setShowPlaylistBrowser(true)}
            className="flex items-center gap-1 sm:gap-2 bg-purple-600 hover:bg-purple-700 text-white px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors"
            title="재생목록 탐색"
          >
            <ListMusic size={16} />
            <span className="hidden sm:inline">재생목록</span>
          </button>

          {/* Sync Toggle Button */}
          <button
            onClick={handleToggleSync}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors border ${
              isSyncEnabled
                ? 'bg-green-600/30 text-green-400 border-green-600/50 hover:bg-green-600/50'
                : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
            }`}
            title={isSyncEnabled ? '동기화 끄기' : '동기화 켜기'}
          >
            {isSyncEnabled ? <Users size={16} /> : <UserX size={16} />}
            <span className="hidden sm:inline">{isSyncEnabled ? '동기화' : '개별재생'}</span>
          </button>

          {/* Invite Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1 sm:gap-2 bg-brand-gray hover:bg-gray-700 text-white px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors border border-gray-600"
            title="초대"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">초대</span>
          </button>

          {/* Voice Chat */}
          {currentRoom && currentUser && (
            <VoiceChat
              roomId={currentRoom.id}
              userId={currentUser.id}
              userName={currentUser.name}
              onError={(error) => {
                setMessages(prev => [...prev, {
                  id: `voice-error-${Date.now()}`,
                  userId: 'ai-1',
                  text: `🎤 음성채팅 오류: ${error}`,
                  timestamp: Date.now()
                }]);
              }}
            />
          )}

          {/* Leave Room Button */}
          <button
            onClick={() => {
              // Remove user from Firebase
              if (currentRoom && currentUser) {
                firebaseService.removeUserFromRoom(currentRoom.id, currentUser.id);
              }
              // Clear session
              sessionStorage.removeItem('tubePartySession');
              // Reset state
              setHasJoined(false);
              setCurrentRoom(null);
              setCurrentUser({ id: '', name: '', avatar: '', isAi: false });
              setUsers([SYSTEM_AI]);
              setMessages([]);
              setPlaylist([]);
              setCurrentVideo({ id: '', title: '', channelTitle: '', thumbnail: '' });
            }}
            className="flex items-center gap-1 sm:gap-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors border border-red-600/30"
            title="방 나가기"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">나가기</span>
          </button>

          {/* Mobile Tab Toggle */}
          <button 
            className="md:hidden text-white p-2 bg-gray-700 rounded-lg" 
            onClick={() => setActiveTab(activeTab === TabType.CHAT ? TabType.PLAYLIST : TabType.CHAT)}
          >
            {activeTab === TabType.CHAT ? <ListVideo size={18} /> : <MessageSquare size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Input */}
      <div className="md:hidden p-3 bg-brand-gray/20 relative md-force-hidden">
        {/* Mobile Tab Buttons */}
        <div className="flex mb-2 gap-2">
          <button
            onClick={() => { setInputMode('search'); setSearchResults([]); }}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-1 ${inputMode === 'search'
              ? 'bg-brand-red text-white'
              : 'bg-gray-800 text-gray-400'
              }`}
          >
            <Search size={14} />검색
          </button>
          <button
            onClick={() => { setInputMode('link'); setSearchResults([]); }}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-1 ${inputMode === 'link'
              ? 'bg-brand-red text-white'
              : 'bg-gray-800 text-gray-400'
              }`}
          >
            <LinkIcon size={14} />링크
          </button>
        </div>

        {/* Mobile Input Box */}
        <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
          {inputMode === 'search' ? (
            <>
              <input
                type="text"
                placeholder="노래 제목, 아티스트 검색..."
                className="bg-transparent border-none focus:outline-none text-sm text-white w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInlineSearch()}
              />
              <button
                onClick={handleInlineSearch}
                disabled={isSearching}
                className="ml-2 bg-brand-red px-3 py-1 rounded text-white text-sm"
              >
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Mobile Search Results */}
        {searchResults.length > 0 && inputMode === 'search' && (
          <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectSearchResult(result)}
                className="w-full flex items-center gap-3 p-2 hover:bg-gray-800 transition-colors text-left border-b border-gray-800 last:border-0"
              >
                <img src={result.thumbnail} alt={result.title} className="w-14 h-9 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm line-clamp-1">{result.title}</p>
                  <p className="text-gray-500 text-xs line-clamp-1">{result.channelTitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Video + Playlist */}
        <section className={`lg:col-span-8 flex-col gap-4 ${activeTab === TabType.CHAT ? 'hidden' : 'flex'} lg-force-flex`}>
          <VideoPlayer
            videoId={currentVideo.id}
            onVideoEnd={handleVideoEnd}
            onVideoError={() => {
              // Auto-skip to next video on error
              if (playlist.length > 1) {
                const currentIndex = playlist.findIndex(v => v.id === currentVideo.id);
                const nextIndex = (currentIndex + 1) % playlist.length;
                const nextVideo = playlist[nextIndex];
                setCurrentVideo(nextVideo);
                if (currentRoom) {
                  firebaseService.updateCurrentVideo(currentRoom.id, nextVideo);
                }
                setMessages(prev => [...prev, {
                  id: `skip-${Date.now()}`,
                  userId: 'ai-1',
                  text: `재생 불가 영상 스킵! ⏭️`,
                  timestamp: Date.now()
                }]);
              }
            }}
            currentUserId={currentUser?.id}
            syncState={playbackSyncState}
            onPlaybackSync={handlePlaybackSync}
            syncEnabled={isSyncEnabled}
          />

          <div className="bg-brand-gray/30 p-4 rounded-lg border border-brand-gray flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white mb-1 line-clamp-1">{currentVideo.title}</h2>
              <p className="text-gray-400 text-sm">{currentVideo.channelTitle}</p>
            </div>
          </div>

          {/* Playlist - Always visible on Desktop, toggled on Mobile via parent section visibility logic above if we want to hide video too? 
              Actually, usually video stays, only playlist/chat toggles. 
              Let's refine: Video always shows? 
              If user wants to chat while watching video on mobile... 
              The current structure splits Video+Playlist vs Chat.
              Let's keep Video always visible on mobile at top?
              But the grid splits them. 
              Let's try: 
              - Mobile: Video always top. Below it: Playlist OR Chat.
              - Desktop: Video+Playlist Left, Chat Right (Sticky).
          */}
          <div className="max-h-[400px]">
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
              onRemoveVideo={handleRemoveVideo}
              onReorderPlaylist={handleReorderPlaylist}
            />
          </div>
        </section>

        {/* On mobile, if we want to show chat, we must hide the left section? 
            Or maybe better: Move VideoPlayer OUT of the grid so it's always top?
            That's a larger refactor.
            For now, let's just make the simple fix:
            On mobile:
            - If CHAT tab: Hide specific parts of left column? No, grid column hides entire section.
            
            Let's stick to the user's likely issue: Desktop layout "strange".
            I'll implement sticky on right col.
            And basic visibility toggle.
        */}

        {/* Right: Chat Only */}
        <section className={`lg:col-span-4 h-[500px] lg:h-[calc(100vh-100px)] flex-col lg:sticky lg:top-20 ${activeTab === TabType.PLAYLIST ? 'hidden' : 'flex'} lg-force-flex`}>
          <ChatRoom
            messages={messages}
            users={users}
            currentUser={currentUser!}
            onSendMessage={handleSendMessage}
            isAiTyping={isAiTyping}
          />
        </section>
      </main>
    </div>
  );
};

export default App;