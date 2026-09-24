import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Message, User, Video, SyncAction, SavedPlaylist, Room } from './types';
import { VideoPlayer, PlaybackSyncState, PlayerControlsMode } from './components/VideoPlayer';
import { ChatRoom } from './components/ChatRoom';
import { Playlist, RepeatMode } from './components/Playlist';
import { Onboarding } from './components/Onboarding';
import { StartModal } from './components/StartModal';
import { PlaylistBrowser } from './components/PlaylistBrowser';
import { VoiceChat } from './components/VoiceChat';
import { MoreMenu } from './components/MoreMenu';
import { extractVideoId, getAiChatResponse, getVideoRecommendations } from './services/geminiService';
import * as syncService from './services/syncService';
import * as playlistStorage from './services/playlistStorage';
import * as firebaseService from './services/firebaseService';
import { isStaleRemoteUpdate } from './services/playbackGuard';
import { advanceQueue, skipQueue, skipUnplayable } from './services/queueAdvance';
import { GenreType, GENRE_OPTIONS } from './constants';
import * as youtubeService from './services/youtubeService';
import { useI18n } from './services/i18n';
import { MonitorPlay, MessageSquare, ListVideo, Link as LinkIcon, Plus, Check, Copy, Search, Loader2, X, EyeOff, MoreHorizontal } from 'lucide-react';

type MobileView = 'watch' | 'chat' | 'playlist' | 'more';
type SidePanel = 'chat' | 'playlist' | 'hidden';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Initial Data
const SYSTEM_AI: User = { id: 'ai-1', name: 'TubeBot', avatar: '', isAi: true };

const INITIAL_VIDEO: Video = {
  id: 'jfKfPfyJRdk', // lofi hip hop radio
  title: 'lofi hip hop radio - beats to relax/study to',
  channelTitle: 'Lofi Girl',
  thumbnail: 'https://picsum.photos/seed/lofi/320/180'
};

const arePlaylistsEqual = (a: Video[], b: Video[]) =>
  a.length === b.length && a.every((video, index) => video.id === b[index]?.id);

type InviteStatus = 'none' | 'checking' | 'ready' | 'invalid';

const getInviteTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return url.searchParams.get('invite');
};

const removeInviteTokenFromUrl = () => {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;

  url.searchParams.delete('invite');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

const buildInviteLink = (token: string): string => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('invite', token);
  return url.toString();
};

const App: React.FC = () => {
  // --- i18n ---
  const { language, setLanguage, t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  // --- State ---
  const [hasJoined, setHasJoined] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [users, setUsers] = useState<User[]>([SYSTEM_AI]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [playlist, setPlaylist] = useState<Video[]>([INITIAL_VIDEO]);
  const [currentVideo, setCurrentVideo] = useState<Video>(INITIAL_VIDEO);

  // 초기 환영 메시지 설정
  const welcomeMessageSetRef = useRef(false);
  useEffect(() => {
    if (!welcomeMessageSetRef.current) {
      welcomeMessageSetRef.current = true;
      setMessages([{ id: 'welcome', userId: 'ai-1', text: t('welcomeMessage'), timestamp: Date.now() }]);
    }
  }, [t]);

  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [mobileView, setMobileView] = useState<MobileView>('watch');
  const [sidePanel, setSidePanel] = useState<SidePanel>('chat');
  const [moreOpen, setMoreOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const sidePanelBeforeCinema = useRef<'chat' | 'playlist'>('chat');
  const toastTimerRef = useRef<number | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2200);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [moreOpen]);

  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(() => getInviteTokenFromUrl());
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>(pendingInviteToken ? 'checking' : 'none');

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
  const [replayToken, setReplayToken] = useState(0);

  // 이전 사용자 목록 (입장/퇴장 감지용)
  const prevUsersRef = useRef<Set<string>>(new Set());

  // currentRoom을 ref로 추적하여 stale closure 방지
  const currentRoomRef = useRef(currentRoom);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const currentVideoRef = useRef(currentVideo);
  const playlistRef = useRef(playlist);
  const pendingVideoSyncRef = useRef<{ id: string; at: number } | null>(null);
  const pendingPlaylistSyncRef = useRef<{ at: number } | null>(null);
  const lastAppliedCurrentVideoAtRef = useRef<number>(0);
  const lastAppliedPlaylistAtRef = useRef<number>(0);

  useEffect(() => {
    const pending = pendingVideoSyncRef.current;
    if (
      pending &&
      Date.now() - pending.at < 8000 &&
      currentVideo.id !== currentVideoRef.current.id
    ) {
      return;
    }
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  useEffect(() => {
    const pending = pendingPlaylistSyncRef.current;
    if (
      pending &&
      Date.now() - pending.at < 8000 &&
      !arePlaylistsEqual(playlist, playlistRef.current)
    ) {
      return;
    }
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    removeInviteTokenFromUrl();
  }, []);

  useEffect(() => {
    if (!pendingInviteToken) {
      setInviteStatus('none');
      return;
    }

    let didCancel = false;
    setInviteStatus('checking');

    firebaseService.resolveInvite(pendingInviteToken)
      .then((invite) => {
        if (!didCancel) {
          setInviteStatus(invite ? 'ready' : 'invalid');
        }
      })
      .catch((error) => {
        console.error('Failed to resolve invite:', error);
        if (!didCancel) {
          setInviteStatus('invalid');
        }
      });

    return () => {
      didCancel = true;
    };
  }, [pendingInviteToken]);

  const publishPlayback = useCallback((video: Video, nextPlaylist: Video[], replayIfSame = true) => {
    const at = Date.now();
    const sameVideo = video.id === currentVideoRef.current.id;
    currentVideoRef.current = video;
    playlistRef.current = nextPlaylist;
    pendingVideoSyncRef.current = { id: video.id, at };
    pendingPlaylistSyncRef.current = { at };
    if (sameVideo && replayIfSame) {
      setReplayToken((token) => token + 1);
    }
    setCurrentVideo(video);
    setPlaylist(nextPlaylist);

    const room = currentRoomRef.current;
    const actorId = currentUserRef.current?.id;
    if (room && actorId) {
      void firebaseService.updateCurrentVideo(room.id, video, actorId, at);
      void firebaseService.updatePlaylist(room.id, nextPlaylist, actorId, at);
    }
  }, []);

  const publishPlaylist = useCallback((nextPlaylist: Video[]) => {
    const at = Date.now();
    playlistRef.current = nextPlaylist;
    pendingPlaylistSyncRef.current = { at };
    setPlaylist(nextPlaylist);
    const room = currentRoomRef.current;
    const actorId = currentUserRef.current?.id;
    if (room && actorId) {
      void firebaseService.updatePlaylist(room.id, nextPlaylist, actorId, at);
    }
  }, []);

  const hydrateRoomPlayback = (room: Room) => {
    pendingVideoSyncRef.current = null;
    pendingPlaylistSyncRef.current = null;
    if (room.currentVideo) {
      currentVideoRef.current = room.currentVideo;
      setCurrentVideo(room.currentVideo);
    }
    if (room.playlist && room.playlist.length > 0) {
      playlistRef.current = room.playlist;
      setPlaylist(room.playlist);
    } else if (room.currentVideo) {
      const seeded = [room.currentVideo];
      playlistRef.current = seeded;
      setPlaylist(seeded);
    }
    lastAppliedCurrentVideoAtRef.current = room.currentVideoUpdatedAt || 0;
    lastAppliedPlaylistAtRef.current = room.playlistUpdatedAt || 0;
  };

  // --- Session Restore on Page Load ---
  useEffect(() => {
    const restoreSession = async () => {
      if (pendingInviteToken || hasJoined) return;

      const savedSession = sessionStorage.getItem('tubePartySession');
      if (!savedSession) return;

      try {
        const { roomId, nickname, userId } = JSON.parse(savedSession);
        if (!roomId || !nickname) return;

        const room = await firebaseService.joinRoomByCode(roomId, nickname);
        if (!room) {
          // Room no longer exists, clear session
          sessionStorage.removeItem('tubePartySession');
          return;
        }

        const restoredUser: User = {
          id: userId || `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: nickname,
          avatar: '',
          isAi: false
        };
        currentRoomRef.current = room;
        currentUserRef.current = restoredUser;
        hydrateRoomPlayback(room);
        setCurrentRoom(room);
        setCurrentUser(restoredUser);
        setUsers(prev => [...prev, restoredUser]);
        setHasJoined(true);

        // Re-register user in Firebase (in case they disconnected)
        await firebaseService.addUserToRoom(room.id, { id: restoredUser.id, name: restoredUser.name });

        // Reconnected message
        setMessages(prev => [...prev, {
          id: `reconnected-${Date.now()}`,
          userId: 'ai-1',
          text: `🔄 ${t('sessionRestored', { name: nickname })}`,
          timestamp: Date.now()
        }]);
      } catch (error) {
        console.error('Failed to restore session:', error);
        sessionStorage.removeItem('tubePartySession');
      }
    };

    restoreSession();
  }, [hasJoined, pendingInviteToken]);

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
              text: t('userJoined', { name: action.payload.user.name }),
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
        case 'VIDEO_CHANGE': {
          const incoming = action.payload.video;
          const nextPlaylist = playlistRef.current.some(v => v.id === incoming.id)
            ? playlistRef.current
            : [incoming, ...playlistRef.current];
          currentVideoRef.current = incoming;
          playlistRef.current = nextPlaylist;
          setCurrentVideo(incoming);
          setPlaylist(nextPlaylist);
          setMessages(prev => [...prev, {
            id: `sys-vid-${Date.now()}`,
            userId: 'ai-1',
            text: `${t('videoChanged')} ${incoming.title}`,
            timestamp: Date.now()
          }]);
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [hasJoined, users]);

  // --- Firebase Real-time Sync ---
  useEffect(() => {
    if (!hasJoined || !currentRoom || !currentUser) return;

    let cancelled = false;
    const userId = currentUser.id;

    // Subscribe to room updates from Firebase. Chat, presence, and playback
    // writes also live under this node, so ignore snapshots older than a
    // local queue change or they snap the player back to the previous song.
    const unsubscribe = firebaseService.subscribeToRoom(currentRoom.id, (data) => {
      if (cancelled) return;

      const now = Date.now();
      const videoUpdatedAt = data.currentVideoUpdatedAt || 0;
      const playlistUpdatedAt = data.playlistUpdatedAt || 0;
      const videoStale = isStaleRemoteUpdate(pendingVideoSyncRef.current?.at ?? null, videoUpdatedAt, now);
      const playlistStale = isStaleRemoteUpdate(pendingPlaylistSyncRef.current?.at ?? null, playlistUpdatedAt, now);

      if (!videoStale && data.currentVideo) {
        const changed = data.currentVideo.id !== currentVideoRef.current.id;
        const remoteReplay = !changed
          && !!data.currentVideoUpdatedBy
          && data.currentVideoUpdatedBy !== userId
          && videoUpdatedAt > lastAppliedCurrentVideoAtRef.current;

        if (changed) {
          currentVideoRef.current = data.currentVideo;
          setCurrentVideo(data.currentVideo);
          const pending = pendingVideoSyncRef.current;
          if (pending && data.currentVideo.id !== pending.id && videoUpdatedAt >= pending.at) {
            pendingVideoSyncRef.current = null;
          }
        } else if (remoteReplay) {
          setReplayToken((token) => token + 1);
        }

        const pending = pendingVideoSyncRef.current;
        if (
          pending &&
          data.currentVideoUpdatedBy === userId &&
          data.currentVideo.id === pending.id &&
          videoUpdatedAt >= pending.at
        ) {
          pendingVideoSyncRef.current = null;
        }
      }
      if (!videoStale && videoUpdatedAt > lastAppliedCurrentVideoAtRef.current) {
        lastAppliedCurrentVideoAtRef.current = videoUpdatedAt;
      }

      if (data.playlist && !playlistStale && !arePlaylistsEqual(playlistRef.current, data.playlist)) {
        playlistRef.current = data.playlist;
        setPlaylist(data.playlist);
      }
      if (!playlistStale) {
        const pending = pendingPlaylistSyncRef.current;
        if (pending && data.playlistUpdatedBy === userId && playlistUpdatedAt >= pending.at) {
          pendingPlaylistSyncRef.current = null;
        }
        if (playlistUpdatedAt > lastAppliedPlaylistAtRef.current) {
          lastAppliedPlaylistAtRef.current = playlistUpdatedAt;
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hasJoined, currentRoom?.id, currentUser?.id]);

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

    let cancelled = false;
    let initialized = false;
    const names = new Map<string, string>();
    const selfId = currentUser.id;

    const unsubscribe = firebaseService.subscribeToUsers(currentRoom.id, (firebaseUsers) => {
      if (cancelled) return;

      const currentUserIds = new Set(firebaseUsers.map(u => u.id));

      // The first snapshot is whoever is already in the room. Announcing them
      // as new joins makes every participant look like they just arrived.
      if (!initialized) {
        initialized = true;
        firebaseUsers.forEach((fu) => names.set(fu.id, fu.name));
        prevUsersRef.current = currentUserIds;
      } else {
        firebaseUsers.forEach((fu) => {
          if (fu.id !== selfId && !prevUsersRef.current.has(fu.id)) {
            setMessages(prev => [...prev, {
              id: `join-${fu.id}-${Date.now()}`,
              userId: 'ai-1',
              text: tRef.current('userJoinedShort', { name: fu.name }),
              timestamp: Date.now()
            }]);
          }
          names.set(fu.id, fu.name);
        });

        prevUsersRef.current.forEach((prevId) => {
          if (prevId !== selfId && !currentUserIds.has(prevId)) {
            const userName = names.get(prevId) || tRef.current('unknownUser');
            setMessages(prev => [...prev, {
              id: `leave-${prevId}-${Date.now()}`,
              userId: 'ai-1',
              text: tRef.current('userLeft', { name: userName }),
              timestamp: Date.now()
            }]);
            names.delete(prevId);
          }
        });

        prevUsersRef.current = currentUserIds;
      }

      setUsers(prev => {
        const aiUser = prev.find(u => u.isAi) ?? SYSTEM_AI;
        const seen = new Set<string>();
        const usersList: User[] = [aiUser];
        firebaseUsers.forEach((fu) => {
          if (!fu.id || seen.has(fu.id)) return;
          seen.add(fu.id);
          usersList.push({
            id: fu.id,
            name: fu.name,
            avatar: '',
            isAi: false
          });
        });
        if (selfId && !seen.has(selfId)) {
          const self = prev.find(u => u.id === selfId);
          if (self) usersList.push(self);
        }
        return usersList;
      });
    });

    return () => {
      cancelled = true;
      prevUsersRef.current = new Set();
      unsubscribe();
    };
  }, [hasJoined, currentRoom?.id, currentUser?.id]);

  // --- Firebase Real-time Playback Sync ---
  useEffect(() => {
    if (!hasJoined || !currentRoom || !isSyncEnabled) return;

    let cancelled = false;
    const unsubscribe = firebaseService.subscribeToPlaybackState(currentRoom.id, (state) => {
      if (cancelled) return;
      if (state) {
        setPlaybackSyncState(state);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hasJoined, currentRoom?.id, isSyncEnabled]);

  // --- Handlers ---

  const handleCreateRoom = async (nickname: string, apiKey: string) => {
    try {
      const newRoom = await firebaseService.createRoom(apiKey, nickname);
      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: nickname,
        avatar: '',
        isAi: false
      };
      currentRoomRef.current = newRoom;
      currentUserRef.current = newUser;
      setCurrentRoom(newRoom);
      setCurrentUser(newUser);
      setUsers(prev => [...prev, newUser]);
      publishPlayback(INITIAL_VIDEO, [INITIAL_VIDEO], false);
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
        text: `${t('roomCreated')} 📋 ${newRoom.id}`,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert(t('roomCreateFailed'));
    }
  };

  const handleJoinRoom = async (nickname: string, roomCode: string) => {
    try {
      const room = await firebaseService.joinRoomByCode(roomCode.toUpperCase(), nickname);
      if (!room) {
        alert(t('roomNotExist'));
        return;
      }

      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: nickname,
        avatar: '',
        isAi: false
      };
      currentRoomRef.current = room;
      currentUserRef.current = newUser;
      hydrateRoomPlayback(room);
      setCurrentRoom(room);
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
        text: t('userJoined', { name: nickname }),
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to join room:', error);
      alert(t('roomJoinFailed'));
    }
  };

  const handleJoinInvite = async (nickname: string) => {
    if (!pendingInviteToken) return;

    try {
      const room = await firebaseService.joinRoomByInvite(pendingInviteToken, nickname);
      if (!room) {
        setInviteStatus('invalid');
        alert(t('inviteInvalid'));
        return;
      }

      const newUser: User = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: nickname,
        avatar: '',
        isAi: false
      };
      currentRoomRef.current = room;
      currentUserRef.current = newUser;
      hydrateRoomPlayback(room);
      setCurrentRoom(room);
      setCurrentUser(newUser);
      setUsers(prev => [...prev, newUser]);
      setHasJoined(true);
      setPendingInviteToken(null);
      setInviteStatus('none');

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
        id: `joined-invite-${Date.now()}`,
        userId: 'ai-1',
        text: t('userJoined', { name: nickname }),
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Failed to join room by invite:', error);
      alert(t('roomJoinFailed'));
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
          text: `"${results[0].title}" ${t('addedSong')}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsAiTyping(false);
        return;
      } else {
        const aiMessage: Message = {
          id: `ai-notfound-${Date.now()}`,
          userId: 'ai-1',
          text: `"${songQuery}" ${t('searchNotFound')}`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
        setIsAiTyping(false);
        return;
      }
    }

    // AI Logic (normal chat) - API 키가 있을 때만 작동
    const hasApiKey = currentRoom?.apiKey && currentRoom.apiKey.trim() !== '';
    
    if (hasApiKey) {
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
        const currentPlaylist = playlistRef.current;
        const newVideos = videos.filter(v => !currentPlaylist.some(p => p.id === v.id));
        if (newVideos.length > 0) {
          publishPlaylist([...currentPlaylist, ...newVideos]);
        }

        const msg: Message = {
          id: `sys-plist-${Date.now()}`,
          userId: 'ai-1',
          text: t('playlistLoaded', { count: videos.length }),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
        syncService.broadcast({ type: 'CHAT', payload: { message: msg } });
        setUrlInput('');
      } else {
        alert(t('playlistLoadFailed'));
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
      alert(t('invalidYoutubeLink'));
    }
  };

  const handleVideoChange = useCallback((video: Video, playlistOverride?: Video[]) => {
    const base = playlistOverride ?? playlistRef.current;
    const updatedPlaylist = base.some(item => item.id === video.id) ? base : [video, ...base];
    publishPlayback(video, updatedPlaylist);
    syncService.broadcast({ type: 'VIDEO_CHANGE', payload: { video } });
  }, [publishPlayback]);

  const handleGenerateRecommendations = async () => {
    // API 키가 없으면 추천 기능 비활성화
    if (!currentRoom?.apiKey || currentRoom.apiKey.trim() === '') {
      return;
    }
    setIsGenerating(true);
    const recs = await getVideoRecommendations(currentVideo.title, "재미있는 영상이나 유사한 분위기", currentRoom?.apiKey || '');

    const newRecs = recs.filter(r => !playlistRef.current.some(p => p.id === r.id));

    if (newRecs.length > 0) {
      publishPlaylist([...playlistRef.current, ...newRecs]);
      const msg: Message = {
        id: `sys-rec-${Date.now()}`,
        userId: 'ai-1',
        text: t('aiRecommendAdded', { count: newRecs.length }),
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, msg]);
      syncService.broadcast({ type: 'CHAT', payload: { message: msg } });
    }
    setIsGenerating(false);
  };

  const handleShare = async () => {
    if (currentRoom) {
      try {
        const invite = await firebaseService.createInvite(currentRoom.id);
        await navigator.clipboard.writeText(buildInviteLink(invite.token));
        showToast(t('inviteLinkCopied'));
        setMoreOpen(false);
      } catch (error) {
        console.error('Failed to create invite link:', error);
        alert(t('inviteCreateFailed'));
      }
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
    setMobileView('watch');
    setMessages(prev => [...prev, {
      id: `search-${Date.now()}`,
      userId: 'ai-1',
      text: t('searchAndAdd', { title: video.title }),
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

      const merged = [...playlistRef.current];
      videoList.forEach((video) => {
        if (!merged.some((item) => item.id === video.id)) merged.push(video);
      });
      handleVideoChange(videoList[0], merged);

      setMessages(prev => [...prev, {
        id: `playlist-${Date.now()}`,
        userId: 'ai-1',
        text: t('playlistAdded', { title, count: videos.length }),
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
    const result = advanceQueue(
      playlistRef.current,
      currentVideoRef.current.id,
      repeatMode,
      isShuffleOn,
    );
    if (!result.video) return;
    handleVideoChange(result.video, result.playlist);
  }, [isShuffleOn, repeatMode, handleVideoChange]);

  const handleSkip = useCallback(() => {
    const result = skipQueue(playlistRef.current, currentVideoRef.current.id);
    if (!result.video) return;
    handleVideoChange(result.video, result.playlist);
  }, [handleVideoChange]);

  const handlePlaybackError = useCallback(() => {
    const result = skipUnplayable(playlistRef.current, currentVideoRef.current.id, repeatMode);
    if (!result.video) return;
    handleVideoChange(result.video, result.playlist);
    setMessages(prev => [...prev, {
      id: `skip-${Date.now()}`,
      userId: 'ai-1',
      text: tRef.current('skipUnplayable'),
      timestamp: Date.now()
    }]);
  }, [handleVideoChange, repeatMode]);

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
      text: t('playlistSaved', { name }),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleLoadPlaylist = (savedPlaylist: SavedPlaylist) => {
    if (savedPlaylist.videos.length > 0) {
      publishPlayback(savedPlaylist.videos[0], savedPlaylist.videos);
    }

    const msg: Message = {
      id: `sys-load-${Date.now()}`,
      userId: 'ai-1',
      text: t('playlistLoadedMsg', { name: savedPlaylist.name }),
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

        publishPlayback(videoList[0], videoList);

        const genreInfo = GENRE_OPTIONS.find(g => g.id === genre);
        const genreName = genreInfo ? `${genreInfo.emoji} ${genreInfo.name}` : '🎵';

        const msg: Message = {
          id: `sys-start-${Date.now()}`,
          userId: 'ai-1',
          text: t('genreRecommendComplete', { genre: genreName, count: videoList.length }),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      } else {
        const msg: Message = {
          id: `sys-error-${Date.now()}`,
          userId: 'ai-1',
          text: t('recommendFailed'),
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

        publishPlayback(videoList[0], videoList);

        const msg: Message = {
          id: `sys-ranking-${Date.now()}`,
          userId: 'ai-1',
          text: t('koreanPopularChart'),
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
      } else {
        const msg: Message = {
          id: `sys-error-${Date.now()}`,
          userId: 'ai-1',
          text: t('chartFailed'),
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
    if (savedPlaylist.videos.length > 0) {
      publishPlayback(savedPlaylist.videos[0], savedPlaylist.videos);
    }
    setShowStartModal(false);

    const msg: Message = {
      id: `sys-start-${Date.now()}`,
      userId: 'ai-1',
      text: t('startWithPlaylist', { name: savedPlaylist.name }),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleStartWithVideo = (video: Video) => {
    publishPlayback(video, [video]);
    setShowStartModal(false);

    const msg: Message = {
      id: `sys-start-${Date.now()}`,
      userId: 'ai-1',
      text: t('searchAndStart', { title: video.title }),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleRemoveVideo = (videoId: string) => {
    const newPlaylist = playlistRef.current.filter(v => v.id !== videoId);
    if (videoId === currentVideoRef.current.id && newPlaylist.length > 0) {
      publishPlayback(newPlaylist[0], newPlaylist);
      return;
    }
    publishPlaylist(newPlaylist);
  };

  const handleReorderPlaylist = (newOrder: Video[]) => {
    publishPlaylist(newOrder);
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

  const handleLeaveRoom = () => {
    if (currentRoom && currentUser) {
      firebaseService.removeUserFromRoom(currentRoom.id, currentUser.id);
    }
    sessionStorage.removeItem('tubePartySession');
    setHasJoined(false);
    setCurrentRoom(null);
    setCurrentUser(null);
    setUsers([SYSTEM_AI]);
    setMessages([]);
    setPlaylist([INITIAL_VIDEO]);
    setCurrentVideo(INITIAL_VIDEO);
    playlistRef.current = [INITIAL_VIDEO];
    currentVideoRef.current = INITIAL_VIDEO;
    pendingVideoSyncRef.current = null;
    pendingPlaylistSyncRef.current = null;
    setMoreOpen(false);
    setMobileView('watch');
  };

  const copyRoomCode = async () => {
    if (!currentRoom) return;
    try {
      await navigator.clipboard.writeText(currentRoom.id);
      showToast(t('roomCodeCopied'));
    } catch (error) {
      console.error('Failed to copy room code:', error);
    }
  };

  const toggleCinema = () => {
    setSidePanel((prev) => {
      if (prev === 'hidden') return sidePanelBeforeCinema.current;
      sidePanelBeforeCinema.current = prev;
      return 'hidden';
    });
  };

  const openSidePanel = (panel: 'chat' | 'playlist') => {
    sidePanelBeforeCinema.current = panel;
    setSidePanel(panel);
  };

  // --- Render ---

  if (!hasJoined) {
    return (
      <Onboarding
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onJoinInvite={handleJoinInvite}
        onCancelInvite={() => {
          setPendingInviteToken(null);
          setInviteStatus('none');
        }}
        inviteStatus={pendingInviteToken ? inviteStatus : 'none'}
      />
    );
  }

  const controlsMode: PlayerControlsMode = !isDesktop ? 'tap' : sidePanel === 'hidden' ? 'hover' : 'always';
  const minimized = !isDesktop && mobileView !== 'watch';
  const humanCount = users.filter((user) => !user.isAi).length;
  const showMobileTabs = !isDesktop && keyboardInset === 0;

  const voiceChat = currentRoom && currentUser ? (
    <VoiceChat
      roomId={currentRoom.id}
      userId={currentUser.id}
      userName={currentUser.name}
      onError={(error) => {
        setMessages((prev) => [...prev, {
          id: `voice-error-${Date.now()}`,
          userId: 'ai-1',
          text: `${t('voiceError')} ${error}`,
          timestamp: Date.now()
        }]);
      }}
    />
  ) : null;

  const moreMenu = (
    <MoreMenu
      t={t}
      isSyncEnabled={isSyncEnabled}
      onToggleSync={handleToggleSync}
      onInvite={handleShare}
      onLeave={handleLeaveRoom}
      language={language}
      onLanguage={setLanguage}
      voice={voiceChat}
    />
  );

  const chatPanel = (
    <ChatRoom
      messages={messages}
      users={users}
      currentUser={currentUser!}
      onSendMessage={handleSendMessage}
      isAiTyping={isAiTyping}
      variant={isDesktop ? 'panel' : 'sheet'}
      onKeyboardInset={isDesktop ? undefined : setKeyboardInset}
    />
  );

  const queuePanel = (
    <div className="flex h-full min-h-0 flex-col bg-black/20">
      <div className="shrink-0 border-b border-white/10 p-3">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => { setInputMode('search'); setSearchResults([]); }}
            className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-lg text-sm ${inputMode === 'search' ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-400'}`}
          >
            <Search size={14} />
            {t('searchMobile')}
          </button>
          <button
            type="button"
            onClick={() => { setInputMode('link'); setSearchResults([]); }}
            className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-lg text-sm ${inputMode === 'link' ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-400'}`}
          >
            <LinkIcon size={14} />
            {t('linkMobile')}
          </button>
        </div>
        <div className="flex items-center rounded-lg apple-control apple-focus px-3">
          {inputMode === 'search' ? (
            <>
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                className="h-11 w-full bg-transparent text-sm text-white focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInlineSearch()}
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="flex h-11 w-11 items-center justify-center text-gray-400">
                  <X size={16} />
                </button>
              )}
              <button type="button" onClick={handleInlineSearch} disabled={isSearching} className="flex h-11 w-11 items-center justify-center text-white">
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder={t('linkPlaceholder')}
                className="h-11 w-full bg-transparent text-sm text-white focus:outline-none"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddVideo()}
              />
              <button type="button" onClick={handleAddVideo} className="flex h-11 w-11 items-center justify-center text-brand-red">
                <Plus size={18} />
              </button>
            </>
          )}
        </div>
        {searchResults.length > 0 && inputMode === 'search' && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1c1c1e]">
            {searchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSelectSearchResult(result)}
                className="flex w-full items-center gap-3 border-b border-white/5 p-2 text-left last:border-0 hover:bg-white/10"
              >
                <img src={result.thumbnail} alt="" className="h-10 w-16 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{result.title}</span>
                  <span className="block truncate text-xs text-gray-500">{result.channelTitle}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Playlist
          videos={playlist}
          currentVideoId={currentVideo.id}
          onSelectVideo={(video) => {
            handleVideoChange(video);
            if (!isDesktop) setMobileView('watch');
          }}
          onGenerateRecommendations={handleGenerateRecommendations}
          isGenerating={isGenerating}
          hasApiKey={!!(currentRoom?.apiKey && currentRoom.apiKey.trim() !== '')}
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
          onBrowse={() => setShowPlaylistBrowser(true)}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-brand-dark font-sans text-brand-text">
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

      {/* Playlist Browser Modal */}
      <PlaylistBrowser
        isOpen={showPlaylistBrowser}
        onClose={() => setShowPlaylistBrowser(false)}
        onSelectPlaylist={handleAddPlaylist}
        onSelectVideos={(videos, mode) => {
          if (videos.length === 0) return;

          // Calculate new playlist based on mode
          const sourcePlaylist = playlistRef.current;
          const newVideos = videos.filter(v => !sourcePlaylist.some(p => p.id === v.id));
          let updatedPlaylist: Video[];
          let videoToPlay: Video;

          if (mode === 'playNow') {
            // Play Now: Insert at current position + 1 (right after current video)
            const currentIndex = sourcePlaylist.findIndex(v => v.id === currentVideoRef.current.id);
            if (currentIndex >= 0) {
              updatedPlaylist = [
                ...sourcePlaylist.slice(0, currentIndex + 1),
                ...newVideos,
                ...sourcePlaylist.slice(currentIndex + 1)
              ];
            } else {
              updatedPlaylist = [...newVideos, ...sourcePlaylist];
            }
            videoToPlay = newVideos[0] || videos[0];
          } else {
            // Play Next (default): Add to end of playlist
            updatedPlaylist = [...sourcePlaylist, ...newVideos];
            videoToPlay = videos[0];
          }

          // Keep the computed order. handleVideoChange would move the picked
          // video to the front, which breaks play-next / play-now placement.
          publishPlayback(videoToPlay, updatedPlaylist);
          syncService.broadcast({ type: 'VIDEO_CHANGE', payload: { video: videoToPlay } });

          // Notify
          setMobileView('watch');
          setMessages(prev => [...prev, {
            id: `genre-${Date.now()}`,
            userId: 'ai-1',
            text: t('songsAdded', { count: videos.length }),
            timestamp: Date.now()
          }]);
        }}
      />

      {toastMessage && (
        <div className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#30D158] px-4 py-2 font-medium text-black shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          <Check size={16} /> {toastMessage}
        </div>
      )}

      <header className="z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0c0c0e] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <MonitorPlay className="shrink-0 text-brand-red" size={22} />
          <span className="hidden font-semibold text-white sm:inline">TubeParty</span>
          {currentRoom && (
            <button
              type="button"
              onClick={copyRoomCode}
              className="flex h-9 max-w-[9.5rem] items-center gap-1.5 rounded-lg apple-control px-2.5 font-mono text-xs text-gray-200"
            >
              <Copy size={12} />
              <span className="truncate">{currentRoom.id}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDesktop && (
            <button
              type="button"
              onClick={toggleCinema}
              className="inline-flex h-11 items-center gap-2 rounded-lg apple-control px-3 text-sm text-white"
            >
              {sidePanel === 'hidden' ? <MessageSquare size={16} /> : <EyeOff size={16} />}
              {sidePanel === 'hidden' ? t('showChat') : t('hideChat')}
            </button>
          )}
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (isDesktop) setMoreOpen((open) => !open);
                else setMobileView('more');
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg apple-control px-3 text-sm text-white"
            >
              <MoreHorizontal size={16} />
              {t('tabMore')}
            </button>
            <div
              className={
                isDesktop
                  ? `absolute right-0 top-full z-50 mt-2 w-72 ${moreOpen ? '' : 'hidden'}`
                  : mobileView === 'more'
                    ? 'fixed inset-x-0 top-14 z-30 overflow-y-auto bg-[#050505] px-3 py-3'
                    : 'hidden'
              }
              style={!isDesktop && mobileView === 'more' ? { bottom: showMobileTabs ? 'calc(4rem + env(safe-area-inset-bottom))' : 0 } : undefined}
            >
              {moreMenu}
            </div>
          </div>
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 ${isDesktop ? 'flex-row' : 'flex-col'}`}>
        <section className={`flex min-w-0 flex-col ${minimized ? 'shrink-0' : 'min-h-0 flex-1'}`}>
          <div className={isDesktop ? 'mx-auto flex w-full max-w-5xl flex-1 flex-col p-4 lg:p-6' : 'flex min-h-0 flex-1 flex-col'}>
            <VideoPlayer
              videoId={currentVideo.id}
              replayToken={replayToken}
              onVideoEnd={handleVideoEnd}
              onSkip={handleSkip}
              onVideoError={handlePlaybackError}
              currentUserId={currentUser?.id}
              syncState={playbackSyncState}
              onPlaybackSync={handlePlaybackSync}
              syncEnabled={isSyncEnabled}
              controlsMode={controlsMode}
              minimized={minimized}
              minimizedTitle={currentVideo.title}
              onRestore={() => setMobileView('watch')}
              onPositionShared={() => showToast(t('positionShared'))}
            />

            {!minimized && (
              <div className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs ${isSyncEnabled ? 'border-[#30D158]/30 text-[#30D158]' : 'border-white/10 text-gray-400'}`}>
                    <span className={`h-2 w-2 rounded-full ${isSyncEnabled ? 'bg-[#30D158]' : 'bg-gray-500'}`} />
                    {isSyncEnabled ? t('synced') : t('individualPlay')}
                  </span>
                  <span className="text-xs text-gray-500">{t('participantsWatching', { count: humanCount })}</span>
                </div>
                <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-white">{currentVideo.title || t('playlistTitle')}</h2>
                {currentVideo.channelTitle && (
                  <p className="text-sm text-gray-400">{currentVideo.channelTitle}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {isDesktop && sidePanel !== 'hidden' && (
          <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-white/10">
            <div className="grid h-12 shrink-0 grid-cols-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => openSidePanel('chat')}
                className={`text-sm font-medium ${sidePanel === 'chat' ? 'border-b-2 border-white text-white' : 'text-gray-400'}`}
              >
                {t('tabChat')}
              </button>
              <button
                type="button"
                onClick={() => openSidePanel('playlist')}
                className={`text-sm font-medium ${sidePanel === 'playlist' ? 'border-b-2 border-white text-white' : 'text-gray-400'}`}
              >
                {t('tabList')}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {sidePanel === 'chat' ? chatPanel : queuePanel}
            </div>
          </aside>
        )}

        {!isDesktop && mobileView === 'chat' && (
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            <div className="flex h-[70vh] max-h-full min-h-[55%] flex-col">
              {chatPanel}
            </div>
          </div>
        )}

        {!isDesktop && mobileView === 'playlist' && (
          <div className="min-h-0 flex-1">
            {queuePanel}
          </div>
        )}
      </div>

      {showMobileTabs && (
        <nav className="z-40 grid shrink-0 grid-cols-3 border-t border-white/10 bg-black/90 pb-[env(safe-area-inset-bottom)]">
          {([
            ['chat', t('tabChat'), MessageSquare],
            ['playlist', t('tabList'), ListVideo],
            ['more', t('tabMore'), MoreHorizontal],
          ] as const).map(([mode, label, Icon]) => {
            const active = mobileView === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setMobileView(mode)}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? 'text-white' : 'text-gray-400'}`}
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default App;
