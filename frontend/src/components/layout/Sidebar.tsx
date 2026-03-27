import React from 'react';
import {
    CircleHelp,
    CreditCard,
    FileText,
    History,
    MessageSquareQuote,
    Printer,
    Settings,
    SlidersHorizontal,
    Wrench,
} from 'lucide-react';

import type { AppPage } from '../../App';
import { chatStorage } from '../../api/chatStorage';
import type { ChatSessionMetadata } from '../../api/chatStorage';
import { useI18n } from '../../i18n/I18nProvider';

interface SidebarProps {
    currentPage: AppPage;
    onNavigate: (page: AppPage) => void;
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
}

interface SidebarNavItem {
    icon: React.ElementType;
    labelKey: string;
    page?: AppPage;
    isActive: boolean;
    isDisabled?: boolean;
    onClick?: () => void;
}

type SidebarTab = 'tools' | 'history';

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentSessionId, onSessionChange }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = React.useState<SidebarTab>('tools');
    const [history, setHistory] = React.useState<ChatSessionMetadata[]>([]);
    const settingsClickStateRef = React.useRef<{ count: number; lastClickAt: number }>({ count: 0, lastClickAt: 0 });

    const showSwitcher = currentPage === 'chat';

    React.useEffect(() => {
        let cancelled = false;

        if (showSwitcher && activeTab === 'history') {
            void chatStorage.listSessions().then((sessions) => {
                if (!cancelled) {
                    setHistory(sessions);
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [currentPage, currentSessionId, activeTab, showSwitcher]);

    const handleNewChat = () => {
        onSessionChange(null);
        onNavigate('chat');
    };

    const handleSessionClick = (id: string) => {
        onSessionChange(id);
        onNavigate('chat');
    };

    const handleSettingsSecretClick = () => {
        const now = Date.now();
        const withinRapidWindow = now - settingsClickStateRef.current.lastClickAt < 800;

        settingsClickStateRef.current = {
            count: withinRapidWindow ? settingsClickStateRef.current.count + 1 : 1,
            lastClickAt: now,
        };

        if (settingsClickStateRef.current.count >= 10) {
            settingsClickStateRef.current = { count: 0, lastClickAt: 0 };
            onNavigate('developer');
        }
    };

    const navItems: SidebarNavItem[] = [
        {
            icon: MessageSquareQuote,
            labelKey: 'sidebar.chat',
            page: 'chat',
            isActive: currentPage === 'chat',
            onClick: () => {
                onNavigate('chat');
            },
        },
        {
            icon: SlidersHorizontal,
            labelKey: 'sidebar.presets',
            isActive: false,
            isDisabled: true,
        },
        {
            icon: Printer,
            labelKey: 'sidebar.printerControl',
            page: 'printer',
            isActive: currentPage === 'printer',
            onClick: () => {
                onNavigate('printer');
            },
        },
        {
            icon: FileText,
            labelKey: 'sidebar.reports',
            page: 'developer',
            isActive: currentPage === 'developer',
            onClick: () => {
                onNavigate('developer');
            },
        },
        {
            icon: CreditCard,
            labelKey: 'sidebar.subscription',
            isActive: false,
            isDisabled: true,
        },
    ];

    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 shrink-0 border-r border-slate-200 bg-[#f0f4f8] lg:flex lg:flex-col">
            <div className="flex items-center gap-3 px-6 py-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--color-primary)] text-white">
                    <Wrench size={16} />
                </div>
                <div className="min-w-0">
                    <h1 className="truncate font-heading text-lg font-bold tracking-tight text-green-950">FDM-Web</h1>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        {t('sidebar.brandSubtitle')}
                    </p>
                </div>
            </div>

            {/* Tab Switcher - Only visible on chat page */}
            {showSwitcher && (
                <div className="px-4 mb-4">
                    <div className="flex bg-slate-200/50 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-md ${
                                activeTab === 'tools'
                                    ? 'bg-white text-green-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Wrench size={14} />
                            {t('sidebar.tools')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-md ${
                                activeTab === 'history'
                                    ? 'bg-white text-green-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <History size={14} />
                            {t('sidebar.history')}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {(!showSwitcher || activeTab === 'tools') ? (
                    <nav className="space-y-1 px-0 pb-4">
                        {navItems.map((item) => {
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.labelKey}
                                    type="button"
                                    disabled={item.isDisabled}
                                    onClick={item.onClick}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left font-heading text-sm font-semibold tracking-tight transition-colors ${
                                        item.isActive
                                            ? 'border-l-[3px] border-green-700 bg-white/45 text-green-900'
                                            : item.isDisabled
                                              ? 'cursor-not-allowed text-slate-400'
                                              : 'cursor-pointer text-slate-500 hover:bg-slate-200/80 hover:text-slate-700'
                                    }`}
                                >
                                    <Icon size={18} />
                                    <span className="truncate">{t(item.labelKey)}</span>
                                </button>
                            );
                        })}
                    </nav>
                ) : (
                    <section className="px-4 pb-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h2 className="font-heading text-xs font-bold tracking-tight text-slate-900">{t('sidebar.historyLabel')}</h2>
                            <button
                                type="button"
                                onClick={handleNewChat}
                                className="rounded bg-[var(--color-primary)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[var(--color-primary-container)]"
                            >
                                {t('sidebar.newShort')}
                            </button>
                        </div>

                        <div className="space-y-1 text-xs">
                            {history.length > 0 ? (
                                history.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSessionClick(item.id)}
                                        className={`w-full px-3 py-2.5 text-left transition-colors rounded-md ${
                                            currentSessionId === item.id
                                                ? 'bg-white text-green-900 shadow-sm font-semibold'
                                                : 'text-slate-600 hover:bg-white/55 hover:text-slate-800'
                                        }`}
                                    >
                                        <span className="block truncate">{item.title}</span>
                                        <span className="mt-0.5 block text-[10px] opacity-50">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    {t('sidebar.noSessions')}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>

            <div className="mt-auto px-4 py-4 border-t border-slate-200/60 bg-slate-50/30">
                <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                >
                    <CircleHelp size={18} />
                    <span className="truncate">{t('sidebar.help')}</span>
                </button>
                <button
                    type="button"
                    onClick={handleSettingsSecretClick}
                    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                >
                    <Settings size={18} />
                    <span className="truncate">{t('sidebar.settings')}</span>
                </button>
            </div>
        </aside>
    );
};
