import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon } from 'lucide-react';
import { Message, User } from '../types';

interface ChatRoomProps {
  messages: Message[];
  users: User[];
  currentUser: User;
  onSendMessage: (text: string) => void;
  isAiTyping: boolean;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  messages,
  users,
  currentUser,
  onSendMessage,
  isAiTyping
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const getUser = (userId: string) => users.find(u => u.id === userId);

  return (
    <div className="flex flex-col h-full bg-brand-gray/30 rounded-lg border border-brand-gray overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-brand-gray bg-brand-dark/50 flex justify-between items-center">
        <h3 className="font-semibold text-white">실시간 채팅</h3>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>{users.length}명 참여중</span>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => {
          const sender = getUser(msg.userId);
          const isMe = msg.userId === currentUser.id;
          const isAi = sender?.isAi;

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                  ${isAi ? 'bg-gradient-to-tr from-purple-500 to-blue-500' : 'bg-gray-600'}`}>
                  {isAi ? <Bot size={16} /> : <UserIcon size={16} />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-400 mb-1 ml-1">{msg.userName || sender?.name || '알 수 없음'}</span>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm break-words
                      ${isMe
                        ? 'bg-brand-red text-white rounded-br-none'
                        : isAi
                          ? 'bg-gradient-to-r from-gray-700 to-gray-800 border border-gray-600 text-gray-100 rounded-bl-none'
                          : 'bg-gray-700 text-gray-100 rounded-bl-none'
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-none">
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-brand-dark/50 border-t border-brand-gray">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="메시지 보내기... (@AI로 봇 호출)"
            className="w-full bg-gray-800 text-white pl-4 pr-12 py-3 rounded-full border border-gray-700 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-red hover:bg-red-700 rounded-full text-white transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};