/**
 * Unit Tests for Bambu Studio Cloud Bridge Fix
 * 
 * Tests verify that:
 * 1. Studio route is available for cloud-only printers when Bambu Studio is installed
 * 2. Movement commands include cloud fallback route
 * 3. LAN-connected printers continue to work as before (preservation)
 */

const assert = require('assert');
const { describe, it } = require('node:test');
const path = require('path');
const fs = require('fs');

// Mock fs.existsSync for Bambu Studio path checking
const originalExistsSync = fs.existsSync;
let mockBambuStudioExists = true;

fs.existsSync = (filePath) => {
    if (typeof filePath === 'string' && filePath.includes('Bambu Studio')) {
        return mockBambuStudioExists;
    }
    return originalExistsSync(filePath);
};

// Import functions after mocks are set up
const printerModule = require('../src/handlers/printer');

describe('Cloud Bridge Fix: Route Availability Tests', () => {
    it('Test 1: Cloud-only printer with Studio installed - studio route should be available', () => {
        mockBambuStudioExists = true;
        
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            ip: null,
            token: '12345678'
        };
        
        const agentConfig = {
            bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
        };
        
        const availability = printerModule.createRouteAvailability(machine, null, false, agentConfig);
        
        console.log('Test 1 Results:');
        console.log('  LAN:', availability.lan);
        console.log('  Studio:', availability.studio);
        console.log('  Cloud:', availability.cloud);
        
        assert.strictEqual(availability.lan, false, 'LAN should be offline (no IP)');
        assert.strictEqual(availability.studio, true, '✅ Studio should be available for cloud-only printer');
        assert.strictEqual(availability.cloud, true, 'Cloud should be online');
    });
    
    it('Test 2: LAN-connected printer with Studio - studio route should be available (preservation)', () => {
        mockBambuStudioExists = true;
        
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            ip: '192.168.1.100',
            token: '12345678'
        };
        
        const mqttState = { mqtt: true };
        const ftpAlive = true;
        
        const agentConfig = {
            bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
        };
        
        const availability = printerModule.createRouteAvailability(machine, mqttState, ftpAlive, agentConfig);
        
        console.log('Test 2 Results:');
        console.log('  LAN:', availability.lan);
        console.log('  Studio:', availability.studio);
        console.log('  Cloud:', availability.cloud);
        
        assert.strictEqual(availability.lan, true, 'LAN should be online');
        assert.strictEqual(availability.studio, true, 'Studio should be available');
        assert.strictEqual(availability.cloud, true, 'Cloud should be online');
    });
    
    it('Test 3: Offline printer with Studio - no routes should be available (preservation)', () => {
        mockBambuStudioExists = true;
        
        const machine = {
            id: '01S00C123456',
            cloud_online: false,
            ip: null,
            token: '12345678'
        };
        
        const agentConfig = {
            bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
        };
        
        const availability = printerModule.createRouteAvailability(machine, null, false, agentConfig);
        
        console.log('Test 3 Results:');
        console.log('  LAN:', availability.lan);
        console.log('  Studio:', availability.studio);
        console.log('  Cloud:', availability.cloud);
        
        assert.strictEqual(availability.lan, false, 'LAN should be offline');
        assert.strictEqual(availability.studio, false, 'Studio should not be available (printer offline)');
        assert.strictEqual(availability.cloud, false, 'Cloud should be offline');
    });
    
    it('Test 4: Cloud-only printer without Studio - only cloud route available', () => {
        mockBambuStudioExists = false;
        
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            ip: null,
            token: '12345678'
        };
        
        const agentConfig = {
            bambu_studio_path: null
        };
        
        const availability = printerModule.createRouteAvailability(machine, null, false, agentConfig);
        
        console.log('Test 4 Results:');
        console.log('  LAN:', availability.lan);
        console.log('  Studio:', availability.studio);
        console.log('  Cloud:', availability.cloud);
        
        assert.strictEqual(availability.lan, false, 'LAN should be offline');
        assert.strictEqual(availability.studio, false, 'Studio should not be available (not installed)');
        assert.strictEqual(availability.cloud, true, 'Cloud should be online');
    });
});

describe('Cloud Bridge Fix: Command Routes Tests', () => {
    it('Test 5: Movement commands include cloud fallback', () => {
        const availability = {
            lan: false,
            studio: false,
            cloud: true
        };
        
        const routes = printerModule.buildCommandRoutes(availability);
        
        console.log('Test 5 Results:');
        console.log('  printer_home routes:', routes.printer_home);
        console.log('  move_axis routes:', routes.move_axis);
        
        assert.deepStrictEqual(routes.printer_home, ['cloud'], 
            '✅ printer_home should include cloud fallback');
        assert.deepStrictEqual(routes.move_axis, ['cloud'], 
            '✅ move_axis should include cloud fallback');
    });
    
    it('Test 6: LAN route still preferred when available (preservation)', () => {
        const availability = {
            lan: true,
            studio: true,
            cloud: true
        };
        
        const routes = printerModule.buildCommandRoutes(availability);
        
        console.log('Test 6 Results:');
        console.log('  printer_home routes:', routes.printer_home);
        console.log('  move_axis routes:', routes.move_axis);
        
        assert.deepStrictEqual(routes.printer_home, ['lan', 'studio', 'cloud'], 
            'printer_home should have all routes');
        assert.deepStrictEqual(routes.move_axis, ['lan', 'studio', 'cloud'], 
            'move_axis should have all routes');
        assert.strictEqual(routes.printer_home[0], 'lan', 
            '✅ LAN should be first priority (preservation)');
        assert.strictEqual(routes.move_axis[0], 'lan', 
            '✅ LAN should be first priority (preservation)');
    });
    
    it('Test 7: Other commands unchanged (preservation)', () => {
        const availability = {
            lan: true,
            studio: true,
            cloud: true
        };
        
        const routes = printerModule.buildCommandRoutes(availability);
        
        console.log('Test 7 Results:');
        console.log('  print_start routes:', routes.print_start);
        console.log('  set_bed_temperature routes:', routes.set_bed_temperature);
        
        // Print commands should have ['lan', 'cloud'] pattern
        assert.deepStrictEqual(routes.print_start, ['lan', 'cloud'], 
            '✅ print_start unchanged');
        assert.deepStrictEqual(routes.print_pause, ['lan', 'cloud'], 
            '✅ print_pause unchanged');
        
        // Temperature commands should only have ['lan']
        assert.deepStrictEqual(routes.set_bed_temperature, ['lan'], 
            '✅ set_bed_temperature unchanged');
        assert.deepStrictEqual(routes.set_nozzle_temperature, ['lan'], 
            '✅ set_nozzle_temperature unchanged');
    });
    
    it('Test 8: Studio route available for cloud-only printer', () => {
        const availability = {
            lan: false,
            studio: true,
            cloud: true
        };
        
        const routes = printerModule.buildCommandRoutes(availability);
        
        console.log('Test 8 Results:');
        console.log('  printer_home routes:', routes.printer_home);
        console.log('  move_axis routes:', routes.move_axis);
        
        assert.deepStrictEqual(routes.printer_home, ['studio', 'cloud'], 
            '✅ Studio route available for cloud-only printer');
        assert.deepStrictEqual(routes.move_axis, ['studio', 'cloud'], 
            '✅ Studio route available for cloud-only printer');
        assert.strictEqual(routes.printer_home[0], 'studio', 
            'Studio should be first when LAN unavailable');
    });
});

describe('Cloud Bridge Fix: Summary', () => {
    it('Summary of Fix Verification', () => {
        console.log('\n=== CLOUD BRIDGE FIX VERIFICATION ===');
        console.log('✅ Fix 1: Studio route available for cloud-only printers');
        console.log('   - createRouteAvailability now checks (lanOnline || cloudOnline)');
        console.log('   - Studio can bridge to both LAN and cloud printers');
        console.log('');
        console.log('✅ Fix 2: Movement commands include cloud fallback');
        console.log('   - printer_home: [\'lan\', \'studio\', \'cloud\']');
        console.log('   - move_axis: [\'lan\', \'studio\', \'cloud\']');
        console.log('');
        console.log('✅ Preservation: LAN-connected printers unchanged');
        console.log('   - LAN route still preferred (first in array)');
        console.log('   - Other commands maintain original routing');
        console.log('');
        console.log('✅ Preservation: Offline printers still fail');
        console.log('   - No routes available when printer is offline');
        console.log('');
        console.log('Route Priority: LAN → Studio → Cloud');
        console.log('=====================================\n');
    });
});
