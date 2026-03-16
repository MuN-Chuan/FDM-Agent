import { useEffect, useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { AuthModal } from './components/auth/AuthModal'
import { DiagnosisDashboard } from './pages/DiagnosisDashboard'
import { AIChatPage } from './pages/AIChatPage'
import { api, type UserProfile } from './api/api'

export type AppPage = 'diagnosis' | 'chat';

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
      case 'diagnosis':
        return <DiagnosisDashboard />;
      case 'chat':
        return <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />;
      default:
        return <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />;
    }
  };

  return (
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
  )
}

export default App
