/**
 * Test script for printer home command
 * Tests both LAN and cloud modes
 */

const WebSocket = require('ws');

const AGENT_URL = 'ws://localhost:7890';
const PRINTER_ID = '0309AA3C1400422'; // A1 Mini (cloud-only)

async function testHomeCommand() {
    console.log('=== Testing Printer Home Command ===\n');
    
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(AGENT_URL);
        let messageCount = 0;
        
        ws.on('open', () => {
            console.log('✓ Connected to client-agent\n');
            
            // Send home command
            const command = {
                cmd: 'printer_home',
                params: {
                    printer_id: PRINTER_ID
                }
            };
            
            console.log('Sending command:', JSON.stringify(command, null, 2));
            ws.send(JSON.stringify(command));
        });
        
        ws.on('message', (data) => {
            messageCount++;
            try {
                const response = JSON.parse(data.toString());
                console.log(`\n[Message ${messageCount}]`, JSON.stringify(response, null, 2));
                
                if (response.type === 'done') {
                    console.log('\n✓ Command completed successfully!');
                    ws.close();
                    resolve(response);
                } else if (response.type === 'error') {
                    console.error('\n✗ Command failed:', response.message);
                    ws.close();
                    reject(new Error(response.message));
                }
            } catch (error) {
                console.error('Failed to parse message:', error.message);
            }
        });
        
        ws.on('error', (error) => {
            console.error('\n✗ WebSocket error:', error.message);
            reject(error);
        });
        
        ws.on('close', () => {
            console.log('\nConnection closed');
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.error('\n✗ Test timeout after 30 seconds');
                ws.close();
                reject(new Error('Test timeout'));
            }
        }, 30000);
    });
}

// Run test
testHomeCommand()
    .then(() => {
        console.log('\n=== Test Passed ===');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n=== Test Failed ===');
        console.error(error.message);
        process.exit(1);
    });
