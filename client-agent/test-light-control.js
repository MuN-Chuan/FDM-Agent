/**
 * Test script to control printer light via cloud MQTT
 */

const WebSocket = require('ws');

const PRINTER_ID = '0309AA3C1400422'; // A1M printer ID

function testLightControl(mode) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:7890');
        let timeout;

        ws.on('open', () => {
            console.log(`\n=== Testing Light Control (mode: ${mode}) ===`);
            console.log('Connected to client-agent');
            
            // Send light control command
            ws.send(JSON.stringify({
                cmd: 'printer_light_control',
                printer_id: PRINTER_ID,
                mode: mode
            }));
            
            // Set timeout
            timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Command timeout'));
            }, 30000);
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'hello') {
                console.log('Agent version:', message.version);
                console.log('Capabilities:', message.capabilities);
            } else if (message.cmd === 'printer_light_control') {
                if (message.type === 'progress') {
                    console.log('[Progress]', message.message);
                } else if (message.type === 'done') {
                    clearTimeout(timeout);
                    console.log('\n✅ Success!');
                    console.log('Message:', message.message);
                    console.log('Data:', JSON.stringify(message.data, null, 2));
                    ws.close();
                    resolve(message.data);
                } else if (message.type === 'error') {
                    clearTimeout(timeout);
                    console.log('\n❌ Error!');
                    console.log('Message:', message.message);
                    ws.close();
                    reject(new Error(message.message));
                }
            }
        });

        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error('WebSocket error:', error.message);
            reject(error);
        });

        ws.on('close', () => {
            console.log('Disconnected from client-agent\n');
        });
    });
}

async function main() {
    console.log('='.repeat(60));
    console.log('Bambu Printer Light Control Test via Cloud MQTT');
    console.log('='.repeat(60));
    console.log('Printer ID:', PRINTER_ID);
    console.log('Printer Name: A1M');
    
    try {
        // Test turning light ON
        await testLightControl('on');
        
        // Wait a bit
        console.log('Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test turning light OFF
        await testLightControl('off');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed successfully!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ Test failed:', error.message);
        console.error('='.repeat(60));
        
        if (error.message.includes('Not logged in') || error.message.includes('expired')) {
            console.log('\n💡 Tip: You need to login first to get a valid access token.');
            console.log('The access token is required for cloud MQTT control.');
            console.log('Please run the printer_login command through the client-agent.');
        }
        
        process.exit(1);
    }
}

main();
