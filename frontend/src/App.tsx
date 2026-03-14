import { useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { DiagnosisDashboard } from './pages/DiagnosisDashboard'
import { AIChatPage } from './pages/AIChatPage'

export type AppPage = 'diagnosis' | 'chat';

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
    // If navigating to chat from elsewhere, we don't necessarily reset session
    // unless the user explicitly clicks "New Chat" in Sidebar (handled there).
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'diagnosis': return <DiagnosisDashboard />;
      case 'chat': return <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />;
      default: return <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />;
    }
  };

  return (
    <MainLayout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      currentSessionId={currentSessionId}
      onSessionChange={setCurrentSessionId}
    >
      {renderPage()}
    </MainLayout>
  )
}

export default App
