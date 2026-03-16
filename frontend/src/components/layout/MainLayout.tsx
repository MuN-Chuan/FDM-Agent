import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { AppPage } from '../../App';
import type { UserProfile } from '../../api/api';

interface MainLayoutProps {
    children: React.ReactNode;
    currentPage: AppPage;
    onNavigate: (page: AppPage) => void;
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
    currentUser: UserProfile | null;
    onOpenAuth: () => void;
    onLogout: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    currentPage,
    onNavigate,
    currentSessionId,
    onSessionChange,
    currentUser,
    onOpenAuth,
    onLogout,
}) => {
    return (
        <div className="h-screen flex bg-background-light dark:bg-background-dark overflow-hidden">
            <Sidebar
                currentPage={currentPage}
                onNavigate={onNavigate}
                currentSessionId={currentSessionId}
                onSessionChange={onSessionChange}
            />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Topbar
                    isBorderless={currentPage === 'chat'}
                    currentUser={currentUser}
                    onOpenAuth={onOpenAuth}
                    onLogout={onLogout}
                />
                <main className="flex-1 p-8 overflow-y-auto relative">
                    <div className="max-w-[1440px] mx-auto h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
