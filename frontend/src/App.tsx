import { useState } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { DiagnosisDashboard } from './pages/DiagnosisDashboard'
import { AIChatPage } from './pages/AIChatPage'

export type AppPage = 'diagnosis' | 'chat';

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('diagnosis');

  const renderPage = () => {
    switch (currentPage) {
      case 'diagnosis': return <DiagnosisDashboard />;
      case 'chat': return <AIChatPage />;
      default: return <DiagnosisDashboard />;
    }
  };

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  )
}

export default App
