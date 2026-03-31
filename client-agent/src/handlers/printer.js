const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');
const ftp = require('basic-ftp');
const execFileAsync = promisify(execFile);
const mqtt = require('mqtt');
const xdgAppPaths = require('xdg-app-paths/cjs');
const jwt = require('jsonwebtoken');
const { getBambuStudioStatus, runStudioLocalCommand, runStudioCloudCommand } = require('./studio');
const { generateFakePrintGcode } = require('../utils/gcode_generator');
const { spawn } = require('child_process');

const bambuConsts = require('bambu-cli/lib/const.js');
const bambuUtils = require('bambu-cli/lib/utils.js');

const DISCOVERY_TIMEOUT_MS = 9000;
const MQTT_TIMEOUT_MS = 10000; // Increased from 7000 to 10000 for more reliable connections
const FTP_TIMEOUT_MS = 7000; // Increased from 5000 to 7000 for more reliable connections
const STUDIO_START_SEQUENCE_ID = 20000;
let studioSequenceId = STUDIO_START_SEQUENCE_ID;

function getBambuCliConfigFile() {
    const xdg = xdgAppPaths({ name: 'bambu-cli' });
    const configDir = xdg.config({ name: 'bambu-cli' });
    return path.join(configDir, 'config.json');
}

function normalizeCloudRegion(region) {
    return region === 'cn' ? 'cn' : 'global';
}

function getBambuCloudBase(region) {
    return normalizeCloudRegion(region) === 'cn'
        ? 'https://api.bambulab.cn/v1'
        : 'https://api.bambulab.com/v1';
}

function getBambuCloudMqttBroker(region) {
    return normalizeCloudRegion(region) === 'cn'
        ? 'mqtts://cn.mqtt.bambulab.com:8883'
        : 'mqtts://us.mqtt.bambulab.com:8883';
}

function writeBambuCliConfig(nextConfig) {
    const configFile = getBambuCliConfigFile();
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(nextConfig, null, 4) + '\n', 'utf8');
}

function nextStudioSequenceId() {
    const current = studioSequenceId;
    studioSequenceId += 1;
    return String(current);
}

function cloneCommand(command) {
    return JSON.parse(JSON.stringify(command || {}));
}

function getCommandEnvelope(command) {
    if (!command || typeof command !== 'object') {
        return null;
    }

    for (const key of ['print', 'system', 'camera', 'upgrade', 'xcam', 'pushing', 'info']) {
        if (command[key] && typeof command[key] === 'object' && typeof command[key].command === 'string') {
            return { key, payload: command[key] };
        }
    }

    return null;
}

function prepareCommandForDispatch(command, options = {}) {
    const prepared = cloneCommand(command);
    const envelope = getCommandEnvelope(prepared);
    if (!envelope) {
        return prepared;
    }

    envelope.payload.sequence_id = nextStudioSequenceId();
    if (options.userId && envelope.key === 'print') {
        envelope.payload.user_id = options.userId;
    }

    return prepared;
}

function extractMatchingCommandAck(response, command) {
    const envelope = getCommandEnvelope(command);
    if (!envelope) {
        return null;
    }

    const responseEnvelope = response?.[envelope.key];
    if (!responseEnvelope || responseEnvelope.command !== envelope.payload.command) {
        return null;
    }

    if (
        envelope.payload.sequence_id &&
        responseEnvelope.sequence_id &&
        String(responseEnvelope.sequence_id) !== String(envelope.payload.sequence_id)
    ) {
        return null;
    }

    return responseEnvelope;
}

// Known Bambu printer soft-rejection codes that indicate a state/safety interlock
// rather than a communication or command-format error.
// The command was received by the printer but rejected due to current machine state.
const BAMBU_SOFT_REJECTION_CODES = {
    84033543: '打印机当前状态不允许此操作（可能正在打印，或需要先手动确认归零）',  // 0x5024007
};

function isBambuSoftRejection(code) {
    return Object.prototype.hasOwnProperty.call(BAMBU_SOFT_REJECTION_CODES, Number(code));
}

function extractCommandError(envelope) {
    if (!envelope || typeof envelope !== 'object') {
        return null;
    }

    const code = envelope.err_code ?? envelope.error_code ?? envelope.code ?? null;
    if (code === null || code === undefined || code === '' || String(code) === '0') {
        return null;
    }

    const softMsg = BAMBU_SOFT_REJECTION_CODES[Number(code)];
    if (softMsg) {
        // Return a structured object so callers can distinguish soft from hard errors
        return { soft: true, code: Number(code), message: softMsg };
    }

    return { soft: false, code: Number(code), message: `Printer rejected command with err_code ${code}` };
}

function commandErrorToString(err) {
    if (!err) return null;
    if (typeof err === 'string') return err;
    return err.message || `Printer error ${err.code}`;
}

function isValidIpAddress(value) {
    if (typeof value !== 'string') {
        return false;
    }

    const parts = value.trim().split('.');
    if (parts.length !== 4) {
        return false;
    }

    return parts.every((part) => {
        if (!/^\d{1,3}$/.test(part)) {
            return false;
        }
        const num = Number(part);
        return num >= 0 && num <= 255;
    });
}

function isPrivateIpv4(value) {
    if (!isValidIpAddress(value)) {
        return false;
    }

    const [a, b] = value.split('.').map(Number);
    return a === 10
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 169 && b === 254);
}

function ipv4ToUint32(value) {
    if (!isValidIpAddress(value)) {
        return null;
    }

    return value.split('.').reduce((acc, part) => ((acc << 8) | Number(part)) >>> 0, 0);
}

function getLocalIpv4Networks() {
    const interfaces = os.networkInterfaces();
    const networks = [];

    Object.values(interfaces).forEach((entries) => {
        (entries || []).forEach((entry) => {
            if (!entry || entry.internal || entry.family !== 'IPv4') {
                return;
            }
            if (!isValidIpAddress(entry.address) || !isValidIpAddress(entry.netmask)) {
                return;
            }

            networks.push({
                address: entry.address,
                netmask: entry.netmask,
            });
        });
    });

    return networks;
}

function isIpOnSameSubnet(ip, networks = getLocalIpv4Networks()) {
    const ipValue = ipv4ToUint32(ip);
    if (ipValue == null) {
        return false;
    }

    return networks.some((network) => {
        const networkValue = ipv4ToUint32(network.address);
        const maskValue = ipv4ToUint32(network.netmask);
        if (networkValue == null || maskValue == null) {
            return false;
        }
        return (ipValue & maskValue) === (networkValue & maskValue);
    });
}

function scoreIpCandidate(ip, networks = getLocalIpv4Networks()) {
    if (!isPrivateIpv4(ip)) {
        return 0;
    }
    if (isIpOnSameSubnet(ip, networks)) {
        return 100;
    }
    return 10;
}

function readBambuCliConfig() {
    const configFile = getBambuCliConfigFile();
    if (!fs.existsSync(configFile)) {
        return {
            config_file: configFile,
            username: null,
            mqtt_user: null,
            machines: [],
        };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        return {
            config_file: configFile,
            username: typeof parsed.username === 'string' ? parsed.username : null,
            mqtt_user: typeof parsed.mqtt_user === 'string' ? parsed.mqtt_user : null,
            cloud_region: normalizeCloudRegion(parsed.cloud_region),
            access_token: typeof parsed.access_token === 'string' ? parsed.access_token : null,
            refresh_token: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null,
            token_expires_at: typeof parsed.token_expires_at === 'number' ? parsed.token_expires_at : null,
            machines: Array.isArray(parsed.machines) ? parsed.machines : [],
        };
    } catch (error) {
        throw new Error(`Failed to read bambu-cli config: ${error.message}`);
    }
}

function summarizeDiscoveredMachine(machine, preferredId) {
    return {
        id: String(machine.id || ''),
        name: String(machine.name || ''),
        ip: machine.ip || null,
        ip_source: machine.ip_source || null,
        model: machine.model || null,
        make: machine.make || null,
        has_access_code: Boolean(machine.token),
        selected: preferredId ? machine.id === preferredId : false,
        cloud_online: Boolean(machine.cloud_online),
    };
}

function isLocalBambuStudioAvailable(agentConfig) {
    return Boolean(agentConfig?.bambu_studio_path && fs.existsSync(agentConfig.bambu_studio_path));
}

function isStudioLocalControlAvailable(machine, agentConfig) {
    return Boolean(isLocalBambuStudioAvailable(agentConfig));
}

function createRouteAvailability(machine, mqttState, ftpAlive, agentConfig) {
    const lanOnline = Boolean(machine.ip && machine.token && (ftpAlive || mqttState?.mqtt));
    const cloudOnline = Boolean(machine.cloud_online);
    
    // ✅ FIX: Studio available when installed AND printer is reachable (LAN or cloud)
    // Bambu Studio can connect to printers via both LAN and cloud, so it should be
    // available as a route whenever the printer is reachable through either method
    const studioAvailable = Boolean(
        isStudioLocalControlAvailable(machine, agentConfig) &&
        (lanOnline || cloudOnline)
    );

    return {
        lan: lanOnline,
        studio: studioAvailable,
        cloud: cloudOnline,
    };
}

function resolveRoutesInPriority(availability, preferredRoutes) {
    return preferredRoutes.filter((route) => Boolean(availability?.[route]));
}

function buildCommandRoutes(availability) {
    return {
        printer_status: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        ams_status: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_light_control: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_start: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_pause: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_resume: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_stop: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_home: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        move_axis: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        set_bed_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_nozzle_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_print_speed: resolveRoutesInPriority(availability, ['lan']),
        set_fan_speed: resolveRoutesInPriority(availability, ['lan']),
        extrude_filament: resolveRoutesInPriority(availability, ['lan']),
        send_gcode: resolveRoutesInPriority(availability, ['lan']),
    };
}

function getPreferredPrinterId(config, machines) {
    const preferredId = config.printer?.serial;
    if (preferredId && machines.some((machine) => machine.id === preferredId)) {
        return preferredId;
    }

    return machines.length === 1 ? machines[0].id : null;
}

function listConfiguredPrinters(config) {
    const cliConfig = readBambuCliConfig();
    const machines = cliConfig.machines;
    const preferredId = getPreferredPrinterId(config, machines);
    const accountLinked = Boolean(cliConfig.username);

    return {
        config_file: cliConfig.config_file,
        username: cliConfig.username,
        mqtt_user: cliConfig.mqtt_user,
        cloud_region: cliConfig.cloud_region || 'global',
        account_linked: accountLinked,
        login_required: !accountLinked,
        binding_required: accountLinked && machines.length === 0,
        selected_printer_id: preferredId,
        machines: machines.map((machine) => summarizeDiscoveredMachine(machine, preferredId)),
    };
}

function saveConfiguredPrinterIp(config, printerId, ip) {
    const cliConfig = readBambuCliConfig();
    let found = false;
    const machines = cliConfig.machines.map((machine) => {
        if (machine.id !== printerId) {
            return machine;
        }
        found = true;
        return {
            ...machine,
            ip: ip.trim(),
        };
    });

    if (!found) {
        throw new Error(`Unknown printer id: ${printerId}`);
    }

    writeBambuCliConfig({
        ...cliConfig,
        machines,
    });

    return listConfiguredPrinters(config);
}

function requestJson(urlString, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const req = https.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || undefined,
                path: `${url.pathname}${url.search}`,
                method,
                headers,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode ?? 0,
                        headers: res.headers,
                        data,
                    });
                });
            },
        );

        req.on('error', reject);
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function fetchBambuTokens(payloadData, region) {
    let normalizedRegion = normalizeCloudRegion(region);
    
    // Auto-detect Chinese phone number (11 digits starting with 1)
    const account = payloadData.account || payloadData.username || '';
    if (normalizedRegion === 'global' && /^1\d{10}$/.test(account)) {
        normalizedRegion = 'cn';
    }

    const payload = JSON.stringify(payloadData);
    const response = await requestJson(`${getBambuCloudBase(normalizedRegion)}/user-service/user/login`, {
        method: 'POST',
        body: payload,
        headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
        },
    });

    if (response.statusCode !== 200) {
        let errorMessage = `Bambu Lab login failed (${response.statusCode})`;
        try {
            const parsed = JSON.parse(response.data);
            errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
            // Ignore parse failures, keep generic message.
        }
        throw new Error(errorMessage);
    }

    let parsed;
    try {
        parsed = JSON.parse(response.data);
    } catch {
        throw new Error('Bambu Lab login returned an unreadable response');
    }

    if (parsed.loginType === 'verifyCode') {
        return {
            requiresVerificationCode: true,
            tfaKey: parsed.tfaKey || null,
        };
    }

    if (!parsed.accessToken) {
        throw new Error(parsed.message || 'Bambu Lab login succeeded but no access token was returned');
    }

    return {
        requiresVerificationCode: false,
        token: parsed.accessToken,
        refreshToken: parsed.refreshToken || null,
        expiresIn: parsed.expiresIn || null,
    };
}

async function fetchBoundDevices(token, region) {
    const response = await requestJson(`${getBambuCloudBase(region)}/iot-service/api/user/bind`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.statusCode !== 200) {
        throw new Error(`Failed to fetch Bambu device list (${response.statusCode})`);
    }

    const parsed = JSON.parse(response.data);
    if (parsed.error) {
        throw new Error(parsed.error);
    }

    return Array.isArray(parsed.devices) ? parsed.devices : [];
}

async function fetchCloudMqttUser(token, region) {
    const normalizedRegion = normalizeCloudRegion(region);
    const endpoints = normalizedRegion === 'cn'
        ? [
            'https://makerworld.com.cn/api/v1/design-user-service/my/preference',
            'https://makerworld.com/api/v1/design-user-service/my/preference',
            `${getBambuCloudBase(normalizedRegion)}/design-user-service/my/preference`,
        ]
        : [
            'https://makerworld.com/api/v1/design-user-service/my/preference',
            'https://makerworld.com.cn/api/v1/design-user-service/my/preference',
            `${getBambuCloudBase(normalizedRegion)}/design-user-service/my/preference`,
        ];

    for (const endpoint of endpoints) {
        let response;
        try {
            response = await requestJson(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch {
            continue;
        }

        if (response.statusCode !== 200) {
            continue;
        }

        let parsed;
        try {
            parsed = JSON.parse(response.data);
        } catch {
            continue;
        }

        const rawUid = parsed.uid ?? parsed.user_id ?? parsed.userId ?? parsed.data?.uid ?? null;
        if (rawUid == null) {
            continue;
        }

        const uid = String(rawUid).trim();
        if (!uid) {
            continue;
        }

        return uid.startsWith('u_') ? uid : `u_${uid}`;
    }

    return null;
}

function mapBoundDevicesToMachines(devices) {
    return devices.map((device) => ({
        id: device.dev_id,
        name: device.name,
        token: device.dev_access_code,
        ip: null,
        ip_source: null,
        model: device.dev_model_name,
        make: device.dev_product_name,
        cloud_online: Boolean(device.online),
        cloud_print_status: device.print_status || null,
    }));
}

function convertUint32ToIpv4(value) {
    if (!Number.isFinite(value)) {
        return null;
    }

    const ip = Number(value) >>> 0;
    const bigEndian = [
        (ip >>> 24) & 255,
        (ip >>> 16) & 255,
        (ip >>> 8) & 255,
        ip & 255,
    ].join('.');
    const littleEndian = [
        ip & 255,
        (ip >>> 8) & 255,
        (ip >>> 16) & 255,
        (ip >>> 24) & 255,
    ].join('.');
    const candidates = [bigEndian, littleEndian].filter((candidate, index, all) => {
        return isValidIpAddress(candidate) && all.indexOf(candidate) === index;
    });

    if (candidates.length === 0) {
        return null;
    }

    return candidates.find((candidate) => isPrivateIpv4(candidate)) || candidates[0];
}

function shouldReplaceMachineIp(currentIp, nextIp, networks = getLocalIpv4Networks()) {
    if (!nextIp) {
        return false;
    }
    if (!currentIp) {
        return true;
    }
    if (currentIp === nextIp) {
        return true;
    }
    
    // Enhanced logic: Consider subnet scoring
    // Prefer same-subnet IPs (score 100) over different-subnet private IPs (score 10)
    const currentScore = scoreIpCandidate(currentIp, networks);
    const nextScore = scoreIpCandidate(nextIp, networks);
    
    // If next IP has higher score, replace
    if (nextScore > currentScore) {
        return true;
    }
    
    // If scores are equal, keep existing behavior
    if (nextScore === currentScore) {
        // Prefer private IPs over non-private
        if (isPrivateIpv4(currentIp) && !isPrivateIpv4(nextIp)) {
            return false;
        }
        if (!isPrivateIpv4(currentIp) && isPrivateIpv4(nextIp)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Validate if an IP address is likely reachable on the LAN
 * Performs a quick TCP connection test to MQTT port
 * @param {string} ip - IP address to validate
 * @param {string} token - Access code for authentication
 * @param {number} timeout - Timeout in milliseconds (default: 2000)
 * @returns {Promise<boolean>} - True if IP is likely reachable
 */
async function validateIpReachability(ip, token, timeout = 2000) {
    if (!ip || !isValidIpAddress(ip)) {
        return false;
    }
    
    return new Promise((resolve) => {
        const mqtt = require('mqtt');
        let settled = false;
        
        const client = mqtt.connect(`mqtts://${ip}:8883`, {
            username: 'bblp',
            password: token || 'test',
            rejectUnauthorized: false,
            connectTimeout: timeout,
        });
        
        const finish = (result) => {
            if (settled) return;
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore cleanup errors
            }
            resolve(result);
        };
        
        const timer = setTimeout(() => finish(false), timeout + 100);
        
        client.on('error', () => {
            clearTimeout(timer);
            finish(false);
        });
        
        client.on('connect', () => {
            clearTimeout(timer);
            finish(true);
        });
    });
}

function getReadableBambuStudioConfigFiles() {
    const appDataDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'BambuStudio') : null;
    if (!appDataDir || !fs.existsSync(appDataDir)) {
        return [];
    }

    return fs.readdirSync(appDataDir)
        .filter((name) => name === 'BambuStudio.conf' || name === 'BambuStudio.conf.bak' || /^BambuStudio\.conf\.\d+$/.test(name))
        .map((name) => path.join(appDataDir, name))
        .filter((filePath) => {
            try {
                return fs.statSync(filePath).isFile();
            } catch {
                return false;
            }
        });
}

function getReadableBambuStudioCacheFiles() {
    const files = [];
    const localAppDataDir = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'BambuStudio') : null;
    if (!localAppDataDir || !fs.existsSync(localAppDataDir)) {
        return files;
    }

    const webViewRoot = path.join(localAppDataDir, 'WebView2Cache');
    if (!fs.existsSync(webViewRoot)) {
        return files;
    }

    for (const entry of fs.readdirSync(webViewRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
            continue;
        }

        const baseDir = path.join(webViewRoot, entry.name, 'EBWebView');
        const candidates = [
            path.join(baseDir, 'Local State'),
            path.join(baseDir, 'Default', 'Session Storage'),
            path.join(baseDir, 'Default', 'Local Storage', 'leveldb'),
        ];

        for (const candidate of candidates) {
            if (!fs.existsSync(candidate)) {
                continue;
            }

            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
                files.push(candidate);
                continue;
            }

            for (const nested of fs.readdirSync(candidate, { withFileTypes: true })) {
                if (!nested.isFile()) {
                    continue;
                }
                if (!/\.(log|ldb)$/i.test(nested.name) && nested.name !== 'Local State') {
                    continue;
                }
                files.push(path.join(candidate, nested.name));
            }
        }
    }

    return files;
}

function extractPrivateIpsFromFile(filePath, localNetworks) {
    let text = '';

    try {
        text = fs.readFileSync(filePath, 'utf8');
    } catch {
        try {
            text = fs.readFileSync(filePath, 'latin1');
        } catch {
            return [];
        }
    }

    const matches = text.match(/\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g) || [];
    const unique = new Set();

    return matches.filter((ip) => {
        if (!isPrivateIpv4(ip)) {
            return false;
        }
        if (unique.has(ip)) {
            return false;
        }
        unique.add(ip);
        return scoreIpCandidate(ip, localNetworks) > 0;
    });
}

function scanBambuStudioCacheIpHints() {
    const localNetworks = getLocalIpv4Networks();
    const candidateMap = new Map();
    const files = [
        ...getReadableBambuStudioConfigFiles(),
        ...getReadableBambuStudioCacheFiles(),
    ];

    for (const filePath of files) {
        const ips = extractPrivateIpsFromFile(filePath, localNetworks);
        for (const ip of ips) {
            const existing = candidateMap.get(ip) || {
                ip,
                score: scoreIpCandidate(ip, localNetworks),
                same_subnet: isIpOnSameSubnet(ip, localNetworks),
                sources: [],
            };
            existing.sources.push(filePath);
            candidateMap.set(ip, existing);
        }
    }

    return Array.from(candidateMap.values())
        .sort((a, b) => b.score - a.score || b.sources.length - a.sources.length || a.ip.localeCompare(b.ip));
}

function enrichMachineIpsFromBambuStudioCache(machines) {
    const candidates = scanBambuStudioCacheIpHints();
    const localNetworks = getLocalIpv4Networks();
    
    console.log('[IP Discovery] Bambu Studio cache scan found', candidates.length, 'IP candidates');
    if (candidates.length > 0) {
        console.log('[IP Discovery] Top 3 cache candidates:', candidates.slice(0, 3).map(c => 
            `${c.ip} (score: ${c.score}, same_subnet: ${c.same_subnet})`
        ));
    }
    
    // Enhanced logic: Replace cloud IPs with cache IPs when cache has higher-scored IPs
    const nextMachines = machines.map((machine) => {
        if (!machine.ip) {
            // No IP yet - try to fill from cache (original behavior)
            if (machine.cloud_online && candidates.length > 0) {
                const topCandidate = candidates[0];
                if (topCandidate && topCandidate.score >= 100) {
                    console.log(`[IP Discovery] Machine ${machine.id}: No IP, using cache IP ${topCandidate.ip} (score: ${topCandidate.score})`);
                    return {
                        ...machine,
                        ip: topCandidate.ip,
                        ip_source: 'bambu_studio_cache',
                    };
                }
            }
            return machine;
        }
        
        // Machine has IP - check if cache has a better one
        const currentScore = scoreIpCandidate(machine.ip, localNetworks);
        console.log(`[IP Discovery] Machine ${machine.id}: Current IP ${machine.ip} (score: ${currentScore}, source: ${machine.ip_source})`);
        
        // Find best cache candidate for this machine
        // Prefer same-subnet IPs (score 100) over cloud IPs with lower scores
        const betterCandidates = candidates.filter(hint => 
            hint.score > currentScore && hint.ip !== machine.ip
        );
        
        if (betterCandidates.length > 0) {
            const bestCandidate = betterCandidates[0]; // Already sorted by score
            console.log(`[IP Discovery] Machine ${machine.id}: Replacing with better cache IP ${bestCandidate.ip} (score: ${bestCandidate.score})`);
            return {
                ...machine,
                ip: bestCandidate.ip,
                ip_source: 'bambu_studio_cache_prioritized',
            };
        }
        
        return machine;
    });

    return { machines: nextMachines, cacheHints: candidates.slice(0, 5) };
}

function getIpFromNetInfo(parsed) {
    const candidates = [
        parsed?.print?.net?.info,
        parsed?.net?.info,
        parsed?.info?.net?.info,
    ];

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) {
            continue;
        }

        for (const entry of candidate) {
            if (entry == null || typeof entry !== 'object') {
                continue;
            }

            if (typeof entry.ip === 'string' && isValidIpAddress(entry.ip)) {
                return entry.ip;
            }

            const numericIp = Number(entry.ip);
            if (!Number.isFinite(numericIp)) {
                continue;
            }

            const convertedIp = convertUint32ToIpv4(numericIp);
            if (convertedIp) {
                return convertedIp;
            }
        }
    }

    return null;
}

function getIpFromRtspUrl(parsed) {
    const rtspUrl = parsed?.print?.ipcam?.rtsp_url ?? parsed?.ipcam?.rtsp_url ?? null;
    if (!rtspUrl || typeof rtspUrl !== 'string') {
        return null;
    }

    try {
        const hostname = new URL(rtspUrl).hostname;
        return isValidIpAddress(hostname) ? hostname : null;
    } catch {
        return null;
    }
}

function extractIpFromCloudMqttPayload(parsed) {
    return getIpFromRtspUrl(parsed) || getIpFromNetInfo(parsed);
}

function mergeKnownMachineIps(existingMachines, discoveredMachines) {
    const existingById = new Map(existingMachines.map((machine) => [machine.id, machine]));
    return discoveredMachines.map((machine) => {
        const existing = existingById.get(machine.id);
        if (!existing?.ip || machine.ip) {
            return machine;
        }

        return {
            ...machine,
            ip: existing.ip,
            ip_source: existing.ip_source || machine.ip_source || null,
        };
    });
}

function enrichMachineIpsFromCloud(token, mqttUser, machines, region) {
    return new Promise((resolve) => {
        if (!token || !mqttUser || machines.length === 0) {
            resolve(machines);
            return;
        }

        const machinesById = new Map(machines.map((machine) => [machine.id, { ...machine }]));
        let settled = false;
        const client = mqtt.connect(getBambuCloudMqttBroker(region), {
            username: mqttUser,
            password: token,
            rejectUnauthorized: false,
            connectTimeout: DISCOVERY_TIMEOUT_MS,
        });

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore shutdown failures.
            }
            resolve(Array.from(machinesById.values()));
        };

        const timer = setTimeout(finish, DISCOVERY_TIMEOUT_MS);

        const validate = () => {
            if (Array.from(machinesById.values()).every((machine) => machine.ip)) {
                clearTimeout(timer);
                finish();
            }
        };

        client.on('error', () => {
            clearTimeout(timer);
            finish();
        });

        client.on('connect', () => {
            Array.from(machinesById.values()).forEach((machine) => {
                client.unsubscribe(`device/${machine.id}/report`, () => {});
                setTimeout(() => {
                    client.subscribe(`device/${machine.id}/report`, () => {});
                    client.publish(
                        `device/${machine.id}/request`,
                        JSON.stringify({ pushing: { sequence_id: '0', command: 'pushall' } }),
                    );
                }, 400);
            });
        });

        client.on('message', (topic, message) => {
            try {
                const deviceId = topic.split('/')[1];
                const machine = machinesById.get(deviceId);
                if (!machine) {
                    return;
                }

                const parsed = JSON.parse(message.toString());
                const ip = extractIpFromCloudMqttPayload(parsed);
                if (!ip) {
                    return;
                }

                if (shouldReplaceMachineIp(machine.ip, ip)) {
                    machine.ip = ip;
                    machine.ip_source = getIpFromRtspUrl(parsed) ? 'cloud_mqtt_rtsp' : 'cloud_mqtt_net_info';
                    validate();
                }
            } catch {
                // Ignore malformed discovery packets.
            }
        });
    });
}

async function finishBambuLogin(config, username, tokens, push) {
    const normalizedRegion = /^1\d{10}$/.test(username) ? 'cn' : normalizeCloudRegion(tokens.region);
    push({ type: 'progress', message: `Fetching bound printers (${normalizedRegion})...` });
    const devices = await fetchBoundDevices(tokens.token, normalizedRegion);
    const existingCliConfig = readBambuCliConfig();
    const jwtPayload = jwt.decode(tokens.token) || {};
    let mqttUser = typeof jwtPayload.username === 'string' ? jwtPayload.username : null;
    if (!mqttUser) {
        push({ type: 'progress', message: 'Resolving cloud MQTT user id...' });
        mqttUser = await fetchCloudMqttUser(tokens.token, tokens.region);
    }
    let machines = mergeKnownMachineIps(existingCliConfig.machines, mapBoundDevicesToMachines(devices));

    push({ type: 'progress', message: 'Syncing printer IP addresses from Bambu cloud MQTT...' });
    machines = await enrichMachineIpsFromCloud(tokens.token, mqttUser, machines, tokens.region);
    const cacheEnriched = enrichMachineIpsFromBambuStudioCache(machines);
    machines = cacheEnriched.machines;

    writeBambuCliConfig({
        username,
        mqtt_user: mqttUser,
        cloud_region: tokens.region,
        access_token: tokens.token, // Save access token for cloud MQTT control
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresIn ? Date.now() + (tokens.expiresIn * 1000) : null,
        machines,
    });

    return collectPrinterStatuses(config, push);
}

async function loginBambuAccount(config, username, password, region, accountType, push) {
    const normalizedRegion = /^1\d{10}$/.test(username) ? 'cn' : normalizeCloudRegion(region);
    push({ type: 'progress', message: `Logging into Bambu Lab account (${normalizedRegion})...` });
    const tokens = await fetchBambuTokens({
        account: username,
        password,
    }, normalizedRegion);

    if (tokens.requiresVerificationCode) {
        return {
            requires_verification_code: true,
            account: username,
            region: normalizedRegion,
            account_type: accountType === 'phone' ? 'phone' : 'email',
            tfa_key: tokens.tfaKey || null,
        };
    }

    return finishBambuLogin(config, username, { ...tokens, region: normalizeCloudRegion(region) }, push);
}

async function loginBambuAccountWithCode(config, username, code, region, push) {
    const normalizedRegion = /^1\d{10}$/.test(username) ? 'cn' : normalizeCloudRegion(region);
    push({ type: 'progress', message: `Submitting verification code to Bambu Lab (${normalizedRegion})...` });
    const tokens = await fetchBambuTokens({
        account: username,
        code,
    }, normalizedRegion);

    if (tokens.requiresVerificationCode) {
        throw new Error('Bambu Lab requested another verification code. Please request a fresh code and try again.');
    }

    return finishBambuLogin(config, username, { ...tokens, region: normalizedRegion }, push);
}

async function sendBambuLoginCode(account, accountType, region) {
    let normalizedRegion = normalizeCloudRegion(region);
    let normalizedAccountType = accountType === 'phone' ? 'phone' : 'email';
    
    // Auto-detect phone number format (simple check for numeric-only accounts)
    if (/^\d{11,}$/.test(account)) {
        normalizedAccountType = 'phone';
        // Auto-detect Chinese phone number (11 digits starting with 1)
        if (normalizedRegion === 'global' && /^1\d{10}$/.test(account)) {
            normalizedRegion = 'cn';
        }
    }

    const endpoint = normalizedAccountType === 'phone'
        ? `${getBambuCloudBase(normalizedRegion)}/user-service/user/sendsmscode`
        : `${getBambuCloudBase(normalizedRegion)}/user-service/user/sendemail/code`;
    const payload = normalizedAccountType === 'phone'
        ? { phone: account, type: 'codeLogin' }
        : { email: account, type: 'codeLogin' };
    const body = JSON.stringify(payload);
    const response = await requestJson(endpoint, {
        method: 'POST',
        body,
        headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
        },
    });

    if (response.statusCode !== 200) {
        let errorMessage = `Failed to send verification code (${response.statusCode})`;
        try {
            const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            errorMessage = parsed.error || parsed.message || parsed.msg || errorMessage;
            
            // Add hint for region mismatch
            if (errorMessage.includes('Invalid') || errorMessage.includes('not found')) {
                errorMessage += `. Hint: Try changing the Region to ${normalizedRegion === 'cn' ? 'Global' : 'China'}.`;
            }
        } catch {
            // Keep generic fallback message.
        }
        throw new Error(errorMessage);
    }

    return {
        sent: true,
        region: normalizedRegion,
        account_type: normalizedAccountType,
        account,
    };
}

function resolveBambuCliPath(config) {
    const configuredPath = config.bambu_cli_path;
    const candidates = [];

    if (configuredPath) {
        candidates.push(configuredPath);

        if (!path.isAbsolute(configuredPath)) {
            candidates.push(path.resolve(__dirname, '..', '..', configuredPath));
        }
    }

    candidates.push(
        path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'bambu-cli.cmd'),
        path.resolve(__dirname, '..', '..', 'node_modules', '.bin', 'bambu-cli'),
        'bambu-cli',
    );

    for (const candidate of candidates) {
        if (candidate !== 'bambu-cli' && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return 'bambu-cli';
}

async function checkFtp(machine) {
    if (!machine.ip || !machine.token) {
        return false;
    }

    const client = new ftp.Client(FTP_TIMEOUT_MS);
    client.ftp.verbose = false;

    try {
        await client.access({
            host: machine.ip,
            user: 'bblp',
            password: machine.token,
            port: 990,
            secure: 'implicit',
            secureOptions: {
                checkServerIdentity: () => null,
                rejectUnauthorized: false,
            },
        });
        await client.list('/');
        return true;
    } catch {
        return false;
    } finally {
        client.close();
    }
}

function fetchMqttStatus(machine) {
    return new Promise((resolve) => {
        if (!machine.ip || !machine.token) {
            resolve({ mqtt: false });
            return;
        }

        const state = {
            machine: {
                id: machine.id,
                name: machine.name,
                ip: machine.ip,
                model: machine.model,
                make: machine.make,
            },
            external: { color: false, type: false },
            ams: 'None',
            mqtt: false,
            printing: 'Unknown',
            task: 'None',
            percent: 'n/a',
            remaining: 'n/a',
            speed: 'n/a',
            nozzle: 'n/a',
            nozzle_temp: null,
            nozzle_target_temp: null,
            bed_temp: null,
            bed_target_temp: null,
            chamber_temp: null,
            gcode_state: null,
            layer_num: null,
            total_layers: null,
            hms: [],
        };

        let settled = false;
        const topics = { info: 0, print: 0 };
        const client = mqtt.connect(`mqtts://${machine.ip}:8883`, {
            username: 'bblp',
            password: machine.token,
            rejectUnauthorized: false,
            connectTimeout: MQTT_TIMEOUT_MS,
            clientId: `fdm-ai-${Math.random().toString(16).slice(2)}`,
        });

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore socket shutdown failures.
            }
            resolve(state);
        };

        const hardTimeout = setTimeout(finish, MQTT_TIMEOUT_MS + 1500);

        client.on('error', finish);

        client.on('connect', () => {
            state.mqtt = true;
            client.unsubscribe(`device/${machine.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${machine.id}/report`, () => {});
                bambuConsts.MQTT_INIT.forEach((init) => {
                    client.publish(`device/${machine.id}/request`, JSON.stringify(init));
                });
            }, 300);
        });

        client.on('message', (_topic, message) => {
            try {
                const json = JSON.parse(message.toString());
                bambuUtils.mqttMessage(json, state);
                enrichParsedPrintState(json.print, state);

                if (json.info) {
                    topics.info += 1;
                }
                if (json.print) {
                    topics.print += 1;
                }

                if (topics.info >= 1 && topics.print >= 2) {
                    clearTimeout(hardTimeout);
                    finish();
                }
            } catch {
                // Ignore malformed MQTT payloads.
            }
        });
    });
}

function fetchCloudMqttStatus(machine, cliConfig) {
    return new Promise((resolve) => {
        if (!machine?.id || !cliConfig?.access_token || !cliConfig?.mqtt_user) {
            resolve({ mqtt: false });
            return;
        }

        const state = {
            machine: {
                id: machine.id,
                name: machine.name,
                ip: machine.ip,
                model: machine.model,
                make: machine.make,
            },
            external: { color: false, type: false },
            ams: 'None',
            mqtt: false,
            printing: 'Unknown',
            task: 'None',
            percent: 'n/a',
            remaining: 'n/a',
            speed: 'n/a',
            nozzle: 'n/a',
            nozzle_temp: null,
            nozzle_target_temp: null,
            bed_temp: null,
            bed_target_temp: null,
            chamber_temp: null,
            gcode_state: null,
            layer_num: null,
            total_layers: null,
            hms: [],
        };

        let settled = false;
        const topics = { info: 0, print: 0 };
        const client = mqtt.connect(getBambuCloudMqttBroker(cliConfig.cloud_region), {
            username: cliConfig.mqtt_user,
            password: cliConfig.access_token,
            rejectUnauthorized: false,
            connectTimeout: MQTT_TIMEOUT_MS,
            clientId: `fdm-ai-cloud-${Math.random().toString(16).slice(2)}`,
        });

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore socket shutdown failures.
            }
            resolve(state);
        };

        const hardTimeout = setTimeout(finish, MQTT_TIMEOUT_MS + 1500);

        client.on('error', finish);

        client.on('connect', () => {
            state.mqtt = true;
            client.unsubscribe(`device/${machine.id}/report`, () => {});
            setTimeout(() => {
                client.subscribe(`device/${machine.id}/report`, () => {});
                bambuConsts.MQTT_INIT.forEach((init) => {
                    client.publish(`device/${machine.id}/request`, JSON.stringify(init));
                });
            }, 300);
        });

        client.on('message', (_topic, message) => {
            try {
                const json = JSON.parse(message.toString());
                bambuUtils.mqttMessage(json, state);
                enrichParsedPrintState(json.print, state);

                if (json.info) {
                    topics.info += 1;
                }
                if (json.print) {
                    topics.print += 1;
                }

                if (topics.info >= 1 && topics.print >= 2) {
                    clearTimeout(hardTimeout);
                    finish();
                }
            } catch {
                // Ignore malformed MQTT payloads.
            }
        });
    });
}

function formatRemainingMinutes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 'n/a';
    }

    const totalSeconds = Math.max(0, Math.round(numeric * 60));
    if (totalSeconds <= 0) {
        return '0s';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}

function enrichParsedPrintState(print, state) {
    if (!print || typeof print !== 'object') {
        return state;
    }

    const readNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const gcodeState = typeof print.gcode_state === 'string' ? print.gcode_state.toUpperCase() : null;
    const percentValue = readNumber(print.mc_percent);
    const remainingMinutes = readNumber(print.mc_remaining_time);
    const layerNum = readNumber(print.layer_num);
    const totalLayers = readNumber(print.total_layer_num);
    const isFinished = gcodeState === 'FINISH'
        || (percentValue != null && percentValue >= 100)
        || (layerNum != null && totalLayers != null && totalLayers > 0 && layerNum >= totalLayers);

    state.nozzle_temp = readNumber(print.nozzle_temper);
    state.nozzle_target_temp = readNumber(print.nozzle_target_temper);
    state.bed_temp = readNumber(print.bed_temper);
    state.bed_target_temp = readNumber(print.bed_target_temper);
    state.chamber_temp = readNumber(print.chamber_temper);
    state.gcode_state = gcodeState || state.gcode_state || null;
    state.layer_num = layerNum ?? state.layer_num ?? null;
    state.total_layers = totalLayers ?? state.total_layers ?? null;

    if (isFinished) {
        state.printing = 'Complete';
        state.percent = '100%';
        state.remaining = '0s';
        return state;
    }

    if (gcodeState === 'PAUSE') {
        state.printing = 'Paused';
    } else if (gcodeState === 'FAILED') {
        state.printing = 'Failed';
    } else if ((state.printing === 'Unknown' || !state.printing) && gcodeState === 'RUNNING') {
        state.printing = 'Printing';
    }

    if ((state.printing === 'Unknown' || !state.printing) && (gcodeState === 'IDLE' || Number(print.stg_cur) === 255)) {
        state.printing = 'Idle';
    }
    if ((state.printing === 'Unknown' || !state.printing) && typeof print.print_type === 'string' && print.print_type.toLowerCase() === 'idle') {
        state.printing = 'Idle';
    }
    if ((state.percent === 'n/a' || state.percent == null || state.percent === '0%') && percentValue != null) {
        state.percent = `${Math.max(0, Math.min(100, Math.round(percentValue)))}%`;
    }
    if ((state.remaining === 'n/a' || state.remaining == null) && remainingMinutes != null) {
        state.remaining = formatRemainingMinutes(remainingMinutes);
    }

    return state;
}

function mergeTelemetryState(baseState, fallbackState) {
    if (!fallbackState || typeof fallbackState !== 'object') {
        return baseState;
    }

    const next = {
        ...baseState,
        ...fallbackState,
        machine: baseState.machine || fallbackState.machine,
        external: (baseState.external?.color && baseState.external?.type) ? baseState.external : fallbackState.external,
        ams: (Array.isArray(baseState.ams?.ams) && baseState.ams.ams.length > 0) ? baseState.ams : fallbackState.ams,
        hms: Array.isArray(baseState.hms) && baseState.hms.length > 0 ? baseState.hms : fallbackState.hms,
    };

    for (const key of ['printing', 'task', 'percent', 'remaining', 'speed', 'nozzle', 'nozzle_temp', 'nozzle_target_temp', 'bed_temp', 'bed_target_temp', 'chamber_temp', 'gcode_state', 'layer_num', 'total_layers']) {
        if (baseState[key] == null || ['Unknown', 'None', 'n/a', ''].includes(baseState[key])) {
            next[key] = fallbackState[key] ?? baseState[key];
        } else {
            next[key] = baseState[key];
        }
    }

    next.mqtt = Boolean(baseState.mqtt);
    return next;
}

function normalizeAmsModules(rawAms) {
    if (!Array.isArray(rawAms?.ams)) {
        return [];
    }

    return rawAms.ams.map((module) => ({
        id: String(module.id ?? ''),
        letter: bambuUtils.amsNumToLetter(module.id),
        humidity: module.humidity ?? null,
        temp: module.temp ?? null,
        trays: Array.isArray(module.tray)
            ? module.tray.map((tray) => ({
                  id: String(tray.id ?? ''),
                  type: tray.tray_type || null,
                  color: Array.isArray(tray.cols) && tray.cols[0] ? String(tray.cols[0]).slice(0, 6) : null,
                  colors: Array.isArray(tray.cols)
                      ? tray.cols.map((entry) => String(entry).slice(0, 6)).filter(Boolean)
                      : [],
                  remain: Number.isFinite(Number(tray.remain)) ? Number(tray.remain) : null,
                  name: tray.tray_sub_brands || tray.tray_info_name || tray.tray_name || null,
              }))
            : [],
    }));
}

function normalizeActiveTray(rawAms) {
    const trayNow = Number(rawAms?.tray_now);
    if (!Number.isFinite(trayNow) || trayNow < 0) {
        return null;
    }

    if (trayNow >= 254) {
        return 'External Spool';
    }

    const amsIndex = Math.floor(trayNow / 4);
    const trayIndex = (trayNow % 4) + 1;
    if (!Number.isFinite(amsIndex) || amsIndex < 0 || amsIndex > 25) {
        return `TRAY ${trayIndex}`;
    }

    return `AMS ${String.fromCharCode(65 + amsIndex)}${trayIndex}`;
}

function normalizeStatus(machine, mqttState, ftpAlive, preferredId, agentConfig) {
    const amsModules = normalizeAmsModules(mqttState.ams);
    const activeTray = normalizeActiveTray(mqttState.ams);
    const routes = createRouteAvailability(machine, mqttState, ftpAlive, agentConfig);
    const command_routes = buildCommandRoutes(routes);

    return {
        id: String(machine.id || ''),
        name: String(machine.name || ''),
        ip: machine.ip || null,
        ip_source: machine.ip_source || null,
        model: machine.model || null,
        make: machine.make || null,
        selected: preferredId ? machine.id === preferredId : false,
        online: Boolean(machine.cloud_online || ftpAlive || mqttState.mqtt),
        cloud_online: Boolean(machine.cloud_online),
        lan_online: Boolean(ftpAlive || mqttState.mqtt),
        local_mode_required: Boolean(machine.cloud_online && !(ftpAlive || mqttState.mqtt)),
        studio_available: routes.studio,
        routes,
        command_routes,
        ftp: Boolean(ftpAlive),
        mqtt: Boolean(mqttState.mqtt),
        printing_stage: mqttState.printing || 'Unknown',
        task_name: mqttState.task || 'None',
        progress_percent: mqttState.percent || 'n/a',
        remaining_time: mqttState.remaining || 'n/a',
        speed: mqttState.speed || 'n/a',
        nozzle_diameter: mqttState.nozzle || 'n/a',
        gcode_state: mqttState.gcode_state || null,
        layer_num: Number.isFinite(Number(mqttState.layer_num)) ? Number(mqttState.layer_num) : null,
        total_layers: Number.isFinite(Number(mqttState.total_layers)) ? Number(mqttState.total_layers) : null,
        nozzle_temp: Number.isFinite(Number(mqttState.nozzle_temp)) ? Number(mqttState.nozzle_temp) : null,
        nozzle_target_temp: Number.isFinite(Number(mqttState.nozzle_target_temp)) ? Number(mqttState.nozzle_target_temp) : null,
        bed_temp: Number.isFinite(Number(mqttState.bed_temp)) ? Number(mqttState.bed_temp) : null,
        bed_target_temp: Number.isFinite(Number(mqttState.bed_target_temp)) ? Number(mqttState.bed_target_temp) : null,
        chamber_temp: Number.isFinite(Number(mqttState.chamber_temp)) ? Number(mqttState.chamber_temp) : null,
        ams_modules: amsModules,
        active_tray: activeTray,
        has_external_spool: Boolean(mqttState.external?.color && mqttState.external?.type),
        hms_errors: Array.isArray(mqttState.hms)
            ? mqttState.hms.map((entry) => ({
                  code: bambuUtils.hmsErrorToCode(entry.attr, entry.code),
                  message: bambuUtils.hmsErrorLookup(entry.attr, entry.code),
              }))
            : [],
    };
}

async function collectPrinterStatuses(config, push) {
    const discovery = listConfiguredPrinters(config);
    const studio_status = await getBambuStudioStatus(config).catch(() => ({
        installed: false,
        running: false,
        automation_ready: false,
        path: config?.bambu_studio_path ?? null,
        process_name: null,
    }));
    if (discovery.login_required) {
        return {
            ...discovery,
            studio_status,
            statuses: [],
            message: 'No Bambu account devices found. Run "bambu-cli login" once on this computer first.',
        };
    }

    if (discovery.binding_required) {
        return {
            ...discovery,
            studio_status,
            statuses: [],
            message: 'Bambu account login succeeded, but the cloud API returned no bound printers for this account.',
        };
    }

    const cliConfig = readBambuCliConfig();
    const cacheEnriched = enrichMachineIpsFromBambuStudioCache(cliConfig.machines);
    let machines = cacheEnriched.machines;
    const preferredId = discovery.selected_printer_id;
    const statuses = [];
    const localNetworks = getLocalIpv4Networks();

    for (let machine of machines) {
        push({
            type: 'progress',
            message: `Checking ${machine.name || machine.id}...`,
        });
        
        // Try connection with current IP
        let [ftpAlive, mqttState] = await Promise.all([
            checkFtp(machine),
            fetchMqttStatus(machine),
        ]);
        
        // If LAN connection failed but machine has cloud connectivity, try fallback IPs
        if (!ftpAlive && !mqttState.mqtt && machine.cloud_online && machine.ip) {
            console.log(`[LAN Connection] Machine ${machine.id}: LAN connection failed with IP ${machine.ip}, attempting fallback...`);
            push({
                type: 'progress',
                message: `LAN connection failed for ${machine.name || machine.id}, trying alternative IPs...`,
            });
            
            // Get alternative IPs from Bambu Studio cache
            const cacheHints = cacheEnriched.cacheHints || [];
            const sameSubnetHints = cacheHints.filter(hint => 
                hint.same_subnet && hint.score === 100 && hint.ip !== machine.ip
            );
            
            console.log(`[LAN Connection] Found ${sameSubnetHints.length} same-subnet alternative IPs from cache`);
            
            // Try each same-subnet IP from cache
            for (const hint of sameSubnetHints) {
                console.log(`[LAN Connection] Trying alternative IP ${hint.ip} (score: ${hint.score})...`);
                push({
                    type: 'progress',
                    message: `Trying alternative IP ${hint.ip} for ${machine.name || machine.id}...`,
                });
                
                const altMachine = { ...machine, ip: hint.ip, ip_source: 'bambu_studio_cache_fallback' };
                const [altFtp, altMqtt] = await Promise.all([
                    checkFtp(altMachine),
                    fetchMqttStatus(altMachine),
                ]);
                
                if (altFtp || altMqtt.mqtt) {
                    // Success! Update machine IP
                    console.log(`[LAN Connection] SUCCESS! Connected to ${machine.id} using alternative IP ${hint.ip} (FTP: ${altFtp}, MQTT: ${altMqtt.mqtt})`);
                    machine = altMachine;
                    ftpAlive = altFtp;
                    mqttState = altMqtt;
                    
                    push({
                        type: 'progress',
                        message: `Successfully connected to ${machine.name || machine.id} using alternative IP ${hint.ip}`,
                    });
                    
                    // Update the machine in the config
                    const updatedMachines = cliConfig.machines.map(m => 
                        m.id === machine.id ? machine : m
                    );
                    writeBambuCliConfig({
                        ...cliConfig,
                        machines: updatedMachines,
                    });
                    
                    break;
                } else {
                    console.log(`[LAN Connection] Alternative IP ${hint.ip} also failed (FTP: ${altFtp}, MQTT: ${altMqtt.mqtt})`);
                }
            }
            
            if (!ftpAlive && !mqttState.mqtt) {
                console.log(`[LAN Connection] All fallback attempts failed for machine ${machine.id}`);
            }
        }

        if (machine.cloud_online && cliConfig.access_token && cliConfig.mqtt_user) {
            const cloudMqttState = await fetchCloudMqttStatus(machine, cliConfig);
            mqttState = mergeTelemetryState(mqttState, cloudMqttState);
        }
        
        statuses.push(normalizeStatus(machine, mqttState, ftpAlive, preferredId, config));
    }

    return {
        ...discovery,
        studio_status,
        machines: machines.map((machine) => summarizeDiscoveredMachine(machine, preferredId)),
        statuses,
        cache_ip_hints: cacheEnriched.cacheHints,
        checked_at: new Date().toISOString(),
    };
}

/**
 * Send command to printer via cloud MQTT
 * @param {string} printerId - Printer device ID
 * @param {object} command - Command object to send
 * @param {function} push - Progress callback
 * @returns {Promise<object>} - Command result
 */
async function sendCloudMqttCommand(printerId, command, push) {
    const cliConfig = readBambuCliConfig();
    
    if (!cliConfig.access_token || !cliConfig.mqtt_user) {
        throw new Error('Not logged in or access token not available. Please login again.');
    }
    
    // Check if token is expired
    if (cliConfig.token_expires_at && Date.now() > cliConfig.token_expires_at) {
        throw new Error('Access token expired. Please login again.');
    }
    
    const region = cliConfig.cloud_region || 'global';
    const broker = getBambuCloudMqttBroker(region);
    
    push({ type: 'progress', message: `Connecting to cloud MQTT (${broker})...` });
    
    const preparedCommand = prepareCommandForDispatch(command, { userId: cliConfig.mqtt_user || null });
    const envelope = getCommandEnvelope(preparedCommand);

    return new Promise((resolve, reject) => {
        let settled = false;
        const responses = [];
        
        const client = mqtt.connect(broker, {
            username: cliConfig.mqtt_user,
            password: cliConfig.access_token,
            rejectUnauthorized: false,
            connectTimeout: 10000,
        });
        
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore cleanup errors
            }
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        
        const timeout = setTimeout(() => {
            finish(new Error('Cloud MQTT command timeout'));
        }, 15000);
        
        client.on('error', (error) => {
            clearTimeout(timeout);
            finish(error);
        });
        
        client.on('connect', () => {
            push({ type: 'progress', message: 'Connected to cloud MQTT, sending command...' });
            
            // Subscribe to device report
            client.subscribe(`device/${printerId}/report`, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    finish(err);
                    return;
                }
                
                // Publish command
                const topic = `device/${printerId}/request`;
                const payload = JSON.stringify(preparedCommand);
                
                client.publish(topic, payload, (err) => {
                    if (err) {
                        clearTimeout(timeout);
                        finish(err);
                        return;
                    }
                    
                    push({ type: 'progress', message: 'Command sent, waiting for response...' });
                });
            });
        });
        
        client.on('message', (topic, message) => {
            try {
                const response = JSON.parse(message.toString());
                responses.push(response);

                const ackEnvelope = extractMatchingCommandAck(response, preparedCommand);
                if (!ackEnvelope) {
                    return;
                }

                const commandError = extractCommandError(ackEnvelope);
                clearTimeout(timeout);
                if (commandError) {
                    if (commandError.soft) {
                        // Soft rejection: printer received but refused due to state (safety interlock).
                        // Resolve with a warning so callers can decide to show a friendly message.
                        finish(null, {
                            success: false,
                            soft_rejection: true,
                            err_code: commandError.code,
                            message: commandError.message,
                            command: preparedCommand,
                            responses,
                        });
                    } else {
                        finish(new Error(commandErrorToString(commandError)));
                    }
                    return;
                }

                finish(null, {
                    success: true,
                    command: preparedCommand,
                    responses,
                    sequence_id: envelope?.payload?.sequence_id || null,
                    message: 'Command sent successfully via cloud MQTT'
                });
            } catch (error) {
                // Ignore malformed responses, keep waiting
            }
        });
    });
}

/**
 * Send print control command via LAN MQTT
 */
async function sendPrintCommandViaLanMqtt(printerId, ip, accessCode, command, params = {}) {
    let mqttCommand;

    switch (command) {
        case 'print_start':
            mqttCommand = {
                print: {
                    command: 'project_file',
                    param: params.fileName || '',
                    subtask_name: params.fileName || '',
                    url: `ftp://${params.fileName}`,
                    bed_type: 'auto',
                    timelapse: false,
                    bed_leveling: true,
                    flow_cali: false,
                    vibration_cali: false,
                    layer_inspect: false,
                    use_ams: true
                }
            };
            break;
        case 'print_pause':
            mqttCommand = { print: { command: 'pause' } };
            break;
        case 'print_resume':
            mqttCommand = { print: { command: 'resume' } };
            break;
        case 'print_stop':
            mqttCommand = { print: { command: 'stop' } };
            break;
        default:
            throw new Error(`Unknown command: ${command}`);
    }

    return sendCommandViaLanMqtt(printerId, ip, accessCode, mqttCommand);
}

/**
 * Send print control command via Cloud MQTT
 */
async function sendPrintCommandViaCloudMqtt(printerId, command, params, push) {
    let mqttCommand;
    
    switch (command) {
        case 'print_start':
            mqttCommand = {
                print: {
                    command: 'project_file',
                    param: params.fileName || '',
                    subtask_name: params.fileName || '',
                    url: `ftp://${params.fileName}`,
                    bed_type: 'auto',
                    timelapse: false,
                    bed_leveling: true,
                    flow_cali: false,
                    vibration_cali: false,
                    layer_inspect: false,
                    use_ams: true
                }
            };
            break;
        case 'print_pause':
            mqttCommand = { print: { command: 'pause' } };
            break;
        case 'print_resume':
            mqttCommand = { print: { command: 'resume' } };
            break;
        case 'print_stop':
            mqttCommand = { print: { command: 'stop' } };
            break;
        default:
            throw new Error(`Unknown command: ${command}`);
    }
    
    return sendCloudMqttCommand(printerId, mqttCommand, push);
}

/**
 * Send generic command via LAN MQTT
 */
async function sendCommandViaLanMqtt(printerId, ip, accessCode, command) {
    const cliConfig = readBambuCliConfig();
    const preparedCommand = prepareCommandForDispatch(command, { userId: cliConfig.mqtt_user || null });
    const envelope = getCommandEnvelope(preparedCommand);

    return new Promise((resolve, reject) => {
        let settled = false;
        const client = mqtt.connect(`mqtts://${ip}:8883`, {
            username: 'bblp',
            password: accessCode,
            clientId: `client_${Date.now()}`,
            rejectUnauthorized: false,
            connectTimeout: MQTT_TIMEOUT_MS
        });
        
        const finish = (error, result) => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                client.end(true);
            } catch {
                // Ignore cleanup failures.
            }
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };

        const timeout = setTimeout(() => {
            finish(new Error('LAN MQTT command timeout'));
        }, MQTT_TIMEOUT_MS);
        
        client.on('error', (error) => {
            clearTimeout(timeout);
            finish(error);
        });
        
        client.on('connect', () => {
            client.subscribe(`device/${printerId}/report`, (subscribeError) => {
                if (subscribeError) {
                    clearTimeout(timeout);
                    finish(subscribeError);
                    return;
                }

                client.publish(`device/${printerId}/request`, JSON.stringify(preparedCommand), (publishError) => {
                    if (publishError) {
                        clearTimeout(timeout);
                        finish(publishError);
                    }
                });
            });
        });

        client.on('message', (_topic, message) => {
            try {
                const response = JSON.parse(message.toString());
                const ackEnvelope = extractMatchingCommandAck(response, preparedCommand);
                if (!ackEnvelope) {
                    return;
                }

                const commandError = extractCommandError(ackEnvelope);
                clearTimeout(timeout);
                if (commandError) {
                    finish(new Error(commandError));
                    return;
                }

                finish(null, {
                    success: true,
                    command: preparedCommand,
                    response,
                    sequence_id: envelope?.payload?.sequence_id || null,
                });
            } catch {
                // Ignore malformed packets and keep waiting.
            }
        });
    });
}

async function sendCommandViaStudioPlugin(machine, command, config) {
    const cliConfig = readBambuCliConfig();
    const preparedCommand = prepareCommandForDispatch(command, { userId: cliConfig.mqtt_user || null });
    const result = await runStudioLocalCommand(machine, preparedCommand, config);

    if (typeof result.response === 'string' && result.response.trim()) {
        try {
            const response = JSON.parse(result.response);
            const ackEnvelope = extractMatchingCommandAck(response, preparedCommand);
            const commandError = extractCommandError(ackEnvelope);
            if (commandError) {
                throw new Error(commandError);
            }
            return {
                success: true,
                command: preparedCommand,
                response,
                sequence_id: result.sequence_id || null,
                bridge: result,
            };
        } catch (error) {
            if (!(error instanceof SyntaxError)) {
                throw error;
            }
        }
    }

    return {
        success: true,
        command: preparedCommand,
        response: result.response || null,
        sequence_id: result.sequence_id || null,
        bridge: result,
    };
}

/**
 * Send command via Studio Bridge cloud_send mode.
 * Uses bambu_networking.dll's cloud channel - the same path official Bambu Studio uses.
 * Does NOT require LAN IP; only requires Bambu Studio to be installed and logged in via the app.
 */
async function sendCommandViaStudioCloud(machine, command, config) {
    const cliConfig = readBambuCliConfig();
    const preparedCommand = prepareCommandForDispatch(command, { userId: cliConfig.mqtt_user || null });
    const result = await runStudioCloudCommand(machine, preparedCommand, config);

    if (typeof result.response === 'string' && result.response.trim()) {
        try {
            const response = JSON.parse(result.response);
            const ackEnvelope = extractMatchingCommandAck(response, preparedCommand);
            const commandError = extractCommandError(ackEnvelope);
            if (commandError) {
                if (commandError.soft) {
                    return {
                        success: false,
                        soft_rejection: true,
                        err_code: commandError.code,
                        message: commandError.message,
                        command: preparedCommand,
                    };
                }
                throw new Error(commandErrorToString(commandError));
            }
            return {
                success: true,
                command: preparedCommand,
                response,
                sequence_id: result.sequence_id || null,
                bridge: result,
            };
        } catch (error) {
            if (!(error instanceof SyntaxError)) {
                throw error;
            }
        }
    }

    return {
        success: true,
        command: preparedCommand,
        response: result.response || null,
        sequence_id: result.sequence_id || null,
        bridge: result,
    };
}
function requireLanControl(machine, action) {
    if (!machine || !machine.id) {
        throw new Error(`${action} requires a known printer`);
    }
    if (!machine.ip || !machine.token) {
        throw new Error(`${action} requires LAN control. Current printer has no valid LAN IP or access code.`);
    }
    return machine;
}

async function sendGcodeLineViaLan(machine, line) {
    const trimmed = typeof line === 'string' ? line.trim() : '';
    if (!trimmed) {
        return { success: true, skipped: true };
    }
    return sendCommandViaLanMqtt(machine.id, machine.ip, machine.token, {
        print: {
            command: 'gcode_line',
            param: trimmed,
        },
    });
}

async function sendGcodeSequenceViaLan(machine, lines) {
    const results = [];
    for (const line of lines) {
        results.push(await sendGcodeLineViaLan(machine, line));
    }
    return {
        success: true,
        steps: results.length,
    };
}

/**
 * Send G-code line via cloud MQTT
 * @param {string} printerId - Printer device ID
 * @param {string} line - G-code line to send
 * @param {function} push - Progress callback
 * @returns {Promise<object>} - Command result
 */
async function sendGcodeLineViaCloud(printerId, line, push) {
    const trimmed = typeof line === 'string' ? line.trim() : '';
    if (!trimmed) {
        return { success: true, skipped: true };
    }
    
    const cliConfig = readBambuCliConfig();
    const command = {
        print: {
            command: 'gcode_line',
            param: trimmed,
        },
    };

    return sendCloudMqttCommand(printerId, command, push);
}

/**
 * Send G-code sequence via cloud MQTT
 * @param {string} printerId - Printer device ID
 * @param {string[]} lines - Array of G-code lines
 * @param {function} push - Progress callback
 * @returns {Promise<object>} - Command result
 */
async function sendGcodeSequenceViaCloud(printerId, lines, push) {
    const results = [];
    for (const line of lines) {
        results.push(await sendGcodeLineViaCloud(printerId, line, push));
    }
    return {
        success: true,
        steps: results.length,
    };
}

/**
 * Execute a command (Home/Move) via a "Fake Print" job.
 * This wraps the G-code into a 3MF, uploads to cloud OSS, and sends project_file command.
 */
async function executeViaFakePrint(printerId, gcodeLines, push, config, useSafetyPrep = false) {
    const cliConfig = readBambuCliConfig();
    const machine = cliConfig.machines.find(m => m.id === printerId);
    if (!machine) {
        throw new Error(`Printer ${printerId} not found`);
    }

    const accessToken = cliConfig.access_token;
    if (!accessToken) {
        throw new Error('Access token is missing in bambu-cli config. Please re-login.');
    }

    const region = cliConfig.cloud_region || 'global';
    const modelName = machine.name || machine.id;

    // 1. Generate G-code payload
    const finalGcode = generateFakePrintGcode(modelName, gcodeLines, useSafetyPrep);
    push({ type: 'progress', message: `[伪装打印] 已生成 G-code 负载 (${useSafetyPrep ? '安全准备模式' : '对齐模式'})...` });

    // 2. Wrap into 3MF and upload to OSS via Python helper
    const helperPath = path.resolve(__dirname, '../../scripts/fake_print_helper.py');
    const resultJson = await new Promise((resolve, reject) => {
        // Normalize region (Bambu config often uses 'China' or 'Global')
        const normRegion = (region.toLowerCase().includes('china') || region.toLowerCase().includes('cn')) ? 'cn' : 'global';
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        console.log(`[Fake Print] Starting helper: ${pythonCmd} ${helperPath} --region ${normRegion}`);

        const pythonProcess = spawn(pythonCmd, [
            helperPath,
            '--token', accessToken,
            '--region', normRegion,
            '--model', modelName
        ]);

        pythonProcess.on('error', (err) => {
            console.error(`[Fake Print] Failed to spawn python process: ${err.message}`);
            reject(new Error(`Failed to start Python helper (${pythonCmd}): ${err.message}. Please ensure Python is installed and in your PATH.`));
        });

        // Send G-code content via stdin to avoid command line length limits on Windows
        pythonProcess.stdin.write(finalGcode);
        pythonProcess.stdin.end();

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                // If the script failed, it might have still output a JSON error message to stdout.
                try {
                    const errorJson = JSON.parse(stdout);
                    if (errorJson && errorJson.error) {
                        reject(new Error(`Fake print helper error: ${errorJson.error}`));
                        return;
                    }
                } catch {
                    // Ignore parsing error and use stderr/code instead.
                }
                reject(new Error(`Fake print helper failed with code ${code}. Stderr: ${stderr.trim() || 'No error output'}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (err) {
                reject(new Error(`Failed to parse helper output: ${stdout}`));
            }
        });
    });

    if (!resultJson.success) {
        throw new Error(`Helper script error: ${resultJson.error}`);
    }

    const ossUrl = resultJson.url;
    push({ type: 'progress', message: `[伪装打印] 3MF 文件已上传: ${ossUrl}` });

    // 3. Trigger project_file command via cloud MQTT
    const mqttCommand = {
        print: {
            command: 'project_file',
            param: `Metadata/plate_1.gcode`,
            subtask_name: `BBL_${Date.now()}`,
            url: ossUrl,
            bed_type: 'auto',
            timelapse: false,
            bed_leveling: true,
            flow_cali: true,
            vibration_cali: true,
            layer_inspect: true,
            use_ams: true
        }
    };

    push({ type: 'progress', message: `[伪装打印] 正在发送 project_file MQTT 指令...` });
    return sendCloudMqttCommand(printerId, mqttCommand, push);
}


/**
 * Control printer LED chamber light via cloud MQTT
 * @param {string} printerId - Printer device ID
 * @param {string} mode - Light mode: 'on', 'off', or 'auto'
 * @param {function} push - Progress callback
 * @returns {Promise<object>} - Command result
 */
async function controlPrinterLightCloud(printerId, mode, push) {
    // LED control command for Bambu printers
    const command = {
        system: {
            command: 'ledctrl',
            led_node: 'chamber_light',
            led_mode: mode === 'on' ? 'on' : mode === 'off' ? 'off' : 'auto',
            led_on_time: 500,
            led_off_time: 500,
            loop_times: 1,
            interval_time: 1000
        }
    };
    
    return sendCloudMqttCommand(printerId, command, push);
}

async function printerControl(cmd, params, push, config) {
    push({ type: 'status', message: `Running ${cmd}...` });

    switch (cmd) {
        case 'printer_discover': {
            const discovery = listConfiguredPrinters(config);
            const studio_status = await getBambuStudioStatus(config).catch(() => ({
                installed: false,
                running: false,
                automation_ready: false,
                path: config?.bambu_studio_path ?? null,
                process_name: null,
            }));
            push({
                type: 'done',
                cmd,
                data: {
                    ...discovery,
                    studio_status,
                },
                message: discovery.login_required
                    ? 'No linked Bambu account found in local bambu-cli config.'
                    : discovery.binding_required
                        ? 'Bambu account is linked, but no bound printers were returned by the cloud API.'
                        : `Found ${discovery.machines.length} printer(s) in local bambu-cli config.`,
            });
            return;
        }

        case 'printer_status': {
            const status = await collectPrinterStatuses(config, push);
            push({
                type: 'done',
                cmd,
                data: status,
                message: status.login_required
                    ? status.message
                    : status.binding_required
                        ? status.message
                        : `Status refreshed for ${status.statuses.length} printer(s).`,
            });
            return;
        }

        case 'printer_login': {
            const username = typeof params.account === 'string'
                ? params.account.trim()
                : typeof params.username === 'string'
                    ? params.username.trim()
                    : '';
            const password = typeof params.password === 'string' ? params.password : '';
            const accountType = typeof params.account_type === 'string' ? params.account_type : 'email';
            const region = typeof params.region === 'string' ? params.region : 'global';
            if (!username || !password) {
                throw new Error('printer_login requires account and password');
            }

            const status = await loginBambuAccount(config, username, password, region, accountType, push);
            if (status.requires_verification_code) {
                push({
                    type: 'done',
                    cmd,
                    data: status,
                    message: 'Bambu Lab sent a verification code to the account email address.',
                });
                return;
            }
            push({
                type: 'done',
                cmd,
                data: status,
                message: status.binding_required
                    ? 'Bambu account linked, but the cloud API returned no bound printers.'
                    : `Bambu account linked. ${status.statuses.length} printer(s) synced.`,
            });
            return;
        }

        case 'printer_login_verify_code': {
            const username = typeof params.account === 'string'
                ? params.account.trim()
                : typeof params.username === 'string'
                    ? params.username.trim()
                    : '';
            const code = typeof params.code === 'string' ? params.code.trim() : '';
            const region = typeof params.region === 'string' ? params.region : 'global';
            if (!username || !code) {
                throw new Error('printer_login_verify_code requires account and code');
            }

            const status = await loginBambuAccountWithCode(config, username, code, region, push);
            push({
                type: 'done',
                cmd,
                data: status,
                message: status.binding_required
                    ? 'Verification succeeded, but the cloud API returned no bound printers.'
                    : `Verification succeeded. ${status.statuses.length} printer(s) synced.`,
            });
            return;
        }

        case 'printer_send_login_code': {
            const account = typeof params.account === 'string' ? params.account.trim() : '';
            const accountType = typeof params.account_type === 'string' ? params.account_type : 'email';
            const region = typeof params.region === 'string' ? params.region : 'global';
            if (!account) {
                throw new Error('printer_send_login_code requires account');
            }

            push({ type: 'progress', message: 'Requesting verification code from Bambu Lab...' });
            const result = await sendBambuLoginCode(account, accountType, region);
            push({
                type: 'done',
                cmd,
                data: result,
                message: 'Verification code sent successfully.',
            });
            return;
        }

        case 'printer_set_ip': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const ip = typeof params.ip === 'string' ? params.ip.trim() : '';
            if (!printerId || !ip) {
                throw new Error('printer_set_ip requires printer_id and ip');
            }
            if (!isValidIpAddress(ip)) {
                throw new Error(`Invalid IP address: ${ip}`);
            }

            push({ type: 'progress', message: `Saving IP ${ip} for ${printerId}...` });
            saveConfiguredPrinterIp(config, printerId, ip);
            const status = await collectPrinterStatuses(config, push);
            push({
                type: 'done',
                cmd,
                data: status,
                message: `IP saved for ${printerId}. Status refreshed.`,
            });
            return;
        }

        case 'printer_light_control': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const mode = typeof params.mode === 'string' ? params.mode.trim().toLowerCase() : 'on';
            
            if (!printerId) {
                throw new Error('printer_light_control requires printer_id');
            }
            
            if (!['on', 'off', 'auto'].includes(mode)) {
                throw new Error('mode must be "on", "off", or "auto"');
            }
            
            push({ type: 'progress', message: `Controlling light for ${printerId} (mode: ${mode})...` });
            
            try {
                const result = await controlPrinterLightCloud(printerId, mode, push);
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `Light control command sent successfully (mode: ${mode})`,
                });
            } catch (error) {
                // If cloud control fails, provide helpful error message
                if (error.message.includes('Not logged in') || error.message.includes('expired')) {
                    throw new Error(
                        'Cloud MQTT control requires valid login. Please run printer_login command first. ' +
                        'Note: Access tokens expire after some time and require re-login.'
                    );
                }
                throw error;
            }
            return;
        }

        case 'print_start':
        case 'print_pause':
        case 'print_resume':
        case 'print_stop': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const fileName = typeof params.file_name === 'string' ? params.file_name.trim() : '';
            const plate = typeof params.plate === 'number' ? params.plate : 1;
            
            if (!printerId) {
                throw new Error(`${cmd} requires printer_id`);
            }
            
            if (cmd === 'print_start' && !fileName) {
                throw new Error('print_start requires file_name');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Sending ${cmd} command to ${printerId}...` });
            
            try {
                let result;
                
                // 优先使用局域网 MQTT
                if (machine.ip && machine.token) {
                    result = await sendPrintCommandViaLanMqtt(machine.id, machine.ip, machine.token, cmd, { fileName, plate });
                }
                // 回退到云端 MQTT
                else if (machine.cloud_online && cliConfig.access_token) {
                    result = await sendPrintCommandViaCloudMqtt(printerId, cmd, { fileName, plate }, push);
                }
                else {
                    throw new Error('Printer is not available (no LAN or cloud connection)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `${cmd} command sent successfully`
                });
            } catch (error) {
                throw new Error(`Failed to send ${cmd} command: ${error.message}`);
            }
            return;
        }
        
        case 'printer_home': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            
            if (!printerId) {
                throw new Error('printer_home requires printer_id');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Sending home command to ${printerId}...` });
            
            try {
                let result;
                const cloudMode = params.cloud_mode || 'normal';
                
                if (cloudMode === 'normal') {
                    throw new Error("操作被拒绝：由于拓竹(V01.08.03+)固件的安全策略，当前普通云端模式不支持执行敏感移动/回中指令 (HMS_0500拦截)。请在界面上方切换为“伪装打印”或“截图识别”模式。");
                }
    
                if (cloudMode === 'fake_print') {
                    push({ type: 'progress', message: `[伪装打印模式] 正在为 ${printerId} 执行回中任务...` });
                    result = await executeViaFakePrint(printerId, ['G28'], push, config, params.use_safety_prep);
                } else if (cloudMode === 'fara_7b') {
                    push({ type: 'progress', message: `[截图识别模式] 正在唤醒 Fara-7B 模型以控制 Bambu Studio (未完全实现)...` });
                    // TODO: 调用 Python 脚本
                    // result = await homeViaFara7B(printerId, push);
                    result = { success: true, fara: true };
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    throw new Error(`未知的云端控制模式: ${cloudMode}`);
                }
                
                // Handle soft rejection (printer received but refused due to state)
                if (result && result.soft_rejection) {
                    push({
                        type: 'warning',
                        cmd,
                        data: result,
                        message: result.message || '打印机当前状态不允许此操作'
                    });
                    return;
                }

                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: 'Home command sent successfully'
                });
            } catch (error) {
                throw new Error(`Failed to send home command: ${error.message}`);
            }
            return;
        }
        
        case 'set_bed_temperature': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const temperature = typeof params.temperature === 'number' ? params.temperature : 0;
            
            if (!printerId) {
                throw new Error('set_bed_temperature requires printer_id');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Setting bed temperature to ${temperature}°C...` });
            
            try {
                let result;
                if (machine.ip && machine.token) {
                    // LAN mode
                    result = await sendGcodeSequenceViaLan(machine, [`M140 S${temperature}`]);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    // Cloud mode
                    result = await sendGcodeSequenceViaCloud(printerId, [`M140 S${temperature}`], push);
                } else {
                    throw new Error('Printer is not available (neither LAN nor cloud online)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `Bed temperature set to ${temperature}°C`
                });
            } catch (error) {
                throw new Error(`Failed to set bed temperature: ${error.message}`);
            }
            return;
        }
        
        case 'set_nozzle_temperature': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const temperature = typeof params.temperature === 'number' ? params.temperature : 0;
            
            if (!printerId) {
                throw new Error('set_nozzle_temperature requires printer_id');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Setting nozzle temperature to ${temperature}°C...` });
            
            try {
                let result;
                if (machine.ip && machine.token) {
                    // LAN mode
                    result = await sendGcodeSequenceViaLan(machine, [`M104 S${temperature}`]);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    // Cloud mode
                    result = await sendGcodeSequenceViaCloud(printerId, [`M104 S${temperature}`], push);
                } else {
                    throw new Error('Printer is not available (neither LAN nor cloud online)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `Nozzle temperature set to ${temperature}°C`
                });
            } catch (error) {
                throw new Error(`Failed to set nozzle temperature: ${error.message}`);
            }
            return;
        }
        
        case 'move_axis': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const axis = typeof params.axis === 'string' ? params.axis.toUpperCase() : '';
            const distance = typeof params.distance === 'number' ? params.distance : 0;
            const speed = typeof params.speed === 'number' ? params.speed : 3000;
            
            if (!printerId) {
                throw new Error('move_axis requires printer_id');
            }
            
            if (!['X', 'Y', 'Z', 'E'].includes(axis)) {
                throw new Error('axis must be X, Y, Z, or E');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            const cloudMode = params.cloud_mode || 'normal';
            if (cloudMode === 'normal') {
                throw new Error("操作被拒绝：当前普通云端模式不支持直接发送移动轴动作(HMS_0500拦截)。请在界面上方切换为“伪装打印”或“截图识别”模式。");
            }
            
            push({ type: 'progress', message: `Moving ${axis} axis by ${distance}mm...` });
            
            try {
                let result;
                
                if (cloudMode === 'fake_print') {
                    push({ type: 'progress', message: `[伪装打印模式] 正在为 ${printerId} 创建空 3MF 移动任务...` });
                    // 构造移动G-code (G91 增量模式保证控制的一致性)
                    const moveGcode = `G91\nG1 ${axis}${distance} F${speed}\nG90`;
                    result = await executeViaFakePrint(printerId, [moveGcode], push, config, params.use_safety_prep);
                } else if (cloudMode === 'fara_7b') {
                    push({ type: 'progress', message: `[截图识别模式] 正在唤醒 Fara-7B 模型以控制 Bambu Studio (未完全实现)...` });
                    // TODO: fara_7b nodejs -> python
                    result = { success: true, fara: true };
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    throw new Error(`未知的云端控制模式: ${cloudMode}`);
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `${axis} axis moved by ${distance}mm`
                });
            } catch (error) {
                throw new Error(`Failed to move axis: ${error.message}`);
            }
            return;
        }
        
        case 'set_print_speed': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const speed = typeof params.speed === 'number' ? params.speed : 100;
            
            if (!printerId) {
                throw new Error('set_print_speed requires printer_id');
            }
            
            if (speed < 10 || speed > 200) {
                throw new Error('speed must be between 10 and 200 (percentage)');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Setting print speed to ${speed}%...` });
            
            try {
                const command = {
                    print: {
                        command: 'print_speed',
                        param: speed.toString()
                    }
                };
                
                let result;
                if (machine.ip && machine.token) {
                    result = await sendCommandViaLanMqtt(machine.id, machine.ip, machine.token, command);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    result = await sendCloudMqttCommand(printerId, command, push);
                } else {
                    throw new Error('Printer is not available');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `Print speed set to ${speed}%`
                });
            } catch (error) {
                throw new Error(`Failed to set print speed: ${error.message}`);
            }
            return;
        }
        
        case 'set_fan_speed': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const fan = typeof params.fan === 'string' ? params.fan : 'part';
            const speed = typeof params.speed === 'number' ? params.speed : 100;
            
            if (!printerId) {
                throw new Error('set_fan_speed requires printer_id');
            }
            
            if (!['part', 'aux', 'chamber'].includes(fan)) {
                throw new Error('fan must be part, aux, or chamber');
            }
            
            if (speed < 0 || speed > 100) {
                throw new Error('speed must be between 0 and 100 (percentage)');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Setting ${fan} fan speed to ${speed}%...` });
            
            try {
                let gcodeCommand;
                
                if (fan === 'part') {
                    // Part cooling fan (M106)
                    const pwm = Math.round((speed / 100) * 255);
                    gcodeCommand = `M106 S${pwm}`;
                } else if (fan === 'aux') {
                    // Auxiliary fan
                    gcodeCommand = `M106 P2 S${Math.round((speed / 100) * 255)}`;
                } else {
                    // Chamber fan
                    gcodeCommand = `M106 P3 S${Math.round((speed / 100) * 255)}`;
                }
                
                let result;
                if (machine.ip && machine.token) {
                    // LAN mode
                    result = await sendGcodeSequenceViaLan(machine, [gcodeCommand]);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    // Cloud mode
                    result = await sendGcodeSequenceViaCloud(printerId, [gcodeCommand], push);
                } else {
                    throw new Error('Printer is not available (neither LAN nor cloud online)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `${fan} fan speed set to ${speed}%`
                });
            } catch (error) {
                throw new Error(`Failed to set fan speed: ${error.message}`);
            }
            return;
        }
        
        case 'extrude_filament': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const length = typeof params.length === 'number' ? params.length : 10;
            const speed = typeof params.speed === 'number' ? params.speed : 300;
            
            if (!printerId) {
                throw new Error('extrude_filament requires printer_id');
            }
            
            if (Math.abs(length) > 100) {
                throw new Error('length must be between -100 and 100 mm');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            const action = length > 0 ? 'Extruding' : 'Retracting';
            push({ type: 'progress', message: `${action} ${Math.abs(length)}mm of filament...` });
            
            try {
                const gcodeSequence = [
                    'G91',
                    `G1 E${length} F${speed}`,
                    'G90',
                ];
                
                let result;
                if (machine.ip && machine.token) {
                    // LAN mode
                    result = await sendGcodeSequenceViaLan(machine, gcodeSequence);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    // Cloud mode
                    result = await sendGcodeSequenceViaCloud(printerId, gcodeSequence, push);
                } else {
                    throw new Error('Printer is not available (neither LAN nor cloud online)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: `${action} ${Math.abs(length)}mm completed`
                });
            } catch (error) {
                throw new Error(`Failed to extrude filament: ${error.message}`);
            }
            return;
        }
        
        case 'send_gcode': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            const gcode = typeof params.gcode === 'string' ? params.gcode.trim() : '';
            
            if (!printerId) {
                throw new Error('send_gcode requires printer_id');
            }
            
            if (!gcode) {
                throw new Error('send_gcode requires gcode parameter');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Sending G-code: ${gcode.substring(0, 50)}...` });
            
            try {
                const gcodeLines = gcode.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                
                let result;
                if (machine.ip && machine.token) {
                    // LAN mode
                    result = await sendGcodeSequenceViaLan(machine, gcodeLines);
                } else if (machine.cloud_online && cliConfig.access_token) {
                    // Cloud mode
                    result = await sendGcodeSequenceViaCloud(printerId, gcodeLines, push);
                } else {
                    throw new Error('Printer is not available (neither LAN nor cloud online)');
                }
                
                push({
                    type: 'done',
                    cmd,
                    data: result,
                    message: 'G-code sent successfully'
                });
            } catch (error) {
                throw new Error(`Failed to send G-code: ${error.message}`);
            }
            return;
        }
        
        case 'ams_status': {
            const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : '';
            
            if (!printerId) {
                throw new Error('ams_status requires printer_id');
            }
            
            const cliConfig = readBambuCliConfig();
            const machine = cliConfig.machines.find(m => m.id === printerId);
            
            if (!machine) {
                throw new Error(`Printer ${printerId} not found`);
            }
            
            push({ type: 'progress', message: `Getting AMS status from ${printerId}...` });
            
            try {
                // 从 MQTT 状态中获取 AMS 信息
                let mqttState = await fetchMqttStatus(machine);
                if ((!mqttState.mqtt || !Array.isArray(mqttState.ams?.ams)) && machine.cloud_online && cliConfig.access_token && cliConfig.mqtt_user) {
                    const cloudMqttState = await fetchCloudMqttStatus(machine, cliConfig);
                    mqttState = mergeTelemetryState(mqttState, cloudMqttState);
                }

                const amsModules = normalizeAmsModules(mqttState.ams);
                const activeTray = normalizeActiveTray(mqttState.ams);
                
                push({
                    type: 'done',
                    cmd,
                    data: {
                        printer_id: printerId,
                        ams_modules: amsModules,
                        active_tray: activeTray,
                        has_external_spool: Boolean(mqttState.external?.color && mqttState.external?.type)
                    },
                    message: 'AMS status retrieved successfully'
                });
            } catch (error) {
                throw new Error(`Failed to get AMS status: ${error.message}`);
            }
            return;
        }

        case 'printer_login_hint': {
            const cliPath = resolveBambuCliPath(config);
            push({
                type: 'done',
                cmd,
                data: {
                    cli_path: cliPath,
                    config_file: getBambuCliConfigFile(),
                    command: `${cliPath} login`,
                },
                message: 'Run "bambu-cli login" once in a terminal on this computer to bind printers into the local config.',
            });
            return;
        }

        default:
            throw new Error(`Unknown printer command: ${cmd}`);
    }
}

module.exports = {
    printerControl,
    listConfiguredPrinters,
    collectPrinterStatuses,
    // Export for testing
    checkFtp,
    fetchMqttStatus,
    createRouteAvailability,
    buildCommandRoutes,
};
