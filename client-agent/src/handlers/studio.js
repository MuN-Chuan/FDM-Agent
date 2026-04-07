const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const VCVARS64_PATH = 'C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat';
const BRIDGE_SOURCE = path.resolve(__dirname, '../../native/bambu_studio_bridge.cpp');
const BRIDGE_BINARY = path.resolve(__dirname, '../../bin/bambu_studio_bridge.exe');
const DEFAULT_BAMBU_STUDIO_PATH = 'C:/Program Files/Bambu Studio/bambu-studio.exe';

function getStudioExecutable(config) {
    const executable = typeof config?.bambu_studio_path === 'string' ? config.bambu_studio_path.trim() : '';
    if (executable) {
        return executable;
    }
    return DEFAULT_BAMBU_STUDIO_PATH;
}

function getStudioProcessName(executablePath) {
    if (!executablePath) {
        return null;
    }
    const normalized = executablePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || null;
}

function isStudioInstalled(config) {
    const executable = getStudioExecutable(config);
    return Boolean(executable && fs.existsSync(executable));
}

function getStudioDataDir() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'BambuStudio');
}

function getStudioPluginDir() {
    return path.join(getStudioDataDir(), 'plugins');
}

function getStudioPluginDllPath() {
    return path.join(getStudioPluginDir(), 'bambu_networking.dll');
}

function getStudioCertDir(config) {
    const executable = getStudioExecutable(config);
    if (!executable) {
        return null;
    }
    return path.join(path.dirname(executable), 'resources', 'cert');
}

function getBridgeBinaryPath() {
    return BRIDGE_BINARY;
}

function execFileAsync(file, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(file, args, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

function parseBridgeOutput(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

async function ensureStudioBridgeBuilt() {
    if (!fs.existsSync(BRIDGE_SOURCE)) {
        throw new Error('Bambu Studio bridge source is missing');
    }

    const sourceStat = fs.statSync(BRIDGE_SOURCE);
    if (fs.existsSync(BRIDGE_BINARY)) {
        const binaryStat = fs.statSync(BRIDGE_BINARY);
        if (binaryStat.mtimeMs >= sourceStat.mtimeMs) {
            return BRIDGE_BINARY;
        }
    }

    if (!fs.existsSync(VCVARS64_PATH)) {
        throw new Error('Visual Studio Build Tools not found (vcvars64.bat missing)');
    }

    fs.mkdirSync(path.dirname(BRIDGE_BINARY), { recursive: true });
    // Use 'call' prefix to invoke the .bat file correctly under cmd.exe.
    // Without 'call', cmd.exe /s strips outer quotes and misparses the path.
    // Also convert forward slashes to backslashes for Windows compatibility.
    const vcvarsPathNative = VCVARS64_PATH.replace(/\//g, '\\');
    const bridgeBinaryNative = BRIDGE_BINARY.replace(/\//g, '\\');
    const bridgeSourceNative = BRIDGE_SOURCE.replace(/\//g, '\\');
    const compileCommand = [
        `call "${vcvarsPathNative}"`,
        '&&',
        'cl.exe',
        '/nologo',
        '/std:c++17',
        '/EHsc',
        '/O2',
        `/Fe:"${bridgeBinaryNative}"`,
        `"${bridgeSourceNative}"`,
    ].join(' ');

    try {
        await execFileAsync('cmd.exe', ['/d', '/c', compileCommand], {
            windowsHide: true,
            cwd: path.dirname(BRIDGE_SOURCE),
            timeout: 120000,
        });
    } catch (failure) {
        const stderr = failure.stderr ? String(failure.stderr).trim() : '';
        const stdout = failure.stdout ? String(failure.stdout).trim() : '';
        throw new Error(`Failed to build Bambu Studio bridge${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
    }

    if (!fs.existsSync(BRIDGE_BINARY)) {
        throw new Error('Bambu Studio bridge build finished without producing the executable');
    }

    return BRIDGE_BINARY;
}

function queryWindowsProcessRunning(processName) {
    return new Promise((resolve) => {
        if (!processName) {
            resolve(false);
            return;
        }

        execFile('tasklist', ['/FI', `IMAGENAME eq ${processName}`], { windowsHide: true }, (error, stdout) => {
            if (error) {
                resolve(false);
                return;
            }

            resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
        });
    });
}

async function getBambuStudioStatus(config) {
    const executable = getStudioExecutable(config);
    const installed = isStudioInstalled(config);
    const processName = getStudioProcessName(executable);
    const running = installed ? await queryWindowsProcessRunning(processName) : false;
    const pluginDll = getStudioPluginDllPath();
    const certDir = getStudioCertDir(config);

    return {
        installed,
        running,
        automation_ready: installed && fs.existsSync(pluginDll) && Boolean(certDir && fs.existsSync(certDir)),
        path: executable,
        process_name: processName,
        plugin_dll: pluginDll,
        cert_dir: certDir,
        bridge_binary: BRIDGE_BINARY,
    };
}

async function ensureBambuStudioRunning(config) {
    const status = await getBambuStudioStatus(config);
    if (!status.installed) {
        throw new Error('Bambu Studio is not installed or bambu_studio_path is invalid');
    }

    if (status.running) {
        return {
            ...status,
            launched: false,
        };
    }

    spawn(status.path, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
    }).unref();

    for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const nextStatus = await getBambuStudioStatus(config);
        if (nextStatus.running) {
            return {
                ...nextStatus,
                launched: true,
            };
        }
    }

    throw new Error('Bambu Studio launch timed out');
}

async function runStudioLocalCommand(machine, command, config) {
    if (!machine || typeof machine !== 'object') {
        throw new Error('A valid machine is required');
    }
    if (!machine.id || !machine.ip || !machine.token) {
        throw new Error('Studio local control requires printer id, ip, and access code');
    }

    const executable = getStudioExecutable(config);
    if (!executable || !fs.existsSync(executable)) {
        throw new Error('Bambu Studio executable not found');
    }

    const pluginDll = getStudioPluginDllPath();
    if (!fs.existsSync(pluginDll)) {
        throw new Error(`bambu_networking.dll not found at ${pluginDll}`);
    }

    const certDir = getStudioCertDir(config);
    if (!certDir || !fs.existsSync(certDir)) {
        throw new Error('Bambu Studio certificate folder is missing');
    }

    const bridgeBinary = await ensureStudioBridgeBuilt();
    const args = [
        '--command', 'local_send',
        '--plugin-dll', pluginDll,
        '--config-dir', getStudioDataDir(),
        '--cert-dir', certDir,
        '--printer-id', machine.id,
        '--printer-ip', machine.ip,
        '--access-code', machine.token,
        '--payload', JSON.stringify(command),
        '--country-code', String(config?.country_code || config?.bambu_cloud_region || 'CN'),
    ];

    try {
        const { stdout } = await execFileAsync(bridgeBinary, args, {
            windowsHide: true,
            cwd: path.dirname(bridgeBinary),
            timeout: 30000,
        });
        const parsed = parseBridgeOutput(stdout);
        if (!parsed) {
            throw new Error('Bambu Studio bridge returned no output');
        }
        if (!parsed.ok) {
            throw new Error(
                parsed.error
                || parsed.connect_message
                || (typeof parsed.send_ret === 'number' ? `Studio plugin send failed (${parsed.send_ret})` : null)
                || (typeof parsed.connect_status === 'number' ? `Studio plugin connect status ${parsed.connect_status}` : null)
                || 'Bambu Studio bridge reported an error',
            );
        }
        return parsed;
    } catch (failure) {
        if (failure && failure.error) {
            const parsed = parseBridgeOutput(failure.stdout);
            if (parsed) {
                const parts = [];
                if (parsed.error) {
                    parts.push(parsed.error);
                }
                if (typeof parsed.connect_ret === 'number') {
                    parts.push(`connect_ret=${parsed.connect_ret}`);
                }
                if (typeof parsed.connect_status === 'number') {
                    parts.push(`connect_status=${parsed.connect_status}`);
                }
                if (typeof parsed.send_ret === 'number') {
                    parts.push(`send_ret=${parsed.send_ret}`);
                }
                if (parsed.connect_message) {
                    parts.push(`connect_message=${parsed.connect_message}`);
                }
                throw new Error(`Bambu Studio bridge failed: ${parts.join(', ')}`);
            }
            const stderr = failure.stderr ? String(failure.stderr).trim() : '';
            const stdout = failure.stdout ? String(failure.stdout).trim() : '';
            throw new Error(`Bambu Studio bridge failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
        }
        throw failure;
    }
}

/**
 * Send a command to a cloud-connected printer via the Bambu Studio networking DLL
 * using cloud_send mode — the same path the official Bambu Studio app uses.
 *
 * This does NOT require a LAN IP. It authenticates with the cloud using the DLL's
 * own session (same BambuStudio config dir), then sends the command via cloud MQTT.
 *
 * Requirements: Bambu Studio must be installed, bambu_networking.dll must exist,
 * and the user must have logged in at least once via Bambu Studio.
 */
async function runStudioCloudCommand(machine, command, config) {
    if (!machine || typeof machine !== 'object') {
        throw new Error('A valid machine is required');
    }
    if (!machine.id) {
        throw new Error('Studio cloud control requires printer id');
    }

    const executable = getStudioExecutable(config);
    if (!executable || !fs.existsSync(executable)) {
        throw new Error('Bambu Studio executable not found');
    }

    const pluginDll = getStudioPluginDllPath();
    if (!fs.existsSync(pluginDll)) {
        throw new Error(`bambu_networking.dll not found at ${pluginDll}`);
    }

    const certDir = getStudioCertDir(config);
    if (!certDir || !fs.existsSync(certDir)) {
        throw new Error('Bambu Studio certificate folder is missing');
    }

    const bridgeBinary = await ensureStudioBridgeBuilt();
    const args = [
        '--command', 'cloud_send',
        '--plugin-dll', pluginDll,
        '--config-dir', getStudioDataDir(),
        '--cert-dir', certDir,
        '--printer-id', machine.id,
        '--payload', JSON.stringify(command),
        '--country-code', String(config?.country_code || config?.bambu_cloud_region || 'CN'),
    ];

    try {
        const { stdout } = await execFileAsync(bridgeBinary, args, {
            windowsHide: true,
            cwd: path.dirname(bridgeBinary),
            timeout: 20000,
        });
        const parsed = parseBridgeOutput(stdout);
        if (!parsed) {
            throw new Error('Bambu Studio bridge returned no output');
        }
        if (!parsed.ok) {
            throw new Error(
                parsed.error
                || (typeof parsed.send_ret === 'number' ? `Studio cloud send failed (send_ret=${parsed.send_ret})` : null)
                || (typeof parsed.server_ret === 'number' && parsed.server_ret !== 0 ? `Studio cloud connect failed (server_ret=${parsed.server_ret})` : null)
                || 'Bambu Studio cloud bridge reported an error',
            );
        }
        return parsed;
    } catch (failure) {
        if (failure && failure.error) {
            const parsed = parseBridgeOutput(failure.stdout);
            if (parsed) {
                const parts = [];
                if (parsed.error) parts.push(parsed.error);
                if (typeof parsed.send_ret === 'number') parts.push(`send_ret=${parsed.send_ret}`);
                if (typeof parsed.server_ret === 'number') parts.push(`server_ret=${parsed.server_ret}`);
                if (typeof parsed.user_login === 'boolean') parts.push(`user_login=${parsed.user_login}`);
                throw new Error(`Bambu Studio cloud bridge failed: ${parts.join(', ')}`);
            }
            const stderr = failure.stderr ? String(failure.stderr).trim() : '';
            const stdout = failure.stdout ? String(failure.stdout).trim() : '';
            throw new Error(`Bambu Studio cloud bridge failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`);
        }
        throw failure;
    }
}

module.exports = {
    ensureStudioBridgeBuilt,
    getBambuStudioStatus,
    ensureBambuStudioRunning,
    isStudioInstalled,
    getBridgeBinaryPath,
    getStudioPluginDllPath,
    runStudioLocalCommand,
    runStudioCloudCommand,
};
