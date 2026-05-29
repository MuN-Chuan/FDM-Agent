declare global {
    interface Window {
        fdmDesktop?: {
            isDesktopApp: boolean;
            openExternal?: (url: string) => Promise<void> | void;
        };
    }
}

export function isDesktopApp(): boolean {
    return Boolean(window.fdmDesktop?.isDesktopApp);
}
