const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const ftp = require('basic-ftp');
const mqtt = require('mqtt');
const xdgAppPaths = require('xdg-app-paths/cjs');
const jwt = require('jsonwebtoken');

const bambuConsts = require('bambu-cli/lib/const.js');
const bambuUtils = require('bambu-cli/lib/utils.js');

const DISCOVERY_TIMEOUT_MS = 9000;
const MQTT_TIMEOUT_MS = 10000; // Increased from 7000 to 10000 for more reliable connections
const FTP_TIMEOUT_MS = 7000; // Increased from 5000 to 7000 for more reliable connections

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
    const payload = JSON.stringify(payloadData);
    const response = await requestJson(`${getBambuCloudBase(region)}/user-service/user/login`, {
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
    push({ type: 'progress', message: 'Fetching bound printers...' });
    const devices = await fetchBoundDevices(tokens.token, tokens.region);
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
    push({ type: 'progress', message: 'Logging into Bambu Lab account...' });
    const tokens = await fetchBambuTokens({
        account: username,
        password,
    }, region);

    if (tokens.requiresVerificationCode) {
        return {
            requires_verification_code: true,
            account: username,
            region: normalizeCloudRegion(region),
            account_type: accountType === 'phone' ? 'phone' : 'email',
            tfa_key: tokens.tfaKey || null,
        };
    }

    return finishBambuLogin(config, username, { ...tokens, region: normalizeCloudRegion(region) }, push);
}

async function loginBambuAccountWithCode(config, username, code, region, push) {
    push({ type: 'progress', message: 'Submitting verification code to Bambu Lab...' });
    const tokens = await fetchBambuTokens({
        account: username,
        code,
    }, region);

    if (tokens.requiresVerificationCode) {
        throw new Error('Bambu Lab requested another verification code. Please request a fresh code and try again.');
    }

    return finishBambuLogin(config, username, { ...tokens, region: normalizeCloudRegion(region) }, push);
}

async function sendBambuLoginCode(account, accountType, region) {
    const normalizedRegion = normalizeCloudRegion(region);
    const normalizedAccountType = accountType === 'phone' ? 'phone' : 'email';
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
            const parsed = JSON.parse(response.data);
            errorMessage = parsed.error || parsed.message || errorMessage;
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

function normalizeStatus(machine, mqttState, ftpAlive, preferredId) {
    const amsModules = Array.isArray(mqttState.ams?.ams)
        ? mqttState.ams.ams.map((entry) => bambuUtils.amsNumToLetter(entry.id))
        : [];
    const activeTray = Number.isFinite(Number(mqttState.ams?.tray_now))
        ? bambuUtils.amsTrayNumToLetters(Number(mqttState.ams?.tray_now))
        : null;

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
        ftp: Boolean(ftpAlive),
        mqtt: Boolean(mqttState.mqtt),
        printing_stage: mqttState.printing || 'Unknown',
        task_name: mqttState.task || 'None',
        progress_percent: mqttState.percent || 'n/a',
        remaining_time: mqttState.remaining || 'n/a',
        speed: mqttState.speed || 'n/a',
        nozzle_diameter: mqttState.nozzle || 'n/a',
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
    if (discovery.login_required) {
        return {
            ...discovery,
            statuses: [],
            message: 'No Bambu account devices found. Run "bambu-cli login" once on this computer first.',
        };
    }

    if (discovery.binding_required) {
        return {
            ...discovery,
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
        
        statuses.push(normalizeStatus(machine, mqttState, ftpAlive, preferredId));
    }

    return {
        ...discovery,
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
                const payload = JSON.stringify(command);
                
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
                
                // For most commands, we can finish after receiving any response
                // For specific commands, you might want to wait for specific response fields
                clearTimeout(timeout);
                finish(null, {
                    success: true,
                    command,
                    responses,
                    message: 'Command sent successfully via cloud MQTT'
                });
            } catch (error) {
                // Ignore malformed responses, keep waiting
            }
        });
    });
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
            sequence_id: '0',
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
            push({
                type: 'done',
                cmd,
                data: discovery,
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
        case 'print_stop':
        case 'printer_home':
        case 'ams_status':
            throw new Error(
                `The installed bambu-cli version does not expose a stable "${cmd}" command path yet. `
                + 'Use printer discovery and status first, then we can add command support after the toolchain is upgraded.',
            );

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
};
