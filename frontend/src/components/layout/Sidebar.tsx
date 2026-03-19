import React from 'react';
import {
    BarChart3,
    Briefcase,
    ChevronRight,
    CreditCard,
    FileText,
    HelpCircle,
    History,
    LayoutDashboard,
    MessageCircle,
    Settings,
    Zap,
} from 'lucide-react';

import type { AppPage } from '../../App';
import { chatStorage } from '../../api/chatStorage';
import type { ChatSessionMetadata } from '../../api/chatStorage';

interface SidebarProps {
    currentPage: AppPage;
    onNavigate: (page: AppPage) => void;
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
}

const navItems: { icon: React.ElementType; label: string; id: AppPage | string; page?: AppPage }[] = [
    { icon: LayoutDashboard, label: '首页 / 工作台', id: 'dashboard' },
    { icon: Zap, label: 'AI 诊断', id: 'diagnosis', page: 'diagnosis' },
    { icon: MessageCircle, label: 'AI 问答', id: 'chat', page: 'chat' },
    { icon: History, label: '历史记录', id: 'history' },
    { icon: FileText, label: '预设管理', id: 'presets' },
    { icon: BarChart3, label: '报告中心', id: 'reports' },
    { icon: CreditCard, label: '订阅中心', id: 'subscription' },
];

const subItems = [
    { label: '流量计算', id: 'flow' },
    { label: '模型减面', id: 'simplify' },
    { label: '擦料线生成', id: 'purge' },
    { label: 'G-code 清理', id: 'clean' },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, currentSessionId, onSessionChange }) => {
    const [activeTab, setActiveTab] = React.useState<'tools' | 'history'>('tools');
    const [history, setHistory] = React.useState<ChatSessionMetadata[]>([]);

    React.useEffect(() => {
        let cancelled = false;

        if (activeTab === 'history') {
            void chatStorage.listSessions().then((sessions) => {
                if (!cancelled) {
                    setHistory(sessions);
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [activeTab, currentSessionId]);

    const handleNewChat = () => {
        onSessionChange(null);
        onNavigate('chat');
    };

    const handleSessionClick = (id: string) => {
        onSessionChange(id);
        onNavigate('chat');
    };

    return (
        <aside className="z-50 flex h-screen w-[240px] shrink-0 flex-col border-r border-secondary/20 bg-primary">
            <div className="p-6">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-cta">
                        <Zap className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-heading font-bold tracking-tight text-text-dark">FDM-Web</span>
                </div>

                <div className="flex rounded-lg bg-secondary/10 p-1">
                    <button
                        onClick={() => setActiveTab('tools')}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-bold transition-all ${
                            activeTab === 'tools'
                                ? 'bg-white text-cta shadow-sm dark:bg-cta/20'
                                : 'text-text-dark/40 hover:text-text-dark/60'
                        }`}
                    >
                        <Briefcase size={14} />
                        工具
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-bold transition-all ${
                            activeTab === 'history'
                                ? 'bg-white text-cta shadow-sm dark:bg-cta/20'
                                : 'text-text-dark/40 hover:text-text-dark/60'
                        }`}
                    >
                        <History size={14} />
                        历史
                    </button>
                </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4">
                {activeTab === 'tools' ? (
                    <>
                        {navItems.map((item) => {
                            const isActive = item.page === currentPage;
                            const isClickable = !!item.page;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => item.page && onNavigate(item.page)}
                                    disabled={!isClickable}
                                    className={`w-full cursor-pointer rounded-lg px-3 py-2 transition-colors ${
                                        isActive
                                            ? 'bg-cta/10 text-cta'
                                            : isClickable
                                              ? 'text-text-dark/60 hover:bg-secondary/20 hover:text-text-dark'
                                              : 'cursor-not-allowed text-text-dark/40 opacity-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={20} />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </div>
                                </button>
                            );
                        })}

                        <div className="px-3 pb-2 pt-6">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dark/40">未来工具</span>
                        </div>

                        {subItems.map((item) => (
                            <button
                                key={item.id}
                                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-text-dark/40 grayscale transition-colors hover:bg-secondary/20 hover:text-text-dark/80"
                            >
                                <span className="text-sm">{item.label}</span>
                                <ChevronRight size={14} />
                            </button>
                        ))}
                    </>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={handleNewChat}
                            className="flex w-full items-center gap-3 rounded-lg border border-cta/20 px-3 py-2 text-xs font-bold text-cta transition-all hover:bg-cta/5"
                        >
                            <Zap size={14} />
                            新建对话
                        </button>

                        <div className="px-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dark/40">最近会话</span>
                        </div>

                        <div className="space-y-1">
                            {history.length > 0 ? (
                                history.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSessionClick(item.id)}
                                        className={`flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-all ${
                                            currentSessionId === item.id
                                                ? 'bg-cta/10 text-cta'
                                                : 'text-text-dark/60 hover:bg-secondary/10 hover:text-text-dark'
                                        }`}
                                    >
                                        <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
                                        <span className="mt-1 text-[10px] opacity-40">{new Date(item.timestamp).toLocaleString()}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-secondary/10 px-3 py-8 text-center">
                                    <p className="text-[11px] text-text-dark/30">暂无历史会话</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <div className="space-y-1 border-t border-secondary/20 p-4">
                <button className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-text-dark/60 transition-colors hover:text-text-dark">
                    <HelpCircle size={20} />
                    <span className="text-sm font-medium">帮助中心</span>
                </button>
                <button className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-text-dark/60 transition-colors hover:text-text-dark">
                    <Settings size={20} />
                    <span className="text-sm font-medium">设置中心</span>
                </button>
            </div>
        </aside>
    );
};
