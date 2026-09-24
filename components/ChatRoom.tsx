import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon } from 'lucide-react';
import { Message, User } from '../types';
import { useI18n } from '../services/i18n';

interface ChatRoomProps {
  messages: Message[];
  users: User[];
  currentUser: User;
  onSendMessage: (text: string) => void;
  isAiTyping: boolean;
  variant?: 'sheet' | 'panel';
  onKeyboardInset?: (inset: number) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  messages,
  users,
  currentUser,
  onSendMessage,
  isAiTyping,
  variant = 'panel',
  onKeyboardInset,
}) => {
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onKeyboardInsetRef = useRef(onKeyboardInset);
  onKeyboardInsetRef.current = onKeyboardInset;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  useEffect(() => {
    if (variant !== 'sheet') {
      setKeyboardInset(0);
      onKeyboardInsetRef.current?.(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setKeyboardInset(inset);
      onKeyboardInsetRef.current?.(inset);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      onKeyboardInsetRef.current?.(0);
    };
  }, [variant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const getUser = (userId: string) => users.find(u => u.id === userId);

  const humanUsers = users.filter(u => !u.isAi);

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden apple-surface ${variant === 'sheet' ? 'rounded-t-2xl border-b-0' : 'rounded-none border-0 shadow-none'}`}
      style={variant === 'sheet' ? { paddingBottom: keyboardInset } : undefined}
    >
      {variant === 'sheet' && (
      <div className="border-b border-white/10 bg-black/25">
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
      <div className="flex items-center justify-between p-4 pt-2">
        <h3 className="font-semibold text-white">{t('liveChat')}</h3>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span className="w-2 h-2 bg-[#30D158] rounded-full animate-pulse"></span>
          <span>{humanUsers.length}{t('participantsCount')}</span>
        </div>
      </div>
      </div>
      )}

      {/* Participants Bar - Always visible */}
      <div className="px-3 py-2 bg-white/[0.035] border-b border-white/10 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="text-xs text-gray-500 shrink-0">👥 {t('participants')}</span>
        {humanUsers.length > 0 ? (
          humanUsers.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs shrink-0 ${user.id === currentUser.id
                  ? 'bg-brand-red/15 text-brand-red border border-brand-red/30'
                  : 'bg-white/[0.07] text-gray-300 border border-white/10'
                }`}
            >
              <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center">
                <UserIcon size={10} />
              </div>
              <span>{user.name}</span>
              {user.id === currentUser.id && <span className="text-[10px]">({t('me')})</span>}
            </div>
          ))
        ) : (
          <span className="text-xs text-gray-500">{t('noParticipants')}</span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-hide">
        {messages.map((msg) => {
          const sender = getUser(msg.userId);
          const isMe = msg.userId === currentUser.id;
          const isAi = sender?.isAi;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 
                  ${isAi ? 'bg-[#5E5CE6]' : 'bg-white/[0.12]'}`}>
                  {isAi ? <Bot size={16} /> : <UserIcon size={16} />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-400 mb-1 ml-1">{msg.userName || sender?.name || t('unknownUser')}</span>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm break-words
                      ${isMe
                        ? 'bg-brand-red text-white rounded-br-none'
                        : isAi
                          ? 'bg-[#2C2C2E] border border-white/10 text-gray-100 rounded-bl-none'
                          : 'bg-white/10 text-gray-100 rounded-bl-none'
                      }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isAiTyping && (
          <div className="flex justify-start">
            <div className="flex max-w-[80%] items-end gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#5E5CE6] flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-none">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-white/10 bg-black/40 p-3"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('messagePlaceholder')}
            className="h-11 min-w-0 flex-1 rounded-lg apple-control apple-focus px-4 text-white"
          />
          <button
            type="submit"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-red text-white transition-colors hover:bg-[#2997ff]"
            aria-label={t('messagePlaceholder')}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
