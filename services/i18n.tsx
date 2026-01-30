import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 지원 언어 타입
export type Language = 'ko' | 'ja' | 'en';

// 언어 옵션 정보
export const languageOptions: { code: Language; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

// localStorage 키
const LANGUAGE_KEY = 'tubePartyLanguage';

// 번역 데이터
export const translations = {
  ko: {
    // Onboarding
    title: 'TubeParty AI',
    subtitle: '친구들과 함께 유튜브를 즐기세요.',
    savedInfo: '저장된 정보',
    apiKeySaved: '🔑 API 키 저장됨',
    nicknameOnly: '닉네임만 저장됨',
    createRoom: '새 방 만들기',
    joinRoom: '방 참가하기',
    nickname: '닉네임',
    nicknamePlaceholder: '멋진 닉네임을 입력하세요',
    apiKey: 'Gemini API 키',
    apiKeyPlaceholder: 'AIzaSy...',
    apiKeyHelp: '에서 무료로 발급받을 수 있어요.',
    roomCode: '방 코드',
    roomCodePlaceholder: 'ABCD12',
    saveLogin: '다음에도 빠르게 로그인하기 (정보 저장)',
    saveNickname: '닉네임 저장하기',
    useApiKey: 'Gemini API 사용',
    apiKeyOptional: 'API 키 없이도 방을 만들 수 있어요. AI 기능(추천, 채팅)이 비활성화됩니다.',
    createButton: '방 만들기',
    joinButton: '입장하기',
    back: '← 돌아가기',
    footer: '방을 만들면 친구들과 공유할 수 있는 코드가 생성됩니다.',

    // App / Navbar
    searchPlaceholder: '노래 검색...',
    linkPlaceholder: '유튜브 링크...',
    playlist: '재생목록',
    sync: '동기화',
    individualPlay: '개별재생',
    invite: '초대',
    leave: '나가기',
    roomCodeCopied: '방 코드가 복사되었습니다!',
    searchMobile: '검색',
    linkMobile: '링크',
    searchMobilePlaceholder: '노래 제목, 아티스트 검색...',
    linkMobilePlaceholder: '유튜브 링크 추가...',

    // ChatRoom
    liveChat: '실시간 채팅',
    participantsCount: '명 참여중',
    participants: '참여자:',
    noParticipants: '아직 아무도 없어요',
    unknownUser: '알 수 없음',
    me: '나',
    messagePlaceholder: '메시지 보내기... (@AI로 봇 호출)',

    // Playlist
    playlistTitle: '재생 목록',
    nowPlaying: '번째 재생 중',
    songs: '곡',
    randomPlay: '랜덤 재생',
    repeatOff: '반복 끔',
    repeatAll: '전체 반복',
    repeatOne: '한곡 반복',
    savePlaylist: '플레이리스트 저장',
    loadPlaylist: '플레이리스트 불러오기',
    playlistNamePlaceholder: '플레이리스트 이름...',
    save: '저장하기',
    noSavedPlaylists: '저장된 플레이리스트가 없습니다.',
    videos: '개 영상',
    delete: '삭제',
    emptyPlaylist: '재생 목록이 비어있습니다',
    emptyPlaylistHint: '위의 "AI 추천 받기"를 눌러보세요!',
    aiRecommendButton: '✨ AI 추천 받기',
    aiRecommending: 'AI가 추천곡을 찾고 있어요...',
    dragToReorder: '드래그해서 순서 변경',
    removeFromList: '목록에서 삭제',

    // StartModal
    selectMusic: '시작할 음악 선택',
    whatMusic: '어떤 음악으로 시작할까요?',
    recommendTab: '추천/장르',
    searchTab: '곡 검색',
    aiRecommending2: 'AI가 추천 중...',
    pleaseWait: '잠시만 기다려주세요',
    mySavedPlaylists: '내 저장된 플레이리스트',
    popularNow: '지금 인기 있는 음악',
    refresh: '새로고침',
    cantLoadPopular: '인기 음악을 불러올 수 없습니다',
    genreStart: '🎵 장르로 시작 (AI 추천)',
    popularChart: '인기 차트 (Top 50)',
    popularChartDesc: '지금 한국에서 가장 인기 있는 음악',
    savePlaylistHint: '💡 플레이리스트를 저장하면 다음에 바로 사용할 수 있어요!',
    searchResults: '검색 결과',
    clickSearchButton: '검색 버튼을 눌러주세요',
    searchSong: '듣고 싶은 노래를 검색해보세요',
    searchExample: '예: "BTS", "아이유 밤편지"',

    // System Messages
    welcomeMessage: '안녕! TubeParty에 온 걸 환영해! 👋',
    roomCreated: '방이 생성됐어! 방 코드:',
    sessionRestored: '세션이 복원되었어! {name}님, 다시 돌아온 걸 환영해!',
    userJoined: '{name}님이 입장했어! 환영해! 🎉',
    userJoinedShort: '{name}님이 입장했습니다!',
    userLeft: '{name}님이 퇴장했습니다.',
    videoChanged: '영상이 변경되었어! 📺:',
    addedSong: '추가했어! 🎵 지금 재생할게!',
    searchNotFound: '검색 결과가 없어 😢 다른 키워드로 시도해줘!',
    playlistLoaded: '플레이리스트에서 영상 {count}개를 가져왔어! 📚',
    aiRecommendAdded: 'AI 추천 영상 {count}개를 추가했어! 🎵',
    genreRecommendComplete: '{genre} 장르 음악 {count}개 추천 완료! 🎵',
    recommendFailed: '추천을 가져오지 못했어 😢 다시 시도해줘!',
    koreanPopularChart: '🔥 대한민국 인기 급상승 차트 50곡을 가져왔어!',
    chartFailed: '차트를 가져오지 못했어 😢 다시 시도해줘!',
    startWithPlaylist: '"{name}" 플레이리스트로 시작! 📂',
    searchAndStart: '🔍 "{title}" 검색해서 시작! 🎵',
    searchAndAdd: '🔍 "{title}" 검색해서 추가했어! 바로 재생할게!',
    playlistAdded: '📋 "{title}" 재생목록에서 {count}곡을 추가했어! 🎵',
    songsAdded: '🎵 {count}곡이 추가되었어! 바로 재생할게!',
    skipUnplayable: '재생 불가 영상 스킵! ⏭️',
    playlistSaved: '플레이리스트 "{name}"가 저장되었어! 💾',
    playlistLoadedMsg: '플레이리스트 "{name}"를 불러왔어! 📂',
    voiceError: '🎤 음성채팅 오류:',
    roomNotExist: '존재하지 않는 방 코드입니다.',
    roomCreateFailed: '방 생성에 실패했어요. 다시 시도해주세요.',
    roomJoinFailed: '방 참가에 실패했어요. 다시 시도해주세요.',
    invalidYoutubeLink: '올바른 유튜브 링크가 아닙니다.',
    playlistLoadFailed: '플레이리스트를 불러올 수 없거나 비어있습니다.',
  },
  ja: {
    // Onboarding
    title: 'TubeParty AI',
    subtitle: '友達と一緒にYouTubeを楽しもう。',
    savedInfo: '保存された情報',
    apiKeySaved: '🔑 APIキー保存済み',
    nicknameOnly: 'ニックネームのみ保存',
    createRoom: '新しいルームを作成',
    joinRoom: 'ルームに参加',
    nickname: 'ニックネーム',
    nicknamePlaceholder: 'かっこいいニックネームを入力',
    apiKey: 'Gemini APIキー',
    apiKeyPlaceholder: 'AIzaSy...',
    apiKeyHelp: 'で無料で取得できます。',
    roomCode: 'ルームコード',
    roomCodePlaceholder: 'ABCD12',
    saveLogin: '次回も簡単ログイン（情報を保存）',
    saveNickname: 'ニックネームを保存',
    useApiKey: 'Gemini APIを使用',
    apiKeyOptional: 'APIキーなしでもルームを作成できます。AI機能（推薦、チャット）は無効になります。',
    createButton: 'ルーム作成',
    joinButton: '入室する',
    back: '← 戻る',
    footer: 'ルームを作成すると、友達と共有できるコードが生成されます。',

    // App / Navbar
    searchPlaceholder: '曲を検索...',
    linkPlaceholder: 'YouTubeリンク...',
    playlist: 'プレイリスト',
    sync: '同期',
    individualPlay: '個別再生',
    invite: '招待',
    leave: '退出',
    roomCodeCopied: 'ルームコードがコピーされました！',
    searchMobile: '検索',
    linkMobile: 'リンク',
    searchMobilePlaceholder: '曲名、アーティストを検索...',
    linkMobilePlaceholder: 'YouTubeリンクを追加...',

    // ChatRoom
    liveChat: 'リアルタイムチャット',
    participantsCount: '人参加中',
    participants: '参加者:',
    noParticipants: 'まだ誰もいません',
    unknownUser: '不明',
    me: '自分',
    messagePlaceholder: 'メッセージを送信... (@AIでボット呼び出し)',

    // Playlist
    playlistTitle: 'プレイリスト',
    nowPlaying: '番目を再生中',
    songs: '曲',
    randomPlay: 'シャッフル再生',
    repeatOff: 'リピートオフ',
    repeatAll: '全曲リピート',
    repeatOne: '1曲リピート',
    savePlaylist: 'プレイリストを保存',
    loadPlaylist: 'プレイリストを読み込む',
    playlistNamePlaceholder: 'プレイリスト名...',
    save: '保存',
    noSavedPlaylists: '保存されたプレイリストがありません。',
    videos: '本の動画',
    delete: '削除',
    emptyPlaylist: 'プレイリストが空です',
    emptyPlaylistHint: '上の「AI推薦」をクリックしてみてください！',
    aiRecommendButton: '✨ AI推薦を受ける',
    aiRecommending: 'AIが推薦曲を探しています...',
    dragToReorder: 'ドラッグして順序を変更',
    removeFromList: 'リストから削除',

    // StartModal
    selectMusic: '開始する音楽を選択',
    whatMusic: 'どの音楽で始めますか？',
    recommendTab: '推薦/ジャンル',
    searchTab: '曲検索',
    aiRecommending2: 'AI推薦中...',
    pleaseWait: 'しばらくお待ちください',
    mySavedPlaylists: '保存したプレイリスト',
    popularNow: '今人気の音楽',
    refresh: '更新',
    cantLoadPopular: '人気の音楽を読み込めません',
    genreStart: '🎵 ジャンルで開始（AI推薦）',
    popularChart: '人気チャート（Top 50）',
    popularChartDesc: '今日本で最も人気のある音楽',
    savePlaylistHint: '💡 プレイリストを保存すると、次回すぐに使えます！',
    searchResults: '検索結果',
    clickSearchButton: '検索ボタンを押してください',
    searchSong: '聴きたい曲を検索してみてください',
    searchExample: '例：「BTS」、「米津玄師 Lemon」',

    // System Messages
    welcomeMessage: 'こんにちは！TubePartyへようこそ！ 👋',
    roomCreated: 'ルームが作成されました！ルームコード:',
    sessionRestored: 'セッションが復元されました！{name}さん、おかえりなさい！',
    userJoined: '{name}さんが入室しました！ようこそ！ 🎉',
    userJoinedShort: '👋 {name}さんが入室しました！',
    userLeft: '🚪 {name}さんが退室しました。',
    videoChanged: '動画が変更されました！ 📺:',
    addedSong: '追加しました！ 🎵 今すぐ再生します！',
    searchNotFound: '検索結果がありません 😢 別のキーワードを試してください！',
    playlistLoaded: 'プレイリストから{count}本の動画を取得しました！ 📚',
    aiRecommendAdded: 'AI推薦動画{count}本を追加しました！ 🎵',
    genreRecommendComplete: '{genre}ジャンルの音楽{count}曲の推薦完了！ 🎵',
    recommendFailed: '推薦を取得できませんでした 😢 もう一度お試しください！',
    koreanPopularChart: '🔥 日本の人気急上昇チャート50曲を取得しました！',
    chartFailed: 'チャートを取得できませんでした 😢 もう一度お試しください！',
    startWithPlaylist: '「{name}」プレイリストで開始！ 📂',
    searchAndStart: '🔍 「{title}」を検索して開始！ 🎵',
    searchAndAdd: '🔍 「{title}」を検索して追加しました！今すぐ再生します！',
    playlistAdded: '📋 「{title}」プレイリストから{count}曲を追加しました！ 🎵',
    songsAdded: '🎵 {count}曲が追加されました！今すぐ再生します！',
    skipUnplayable: '再生不可の動画をスキップ！ ⏭️',
    playlistSaved: 'プレイリスト「{name}」が保存されました！ 💾',
    playlistLoadedMsg: 'プレイリスト「{name}」を読み込みました！ 📂',
    voiceError: '🎤 音声チャットエラー:',
    roomNotExist: '存在しないルームコードです。',
    roomCreateFailed: 'ルームの作成に失敗しました。もう一度お試しください。',
    roomJoinFailed: 'ルームへの参加に失敗しました。もう一度お試しください。',
    invalidYoutubeLink: '有効なYouTubeリンクではありません。',
    playlistLoadFailed: 'プレイリストを読み込めないか、空です。',
  },
  en: {
    // Onboarding
    title: 'TubeParty AI',
    subtitle: 'Enjoy YouTube with your friends.',
    savedInfo: 'Saved Info',
    apiKeySaved: '🔑 API key saved',
    nicknameOnly: 'Nickname only',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    nickname: 'Nickname',
    nicknamePlaceholder: 'Enter your nickname',
    apiKey: 'Gemini API Key',
    apiKeyPlaceholder: 'AIzaSy...',
    apiKeyHelp: ' - Get it free from',
    roomCode: 'Room Code',
    roomCodePlaceholder: 'ABCD12',
    saveLogin: 'Remember me for quick login',
    saveNickname: 'Save nickname',
    useApiKey: 'Use Gemini API',
    apiKeyOptional: 'You can create a room without API key. AI features (recommendations, chat) will be disabled.',
    createButton: 'Create Room',
    joinButton: 'Join',
    back: '← Back',
    footer: 'A shareable code will be generated when you create a room.',

    // App / Navbar
    searchPlaceholder: 'Search songs...',
    linkPlaceholder: 'YouTube link...',
    playlist: 'Playlist',
    sync: 'Sync',
    individualPlay: 'Individual',
    invite: 'Invite',
    leave: 'Leave',
    roomCodeCopied: 'Room code copied!',
    searchMobile: 'Search',
    linkMobile: 'Link',
    searchMobilePlaceholder: 'Search song title, artist...',
    linkMobilePlaceholder: 'Add YouTube link...',

    // ChatRoom
    liveChat: 'Live Chat',
    participantsCount: ' online',
    participants: 'Participants:',
    noParticipants: 'No one here yet',
    unknownUser: 'Unknown',
    me: 'Me',
    messagePlaceholder: 'Send message... (@AI to call bot)',

    // Playlist
    playlistTitle: 'Playlist',
    nowPlaying: 'th playing',
    songs: 'songs',
    randomPlay: 'Shuffle',
    repeatOff: 'Repeat off',
    repeatAll: 'Repeat all',
    repeatOne: 'Repeat one',
    savePlaylist: 'Save playlist',
    loadPlaylist: 'Load playlist',
    playlistNamePlaceholder: 'Playlist name...',
    save: 'Save',
    noSavedPlaylists: 'No saved playlists.',
    videos: ' videos',
    delete: 'Delete',
    emptyPlaylist: 'Playlist is empty',
    emptyPlaylistHint: 'Click "Get AI Recommendations" above!',
    aiRecommendButton: '✨ Get AI Recommendations',
    aiRecommending: 'AI is finding recommendations...',
    dragToReorder: 'Drag to reorder',
    removeFromList: 'Remove from list',

    // StartModal
    selectMusic: 'Select Music to Start',
    whatMusic: 'What music would you like to start with?',
    recommendTab: 'Recommend/Genre',
    searchTab: 'Search Songs',
    aiRecommending2: 'AI recommending...',
    pleaseWait: 'Please wait',
    mySavedPlaylists: 'My Saved Playlists',
    popularNow: 'Popular Now',
    refresh: 'Refresh',
    cantLoadPopular: 'Cannot load popular music',
    genreStart: '🎵 Start by Genre (AI Recommendation)',
    popularChart: 'Popular Chart (Top 50)',
    popularChartDesc: 'Most popular music right now',
    savePlaylistHint: '💡 Save playlists to use them next time!',
    searchResults: 'Search Results',
    clickSearchButton: 'Click the search button',
    searchSong: 'Search for songs you want to hear',
    searchExample: 'e.g., "BTS", "Taylor Swift"',

    // System Messages
    welcomeMessage: 'Hello! Welcome to TubeParty! 👋',
    roomCreated: 'Room created! Room code:',
    sessionRestored: 'Session restored! Welcome back, {name}!',
    userJoined: '{name} has joined! Welcome! 🎉',
    userJoinedShort: '👋 {name} has joined!',
    userLeft: '🚪 {name} has left.',
    videoChanged: 'Video changed! 📺:',
    addedSong: 'Added! 🎵 Playing now!',
    searchNotFound: 'No results found 😢 Try another keyword!',
    playlistLoaded: 'Loaded {count} videos from playlist! 📚',
    aiRecommendAdded: 'Added {count} AI recommended videos! 🎵',
    genreRecommendComplete: '{genre} genre: {count} songs recommended! 🎵',
    recommendFailed: 'Failed to get recommendations 😢 Please try again!',
    koreanPopularChart: '🔥 Loaded Top 50 trending chart!',
    chartFailed: 'Failed to load chart 😢 Please try again!',
    startWithPlaylist: 'Starting with "{name}" playlist! 📂',
    searchAndStart: '🔍 Searched and starting "{title}"! 🎵',
    searchAndAdd: '🔍 Searched and added "{title}"! Playing now!',
    playlistAdded: '📋 Added {count} songs from "{title}" playlist! 🎵',
    songsAdded: '🎵 {count} songs added! Playing now!',
    skipUnplayable: 'Skipping unplayable video! ⏭️',
    playlistSaved: 'Playlist "{name}" saved! 💾',
    playlistLoadedMsg: 'Loaded playlist "{name}"! 📂',
    voiceError: '🎤 Voice chat error:',
    roomNotExist: 'Room code does not exist.',
    roomCreateFailed: 'Failed to create room. Please try again.',
    roomJoinFailed: 'Failed to join room. Please try again.',
    invalidYoutubeLink: 'Invalid YouTube link.',
    playlistLoadFailed: 'Cannot load playlist or it is empty.',
  },
};

// 번역 타입
export type TranslationKey = keyof typeof translations.ko;

// Context 타입
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

// Context 생성
const I18nContext = createContext<I18nContextType | null>(null);

// Provider 컴포넌트
export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ko');

  // 저장된 언어 불러오기
  useEffect(() => {
    const savedLang = localStorage.getItem(LANGUAGE_KEY) as Language;
    if (savedLang && ['ko', 'ja', 'en'].includes(savedLang)) {
      setLanguageState(savedLang);
    }
  }, []);

  // 언어 변경 핸들러
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
  };

  // 번역 함수
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations.ko[key] || key;
    
    // 파라미터 치환 (예: {name} -> 실제 이름)
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      });
    }
    
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

// Hook
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// 현재 언어 정보 가져오기
export const getCurrentLanguageInfo = (language: Language) => {
  return languageOptions.find(l => l.code === language) || languageOptions[0];
};
