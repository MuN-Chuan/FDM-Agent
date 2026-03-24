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
    const isChatPage = currentPage === 'chat';

    return (
        <div className="app-shell flex min-h-screen bg-transparent text-[var(--color-text-light)]">
            <Sidebar
                currentPage={currentPage}
                onNavigate={onNavigate}
                currentSessionId={currentSessionId}
                onSessionChange={onSessionChange}
            />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-hidden lg:pl-64">
                <Topbar
                    currentPage={currentPage}
                    isBorderless={currentPage === 'chat'}
                    currentUser={currentUser}
                    onOpenAuth={onOpenAuth}
                    onLogout={onLogout}
                />
                <main
                    className={`relative flex-1 overflow-hidden ${
                        isChatPage
                            ? 'px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3 lg:px-8'
                            : 'px-4 pb-6 pt-4 md:px-6 md:pb-8 md:pt-5 lg:px-8 lg:pb-10'
                    }`}
                >
                    <div className={`${isChatPage ? 'h-full' : 'mx-auto h-full max-w-[1600px]'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
