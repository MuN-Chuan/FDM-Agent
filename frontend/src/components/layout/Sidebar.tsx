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
    MessageCircle
} from 'lucide-react';
import type { AppPage } from '../../App';

interface SidebarProps {
    currentPage: AppPage;
    onNavigate: (page: AppPage) => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
    return (
        <aside className="h-screen w-[240px] shrink-0 bg-primary border-r border-secondary/20 flex flex-col z-50">
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cta rounded flex items-center justify-center">
                        <Zap className="text-white w-5 h-5" />
                    </div>
                    <span className="text-xl font-heading font-bold text-text-dark tracking-tight">FDM-Web</span>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
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
            </nav>

            <div className="p-4 border-t border-secondary/20 space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-text-dark/60 hover:text-text-dark rounded-lg transition-colors cursor-pointer">
                    <HelpCircle size={20} />
                    <span className="text-sm font-medium">帮助中心</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-text-dark/60 hover:text-text-dark rounded-lg transition-colors cursor-pointer">
                    <Settings size={20} />
                    <span className="text-sm font-medium">设置</span>
                </button>
            </div>
        </aside>
    );
};
