const { handleCommand } = require('./src/commands');
const { prepareCommandForDispatch } = require('./src/handlers/printer');
const fs = require('fs');

let config = {};
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (e) {
    console.error('No config.json found');
}

async function run() {
    console.log('Testing printer_home...');
    let lastPush = null;
    const push = (data) => {
        // console.log('PUSH:', data);
        lastPush = data;
    };
    
    try {
        await handleCommand('printer_home', { printer_id: '0309AA3C1400422' }, push, config);
        console.log('Finished successfully. Last push state:', lastPush);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
