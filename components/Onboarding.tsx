import React, { useState, useEffect } from 'react';
import { MonitorPlay, ArrowRight, Plus, Users, Key, Hash, Save, Trash2, Clock, Globe } from 'lucide-react';
import { useI18n, languageOptions } from '../services/i18n';

// 저장된 로그인 정보 타입
interface SavedCredentials {
  nickname: string;
  apiKey: string;
  savedAt: number;
}

// localStorage 키
const STORAGE_KEY = 'tubePartyCredentials';

// 저장된 정보 불러오기
const loadSavedCredentials = (): SavedCredentials | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved credentials:', e);
  }
  return null;
};

// 정보 저장
const saveCredentials = (nickname: string, apiKey: string) => {
  try {
    const data: SavedCredentials = {
      nickname,
      apiKey,
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save credentials:', e);
  }
};

// 저장된 정보 삭제
const clearSavedCredentials = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear credentials:', e);
  }
};

interface OnboardingProps {
  onCreateRoom: (nickname: string, apiKey: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
  onJoinInvite?: (nickname: string) => void;
  onCancelInvite?: () => void;
  inviteStatus?: 'none' | 'checking' | 'ready' | 'invalid';
}

export const Onboarding: React.FC<OnboardingProps> = ({
  onCreateRoom,
  onJoinRoom,
  onJoinInvite,
  onCancelInvite,
  inviteStatus = 'none',
}) => {
  const { language, setLanguage, t } = useI18n();
  const isInviteMode = inviteStatus !== 'none';

  const [mode, setMode] = useState<'select' | 'create' | 'join'>(isInviteMode ? 'join' : 'select');
  const [nickname, setNickname] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [saveInfo, setSaveInfo] = useState(true);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [useApi, setUseApi] = useState(true);

  // 저장된 정보 불러오기
  useEffect(() => {
    const saved = loadSavedCredentials();
    if (saved) {
      setNickname(saved.nickname);
      setApiKey(saved.apiKey);
      setHasSavedData(true);
      setSaveInfo(true);
    }
  }, []);

  useEffect(() => {
    if (isInviteMode) {
      setMode('join');
    }
  }, [isInviteMode]);

  // 언어 변경 핸들러
  const handleLanguageChange = (lang: typeof language) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    // API 사용 시에만 apiKey 필수
    if (nickname.trim() && (!useApi || apiKey.trim())) {
      // 정보 저장 옵션이 켜져있으면 저장
      if (saveInfo) {
        saveCredentials(nickname.trim(), useApi ? apiKey.trim() : '');
      }
      onCreateRoom(nickname.trim(), useApi ? apiKey.trim() : '');
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInviteMode) {
      if (nickname.trim() && inviteStatus === 'ready') {
        if (saveInfo && nickname.trim()) {
          const saved = loadSavedCredentials();
          saveCredentials(nickname.trim(), saved?.apiKey || '');
        }
        onJoinInvite?.(nickname.trim());
      }
      return;
    }

    if (nickname.trim() && roomCode.trim()) {
      // 닉네임만 저장 (방 참가시에는 API 키가 없을 수 있음)
      if (saveInfo && nickname.trim()) {
        const saved = loadSavedCredentials();
        saveCredentials(nickname.trim(), saved?.apiKey || '');
      }
      onJoinRoom(nickname.trim(), roomCode.trim().toUpperCase());
    }
  };

  const handleClearSaved = () => {
    clearSavedCredentials();
    setNickname('');
    setApiKey('');
    setHasSavedData(false);
    setSaveInfo(true);
  };

  const handleBack = () => {
    if (isInviteMode) {
      onCancelInvite?.();
    }
    setMode('select');
  };

  const inviteMessage = inviteStatus === 'checking'
    ? t('inviteChecking')
    : inviteStatus === 'ready'
      ? t('inviteReady')
      : t('inviteInvalid');

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/[0.035] to-transparent pointer-events-none" />

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 apple-control text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Globe size={16} className="text-gray-300" />
            <span className="text-sm">
              {languageOptions.find(l => l.code === language)?.flag}{' '}
              {languageOptions.find(l => l.code === language)?.label}
            </span>
          </button>

          {/* Language Dropdown */}
          {showLanguageMenu && (
            <div className="absolute top-full right-0 mt-2 apple-surface-strong rounded-lg overflow-hidden min-w-[140px]">
              {languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    language === lang.code
                      ? 'bg-brand-red text-white'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md w-full apple-surface p-8 rounded-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-brand-red/15 rounded-lg mb-4 ring-1 ring-brand-red/35 shadow-[0_12px_35px_rgba(10,132,255,0.18)]">
            <MonitorPlay size={48} className="text-brand-red" />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {mode === 'select' && (
          <div className="space-y-4">
            {/* 저장된 정보가 있으면 표시 */}
            {hasSavedData && nickname && (
              <div className="apple-control rounded-lg p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <Clock size={14} />
                    <span>{t('savedInfo')}</span>
                  </div>
                  <button
                    onClick={handleClearSaved}
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    title="Delete saved info"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-red/15 rounded-lg flex items-center justify-center text-brand-red font-semibold">
                    {nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{nickname}</p>
                    <p className="text-gray-500 text-xs">
                      {apiKey ? t('apiKeySaved') : t('nicknameOnly')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setMode('create')}
              className="w-full bg-brand-red hover:bg-[#2997ff] text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-3 shadow-[0_16px_40px_rgba(10,132,255,0.28)]"
            >
              <Plus size={20} />
              {t('createRoom')}
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full apple-control text-white font-semibold py-4 rounded-lg transition-all flex items-center justify-center gap-3"
            >
              <Users size={20} />
              {t('joinRoom')}
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('nickname')}
              </label>
              <input
                type="text"
                required
                maxLength={12}
                className="w-full apple-control apple-focus text-white px-4 py-3 rounded-lg transition-all placeholder-gray-500"
                placeholder={t('nicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* API 사용 여부 토글 */}
            <div className="apple-control rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useApi}
                    onChange={(e) => setUseApi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 bg-white/10 rounded border border-white/15 peer-checked:bg-brand-red peer-checked:border-brand-red transition-all flex items-center justify-center">
                    {useApi && <Key size={12} className="text-white" />}
                  </div>
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors font-medium">
                  {t('useApiKey')}
                </span>
              </label>
              {!useApi && (
                <p className="text-xs text-yellow-500/80 mt-2 ml-8">
                  {t('apiKeyOptional')}
                </p>
              )}
            </div>

            {/* API 키 입력 (useApi가 true일 때만 표시) */}
            {useApi && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Key size={14} />
                  {t('apiKey')}
                </label>
                <input
                  type="password"
                  required={useApi}
                  className="w-full apple-control apple-focus text-white px-4 py-3 rounded-lg transition-all placeholder-gray-500 font-mono text-sm"
                  placeholder={t('apiKeyPlaceholder')}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2">
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    Google AI Studio
                  </a>{t('apiKeyHelp')}
                </p>
              </div>
            )}

            {/* 정보 저장 옵션 */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 bg-white/10 rounded border border-white/15 peer-checked:bg-brand-red peer-checked:border-brand-red transition-all flex items-center justify-center">
                  {saveInfo && <Save size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                {t('saveLogin')}
              </span>
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-brand-red hover:bg-[#2997ff] text-white font-semibold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_16px_40px_rgba(10,132,255,0.28)] disabled:opacity-50"
              disabled={!nickname.trim() || (useApi && !apiKey.trim())}
            >
              {t('createButton')}
              <ArrowRight size={20} />
            </button>

            <button
              type="button"
              onClick={() => setMode('select')}
              className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
            >
              {t('back')}
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinRoom} className="space-y-5">
            {isInviteMode && (
              <div className={`rounded-lg p-3 text-sm border ${
                inviteStatus === 'invalid'
                  ? 'bg-red-500/10 border-red-500/25 text-red-300'
                  : inviteStatus === 'ready'
                    ? 'bg-green-500/10 border-green-500/25 text-green-300'
                    : 'bg-white/5 border-white/10 text-gray-300'
              }`}>
                {inviteMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('nickname')}
              </label>
              <input
                type="text"
                required
                maxLength={12}
                className="w-full apple-control apple-focus text-white px-4 py-3 rounded-lg transition-all placeholder-gray-500"
                placeholder={t('nicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {!isInviteMode && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Hash size={14} />
                  {t('roomCode')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  className="w-full apple-control apple-focus text-white px-4 py-3 rounded-lg transition-all placeholder-gray-500 font-mono text-lg uppercase text-center"
                  placeholder={t('roomCodePlaceholder')}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {/* 정보 저장 옵션 */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 bg-white/10 rounded border border-white/15 peer-checked:bg-brand-red peer-checked:border-brand-red transition-all flex items-center justify-center">
                  {saveInfo && <Save size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                {t('saveNickname')}
              </span>
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-brand-red hover:bg-[#2997ff] text-white font-semibold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_16px_40px_rgba(10,132,255,0.28)] disabled:opacity-50"
              disabled={!nickname.trim() || (isInviteMode ? inviteStatus !== 'ready' : roomCode.length !== 6)}
            >
              {t('joinButton')}
              <ArrowRight size={20} />
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
            >
              {t('back')}
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          {t('footer')}
        </div>
      </div>
    </div>
  );
};
