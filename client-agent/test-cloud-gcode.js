/**
 * 测试云端 MQTT G-code 控制
 * 
 * 使用方法:
 *   node test-cloud-gcode.js
 */

const path = require('path');
const fs = require('fs');
const xdgAppPaths = require('xdg-app-paths/cjs');

function getBambuCliConfigFile() {
    const xdg = xdgAppPaths({ name: 'bambu-cli' });
    const configDir = xdg.config({ name: 'bambu-cli' });
    return path.join(configDir, 'config.json');
}

function readBambuCliConfig() {
    const configFile = getBambuCliConfigFile();
    if (!fs.existsSync(configFile)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (error) {
        return null;
    }
}

console.log('=== Bambu Cloud G-code Control Test ===\n');

const config = readBambuCliConfig();

if (!config) {
    console.log('❌ Config file not found');
    console.log('   Please login first using: node test-cloud-control.js');
    process.exit(1);
}

console.log('--- Configuration Status ---');
console.log(`✅ Config file: ${getBambuCliConfigFile()}`);
console.log(`✅ Username: ${config.username || 'Not set'}`);
console.log(`✅ MQTT User: ${config.mqtt_user || 'Not set'}`);
console.log(`✅ Region: ${config.cloud_region || 'global'}`);

if (!config.access_token) {
    console.log('\n❌ Access token not found');
    console.log('   Please login first');
    process.exit(1);
}

console.log(`✅ Access Token: Present (length: ${config.access_token.length})`);

if (config.token_expires_at) {
    const now = Date.now();
    const expiresAt = config.token_expires_at;
    const remaining = expiresAt - now;
    
    if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`✅ Token Status: Valid (${hours}h ${minutes}m remaining)`);
    } else {
        console.log('❌ Token Status: Expired');
        console.log('   Please login again');
        process.exit(1);
    }
}

if (!config.machines || config.machines.length === 0) {
    console.log('\n❌ No printers found');
    console.log('   Please login first to bind printers');
    process.exit(1);
}

console.log(`\n--- Printers (${config.machines.length}) ---`);
config.machines.forEach((machine, index) => {
    console.log(`${index + 1}. ${machine.name} (${machine.id})`);
    console.log(`   Model: ${machine.make || machine.model}`);
    console.log(`   Cloud Online: ${machine.cloud_online ? '✅' : '❌'}`);
    console.log(`   LAN Online: ${machine.ip ? '✅ ' + machine.ip : '❌'}`);
});

const cloudOnlinePrinters = config.machines.filter(m => m.cloud_online);

if (cloudOnlinePrinters.length === 0) {
    console.log('\n❌ No cloud-online printers found');
    console.log('   Please ensure at least one printer is online');
    process.exit(1);
}

console.log('\n--- Cloud G-code Control Test ---');
console.log('✅ Configuration is valid for cloud G-code control');
console.log('\n📝 Command Format:');
console.log('   {');
console.log('     "print": {');
console.log('       "sequence_id": "0",');
console.log('       "command": "gcode_line",');
console.log('       "param": "G28"  // G-code command');
console.log('     }');
console.log('   }');

console.log('\n💡 Test Commands:');
console.log('   1. Home (归零): G28');
console.log('   2. Move X+10mm: G91\\nG1 X10 F3000\\nG90');
console.log('   3. Move Y+10mm: G91\\nG1 Y10 F3000\\nG90');
console.log('   4. Move Z+10mm: G91\\nG1 Z10 F3000\\nG90');

console.log('\n⚠️  Important Notes:');
console.log('   - G-code commands use "print.gcode_line" (not "system.gcode_line")');
console.log('   - Movement commands require printer to be homed first (G28)');
console.log('   - Use relative positioning (G91) for incremental moves');
console.log('   - Return to absolute positioning (G90) after moves');

console.log('\n✅ Ready to test cloud G-code control!');
console.log('   Use the frontend UI or send commands via WebSocket');
