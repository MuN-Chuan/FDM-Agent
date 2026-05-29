const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const rootDir = path.resolve(__dirname, '..');
const frontendDist = path.join(rootDir, 'frontend', 'dist', 'index.html');
const backendDir = path.join(rootDir, 'backend');
const clientAgentDir = path.join(rootDir, 'client-agent');
const rendererUrl = process.env.FDM_DESKTOP_RENDERER_URL || 'http://127.0.0.1:5173';

/** @type {import('child_process').ChildProcess[]} */
const childProcesses = [];
/** @type {Electron.BrowserWindow | null} */
let mainWindow = null;

function spawnManagedProcess(command, args, options) {
    const child = spawn(command, args, {
        ...options,
        shell: process.platform === 'win32',
        stdio: 'inherit',
    });

    child.on('exit', () => {
        const index = childProcesses.indexOf(child);
        if (index >= 0) {
            childProcesses.splice(index, 1);
        }
    });

    childProcesses.push(child);
    return child;
}

function startBackend() {
    return spawnManagedProcess(
        'python',
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001'],
        {
            cwd: backendDir,
            env: {
                ...process.env,
                PYTHONPATH: '.',
            },
        },
    );
}

function startClientAgent() {
    return spawnManagedProcess('node', ['src/index.js'], {
        cwd: clientAgentDir,
        env: process.env,
    });
}

function stopChildProcesses() {
    while (childProcesses.length > 0) {
        const child = childProcesses.pop();
        if (!child || child.killed) {
            continue;
        }
        child.kill();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1480,
        height: 960,
        minWidth: 1200,
        minHeight: 760,
        backgroundColor: '#f8f9fa',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
            `[desktop] Renderer failed to load: ${validatedURL} (${errorCode}) ${errorDescription}`,
        );
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (isDev) {
        void mainWindow.loadURL(rendererUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    void mainWindow.loadFile(frontendDist);
}

app.whenReady().then(() => {
    startBackend();
    startClientAgent();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopChildProcesses();
});
