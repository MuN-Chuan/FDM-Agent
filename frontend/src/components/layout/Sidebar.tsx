import React from 'react';
import {
    CircleHelp,
    CreditCard,
    FileText,
    History,
    MessageSquareQuote,
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
    label: string;
    page?: AppPage;
    isActive: boolean;
    isDisabled?: boolean;
    onClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentSessionId, onSessionChange }) => {
    const { t } = useI18n();
    const [historyExpanded, setHistoryExpanded] = React.useState(currentPage === 'chat');
    const [history, setHistory] = React.useState<ChatSessionMetadata[]>([]);
    const settingsClickStateRef = React.useRef<{ count: number; lastClickAt: number }>({ count: 0, lastClickAt: 0 });

    React.useEffect(() => {
        let cancelled = false;

        if (historyExpanded || currentPage === 'chat') {
            void chatStorage.listSessions().then((sessions) => {
                if (!cancelled) {
                    setHistory(sessions);
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [currentPage, currentSessionId, historyExpanded]);

    const handleNewChat = () => {
        onSessionChange(null);
        onNavigate('chat');
        setHistoryExpanded(true);
    };

    const handleSessionClick = (id: string) => {
        onSessionChange(id);
        onNavigate('chat');
        setHistoryExpanded(true);
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
            label: 'AI Q&A',
            page: 'chat',
            isActive: currentPage === 'chat' && !historyExpanded,
            onClick: () => {
                onNavigate('chat');
                setHistoryExpanded(false);
            },
        },
        {
            icon: History,
            label: 'History',
            isActive: historyExpanded && currentPage === 'chat',
            onClick: () => {
                onNavigate('chat');
                setHistoryExpanded((value) => !value || currentPage !== 'chat');
            },
        },
        {
            icon: SlidersHorizontal,
            label: 'Preset Management',
            isActive: false,
            isDisabled: true,
        },
        {
            icon: FileText,
            label: 'Report Center',
            page: 'developer',
            isActive: currentPage === 'developer',
            onClick: () => {
                onNavigate('developer');
                setHistoryExpanded(false);
            },
        },
        {
            icon: CreditCard,
            label: 'Subscription Center',
            isActive: false,
            isDisabled: true,
        },
    ];

    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 shrink-0 border-r border-[var(--shell-border)] bg-[var(--shell-sidebar)] backdrop-blur-xl lg:flex lg:flex-col">
            <div className="flex items-center gap-3 px-6 py-6">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-primary)] text-white">
                    <Wrench size={16} />
                </div>
                <div>
                    <h1 className="font-heading text-xl font-bold tracking-tight text-green-950">FDM-Web</h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        Engineering Workbench
                    </p>
                </div>
            </div>

            <nav className="flex-1 space-y-1 px-0 pb-4">
                {navItems.map((item) => {
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.label}
                            type="button"
                            disabled={item.isDisabled}
                            onClick={item.onClick}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left font-heading text-sm font-semibold tracking-tight transition-colors ${
                                item.isActive
                                    ? 'border-l-4 border-green-700 bg-white/65 text-green-900'
                                    : item.isDisabled
                                      ? 'cursor-not-allowed text-slate-400'
                                      : 'cursor-pointer text-slate-500 hover:bg-slate-200/80 hover:text-slate-700'
                            }`}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {(historyExpanded || currentPage === 'chat') && (
                <section className="mx-4 mb-4 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-panel-bg)] p-4 shadow-[var(--shadow-md)]">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-heading text-sm font-bold tracking-tight text-slate-900">Recent Sessions</h2>
                        <button
                            type="button"
                            onClick={handleNewChat}
                            className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[var(--color-primary-container)]"
                        >
                            {t('sidebar.newChat')}
                        </button>
                    </div>

                    <div className="custom-scrollbar mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {history.length > 0 ? (
                            history.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSessionClick(item.id)}
                                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                                        currentSessionId === item.id
                                            ? 'border-green-700/30 bg-green-50 text-slate-900'
                                            : 'border-transparent bg-[var(--color-surface-muted)] text-slate-600 hover:border-[var(--shell-border)] hover:bg-white'
                                    }`}
                                >
                                    <span className="block truncate text-xs font-semibold">{item.title}</span>
                                    <span className="mt-1 block text-[10px] text-slate-500">
                                        {new Date(item.timestamp).toLocaleString()}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="rounded-md border border-dashed border-[var(--shell-border)] bg-[var(--color-surface-muted)] px-3 py-8 text-center text-xs text-slate-500">
                                {t('sidebar.noSessions')}
                            </div>
                        )}
                    </div>
                </section>
            )}

            <div className="mt-auto border-t border-[var(--shell-border)] px-4 py-4">
                <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                >
                    <CircleHelp size={18} />
                    <span>{t('sidebar.help')}</span>
                </button>
                <button
                    type="button"
                    onClick={handleSettingsSecretClick}
                    className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
                >
                    <Settings size={18} />
                    <span>{t('sidebar.settings')}</span>
                </button>
            </div>
        </aside>
    );
};
