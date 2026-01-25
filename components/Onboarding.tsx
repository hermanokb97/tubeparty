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
}

export const Onboarding: React.FC<OnboardingProps> = ({ onCreateRoom, onJoinRoom }) => {
  const { language, setLanguage, t } = useI18n();
  
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [nickname, setNickname] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [saveInfo, setSaveInfo] = useState(true);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

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

  // 언어 변경 핸들러
  const handleLanguageChange = (lang: typeof language) => {
    setLanguage(lang);
    setShowLanguageMenu(false);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() && apiKey.trim()) {
      // 정보 저장 옵션이 켜져있으면 저장
      if (saveInfo) {
        saveCredentials(nickname.trim(), apiKey.trim());
      }
      onCreateRoom(nickname.trim(), apiKey.trim());
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-75"></div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-700 transition-colors"
          >
            <Globe size={16} className="text-gray-400" />
            <span className="text-sm">
              {languageOptions.find(l => l.code === language)?.flag}{' '}
              {languageOptions.find(l => l.code === language)?.label}
            </span>
          </button>

          {/* Language Dropdown */}
          {showLanguageMenu && (
            <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
              {languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    language === lang.code
                      ? 'bg-brand-red text-white'
                      : 'text-gray-300 hover:bg-gray-700'
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

      <div className="max-w-md w-full bg-brand-gray/30 p-8 rounded-2xl border border-brand-gray backdrop-blur-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-brand-red/10 rounded-full mb-4 ring-1 ring-brand-red/50">
            <MonitorPlay size={48} className="text-brand-red" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">{t('subtitle')}</p>
        </div>

        {mode === 'select' && (
          <div className="space-y-4">
            {/* 저장된 정보가 있으면 표시 */}
            {hasSavedData && nickname && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 mb-2">
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
                  <div className="w-10 h-10 bg-brand-red/20 rounded-full flex items-center justify-center text-brand-red font-bold">
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
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-red/20"
            >
              <Plus size={20} />
              {t('createRoom')}
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
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
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500"
                placeholder={t('nicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Key size={14} />
                {t('apiKey')}
              </label>
              <input
                type="password"
                required
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500 font-mono text-sm"
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

            {/* 정보 저장 옵션 */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 bg-gray-700 rounded border border-gray-600 peer-checked:bg-brand-red peer-checked:border-brand-red transition-all flex items-center justify-center">
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
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 disabled:opacity-50"
              disabled={!nickname.trim() || !apiKey.trim()}
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('nickname')}
              </label>
              <input
                type="text"
                required
                maxLength={12}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500"
                placeholder={t('nicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Hash size={14} />
                {t('roomCode')}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500 font-mono text-lg tracking-widest uppercase text-center"
                placeholder={t('roomCodePlaceholder')}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
            </div>

            {/* 정보 저장 옵션 */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 bg-gray-700 rounded border border-gray-600 peer-checked:bg-brand-red peer-checked:border-brand-red transition-all flex items-center justify-center">
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
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 disabled:opacity-50"
              disabled={!nickname.trim() || roomCode.length !== 6}
            >
              {t('joinButton')}
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

        <div className="mt-8 text-center text-xs text-gray-500">
          {t('footer')}
        </div>
      </div>
    </div>
  );
};