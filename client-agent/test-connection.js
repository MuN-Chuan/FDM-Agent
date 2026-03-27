/**
 * Test script to check printer connection status
 */

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:7890');

ws.on('open', () => {
    console.log('Connected to client-agent');
    
    // Request printer status
    ws.send(JSON.stringify({
        cmd: 'printer_status'
    }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'hello') {
        console.log('\n=== Agent Hello ===');
        console.log('Version:', message.version);
        console.log('Capabilities:', message.capabilities);
        console.log('Config:', message.config);
        console.log('==================\n');
    } else if (message.cmd === 'printer_status') {
        if (message.type === 'done') {
            console.log('\n=== Printer Status ===');
            console.log('Account:', message.data.username);
            console.log('Region:', message.data.cloud_region);
            console.log('Login Required:', message.data.login_required);
            console.log('Printers Found:', message.data.statuses.length);
            console.log('\n--- Printer Details ---');
            
            message.data.statuses.forEach((printer, index) => {
                console.log(`\nPrinter ${index + 1}:`);
                console.log('  ID:', printer.id);
                console.log('  Name:', printer.name);
                console.log('  Model:', printer.make);
                console.log('  IP:', printer.ip);
                console.log('  IP Source:', printer.ip_source);
                console.log('  Online:', printer.online);
                console.log('  Cloud Online:', printer.cloud_online);
                console.log('  LAN Online:', printer.lan_online);
                console.log('  FTP:', printer.ftp);
                console.log('  MQTT:', printer.mqtt);
                console.log('  Printing Stage:', printer.printing_stage);
                console.log('  Task:', printer.task_name);
                console.log('  Progress:', printer.progress_percent);
                console.log('  AMS Modules:', printer.ams_modules);
                console.log('  Active Tray:', printer.active_tray);
            });
            
            console.log('\n===================\n');
            
            // Close connection
            setTimeout(() => {
                ws.close();
                process.exit(0);
            }, 1000);
        } else if (message.type === 'progress') {
            console.log('[Progress]', message.message);
        }
    }
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('Disconnected from client-agent');
});
