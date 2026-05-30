declare global {
    interface Window {
        fdmDesktop?: {
            isDesktopApp: boolean;
            openExternal?: (url: string) => Promise<void> | void;
        };
    }
}

export function isDesktopApp(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return Boolean(window.fdmDesktop?.isDesktopApp);
}
