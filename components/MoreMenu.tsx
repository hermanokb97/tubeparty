import React, { ReactNode } from 'react';
import { Globe, LogOut, Share2, UserX, Users } from 'lucide-react';
import { languageOptions, Language, TranslationKey } from '../services/i18n';

interface MoreMenuProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isSyncEnabled: boolean;
  onToggleSync: () => void;
  onInvite: () => void;
  onLeave: () => void;
  language: Language;
  onLanguage: (language: Language) => void;
  voice: ReactNode;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({
  t,
  isSyncEnabled,
  onToggleSync,
  onInvite,
  onLeave,
  language,
  onLanguage,
  voice,
}) => {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-[#1c1c1e] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onClick={onToggleSync}
        className="flex h-12 items-center gap-3 rounded-lg px-3 text-left text-sm text-white hover:bg-white/10"
      >
        {isSyncEnabled ? <Users size={18} className="text-[#30D158]" /> : <UserX size={18} className="text-gray-400" />}
        <span>{isSyncEnabled ? t('sync') : t('individualPlay')}</span>
      </button>
      <button
        type="button"
        onClick={onInvite}
        className="flex h-12 items-center gap-3 rounded-lg px-3 text-left text-sm text-white hover:bg-white/10"
      >
        <Share2 size={18} />
        <span>{t('invite')}</span>
      </button>
      <div className="rounded-lg px-1 py-1">
        <p className="px-2 pb-1 text-xs text-gray-500">{t('voice')}</p>
        {voice}
      </div>
      <div className="rounded-lg px-2 py-2">
        <p className="flex items-center gap-2 pb-2 text-xs text-gray-500">
          <Globe size={14} />
          {t('language')}
        </p>
        <div className="grid grid-cols-3 gap-1">
          {languageOptions.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => onLanguage(lang.code)}
              className={`flex h-11 items-center justify-center gap-1 rounded-lg text-xs ${
                language === lang.code ? 'bg-brand-red text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span>{lang.flag}</span>
              <span className="truncate">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="flex h-12 items-center gap-3 rounded-lg px-3 text-left text-sm text-[#FF453A] hover:bg-[#FF453A]/10"
      >
        <LogOut size={18} />
        <span>{t('leave')}</span>
      </button>
    </div>
  );
};
