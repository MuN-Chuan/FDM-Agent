import React from 'react';
import { Bell, LayoutGrid, LogOut, Search, User } from 'lucide-react';
import type { UserProfile } from '../../api/api';

interface TopbarProps {
    isBorderless?: boolean;
    currentUser: UserProfile | null;
    onOpenAuth: () => void;
    onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ isBorderless, currentUser, onOpenAuth, onLogout }) => {
    return (
        <header className={`h-16 flex items-center justify-between px-8 bg-background-light dark:bg-background-dark sticky top-0 z-40 ${
            isBorderless ? '' : 'border-b border-secondary/10'
        }`}>
            <div className="flex items-center gap-4 flex-1 max-w-sm">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light/40 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search help or features..."
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                    />
                </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-6">
                <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-cta/5 border border-cta/10 rounded-full">
                    <div className="w-2 h-2 bg-cta rounded-full animate-pulse" />
                    <span className="text-[11px] font-bold text-cta uppercase tracking-widest">Test Mode</span>
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

                    {currentUser ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-secondary/10 bg-secondary/5 px-3 py-1.5">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold leading-none">{currentUser.email}</p>
                                <p className="text-[10px] text-text-light/40 mt-1 uppercase tracking-tighter">
                                    {currentUser.role}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-cta/20 flex items-center justify-center border-2 border-cta/20">
                                <User size={18} className="text-cta" />
                            </div>
                            <button
                                onClick={onLogout}
                                className="p-2 text-text-light/50 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                title="Logout"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onOpenAuth}
                            className="flex items-center gap-3 hover:bg-secondary/5 p-1 px-2 rounded-lg transition-colors cursor-pointer border border-secondary/10 bg-white/70"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold leading-none">Guest</p>
                                <p className="text-[10px] text-text-light/40 mt-1 uppercase tracking-tighter">Login</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-cta/20 flex items-center justify-center border-2 border-cta/20">
                                <User size={18} className="text-cta" />
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};
