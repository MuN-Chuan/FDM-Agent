import React from 'react';
import { Bell, Coins, Languages, LayoutGrid, LogOut, Search, User } from 'lucide-react';

import type { UserProfile } from '../../api/api';
import { useI18n } from '../../i18n/I18nProvider';

interface TopbarProps {
    isBorderless?: boolean;
    currentUser: UserProfile | null;
    onOpenAuth: () => void;
    onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ isBorderless, currentUser, onOpenAuth, onLogout }) => {
    const { locale, setLocale, t } = useI18n();

    return (
        <header
            className={`sticky top-0 z-40 flex h-16 items-center justify-between bg-background-light px-8 dark:bg-background-dark ${
                isBorderless ? '' : 'border-b border-secondary/10'
            }`}
        >
            <div className="flex max-w-sm flex-1 items-center gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light/40" />
                    <input
                        type="text"
                        placeholder={t('topbar.search')}
                        className="w-full rounded-full border border-secondary/10 bg-secondary/5 py-1.5 pl-10 pr-4 text-sm font-body transition-all focus:border-cta/40 focus:outline-none focus:ring-2 focus:ring-cta/20"
                    />
                </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-6">
                <div className="hidden items-center gap-4 rounded-full border border-cta/10 bg-cta/5 px-4 py-1.5 lg:flex">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-cta" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-cta">{t('topbar.testMode')}</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full border border-secondary/10 bg-secondary/5 px-2 py-1">
                        <Languages size={16} className="text-text-light/40" />
                        <button
                            onClick={() => setLocale('zh')}
                            className={`rounded-full px-2 py-1 text-[11px] font-bold transition-colors ${
                                locale === 'zh' ? 'bg-white text-cta shadow-sm' : 'text-text-light/50'
                            }`}
                        >
                            {t('topbar.lang.zh')}
                        </button>
                        <button
                            onClick={() => setLocale('en')}
                            className={`rounded-full px-2 py-1 text-[11px] font-bold transition-colors ${
                                locale === 'en' ? 'bg-white text-cta shadow-sm' : 'text-text-light/50'
                            }`}
                        >
                            {t('topbar.lang.en')}
                        </button>
                    </div>

                    <button className="relative cursor-pointer p-2 text-text-light/60 transition-colors hover:text-cta">
                        <Bell size={20} />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background-light bg-cta dark:border-background-dark" />
                    </button>
                    <button className="cursor-pointer p-2 text-text-light/60 transition-colors hover:text-cta">
                        <LayoutGrid size={20} />
                    </button>

                    <div className="mx-2 h-6 w-[1px] bg-secondary/10" />

                    {currentUser ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-secondary/10 bg-secondary/5 px-3 py-1.5">
                            <div className="hidden text-right sm:block">
                                <p className="text-xs font-bold leading-none">{currentUser.email}</p>
                                <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-text-light/40">
                                    <span className="uppercase tracking-tighter">{currentUser.role}</span>
                                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600">
                                        <Coins size={10} />
                                        {t('topbar.points')}: {currentUser.points_balance}
                                    </span>
                                </div>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-cta/20 bg-cta/20">
                                <User size={18} className="text-cta" />
                            </div>
                            <button
                                onClick={onLogout}
                                className="rounded-full p-2 text-text-light/50 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                title={t('topbar.logout')}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onOpenAuth}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-secondary/10 bg-white/70 p-1 px-2 transition-colors hover:bg-secondary/5"
                        >
                            <div className="hidden text-right sm:block">
                                <p className="text-xs font-bold leading-none">{t('topbar.guest')}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-tighter text-text-light/40">{t('topbar.login')}</p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-cta/20 bg-cta/20">
                                <User size={18} className="text-cta" />
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
