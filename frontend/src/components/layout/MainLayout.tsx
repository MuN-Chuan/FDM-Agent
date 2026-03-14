import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { AppPage } from '../../App';

interface MainLayoutProps {
    children: React.ReactNode;
    currentPage: AppPage;
    onNavigate: (page: AppPage) => void;
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentPage, onNavigate, currentSessionId, onSessionChange }) => {
    return (
        <div className="h-screen flex bg-background-light dark:bg-background-dark overflow-hidden">
            <Sidebar 
                currentPage={currentPage} 
                onNavigate={onNavigate} 
                currentSessionId={currentSessionId}
                onSessionChange={onSessionChange}
            />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Topbar isBorderless={currentPage === 'chat'} />
                <main className="flex-1 p-8 overflow-y-auto relative">
                    <div className="max-w-[1440px] mx-auto h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
