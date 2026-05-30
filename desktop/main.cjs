const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const clientAgentDir = path.join(rootDir, 'client-agent');
const rendererUrl = process.env.FDM_DESKTOP_RENDERER_URL;
const useDevServer = Boolean(rendererUrl);
const desktopBackendUrl = 'http://127.0.0.1:8001';

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

function waitForBackend(url, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
        const attempt = () => {
            const request = http.get(`${url}/health`, (response) => {
                response.resume();
                if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
                    resolve();
                    return;
                }

                if (Date.now() >= deadline) {
                    reject(new Error(`Backend health check returned ${response.statusCode}`));
                    return;
                }

                setTimeout(attempt, 250);
            });

            request.on('error', () => {
                if (Date.now() >= deadline) {
                    reject(new Error('Backend did not become ready in time'));
                    return;
                }

                setTimeout(attempt, 250);
            });
        };

        attempt();
    });
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

    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[desktop] Renderer process gone:', details);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    if (useDevServer) {
        void mainWindow.loadURL(rendererUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        return;
    }

    void waitForBackend(desktopBackendUrl)
        .then(() => mainWindow?.loadURL(desktopBackendUrl))
        .catch((error) => {
            console.error('[desktop] Backend readiness check failed:', error);
        });
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
