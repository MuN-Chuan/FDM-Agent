const { runStudioCloudCommand } = require('./src/handlers/studio');
const fs = require('fs');
const os = require('os');
const path = require('path');
const xdgAppPaths = require('xdg-app-paths/cjs');

let sysConfig = {};
try { sysConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8')); } catch (e) {}

const dirs = xdgAppPaths('bambu-cli');
let configPath = path.join(dirs.config(), 'config.json');
if (!fs.existsSync(configPath)) { configPath = path.join(os.homedir(), '.bambu-cli', 'config.json'); }
const cliConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function test(paramStr, cmdObj = null) {
    const machine = { id: '01P09C4A2300849' }; // P1S
    console.log(`\nTesting: ${paramStr || JSON.stringify(cmdObj)}`);
    try {
        const cmd = cmdObj || { 
            print: { 
                command: 'gcode_line', 
                param: paramStr, 
                sequence_id: Math.floor(Math.random() * 10000).toString(),
                user_id: cliConfig.mqtt_user
            } 
        };
        const result = await runStudioCloudCommand(machine, cmd, sysConfig);
        console.log(`[SUCCESS] send_ret=${result.send_ret}, response=${result.response}`);
    } catch (e) {
        console.error(`[FAILED]`, e.message.substring(0, 150));
    }
}

async function run() {
    await test('G28');
    await test('G28 \n');
    await test('G28\n');
    await test(null, { print: { command: "cmd_gcode", param: "G28 \n", sequence_id: "555", user_id: cliConfig.mqtt_user }});
    await test(null, { print: { command: "print_start",  sequence_id: "555", user_id: cliConfig.mqtt_user }}); // Just to see if it rejects
}
run();
