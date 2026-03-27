/**
 * Test script to control printer via cloud MQTT
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const xdgAppPaths = require('xdg-app-paths/cjs');

// Read bambu-cli config
function getBambuCliConfigFile() {
    const xdg = xdgAppPaths({ name: 'bambu-cli' });
    const configDir = xdg.config({ name: 'bambu-cli' });
    return path.join(configDir, 'config.json');
}

function readBambuCliConfig() {
    const configFile = getBambuCliConfigFile();
    if (!fs.existsSync(configFile)) {
        throw new Error('Bambu CLI config not found. Please login first.');
    }
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function getBambuCloudMqttBroker(region) {
    return region === 'cn'
        ? 'mqtts://cn.mqtt.bambulab.com:8883'
        : 'mqtts://us.mqtt.bambulab.com:8883';
}

// Main function
async function testCloudControl() {
    console.log('Reading Bambu CLI config...');
    const config = readBambuCliConfig();
    
    if (!config.username || !config.mqtt_user) {
        throw new Error('Not logged in. Please login first.');
    }
    
    console.log('Account:', config.username);
    console.log('MQTT User:', config.mqtt_user);
    console.log('Region:', config.cloud_region);
    console.log('Machines:', config.machines.length);
    
    if (config.machines.length === 0) {
        throw new Error('No machines found.');
    }
    
    // Find A1M printer
    const a1m = config.machines.find(m => m.name === 'A1M' || m.id === '0309AA3C1400422');
    if (!a1m) {
        throw new Error('A1M printer not found.');
    }
    
    console.log('\nTarget Printer:');
    console.log('  ID:', a1m.id);
    console.log('  Name:', a1m.name);
    console.log('  Model:', a1m.make);
    
    // Connect to cloud MQTT
    console.log('\nConnecting to Bambu Cloud MQTT...');
    const broker = getBambuCloudMqttBroker(config.cloud_region);
    console.log('Broker:', broker);
    
    // Note: We need the access token, not the device token
    // The mqtt_user is the username, and we need the access token as password
    // This is typically stored during login
    
    console.log('\n⚠️  Cloud MQTT Control Limitation:');
    console.log('Cloud MQTT requires an access token (JWT) that expires.');
    console.log('The current bambu-cli config only stores device access codes.');
    console.log('To control via cloud MQTT, we need to:');
    console.log('1. Store the access token during login');
    console.log('2. Refresh the token when it expires');
    console.log('3. Use the token to authenticate with cloud MQTT');
    
    console.log('\n💡 Alternative: Use Bambu Lab Cloud API');
    console.log('Bambu Lab provides a REST API for cloud control:');
    console.log('- Send print jobs');
    console.log('- Get printer status');
    console.log('- Control printer settings');
    console.log('However, the API documentation is not publicly available.');
    
    console.log('\n✅ Recommendation:');
    console.log('For reliable printer control, connect the printer to the same LAN.');
    console.log('LAN MQTT provides:');
    console.log('- Real-time control');
    console.log('- No token expiration issues');
    console.log('- Lower latency');
    console.log('- More reliable connection');
}

testCloudControl().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
