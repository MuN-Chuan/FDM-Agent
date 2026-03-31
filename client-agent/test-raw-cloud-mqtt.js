const mqtt = require('mqtt');
const fs = require('fs');
const os = require('os');
const xdgAppPaths = require('xdg-app-paths/cjs');
const path = require('path');

const dirs = xdgAppPaths('bambu-cli');
let configPath = path.join(dirs.config(), 'config.json');
const cliConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Connect to AWS Bambu Cloud MQTT
const host = cliConfig.cloud_region === 'cn' ? 'cn.mqtt.bambulab.com' : "us.mqtt.bambulab.com";
const port = 8883;

const client = mqtt.connect(`mqtts://${host}:${port}`, {
    username: cliConfig.username,
    password: cliConfig.access_token,
    clientId: 'bambu-cli-test-' + Math.random().toString(36).substring(7),
    rejectUnauthorized: false
});

client.on('connect', () => {
    console.log('Connected to Cloud MQTT!');
    const printerId = '01P09C4A2300849'; // P1S
    const topic = `device/${printerId}/request`;
    
    // Listen to responses
    client.subscribe(`device/${printerId}/report`);
    
    const command = {
        print: {
            command: "gcode_line",
            param: "G28 \n",
            sequence_id: "99999",
            user_id: cliConfig.mqtt_user
        }
    };
    
    console.log(`Sending G28 to ${topic}...`);
    client.publish(topic, JSON.stringify(command));
});

client.on('message', (t, m) => {
    const payload = m.toString();
    if (payload.includes('push_status')) return; // ignore static status
    console.log(`[${t}] ${payload}`);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
