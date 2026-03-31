const { runStudioCloudCommand } = require('./src/handlers/studio');
const fs = require('fs');

let config = {};
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (e) {
    console.error('No config.json found');
}

async function run() {
    const machine = { id: '0309AA3C1400422' };
    console.log('Testing back_to_center via cloud_send...');
    try {
        const cmd = { print: { command: 'back_to_center' }, sequence_id: '99999' };
        const result = await runStudioCloudCommand(machine, cmd, config);
        console.log('Result:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
