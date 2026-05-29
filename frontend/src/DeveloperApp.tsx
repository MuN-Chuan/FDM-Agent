import { I18nProvider } from './i18n/I18nProvider';
import { DeveloperDashboard } from './pages/DeveloperDashboard';

function DeveloperApp() {
    return (
        <I18nProvider>
            <div className="min-h-screen bg-[#f8f9fa] text-[var(--color-text-light)]">
                <DeveloperDashboard />
            </div>
        </I18nProvider>
    );
}

export default DeveloperApp;
