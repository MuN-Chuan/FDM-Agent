import React from 'react';
import {
    BarChart3,
    History,
    Settings,
    LayoutDashboard,
    Zap,
    FileText,
    CreditCard,
    ChevronRight,
    HelpCircle,
    MessageCircle,
    Briefcase
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
    { icon: MessageCircle, label: 'AI 答疑', id: 'chat', page: 'chat' },
    { icon: History, label: '历史记录', id: 'history' },
    { icon: FileText, label: '预设管理', id: 'presets' },
    { icon: BarChart3, label: '报告中心', id: 'reports' },
    { icon: CreditCard, label: '订阅中心', id: 'subscription' },
];

const subItems = [
    { label: '流量计算', id: 'flow' },
    { label: '模型减面', id: 'simplify' },
    { label: '擦料线生成', id: 'purge' },
    { label: 'Gcode 清理', id: 'clean' },
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
        <aside className="h-screen w-[240px] shrink-0 bg-primary border-r border-secondary/20 flex flex-col z-50">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-cta rounded flex items-center justify-center">
                        <Zap className="text-white w-5 h-5" />
                    </div>
                    <span className="text-xl font-heading font-bold text-text-dark tracking-tight">FDM-Web</span>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-secondary/10 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('tools')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${
                            activeTab === 'tools' ? 'bg-white dark:bg-cta/20 text-cta shadow-sm' : 'text-text-dark/40 hover:text-text-dark/60'
                        }`}
                    >
                        <Briefcase size={14} />
                        工具
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${
                            activeTab === 'history' ? 'bg-white dark:bg-cta/20 text-cta shadow-sm' : 'text-text-dark/40 hover:text-text-dark/60'
                        }`}
                    >
                        <History size={14} />
                        历史
                    </button>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
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
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                                        isActive 
                                            ? 'bg-cta/10 text-cta' 
                                            : isClickable 
                                                ? 'text-text-dark/60 hover:text-text-dark hover:bg-secondary/20'
                                                : 'text-text-dark/40 cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <item.icon size={20} />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </button>
                            );
                        })}

                        <div className="pt-6 pb-2 px-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dark/40">未来工具</span>
                        </div>

                        {subItems.map((item) => (
                            <button
                                key={item.id}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-text-dark/40 hover:text-text-dark/80 hover:bg-secondary/20 transition-colors cursor-pointer grayscale"
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
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-cta hover:bg-cta/5 border border-cta/20 transition-all font-bold text-xs"
                        >
                            <Zap size={14} />
                            新开对话
                        </button>

                        <div className="px-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-dark/40">最近会话</span>
                        </div>
                        <div className="space-y-1">
                            {history.length > 0 ? history.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSessionClick(item.id)}
                                    className={`w-full flex flex-col items-start px-3 py-2.5 rounded-lg transition-all text-left ${
                                        currentSessionId === item.id 
                                            ? 'bg-cta/10 text-cta' 
                                            : 'text-text-dark/60 hover:text-text-dark hover:bg-secondary/10'
                                    }`}
                                >
                                    <span className="text-sm font-medium line-clamp-1">{item.title}</span>
                                    <span className="text-[10px] opacity-40 mt-1">{new Date(item.timestamp).toLocaleString()}</span>
                                </button>
                            )) : (
                                <div className="px-3 py-8 text-center border border-dashed border-secondary/10 rounded-xl">
                                    <p className="text-[11px] text-text-dark/30">暂无历史会话</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <div className="p-4 border-t border-secondary/20 space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-text-dark/60 hover:text-text-dark rounded-lg transition-colors cursor-pointer">
                    <HelpCircle size={20} />
                    <span className="text-sm font-medium">帮助中心</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-text-dark/60 hover:text-text-dark rounded-lg transition-colors cursor-pointer">
                    <Settings size={20} />
                    <span className="text-sm font-medium">设置中心</span>
                </button>
            </div>
        </aside>
    );
};
