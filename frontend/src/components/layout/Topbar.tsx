import React from 'react';
import { Bell, Languages, LayoutGrid, LogOut, Search, User } from 'lucide-react';

import type { AppPage } from '../../App';
import type { UserProfile } from '../../api/api';
import { useI18n } from '../../i18n/I18nProvider';

interface TopbarProps {
    currentPage: AppPage;
    isBorderless?: boolean;
    currentUser: UserProfile | null;
    onOpenAuth: () => void;
    onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ currentPage, currentUser, onOpenAuth, onLogout }) => {
    const { locale, setLocale, t } = useI18n();

    return (
        <header className="sticky top-0 z-30 h-16 bg-[rgba(255,255,255,0.94)]">
            <div className="flex h-full items-center justify-between px-5 md:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-8">
                    <div className="relative hidden w-72 md:block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search parameters or logs..."
                            className="w-full bg-[var(--color-surface-muted)] py-2 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        />
                    </div>

                    <nav className="flex h-full items-center gap-6">
                        <button
                            type="button"
                            className={`h-full border-b-2 text-sm transition-colors ${
                                currentPage === 'chat'
                                    ? 'border-green-700 font-semibold text-green-800'
                                    : 'font-medium text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Tools
                        </button>
                        <button
                            type="button"
                            className={`h-full border-b-2 text-sm transition-colors ${
                                currentPage === 'developer'
                                    ? 'border-green-700 font-semibold text-green-800'
                                    : 'font-medium text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            History
                        </button>
                    </nav>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden items-center gap-1 sm:flex">
                        <button
                            type="button"
                            onClick={() => setLocale('zh')}
                            className={`p-2 text-slate-500 transition-colors hover:text-green-800 ${
                                locale === 'zh' ? 'bg-[var(--color-surface-muted)] text-green-800' : ''
                            }`}
                            title={t('topbar.lang.zh')}
                        >
                            <Languages size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2 py-1 text-xs font-semibold transition-colors ${
                                locale === 'en'
                                    ? 'bg-[var(--color-surface-muted)] text-green-800'
                                    : 'text-slate-500 hover:text-green-800'
                            }`}
                        >
                            EN
                        </button>
                    </div>

                    <button type="button" className="p-2 text-slate-500 transition-colors hover:text-green-800" title="Notifications">
                        <Bell size={18} />
                    </button>
                    <button type="button" className="p-2 text-slate-500 transition-colors hover:text-green-800" title="Workspace">
                        <LayoutGrid size={18} />
                    </button>

                    <div className="hidden h-8 w-px bg-slate-200 sm:block" />

                    {currentUser ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden text-right md:block">
                                <p className="text-xs font-semibold text-slate-900">{currentUser.email}</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                    {currentUser.role} · {t('topbar.points')}: {currentUser.points_balance}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center bg-[var(--color-primary)] text-white">
                                <User size={16} />
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                title={t('topbar.logout')}
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onOpenAuth}
                            className="bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)]"
                        >
                            {t('topbar.login')}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
