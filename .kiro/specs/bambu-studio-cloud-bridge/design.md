# Bambu Studio Cloud Bridge Bugfix Design

## Overview

This design document describes the implementation approach for fixing the cloud-only printer control bug. The fix enables Bambu Studio to act as a universal bridge for printer commands, supporting both LAN and cloud-connected printers, and adds cloud MQTT as a fallback route for movement commands.

## Design Goals

1. Enable cloud-only printers to execute movement commands through Bambu Studio bridge
2. Add cloud MQTT as a fallback route for movement commands
3. Preserve existing behavior for LAN-connected and offline printers
4. Maintain optimal route priority: LAN → Studio → Cloud

## Architecture Changes

### Current Architecture (Buggy)

```
┌─────────────────────────────────────────────────────────────┐
│ Command Execution Flow (Current)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  printer_home / move_axis                                   │
│         │                                                    │
│         ├─→ Route: ['lan', 'studio']                       │
│         │                                                    │
│         ├─→ LAN Available? ──Yes──→ Execute via LAN        │
│         │         │                                          │
│         │         No                                         │
│         │         │                                          │
│         └─→ Studio Available? ──Yes──→ Execute via Studio   │
│                   │                                          │
│                   No                                         │
│                   │                                          │
│                   └─→ FAIL: No routes available ❌          │
│                                                              │
│  Studio Availability Check:                                 │
│    studioAvailable = lanOnline && studioInstalled           │
│                      ^^^^^^^^^ BUG: Requires LAN            │
└─────────────────────────────────────────────────────────────┘
```

### Fixed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Command Execution Flow (Fixed)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  printer_home / move_axis                                   │
│         │                                                    │
│         ├─→ Route: ['lan', 'studio', 'cloud'] ✅           │
│         │                                                    │
│         ├─→ LAN Available? ──Yes──→ Execute via LAN        │
│         │         │                                          │
│         │         No                                         │
│         │         │                                          │
│         ├─→ Studio Available? ──Yes──→ Execute via Studio   │
│         │         │                    (LAN or Cloud)        │
│         │         No                                         │
│         │         │                                          │
│         └─→ Cloud Available? ──Yes──→ Execute via Cloud     │
│                   │                                          │
│                   No                                         │
│                   │                                          │
│                   └─→ FAIL: Printer offline                 │
│                                                              │
│  Studio Availability Check (Fixed):                         │
│    studioAvailable = (lanOnline || cloudOnline)             │
│                      && studioInstalled ✅                   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Change 1: Fix Studio Route Availability Logic

**File**: `client-agent/src/handlers/printer.js`

**Function**: `createRouteAvailability` (lines ~270-280)

**Current Implementation**:
```javascript
function createRouteAvailability(machine, mqttState, ftpAlive, agentConfig) {
    const lanOnline = Boolean(machine.ip && machine.token && (ftpAlive || mqttState?.mqtt));
    const cloudOnline = Boolean(machine.cloud_online);
    const studioAvailable = Boolean(lanOnline && isStudioLocalControlAvailable(machine, agentConfig));
    //                              ^^^^^^^^^ BUG: Requires LAN

    return {
        lan: lanOnline,
        studio: studioAvailable,
        cloud: cloudOnline,
    };
}
```

**Fixed Implementation**:
```javascript
function createRouteAvailability(machine, mqttState, ftpAlive, agentConfig) {
    const lanOnline = Boolean(machine.ip && machine.token && (ftpAlive || mqttState?.mqtt));
    const cloudOnline = Boolean(machine.cloud_online);
    
    // ✅ FIX: Studio available when installed AND printer is reachable (LAN or cloud)
    const studioAvailable = Boolean(
        isStudioLocalControlAvailable(machine, agentConfig) &&
        (lanOnline || cloudOnline)
    );

    return {
        lan: lanOnline,
        studio: studioAvailable,
        cloud: cloudOnline,
    };
}
```

**Rationale**:
- Bambu Studio can connect to printers via both LAN and cloud
- Studio should be available as a route whenever the printer is reachable
- This enables Studio to act as a universal bridge for both connection types

### Change 2: Add Cloud Fallback to Movement Commands

**File**: `client-agent/src/handlers/printer.js`

**Function**: `buildCommandRoutes` (lines ~285-295)

**Current Implementation**:
```javascript
function buildCommandRoutes(availability) {
    return {
        printer_status: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        ams_status: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_light_control: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_start: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_pause: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_resume: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_stop: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_home: resolveRoutesInPriority(availability, ['lan', 'studio']),  // ❌ No cloud
        move_axis: resolveRoutesInPriority(availability, ['lan', 'studio']),     // ❌ No cloud
        set_bed_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_nozzle_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_print_speed: resolveRoutesInPriority(availability, ['lan']),
        set_fan_speed: resolveRoutesInPriority(availability, ['lan']),
        extrude_filament: resolveRoutesInPriority(availability, ['lan']),
        send_gcode: resolveRoutesInPriority(availability, ['lan']),
    };
}
```

**Fixed Implementation**:
```javascript
function buildCommandRoutes(availability) {
    return {
        printer_status: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        ams_status: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_light_control: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_start: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_pause: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_resume: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        print_stop: resolveRoutesInPriority(availability, ['lan', 'cloud']),
        printer_home: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),  // ✅ Added cloud
        move_axis: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),     // ✅ Added cloud
        set_bed_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_nozzle_temperature: resolveRoutesInPriority(availability, ['lan']),
        set_print_speed: resolveRoutesInPriority(availability, ['lan']),
        set_fan_speed: resolveRoutesInPriority(availability, ['lan']),
        extrude_filament: resolveRoutesInPriority(availability, ['lan']),
        send_gcode: resolveRoutesInPriority(availability, ['lan']),
    };
}
```

**Rationale**:
- Cloud MQTT supports movement commands (G28 for home, G1 for axis movement)
- The `user_id` fix (from cloud-home-fix-summary.md) enables cloud G-code commands
- Provides a fallback when Studio is not available or fails

## Route Priority and Fallback Logic

### Route Selection Algorithm

The `resolveRoutesInPriority` function filters available routes based on the availability object:

```javascript
function resolveRoutesInPriority(availability, preferredRoutes) {
    return preferredRoutes.filter((route) => Boolean(availability?.[route]));
}
```

### Example Scenarios

**Scenario 1: LAN-Connected Printer**
```javascript
availability = { lan: true, studio: true, cloud: true }
routes = ['lan', 'studio', 'cloud']
result = ['lan', 'studio', 'cloud']  // LAN used first (optimal)
```

**Scenario 2: Cloud-Only Printer with Studio**
```javascript
availability = { lan: false, studio: true, cloud: true }
routes = ['lan', 'studio', 'cloud']
result = ['studio', 'cloud']  // Studio used (reliable bridge)
```

**Scenario 3: Cloud-Only Printer without Studio**
```javascript
availability = { lan: false, studio: false, cloud: true }
routes = ['lan', 'studio', 'cloud']
result = ['cloud']  // Cloud MQTT used (last resort)
```

**Scenario 4: Offline Printer**
```javascript
availability = { lan: false, studio: false, cloud: false }
routes = ['lan', 'studio', 'cloud']
result = []  // No routes available, command fails
```

## Command Execution Flow

### printer_home Command

**Current Flow (Buggy)**:
```javascript
case 'printer_home': {
    const routes = commandRoutes.printer_home;  // ['lan', 'studio']
    
    if (routes.includes('lan')) {
        // Try LAN: back_to_center command or G28
    } else if (routes.includes('studio')) {
        // Try Studio: runStudioLocalCommand
    } else {
        // ❌ FAIL: No routes available for cloud-only printer
        throw new Error('No routes available');
    }
}
```

**Fixed Flow**:
```javascript
case 'printer_home': {
    const routes = commandRoutes.printer_home;  // ['lan', 'studio', 'cloud']
    
    if (routes.includes('lan')) {
        // Try LAN: back_to_center command or G28
    } else if (routes.includes('studio')) {
        // ✅ Try Studio: Works for both LAN and cloud printers
        result = await sendCommandViaStudioPlugin(machine, backToCenterCommand, config);
    } else if (routes.includes('cloud')) {
        // ✅ Try Cloud: Send G28 via cloud MQTT with user_id
        result = await sendGcodeSequenceViaCloud(printerId, ['G28'], push);
    } else {
        // Fail: Printer is completely offline
        throw new Error('Printer is offline');
    }
}
```

### move_axis Command

**Fixed Flow**:
```javascript
case 'move_axis': {
    const routes = commandRoutes.move_axis;  // ['lan', 'studio', 'cloud']
    
    if (routes.includes('lan')) {
        // Try LAN: xyz_ctrl command or G-code sequence
    } else if (routes.includes('studio')) {
        // ✅ Try Studio: Works for both LAN and cloud printers
        result = await sendCommandViaStudioPlugin(machine, xyzCtrlCommand, config);
    } else if (routes.includes('cloud')) {
        // ✅ Try Cloud: Send G-code sequence via cloud MQTT
        const gcodeSequence = ['G91', `G1 ${axis}${distance} F${speed}`, 'G90'];
        result = await sendGcodeSequenceViaCloud(printerId, gcodeSequence, push);
    } else {
        // Fail: Printer is completely offline
        throw new Error('Printer is offline');
    }
}
```

## Testing Strategy

### Unit Tests

**Test File**: `client-agent/test/printer.test.js`

**Test 1: Studio Route Available for Cloud-Only Printer**
```javascript
describe('createRouteAvailability', () => {
    it('should enable studio route for cloud-only printer when Studio is installed', () => {
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            ip: null,
            token: '12345678'
        };
        const agentConfig = {
            bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
        };
        
        const availability = createRouteAvailability(machine, null, false, agentConfig);
        
        expect(availability.lan).toBe(false);
        expect(availability.studio).toBe(true);  // ✅ Fixed
        expect(availability.cloud).toBe(true);
    });
});
```

**Test 2: Movement Commands Include Cloud Route**
```javascript
describe('buildCommandRoutes', () => {
    it('should include cloud route for printer_home and move_axis', () => {
        const availability = { lan: false, studio: false, cloud: true };
        const routes = buildCommandRoutes(availability);
        
        expect(routes.printer_home).toEqual(['cloud']);
        expect(routes.move_axis).toEqual(['cloud']);
    });
});
```

**Test 3: LAN Route Still Preferred**
```javascript
describe('buildCommandRoutes', () => {
    it('should prefer LAN route when available', () => {
        const availability = { lan: true, studio: true, cloud: true };
        const routes = buildCommandRoutes(availability);
        
        expect(routes.printer_home).toEqual(['lan', 'studio', 'cloud']);
        expect(routes.printer_home[0]).toBe('lan');  // LAN is first
    });
});
```

### Property-Based Tests

**Test File**: `client-agent/test/preservation.test.js`

**Property 1: LAN-Connected Printers Unchanged**
```javascript
const fc = require('fast-check');

describe('Preservation: LAN-connected printers', () => {
    it('should produce same results for LAN-connected printers', () => {
        fc.assert(
            fc.property(
                fc.record({
                    machine: fc.record({
                        id: fc.string(),
                        cloud_online: fc.boolean(),
                        lan_online: fc.constant(true),  // LAN always online
                        ip: fc.ipV4(),
                        token: fc.string()
                    }),
                    command: fc.constantFrom('printer_home', 'move_axis')
                }),
                ({ machine, command }) => {
                    const availability_original = createRouteAvailability_original(machine, {mqtt: true}, true, agentConfig);
                    const availability_fixed = createRouteAvailability_fixed(machine, {mqtt: true}, true, agentConfig);
                    
                    const routes_original = buildCommandRoutes_original(availability_original);
                    const routes_fixed = buildCommandRoutes_fixed(availability_fixed);
                    
                    // LAN route should still be first
                    expect(routes_fixed[command][0]).toBe('lan');
                }
            )
        );
    });
});
```

**Property 2: Offline Printers Still Fail**
```javascript
describe('Preservation: Offline printers', () => {
    it('should fail for completely offline printers', () => {
        fc.assert(
            fc.property(
                fc.record({
                    machine: fc.record({
                        id: fc.string(),
                        cloud_online: fc.constant(false),
                        lan_online: fc.constant(false),
                        ip: fc.constant(null),
                        token: fc.string()
                    }),
                    command: fc.constantFrom('printer_home', 'move_axis')
                }),
                ({ machine, command }) => {
                    const availability = createRouteAvailability_fixed(machine, null, false, agentConfig);
                    const routes = buildCommandRoutes_fixed(availability);
                    
                    // No routes should be available
                    expect(routes[command]).toEqual([]);
                }
            )
        );
    });
});
```

### Integration Tests

**Test 1: Cloud-Only Printer Executes Home Command**
```javascript
describe('Integration: Cloud-only printer control', () => {
    it('should execute printer_home via Studio for cloud-only printer', async () => {
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            lan_online: false,
            token: '12345678'
        };
        const agentConfig = {
            bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
        };
        
        // Mock Studio command execution
        const mockStudioCommand = jest.spyOn(studio, 'runStudioLocalCommand')
            .mockResolvedValue({ success: true, response: 'OK' });
        
        const result = await handlePrinterCommand({
            cmd: 'printer_home',
            params: { printer_id: machine.id }
        }, agentConfig);
        
        expect(result.success).toBe(true);
        expect(mockStudioCommand).toHaveBeenCalled();
    });
});
```

**Test 2: Fallback to Cloud MQTT When Studio Unavailable**
```javascript
describe('Integration: Cloud MQTT fallback', () => {
    it('should fallback to cloud MQTT when Studio is not installed', async () => {
        const machine = {
            id: '01S00C123456',
            cloud_online: true,
            lan_online: false,
            token: '12345678'
        };
        const agentConfig = {
            bambu_studio_path: null  // Studio not installed
        };
        
        // Mock cloud MQTT command execution
        const mockCloudCommand = jest.spyOn(printer, 'sendGcodeSequenceViaCloud')
            .mockResolvedValue({ success: true });
        
        const result = await handlePrinterCommand({
            cmd: 'printer_home',
            params: { printer_id: machine.id }
        }, agentConfig);
        
        expect(result.success).toBe(true);
        expect(mockCloudCommand).toHaveBeenCalledWith(machine.id, ['G28'], expect.any(Function));
    });
});
```

## Error Handling

### Studio Command Failure

When Studio command fails, the system should fall back to cloud MQTT:

```javascript
try {
    result = await sendCommandViaStudioPlugin(machine, command, config);
} catch (error) {
    console.log('[printer_home] Studio command failed, falling back to cloud:', error.message);
    if (routes.includes('cloud')) {
        result = await sendGcodeSequenceViaCloud(printerId, ['G28'], push);
    } else {
        throw error;  // No fallback available
    }
}
```

### Cloud MQTT Failure

When cloud MQTT fails, there's no further fallback (it's the last resort):

```javascript
try {
    result = await sendGcodeSequenceViaCloud(printerId, ['G28'], push);
} catch (error) {
    throw new Error(`Cloud command failed: ${error.message}`);
}
```

## Performance Considerations

### Route Priority Rationale

1. **LAN (Fastest)**: Direct connection, lowest latency (~10-50ms)
2. **Studio (Reliable)**: Local bridge, moderate latency (~100-200ms)
3. **Cloud (Slowest)**: Internet round-trip, highest latency (~500-2000ms)

### No Performance Regression

- LAN-connected printers continue to use LAN route (no change)
- Studio route is only used when LAN is unavailable
- Cloud route is only used as last resort

## Security Considerations

### Studio Bridge Security

- Studio uses the same authentication as direct LAN/cloud connections
- No additional credentials are exposed
- Studio must be installed locally (user's machine)

### Cloud MQTT Security

- Requires valid `access_token` and `mqtt_user` (from bambu-cli config)
- Commands include `user_id` field for authentication
- Uses TLS encryption (mqtts://)

## Backward Compatibility

### Preserved Behaviors

1. **LAN-connected printers**: Continue to use LAN route (fastest)
2. **Offline printers**: Continue to fail with "no routes available"
3. **Other commands**: No changes to routing logic
4. **Configuration**: No new config fields required

### Breaking Changes

None. This is a pure bug fix that enables previously broken functionality.

## Dependencies

### Existing Functions (No Changes Required)

- `runStudioLocalCommand(machine, command, config)`: Already supports both LAN and cloud printers
- `sendGcodeSequenceViaCloud(printerId, lines, push)`: Already supports cloud G-code with `user_id`
- `isStudioLocalControlAvailable(machine, agentConfig)`: Already checks if Studio is installed

### External Dependencies

- Bambu Studio must be installed locally for Studio route
- bambu-cli config must have valid cloud credentials for cloud route

## Rollout Plan

### Phase 1: Implementation
1. Modify `createRouteAvailability` function
2. Modify `buildCommandRoutes` function
3. Add unit tests

### Phase 2: Testing
1. Run unit tests
2. Run property-based tests
3. Run integration tests

### Phase 3: Validation
1. Test with real cloud-only printer
2. Test with real LAN-connected printer
3. Test with offline printer
4. Verify no performance regression

### Phase 4: Deployment
1. Merge changes to main branch
2. Update documentation
3. Release new client-agent version

## Success Metrics

1. ✅ Cloud-only printers can execute movement commands
2. ✅ Studio route available for cloud-only printers
3. ✅ Cloud route available as fallback
4. ✅ LAN route still preferred (no performance regression)
5. ✅ All tests pass (unit, property-based, integration)
6. ✅ No breaking changes to existing functionality
