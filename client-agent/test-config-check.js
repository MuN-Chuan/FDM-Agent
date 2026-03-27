// Test script to check if access_token is properly saved and read
const fs = require('fs');
const path = require('path');
const xdgAppPaths = require('xdg-app-paths/cjs');

function getBambuCliConfigFile() {
    const xdg = xdgAppPaths({ name: 'bambu-cli' });
    const configDir = xdg.config({ name: 'bambu-cli' });
    return path.join(configDir, 'config.json');
}

function readBambuCliConfig() {
    const configFile = getBambuCliConfigFile();
    if (!fs.existsSync(configFile)) {
        console.log('❌ Config file does not exist:', configFile);
        return null;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        return {
            config_file: configFile,
            username: typeof parsed.username === 'string' ? parsed.username : null,
            mqtt_user: typeof parsed.mqtt_user === 'string' ? parsed.mqtt_user : null,
            cloud_region: parsed.cloud_region || 'global',
            access_token: typeof parsed.access_token === 'string' ? parsed.access_token : null,
            refresh_token: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null,
            token_expires_at: typeof parsed.token_expires_at === 'number' ? parsed.token_expires_at : null,
            machines: Array.isArray(parsed.machines) ? parsed.machines : [],
        };
    } catch (error) {
        console.error('❌ Failed to read config:', error.message);
        return null;
    }
}

console.log('=== Bambu CLI Config Check ===\n');

const config = readBambuCliConfig();

if (!config) {
    console.log('No config found or failed to read.');
    process.exit(1);
}

console.log('Config file location:', config.config_file);
console.log('\n--- Login Status ---');
console.log('Username:', config.username || '(not set)');
console.log('MQTT User:', config.mqtt_user || '(not set)');
console.log('Cloud Region:', config.cloud_region || '(not set)');

console.log('\n--- Token Status ---');
if (config.access_token) {
    console.log('✅ Access Token: Present (length:', config.access_token.length, ')');
    console.log('   First 20 chars:', config.access_token.substring(0, 20) + '...');
} else {
    console.log('❌ Access Token: NOT FOUND');
}

if (config.refresh_token) {
    console.log('✅ Refresh Token: Present (length:', config.refresh_token.length, ')');
} else {
    console.log('⚠️  Refresh Token: NOT FOUND');
}

if (config.token_expires_at) {
    const expiresDate = new Date(config.token_expires_at);
    const now = new Date();
    const isExpired = now > expiresDate;
    console.log('Token Expires At:', expiresDate.toISOString());
    console.log('Current Time:', now.toISOString());
    if (isExpired) {
        console.log('❌ Token Status: EXPIRED');
    } else {
        const remainingMs = config.token_expires_at - Date.now();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`✅ Token Status: Valid (${remainingHours}h ${remainingMinutes}m remaining)`);
    }
} else {
    console.log('⚠️  Token Expiry: NOT SET');
}

console.log('\n--- Printers ---');
console.log('Number of machines:', config.machines.length);
config.machines.forEach((machine, index) => {
    console.log(`  ${index + 1}. ${machine.name || '(unnamed)'} (${machine.id})`);
    console.log(`     IP: ${machine.ip || '(not set)'}`);
});

console.log('\n--- Diagnosis ---');
if (!config.access_token) {
    console.log('❌ PROBLEM: access_token is missing from config file.');
    console.log('   This means the login did not save the token correctly.');
    console.log('   Solution: Re-login using the frontend UI.');
} else if (config.token_expires_at && Date.now() > config.token_expires_at) {
    console.log('❌ PROBLEM: access_token has expired.');
    console.log('   Solution: Re-login to get a fresh token.');
} else {
    console.log('✅ Config looks good! Cloud MQTT control should work.');
}
