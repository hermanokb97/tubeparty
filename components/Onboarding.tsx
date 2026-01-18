import React, { useState } from 'react';
import { MonitorPlay, ArrowRight, Plus, Users, Key, Hash } from 'lucide-react';

interface OnboardingProps {
  onCreateRoom: (nickname: string, apiKey: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [nickname, setNickname] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() && apiKey.trim()) {
      onCreateRoom(nickname.trim(), apiKey.trim());
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() && roomCode.trim()) {
      onJoinRoom(nickname.trim(), roomCode.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-75"></div>

      <div className="max-w-md w-full bg-brand-gray/30 p-8 rounded-2xl border border-brand-gray backdrop-blur-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-brand-red/10 rounded-full mb-4 ring-1 ring-brand-red/50">
            <MonitorPlay size={48} className="text-brand-red" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TubeParty AI</h1>
          <p className="text-gray-400">친구들과 함께 유튜브를 즐기세요.</p>
        </div>

        {mode === 'select' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-red/20"
            >
              <Plus size={20} />
              새 방 만들기
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <Users size={20} />
              방 참가하기
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                닉네임
              </label>
              <input
                type="text"
                required
                maxLength={12}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500"
                placeholder="멋진 닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Key size={14} />
                Gemini API 키
              </label>
              <input
                type="password"
                required
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500 font-mono text-sm"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Google AI Studio
                </a>에서 무료로 발급받을 수 있어요.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 disabled:opacity-50"
              disabled={!nickname.trim() || !apiKey.trim()}
            >
              방 만들기
              <ArrowRight size={20} />
            </button>

            <button
              type="button"
              onClick={() => setMode('select')}
              className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
            >
              ← 돌아가기
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                닉네임
              </label>
              <input
                type="text"
                required
                maxLength={12}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500"
                placeholder="멋진 닉네임을 입력하세요"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Hash size={14} />
                방 코드
              </label>
              <input
                type="text"
                required
                maxLength={6}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all placeholder-gray-500 font-mono text-lg tracking-widest uppercase text-center"
                placeholder="ABCD12"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-red/20 disabled:opacity-50"
              disabled={!nickname.trim() || roomCode.length !== 6}
            >
              입장하기
              <ArrowRight size={20} />
            </button>

            <button
              type="button"
              onClick={() => setMode('select')}
              className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
            >
              ← 돌아가기
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          방을 만들면 친구들과 공유할 수 있는 코드가 생성됩니다.
        </div>
      </div>
    </div>
  );
};