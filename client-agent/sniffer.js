const mqtt = require('mqtt');
const fs = require('fs');

let config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (e) {
    console.error('Failed to read config.json');
    process.exit(1);
}

const machine = config.machines.find(m => m.id === '0309AA3C1400422') || config.machines[0];
if (!machine) {
    console.error('No machine found');
    process.exit(1);
}

console.log(`Connecting to mqtts://${machine.ip}:8883...`);
const client = mqtt.connect(`mqtts://${machine.ip}:8883`, {
    username: 'bblp',
    password: machine.token,
    rejectUnauthorized: false
});

client.on('connect', () => {
    console.log('Connected! Subscribing to all topics...');
    client.subscribe('#');
    console.log('--- PLEASE CLICK "HOME" IN BAMBU STUDIO NOW ---');
});

client.on('message', (topic, message) => {
    const payload = message.toString();
    console.log(`\n[${topic}]`);
    if (payload.includes('push_status')) {
        // Skip status updates to reduce noise
        return;
    }
    console.log(payload);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
