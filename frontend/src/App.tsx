import { useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { AIChatPage } from './pages/AIChatPage'
import { CaseLibraryPage } from './pages/CaseLibraryPage'
import { I18nProvider } from './i18n/I18nProvider'

export type AppPage = 'chat' | 'cases';

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const handleNavigate = (page: AppPage) => {
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'cases':
        return <CaseLibraryPage />;
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
        >
          {renderPage()}
        </MainLayout>
      </>
    </I18nProvider>
  )
}

export default App
