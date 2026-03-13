import React from 'react';
import { Search, Bell, User, LayoutGrid, History as HistoryIcon, Briefcase } from 'lucide-react';
import type { AppPage } from '../../App';

interface TopbarProps {
    currentPage?: AppPage;
}

export const Topbar: React.FC<TopbarProps> = ({ currentPage }) => {
    return (
        <header className="h-16 flex items-center justify-between px-8 bg-background-light dark:bg-background-dark border-b border-secondary/10 sticky top-0 z-40">
            {/* Left: Search */}
            <div className="flex items-center gap-4 flex-1 max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light/40 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="搜索功能或帮助文档..."
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-lg py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                    />
                </div>
            </div>

            {/* Center: Tabs (Only for Chat page) */}
            {currentPage === 'chat' && (
                <div className="flex items-center gap-1 bg-secondary/5 p-1 rounded-xl border border-secondary/10">
                    <button 
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-white dark:bg-secondary/20 shadow-sm text-cta transition-all"
                    >
                        <Briefcase size={16} />
                        工具
                    </button>
                    <button 
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-text-light/40 hover:text-text-light dark:hover:text-text-dark hover:bg-white/50 dark:hover:bg-secondary/10 transition-all"
                    >
                        <HistoryIcon size={16} />
                        历史
                    </button>
                </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-6">
                <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-cta/5 border border-cta/10 rounded-full">
                    <div className="w-2 h-2 bg-cta rounded-full animate-pulse" />
                    <span className="text-[11px] font-bold text-cta uppercase tracking-widest">高级版会员</span>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 text-text-light/60 hover:text-cta transition-colors relative cursor-pointer">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-cta rounded-full border-2 border-background-light dark:border-background-dark" />
                    </button>
                    <button className="p-2 text-text-light/60 hover:text-cta transition-colors cursor-pointer">
                        <LayoutGrid size={20} />
                    </button>

                    <div className="h-6 w-[1px] bg-secondary/10 mx-2" />

                    <button className="flex items-center gap-3 hover:bg-secondary/5 p-1 px-2 rounded-lg transition-colors cursor-pointer">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold leading-none">测试用户</p>
                            <p className="text-[10px] text-text-light/40 mt-1 uppercase tracking-tighter">Pro User</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-cta/20 flex items-center justify-center border-2 border-cta/20">
                            <User size={18} className="text-cta" />
                        </div>
                    </button>
                </div>
            </div>
        </header>
    );
};
