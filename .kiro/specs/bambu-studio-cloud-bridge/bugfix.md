# Bambu Studio Cloud Bridge Bugfix Requirements

## 1. Bug Summary

Cloud-only printers (printers with `cloud_online=true` but `lan_online=false`) cannot execute movement commands like `printer_home` and `move_axis` because the routing logic incorrectly prevents using Bambu Studio as a cloud bridge.

## 2. Current Behavior (Buggy)

### Symptoms
- Movement commands (`printer_home`, `move_axis`) fail on cloud-only printers
- Error occurs even when Bambu Studio is installed and can connect to the cloud printer
- Commands work fine when printer has LAN connectivity

### Observable Behavior
```javascript
// For a cloud-only printer:
{
  cloud_online: true,
  lan_online: false,
  studio_available: false  // ❌ Incorrectly false
}

// Command routes for printer_home:
printer_home: ['lan', 'studio']  // ❌ No available routes for cloud-only printer
```

### Code Location
File: `client-agent/src/handlers/printer.js`

**Function 1: `createRouteAvailability`** (lines ~270-280)
```javascript
function createRouteAvailability(machine, mqttState, ftpAlive, agentConfig) {
    const lanOnline = Boolean(machine.ip && machine.token && (ftpAlive || mqttState?.mqtt));
    const cloudOnline = Boolean(machine.cloud_online);
    const studioAvailable = Boolean(lanOnline && isStudioLocalControlAvailable(machine, agentConfig));
    //                              ^^^^^^^^^ ❌ BUG: Requires LAN to be online

    return {
        lan: lanOnline,
        studio: studioAvailable,
        cloud: cloudOnline,
    };
}
```

**Function 2: `buildCommandRoutes`** (lines ~285-295)
```javascript
function buildCommandRoutes(availability) {
    return {
        // ... other commands ...
        printer_home: resolveRoutesInPriority(availability, ['lan', 'studio']),
        //                                                    ^^^^^^^^^^^^^^^^ ❌ No cloud fallback
        move_axis: resolveRoutesInPriority(availability, ['lan', 'studio']),
        //                                                 ^^^^^^^^^^^^^^^^ ❌ No cloud fallback
        // ... other commands ...
    };
}
```

## 3. Expected Behavior (Fixed)

### Desired Outcome
- Cloud-only printers should be able to execute movement commands through Bambu Studio
- Bambu Studio acts as a bridge, connecting to the cloud printer and relaying commands
- Route priority: LAN direct → Bambu Studio (works for both LAN and cloud) → Cloud MQTT direct

### Expected Behavior
```javascript
// For a cloud-only printer with Bambu Studio installed:
{
  cloud_online: true,
  lan_online: false,
  studio_available: true  // ✅ Correctly true when Bambu Studio is installed
}

// Command routes for printer_home:
printer_home: ['lan', 'studio', 'cloud']  // ✅ Studio and cloud available as fallbacks
```

## 4. Bug Condition C(X)

### Formal Definition

The bug condition C(X) is true when:

```
C(X) = machine.cloud_online == true
       AND machine.lan_online == false
       AND isLocalBambuStudioAvailable(agentConfig) == true
       AND command IN ['printer_home', 'move_axis']
       AND commandExecution(machine, command) == FAILURE
```

Where:
- `machine`: Printer configuration object
- `command`: The command being executed
- `isLocalBambuStudioAvailable(agentConfig)`: Returns true if Bambu Studio is installed locally
- `commandExecution(machine, command)`: Attempts to execute the command and returns SUCCESS or FAILURE

### Input Domain

**Valid Inputs:**
- `machine`: Object with properties:
  - `id`: string (printer serial number)
  - `cloud_online`: boolean
  - `lan_online`: boolean (derived from `ip`, `token`, and connectivity checks)
  - `ip`: string | null
  - `token`: string (access code)
- `agentConfig`: Object with properties:
  - `bambu_studio_path`: string (path to Bambu Studio executable)
- `command`: One of `['printer_home', 'move_axis', 'set_bed_temperature', ...]`

**Bug-Triggering Inputs (Examples):**

1. **Cloud-only printer with Bambu Studio installed:**
   ```javascript
   {
     machine: {
       id: '01S00C123456',
       cloud_online: true,
       lan_online: false,
       ip: null,
       token: '12345678'
     },
     agentConfig: {
       bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
     },
     command: 'printer_home'
   }
   ```

2. **Printer with stale LAN IP but cloud online:**
   ```javascript
   {
     machine: {
       id: '01S00C789012',
       cloud_online: true,
       lan_online: false,  // LAN connection failed
       ip: '192.168.1.100',  // Stale IP
       token: '87654321'
     },
     agentConfig: {
       bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
     },
     command: 'move_axis'
   }
   ```

### Non-Bug Inputs (Should be preserved)

1. **LAN-connected printer:**
   ```javascript
   {
     machine: { cloud_online: true, lan_online: true, ... },
     command: 'printer_home'
   }
   // Expected: Uses LAN route (fastest), should continue to work
   ```

2. **Offline printer:**
   ```javascript
   {
     machine: { cloud_online: false, lan_online: false, ... },
     command: 'printer_home'
   }
   // Expected: Fails with "no routes available", should continue to fail
   ```

3. **Cloud-only printer without Bambu Studio:**
   ```javascript
   {
     machine: { cloud_online: true, lan_online: false, ... },
     agentConfig: { bambu_studio_path: null },
     command: 'printer_home'
   }
   // Expected: Should now use cloud route as fallback
   ```

## 5. Root Cause Analysis

### Primary Root Cause

**Issue 1: Studio Route Incorrectly Requires LAN Connectivity**

Location: `createRouteAvailability` function

```javascript
const studioAvailable = Boolean(lanOnline && isStudioLocalControlAvailable(machine, agentConfig));
//                              ^^^^^^^^^ This is the bug
```

**Why this is wrong:**
- Bambu Studio can connect to printers via both LAN and cloud
- The current logic assumes Studio can only control LAN-connected printers
- This prevents using Studio as a cloud bridge for cloud-only printers

**Evidence:**
- Bambu Studio's own UI successfully controls cloud-only printers
- The `runStudioLocalCommand` function doesn't require LAN connectivity
- The documentation (cloud-home-fix-summary.md) shows cloud MQTT commands work through Studio

### Secondary Root Cause

**Issue 2: Movement Commands Don't Include Cloud Fallback**

Location: `buildCommandRoutes` function

```javascript
printer_home: resolveRoutesInPriority(availability, ['lan', 'studio']),
move_axis: resolveRoutesInPriority(availability, ['lan', 'studio']),
```

**Why this is wrong:**
- Other commands like `print_start`, `print_pause` include cloud fallback: `['lan', 'cloud']`
- Movement commands should also support cloud MQTT as a last resort
- The cloud-home-fix-summary.md shows that cloud MQTT commands (with `user_id`) work for movement

**Evidence:**
- The `sendGcodeLineViaCloud` function exists and works for G-code commands
- Cloud MQTT successfully sends `G28` (home) command when `user_id` is included
- The fix in cloud-home-fix-summary.md proves cloud movement commands are viable

## 6. Hypothesized Fix

### Fix Strategy

**Change 1: Decouple Studio Availability from LAN Status**

Modify `createRouteAvailability` to allow Studio route when Bambu Studio is installed, regardless of LAN connectivity:

```javascript
function createRouteAvailability(machine, mqttState, ftpAlive, agentConfig) {
    const lanOnline = Boolean(machine.ip && machine.token && (ftpAlive || mqttState?.mqtt));
    const cloudOnline = Boolean(machine.cloud_online);
    
    // ✅ FIX: Studio available if installed, works for both LAN and cloud
    const studioAvailable = Boolean(
        isStudioLocalControlAvailable(machine, agentConfig) &&
        (lanOnline || cloudOnline)  // Studio can bridge to either LAN or cloud
    );

    return {
        lan: lanOnline,
        studio: studioAvailable,
        cloud: cloudOnline,
    };
}
```

**Change 2: Add Cloud Fallback to Movement Commands**

Modify `buildCommandRoutes` to include cloud as a fallback for movement commands:

```javascript
function buildCommandRoutes(availability) {
    return {
        // ... other commands ...
        
        // ✅ FIX: Add cloud fallback for movement commands
        printer_home: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        move_axis: resolveRoutesInPriority(availability, ['lan', 'studio', 'cloud']),
        
        // ... other commands ...
    };
}
```

### Why This Fix Works

1. **Studio as Universal Bridge**: Bambu Studio can connect to printers via both LAN and cloud, so it should be available whenever the printer is reachable (LAN or cloud)

2. **Graceful Degradation**: The route priority ensures optimal performance:
   - LAN direct (fastest, lowest latency)
   - Studio bridge (works for both LAN and cloud, reliable)
   - Cloud MQTT direct (slowest, but works as last resort)

3. **Backward Compatibility**: Existing behavior is preserved:
   - LAN-connected printers continue to use LAN route (fastest)
   - Offline printers still fail appropriately
   - No changes to other command types

## 7. Correctness Properties

### Property 1: Bug Condition - Cloud-Only Movement Commands Succeed

**Statement**: For any input where C(X) is true (cloud-only printer with Bambu Studio installed), the fixed system SHALL successfully execute movement commands through either the Studio or cloud route.

**Formal Specification**:
```
∀ input WHERE C(input):
  result = executeCommand_fixed(input.machine, input.command)
  ASSERT result.success == true
  ASSERT result.route IN ['studio', 'cloud']
```

**Validates**: The core bug fix - cloud-only printers can now execute movement commands

### Property 2: Preservation - LAN-Connected Printers Unchanged

**Statement**: For any input where the printer has LAN connectivity, the fixed system SHALL produce the same behavior as the original system, preferring the LAN route.

**Formal Specification**:
```
∀ input WHERE input.machine.lan_online == true:
  result_original = executeCommand_original(input.machine, input.command)
  result_fixed = executeCommand_fixed(input.machine, input.command)
  ASSERT result_original == result_fixed
  ASSERT result_fixed.route == 'lan'  // LAN still preferred
```

**Validates**: Existing LAN connectivity behavior is preserved

### Property 3: Preservation - Offline Printers Still Fail

**Statement**: For any input where the printer is completely offline (no LAN, no cloud), the fixed system SHALL fail in the same way as the original system.

**Formal Specification**:
```
∀ input WHERE input.machine.lan_online == false AND input.machine.cloud_online == false:
  result_original = executeCommand_original(input.machine, input.command)
  result_fixed = executeCommand_fixed(input.machine, input.command)
  ASSERT result_original == result_fixed
  ASSERT result_fixed.success == false
  ASSERT result_fixed.error CONTAINS 'no routes available'
```

**Validates**: Offline detection is preserved

### Property 4: Preservation - Other Commands Unchanged

**Statement**: For any command that is NOT `printer_home` or `move_axis`, the fixed system SHALL produce identical behavior to the original system.

**Formal Specification**:
```
∀ input WHERE input.command NOT IN ['printer_home', 'move_axis']:
  result_original = executeCommand_original(input.machine, input.command)
  result_fixed = executeCommand_fixed(input.machine, input.command)
  ASSERT result_original == result_fixed
```

**Validates**: Other command types are not affected by this fix

## 8. Testing Strategy

### Phase 1: Exploratory Bug Condition Checking

**Goal**: Confirm the bug exists on unfixed code by demonstrating that cloud-only printers fail to execute movement commands.

**Test Cases**:

1. **Test: Cloud-only printer with Studio installed fails on unfixed code**
   ```javascript
   // Setup
   const machine = {
     id: '01S00C123456',
     cloud_online: true,
     lan_online: false,
     token: '12345678'
   };
   const agentConfig = {
     bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe'
   };
   
   // Execute on UNFIXED code
   const result = await executeCommand(machine, 'printer_home');
   
   // Expected: FAILURE (demonstrates bug)
   expect(result.success).toBe(false);
   expect(result.error).toContain('no routes available');
   ```

2. **Test: Studio route unavailable for cloud-only printer on unfixed code**
   ```javascript
   const availability = createRouteAvailability(machine, null, false, agentConfig);
   
   // Expected on UNFIXED code: studio is false
   expect(availability.studio).toBe(false);  // ❌ Bug demonstrated
   expect(availability.cloud).toBe(true);
   ```

### Phase 2: Fix Checking

**Goal**: Verify that the fix resolves the bug for all cloud-only scenarios.

**Test Cases**:

1. **Test: Cloud-only printer with Studio succeeds on fixed code**
   ```javascript
   const result = await executeCommand_fixed(machine, 'printer_home');
   
   // Expected: SUCCESS via studio or cloud route
   expect(result.success).toBe(true);
   expect(['studio', 'cloud']).toContain(result.route);
   ```

2. **Test: Studio route available for cloud-only printer on fixed code**
   ```javascript
   const availability = createRouteAvailability_fixed(machine, null, false, agentConfig);
   
   // Expected on FIXED code: studio is true
   expect(availability.studio).toBe(true);  // ✅ Fix verified
   expect(availability.cloud).toBe(true);
   ```

3. **Test: Movement commands include cloud fallback on fixed code**
   ```javascript
   const routes = buildCommandRoutes_fixed(availability);
   
   // Expected: cloud is in the route list
   expect(routes.printer_home).toContain('cloud');
   expect(routes.move_axis).toContain('cloud');
   ```

### Phase 3: Preservation Checking

**Goal**: Verify that non-buggy scenarios continue to work as before.

**Property-Based Test Strategy**:

```javascript
// Generate many random printer configurations
property('LAN-connected printers unchanged', () => {
  const machine = generateRandomMachine({ lan_online: true });
  const command = randomCommand();
  
  const result_original = executeCommand_original(machine, command);
  const result_fixed = executeCommand_fixed(machine, command);
  
  expect(result_original).toEqual(result_fixed);
});

property('Offline printers still fail', () => {
  const machine = generateRandomMachine({ 
    lan_online: false, 
    cloud_online: false 
  });
  const command = randomCommand();
  
  const result_original = executeCommand_original(machine, command);
  const result_fixed = executeCommand_fixed(machine, command);
  
  expect(result_original).toEqual(result_fixed);
  expect(result_fixed.success).toBe(false);
});

property('Other commands unchanged', () => {
  const machine = generateRandomMachine();
  const command = randomCommandExcept(['printer_home', 'move_axis']);
  
  const result_original = executeCommand_original(machine, command);
  const result_fixed = executeCommand_fixed(machine, command);
  
  expect(result_original).toEqual(result_fixed);
});
```

### Integration Tests

1. **Test: Full command execution flow for cloud-only printer**
   - Setup: Mock Bambu Studio and cloud MQTT
   - Execute: Send `printer_home` command to cloud-only printer
   - Verify: Command reaches printer via Studio or cloud route
   - Verify: Printer responds with success

2. **Test: Route fallback behavior**
   - Setup: Cloud-only printer with Studio installed
   - Execute: Disable Studio temporarily, send command
   - Verify: Falls back to cloud MQTT route
   - Verify: Command still succeeds

3. **Test: Multi-printer scenario**
   - Setup: Mix of LAN, cloud-only, and offline printers
   - Execute: Send commands to all printers
   - Verify: Each printer uses appropriate route
   - Verify: LAN printers use LAN, cloud-only use Studio/cloud, offline fail

## 9. Success Criteria

The bug is considered fixed when:

1. ✅ Cloud-only printers with Bambu Studio installed can execute `printer_home` and `move_axis` commands
2. ✅ The `studio` route is available for cloud-only printers when Bambu Studio is installed
3. ✅ Movement commands include `cloud` as a fallback route
4. ✅ LAN-connected printers continue to prefer the LAN route (no performance regression)
5. ✅ Offline printers continue to fail appropriately (no false positives)
6. ✅ All other command types remain unchanged
7. ✅ All property-based tests pass, confirming preservation of existing behavior

## 10. Implementation Notes

### Files to Modify

1. **`client-agent/src/handlers/printer.js`**
   - Function: `createRouteAvailability` (lines ~270-280)
   - Function: `buildCommandRoutes` (lines ~285-295)

### Testing Files to Create

1. **`client-agent/test/printer.test.js`** (if not exists)
   - Unit tests for route availability logic
   - Unit tests for command routing

2. **`client-agent/test/preservation.test.js`**
   - Property-based tests for preservation checking
   - Random input generation for comprehensive coverage

### Dependencies

- Existing: `runStudioLocalCommand` function (already implemented)
- Existing: `sendGcodeLineViaCloud` function (already implemented with `user_id` fix)
- Existing: `isStudioLocalControlAvailable` function (checks if Bambu Studio is installed)

### Risks and Mitigations

**Risk 1**: Studio bridge might be slower than direct cloud MQTT for cloud-only printers
- **Mitigation**: Route priority puts Studio before cloud, but users can configure preferences if needed

**Risk 2**: Studio might not be running when command is sent
- **Mitigation**: The `runStudioLocalCommand` function should handle Studio startup or return error, allowing fallback to cloud route

**Risk 3**: Breaking existing LAN connectivity behavior
- **Mitigation**: Comprehensive preservation tests ensure LAN route remains preferred and unchanged
