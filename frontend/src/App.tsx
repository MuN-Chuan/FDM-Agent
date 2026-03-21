import { useEffect, useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { AuthModal } from './components/auth/AuthModal'
import { AIChatPage } from './pages/AIChatPage'
import { DeveloperDashboard } from './pages/DeveloperDashboard'
import { api, type UserProfile } from './api/api'
import { I18nProvider } from './i18n/I18nProvider'

export type AppPage = 'chat' | 'developer';

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void api.getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Failed to logout', error);
    } finally {
      setCurrentUser(null);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'developer':
        return <DeveloperDashboard />;
      case 'chat':
      default:
        return <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />;
    }
  };

  return (
    <I18nProvider>
      <>
        <MainLayout
          currentPage={currentPage}
          onNavigate={handleNavigate}
          currentSessionId={currentSessionId}
          onSessionChange={setCurrentSessionId}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={() => { void handleLogout(); }}
        >
          {renderPage()}
        </MainLayout>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthModalOpen(false);
          }}
        />
      </>
    </I18nProvider>
  )
}

export default App
