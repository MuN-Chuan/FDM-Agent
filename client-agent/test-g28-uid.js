const { runStudioCloudCommand } = require('./src/handlers/studio');
const fs = require('fs');
const os = require('os');
const xdgAppPaths = require('xdg-app-paths/cjs');
const path = require('path');

let sysConfig = {};
try {
    sysConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (e) {}

const dirs = xdgAppPaths('bambu-cli');
let configPath = path.join(dirs.config(), 'config.json');
if (!fs.existsSync(configPath)) {
    configPath = path.join(os.homedir(), '.bambu-cli', 'config.json');
}
const cliConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function run() {
    const machine = { id: '0309AA3C1400422' };
    console.log('Testing G28 \\n via cloud_send properly formatted...');
    try {
        const cmd = { 
            print: { 
                command: 'gcode_line', 
                param: 'G28 \n', 
                sequence_id: '99999',
                user_id: cliConfig.mqtt_user
            } 
        };
        const result = await runStudioCloudCommand(machine, cmd, sysConfig);
        console.log('Result:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
