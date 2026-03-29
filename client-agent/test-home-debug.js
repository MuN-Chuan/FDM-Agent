/**
 * Debug script for printer home command
 * Shows detailed MQTT communication
 */

const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const xdgAppPaths = require('xdg-app-paths/cjs');

function getBambuCliConfigFile() {
    const xdg = xdgAppPaths({ name: 'bambu-cli' });
    const configDir = xdg.config({ name: 'bambu-cli' });
    return path.join(configDir, 'config.json');
}

function readBambuCliConfig() {
    const configFile = getBambuCliConfigFile();
    if (!fs.existsSync(configFile)) {
        throw new Error('Config file not found. Please login first.');
    }
    
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    return {
        username: parsed.username,
        mqtt_user: parsed.mqtt_user,
        cloud_region: parsed.cloud_region || 'global',
        access_token: parsed.access_token,
        machines: parsed.machines || [],
    };
}

function getBambuCloudMqttBroker(region) {
    return region === 'cn'
        ? 'mqtts://cn.mqtt.bambulab.com:8883'
        : 'mqtts://us.mqtt.bambulab.com:8883';
}

async function testHomeCommand() {
    console.log('=== Testing Printer Home Command (Debug Mode) ===\n');
    
    const config = readBambuCliConfig();
    console.log('Config loaded:');
    console.log('  Username:', config.username);
    console.log('  MQTT User:', config.mqtt_user);
    console.log('  Region:', config.cloud_region);
    console.log('  Access Token:', config.access_token ? `${config.access_token.substring(0, 20)}...` : 'NOT FOUND');
    console.log('  Machines:', config.machines.length);
    
    if (!config.access_token || !config.mqtt_user) {
        throw new Error('Not logged in or access token not available. Please login again.');
    }
    
    const printer = config.machines[0];
    if (!printer) {
        throw new Error('No printers found in config');
    }
    
    console.log('\nTarget Printer:');
    console.log('  ID:', printer.id);
    console.log('  Name:', printer.name);
    console.log('  Cloud Online:', printer.cloud_online);
    console.log('  IP:', printer.ip || 'N/A');
    
    const broker = getBambuCloudMqttBroker(config.cloud_region);
    console.log('\nConnecting to:', broker);
    
    return new Promise((resolve, reject) => {
        const client = mqtt.connect(broker, {
            username: config.mqtt_user,
            password: config.access_token,
            rejectUnauthorized: false,
            connectTimeout: 10000,
        });
        
        let messageCount = 0;
        
        client.on('error', (error) => {
            console.error('\n✗ MQTT Error:', error.message);
            client.end();
            reject(error);
        });
        
        client.on('connect', () => {
            console.log('✓ Connected to cloud MQTT\n');
            
            const reportTopic = `device/${printer.id}/report`;
            const requestTopic = `device/${printer.id}/request`;
            
            console.log('Subscribing to:', reportTopic);
            client.subscribe(reportTopic, (err) => {
                if (err) {
                    console.error('✗ Subscribe failed:', err.message);
                    client.end();
                    reject(err);
                    return;
                }
                
                console.log('✓ Subscribed successfully\n');
                
                // Prepare command with user_id
                const command = {
                    print: {
                        sequence_id: '0',
                        command: 'gcode_line',
                        param: 'G28',
                        user_id: config.mqtt_user
                    }
                };
                
                console.log('Sending command to:', requestTopic);
                console.log('Command:', JSON.stringify(command, null, 2));
                
                client.publish(requestTopic, JSON.stringify(command), (err) => {
                    if (err) {
                        console.error('\n✗ Publish failed:', err.message);
                        client.end();
                        reject(err);
                        return;
                    }
                    
                    console.log('\n✓ Command published successfully');
                    console.log('\nWaiting for response...\n');
                });
            });
        });
        
        client.on('message', (topic, message) => {
            messageCount++;
            console.log(`[Message ${messageCount}] Topic: ${topic}`);
            
            try {
                const response = JSON.parse(message.toString());
                console.log('Response:', JSON.stringify(response, null, 2));
                
                // Check if this is a response to our command
                if (response.print && response.print.command === 'gcode_line') {
                    console.log('\n✓ Received gcode_line response!');
                    client.end();
                    resolve(response);
                }
            } catch (error) {
                console.log('Raw message:', message.toString().substring(0, 200));
            }
            
            console.log('---\n');
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            console.log('\n⏱ Timeout after 30 seconds');
            console.log(`Received ${messageCount} messages total`);
            client.end();
            reject(new Error('Timeout'));
        }, 30000);
    });
}

// Run test
testHomeCommand()
    .then(() => {
        console.log('\n=== Test Completed ===');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n=== Test Failed ===');
        console.error(error.message);
        process.exit(1);
    });
