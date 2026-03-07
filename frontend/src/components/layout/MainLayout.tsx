import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <Sidebar />
            <div className="pl-[240px] flex flex-col min-h-screen">
                <Topbar />
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-[1440px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
