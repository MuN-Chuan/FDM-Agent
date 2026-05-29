const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('fdmDesktop', {
    isDesktopApp: true,
    openExternal(url) {
        return shell.openExternal(url);
    },
});
