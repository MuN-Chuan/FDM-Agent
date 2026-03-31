# Bambu Studio Cloud Bridge Bugfix - Implementation Tasks

## Task Overview

This task list implements the fix for cloud-only printer control by enabling Bambu Studio as a universal bridge and adding cloud MQTT fallback for movement commands.

---

## Phase 1: Bug Condition Exploration

### Task 1: Write Bug Condition Exploration Property Test

**Objective**: Create a property-based test that demonstrates the bug exists on unfixed code by showing that cloud-only printers fail to execute movement commands.

**File**: `client-agent/test/exploration.test.js`

**Test Requirements**:
- Test should FAIL on unfixed code (demonstrating the bug)
- Test should PASS on fixed code (confirming the fix)
- Use property-based testing to generate various cloud-only printer configurations

**Test Implementation**:
```javascript
const fc = require('fast-check');
const { createRouteAvailability, buildCommandRoutes } = require('../src/handlers/printer');

describe('Bug Condition Exploration: Cloud-only printer control', () => {
    it('should fail to execute movement commands on cloud-only printers (UNFIXED)', () => {
        fc.assert(
            fc.property(
                fc.record({
                    machine: fc.record({
                        id: fc.string({ minLength: 10, maxLength: 20 }),
                        cloud_online: fc.constant(true),
                        ip: fc.constant(null),
                        token: fc.string({ minLength: 8, maxLength: 16 })
                    }),
                    agentConfig: fc.record({
                        bambu_studio_path: fc.constant('C:/Program Files/Bambu Studio/bambu-studio.exe')
                    }),
                    command: fc.constantFrom('printer_home', 'move_axis')
                }),
                ({ machine, agentConfig, command }) => {
                    // This test demonstrates the bug on UNFIXED code
                    const availability = createRouteAvailability(machine, null, false, agentConfig);
                    const routes = buildCommandRoutes(availability);
                    
                    // BUG: Studio should be available but isn't
                    // This assertion will FAIL on unfixed code, demonstrating the bug
                    expect(availability.studio).toBe(true);
                    
                    // BUG: Routes should include studio or cloud but don't
                    expect(routes[command].length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 50 }
        );
    });
});
```

**Success Criteria**:
- Test fails on unfixed code with clear error showing `studio` is false
- Test demonstrates that no routes are available for cloud-only printers
- Test output clearly shows the bug condition

**Subtasks**:
- [ ] 1.1 Create `client-agent/test/exploration.test.js` file
- [ ] 1.2 Implement property-based test for cloud-only printer scenarios
- [ ] 1.3 Run test on unfixed code and capture failure output
- [ ] 1.4 Document the counterexamples found (specific inputs that trigger the bug)

---

## Phase 2: Core Implementation

### Task 2: Fix Studio Route Availability Logic

**Objective**: Modify `createRouteAvailability` function to allow Studio route for cloud-only printers when Bambu Studio is installed.

**File**: `client-agent/src/handlers/printer.js`

**Function**: `createRouteAvailability` (lines ~270-280)

**Changes Required**:

**Before**:
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

**After**:
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

**Success Criteria**:
- Studio route is available when Bambu Studio is installed and printer is cloud-online
- Studio route is still available for LAN-connected printers (preservation)
- Studio route is not available when printer is completely offline

**Subtasks**:
- [ ] 2.1 Locate `createRouteAvailability` function in printer.js
- [ ] 2.2 Modify `studioAvailable` logic to check `(lanOnline || cloudOnline)`
- [ ] 2.3 Add inline comment explaining the fix
- [ ] 2.4 Verify syntax is correct (no missing parentheses or operators)

---

### Task 3: Add Cloud Fallback to Movement Commands

**Objective**: Modify `buildCommandRoutes` function to include cloud MQTT as a fallback route for `printer_home` and `move_axis` commands.

**File**: `client-agent/src/handlers/printer.js`

**Function**: `buildCommandRoutes` (lines ~285-295)

**Changes Required**:

**Before**:
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

**After**:
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

**Success Criteria**:
- `printer_home` route includes `['lan', 'studio', 'cloud']`
- `move_axis` route includes `['lan', 'studio', 'cloud']`
- Other command routes remain unchanged

**Subtasks**:
- [ ] 3.1 Locate `buildCommandRoutes` function in printer.js
- [ ] 3.2 Add `'cloud'` to `printer_home` route array
- [ ] 3.3 Add `'cloud'` to `move_axis` route array
- [ ] 3.4 Verify other command routes are not modified

---

## Phase 3: Unit Testing

### Task 4: Create Unit Tests for Route Availability

**Objective**: Write unit tests to verify the fixed route availability logic works correctly for all scenarios.

**File**: `client-agent/test/printer.test.js`

**Test Cases**:

1. **Cloud-only printer with Studio installed**
   - Input: `cloud_online=true`, `lan_online=false`, Studio installed
   - Expected: `studio=true`, `cloud=true`, `lan=false`

2. **LAN-connected printer with Studio installed**
   - Input: `cloud_online=true`, `lan_online=true`, Studio installed
   - Expected: `studio=true`, `cloud=true`, `lan=true`

3. **Offline printer with Studio installed**
   - Input: `cloud_online=false`, `lan_online=false`, Studio installed
   - Expected: `studio=false`, `cloud=false`, `lan=false`

4. **Cloud-only printer without Studio**
   - Input: `cloud_online=true`, `lan_online=false`, Studio not installed
   - Expected: `studio=false`, `cloud=true`, `lan=false`

**Success Criteria**:
- All test cases pass
- Tests cover all combinations of LAN/cloud/Studio availability
- Tests verify both fixed and preserved behaviors

**Subtasks**:
- [ ] 4.1 Create or update `client-agent/test/printer.test.js`
- [ ] 4.2 Write test for cloud-only printer with Studio
- [ ] 4.3 Write test for LAN-connected printer (preservation)
- [ ] 4.4 Write test for offline printer (preservation)
- [ ] 4.5 Write test for cloud-only printer without Studio
- [ ] 4.6 Run all unit tests and verify they pass

---

### Task 5: Create Unit Tests for Command Routes

**Objective**: Write unit tests to verify the fixed command routing logic includes cloud fallback for movement commands.

**File**: `client-agent/test/printer.test.js`

**Test Cases**:

1. **Movement commands include cloud route**
   - Input: `availability = { lan: false, studio: false, cloud: true }`
   - Expected: `printer_home = ['cloud']`, `move_axis = ['cloud']`

2. **LAN route still preferred**
   - Input: `availability = { lan: true, studio: true, cloud: true }`
   - Expected: `printer_home[0] = 'lan'`, `move_axis[0] = 'lan'`

3. **Other commands unchanged**
   - Input: Various availability combinations
   - Expected: Commands like `set_bed_temperature` still only have `['lan']`

**Success Criteria**:
- All test cases pass
- Tests verify cloud fallback is added to movement commands
- Tests verify LAN route priority is preserved
- Tests verify other commands are not affected

**Subtasks**:
- [ ] 5.1 Write test for cloud fallback in movement commands
- [ ] 5.2 Write test for LAN route priority preservation
- [ ] 5.3 Write test for other commands unchanged
- [ ] 5.4 Run all unit tests and verify they pass

---

## Phase 4: Property-Based Testing (Preservation)

### Task 6: Create Preservation Tests for LAN-Connected Printers

**Objective**: Use property-based testing to verify that LAN-connected printers continue to work exactly as before (no regression).

**File**: `client-agent/test/preservation.test.js`

**Property**: For all LAN-connected printers, the fixed system produces the same behavior as the original system.

**Test Implementation**:
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
                        ip: fc.ipV4(),
                        token: fc.string()
                    }),
                    command: fc.constantFrom('printer_home', 'move_axis', 'print_start', 'printer_status')
                }),
                ({ machine, command }) => {
                    // Simulate LAN online
                    const mqttState = { mqtt: true };
                    const ftpAlive = true;
                    const agentConfig = { bambu_studio_path: 'C:/Program Files/Bambu Studio/bambu-studio.exe' };
                    
                    const availability = createRouteAvailability(machine, mqttState, ftpAlive, agentConfig);
                    const routes = buildCommandRoutes(availability);
                    
                    // LAN should be available and preferred
                    expect(availability.lan).toBe(true);
                    if (routes[command] && routes[command].length > 0) {
                        expect(routes[command][0]).toBe('lan');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

**Success Criteria**:
- Property test passes for 100+ random LAN-connected printer configurations
- LAN route is always available and preferred
- No regressions in LAN connectivity behavior

**Subtasks**:
- [ ] 6.1 Create `client-agent/test/preservation.test.js` file
- [ ] 6.2 Implement property-based test for LAN-connected printers
- [ ] 6.3 Run test with 100+ iterations
- [ ] 6.4 Verify no failures occur

---

### Task 7: Create Preservation Tests for Offline Printers

**Objective**: Use property-based testing to verify that offline printers continue to fail appropriately (no false positives).

**File**: `client-agent/test/preservation.test.js`

**Property**: For all offline printers, the fixed system produces the same failure behavior as the original system.

**Test Implementation**:
```javascript
describe('Preservation: Offline printers', () => {
    it('should fail for completely offline printers', () => {
        fc.assert(
            fc.property(
                fc.record({
                    machine: fc.record({
                        id: fc.string(),
                        cloud_online: fc.constant(false),
                        ip: fc.constant(null),
                        token: fc.string()
                    }),
                    command: fc.constantFrom('printer_home', 'move_axis', 'print_start')
                }),
                ({ machine, command }) => {
                    const availability = createRouteAvailability(machine, null, false, agentConfig);
                    const routes = buildCommandRoutes(availability);
                    
                    // No routes should be available
                    expect(availability.lan).toBe(false);
                    expect(availability.studio).toBe(false);
                    expect(availability.cloud).toBe(false);
                    expect(routes[command]).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

**Success Criteria**:
- Property test passes for 100+ random offline printer configurations
- No routes are available for offline printers
- Offline detection behavior is preserved

**Subtasks**:
- [ ] 7.1 Implement property-based test for offline printers
- [ ] 7.2 Run test with 100+ iterations
- [ ] 7.3 Verify all offline printers correctly show no available routes

---

### Task 8: Create Preservation Tests for Other Commands

**Objective**: Use property-based testing to verify that commands other than `printer_home` and `move_axis` are not affected by the fix.

**File**: `client-agent/test/preservation.test.js`

**Property**: For all commands except movement commands, the fixed system produces identical routing behavior.

**Test Implementation**:
```javascript
describe('Preservation: Other commands unchanged', () => {
    it('should not affect routing for non-movement commands', () => {
        fc.assert(
            fc.property(
                fc.record({
                    availability: fc.record({
                        lan: fc.boolean(),
                        studio: fc.boolean(),
                        cloud: fc.boolean()
                    }),
                    command: fc.constantFrom(
                        'print_start', 'print_pause', 'print_resume', 'print_stop',
                        'set_bed_temperature', 'set_nozzle_temperature', 'printer_status'
                    )
                }),
                ({ availability, command }) => {
                    const routes = buildCommandRoutes(availability);
                    
                    // Verify routes match expected patterns for each command type
                    if (command.startsWith('print_')) {
                        // Print commands should have ['lan', 'cloud'] pattern
                        const expectedRoutes = [
                            availability.lan && 'lan',
                            availability.cloud && 'cloud'
                        ].filter(Boolean);
                        expect(routes[command]).toEqual(expectedRoutes);
                    } else if (command.startsWith('set_')) {
                        // Temperature/speed commands should only have ['lan']
                        const expectedRoutes = availability.lan ? ['lan'] : [];
                        expect(routes[command]).toEqual(expectedRoutes);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

**Success Criteria**:
- Property test passes for 100+ random configurations
- Non-movement commands maintain their original routing patterns
- No unintended side effects on other command types

**Subtasks**:
- [ ] 8.1 Implement property-based test for other commands
- [ ] 8.2 Run test with 100+ iterations
- [ ] 8.3 Verify all non-movement commands are unchanged

---

## Phase 5: Integration Testing

### Task 9: Create Integration Test for Cloud-Only Printer Control

**Objective**: Write an end-to-end integration test that verifies cloud-only printers can execute movement commands through Studio or cloud routes.

**File**: `client-agent/test/integration.test.js`

**Test Scenario**: Cloud-only printer with Bambu Studio installed successfully executes `printer_home` command.

**Test Implementation**:
```javascript
const { handlePrinterCommand } = require('../src/commands');
const { runStudioLocalCommand } = require('../src/handlers/studio');

jest.mock('../src/handlers/studio');

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
        runStudioLocalCommand.mockResolvedValue({ 
            success: true, 
            response: 'OK' 
        });
        
        const result = await handlePrinterCommand({
            cmd: 'printer_home',
            params: { printer_id: machine.id }
        }, agentConfig);
        
        expect(result.success).toBe(true);
        expect(runStudioLocalCommand).toHaveBeenCalled();
    });
});
```

**Success Criteria**:
- Test passes with mocked Studio command
- Command is routed through Studio for cloud-only printer
- Result indicates successful execution

**Subtasks**:
- [ ] 9.1 Create `client-agent/test/integration.test.js` file
- [ ] 9.2 Implement integration test for cloud-only printer with Studio
- [ ] 9.3 Mock Studio command execution
- [ ] 9.4 Verify command is routed correctly
- [ ] 9.5 Run test and verify it passes

---

### Task 10: Create Integration Test for Cloud MQTT Fallback

**Objective**: Write an integration test that verifies cloud MQTT fallback works when Studio is not available.

**File**: `client-agent/test/integration.test.js`

**Test Scenario**: Cloud-only printer without Bambu Studio successfully executes `printer_home` command via cloud MQTT.

**Test Implementation**:
```javascript
const { sendGcodeSequenceViaCloud } = require('../src/handlers/printer');

jest.mock('../src/handlers/printer', () => ({
    ...jest.requireActual('../src/handlers/printer'),
    sendGcodeSequenceViaCloud: jest.fn()
}));

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
        sendGcodeSequenceViaCloud.mockResolvedValue({ success: true });
        
        const result = await handlePrinterCommand({
            cmd: 'printer_home',
            params: { printer_id: machine.id }
        }, agentConfig);
        
        expect(result.success).toBe(true);
        expect(sendGcodeSequenceViaCloud).toHaveBeenCalledWith(
            machine.id, 
            ['G28'], 
            expect.any(Function)
        );
    });
});
```

**Success Criteria**:
- Test passes with mocked cloud MQTT command
- Command falls back to cloud MQTT when Studio is unavailable
- G28 command is sent via cloud MQTT

**Subtasks**:
- [ ] 10.1 Implement integration test for cloud MQTT fallback
- [ ] 10.2 Mock cloud MQTT command execution
- [ ] 10.3 Verify fallback behavior works correctly
- [ ] 10.4 Run test and verify it passes

---

## Phase 6: Fix Verification

### Task 11: Run Bug Condition Exploration Test on Fixed Code

**Objective**: Re-run the exploration test from Task 1 on the fixed code to verify the bug is resolved.

**Expected Outcome**: The test that failed on unfixed code should now pass on fixed code.

**Success Criteria**:
- Exploration test passes on fixed code
- Studio route is now available for cloud-only printers
- Movement commands have available routes for cloud-only printers

**Subtasks**:
- [ ] 11.1 Run `client-agent/test/exploration.test.js` on fixed code
- [ ] 11.2 Verify test passes (was failing before)
- [ ] 11.3 Document the fix verification results

---

### Task 12: Run Full Test Suite

**Objective**: Run all tests (unit, property-based, integration) to verify the fix works correctly and preserves existing behavior.

**Test Suite**:
- Unit tests: `client-agent/test/printer.test.js`
- Property-based tests: `client-agent/test/preservation.test.js`
- Integration tests: `client-agent/test/integration.test.js`
- Exploration test: `client-agent/test/exploration.test.js`

**Success Criteria**:
- All unit tests pass
- All property-based tests pass (100+ iterations each)
- All integration tests pass
- Exploration test passes on fixed code
- No test failures or regressions

**Subtasks**:
- [ ] 12.1 Run all unit tests: `npm test -- printer.test.js`
- [ ] 12.2 Run all property-based tests: `npm test -- preservation.test.js`
- [ ] 12.3 Run all integration tests: `npm test -- integration.test.js`
- [ ] 12.4 Run exploration test: `npm test -- exploration.test.js`
- [ ] 12.5 Verify all tests pass with no failures
- [ ] 12.6 Document test results

---

## Phase 7: Manual Validation

### Task 13: Manual Test with Real Cloud-Only Printer

**Objective**: Manually test the fix with a real cloud-only printer to verify it works in production.

**Test Setup**:
1. Configure a printer to be cloud-only (disconnect from LAN)
2. Ensure Bambu Studio is installed locally
3. Ensure bambu-cli config has valid cloud credentials

**Test Steps**:
1. Start client-agent
2. Send `printer_home` command to cloud-only printer
3. Observe command execution and printer response
4. Send `move_axis` command to cloud-only printer
5. Observe command execution and printer response

**Success Criteria**:
- Cloud-only printer successfully executes `printer_home` command
- Cloud-only printer successfully executes `move_axis` command
- Commands are routed through Studio or cloud MQTT
- Printer responds correctly to commands

**Subtasks**:
- [ ] 13.1 Set up test environment with cloud-only printer
- [ ] 13.2 Test `printer_home` command
- [ ] 13.3 Test `move_axis` command
- [ ] 13.4 Verify commands execute successfully
- [ ] 13.5 Document manual test results

---

### Task 14: Manual Test with LAN-Connected Printer (Preservation)

**Objective**: Manually test with a LAN-connected printer to verify no regression in existing behavior.

**Test Setup**:
1. Configure a printer with LAN connectivity
2. Ensure printer is reachable on local network

**Test Steps**:
1. Start client-agent
2. Send `printer_home` command to LAN-connected printer
3. Verify command uses LAN route (fastest)
4. Send `move_axis` command to LAN-connected printer
5. Verify command uses LAN route

**Success Criteria**:
- LAN-connected printer continues to use LAN route
- No performance regression (commands execute quickly)
- No changes in behavior for LAN-connected printers

**Subtasks**:
- [ ] 14.1 Set up test environment with LAN-connected printer
- [ ] 14.2 Test `printer_home` command via LAN
- [ ] 14.3 Test `move_axis` command via LAN
- [ ] 14.4 Verify LAN route is used (check logs)
- [ ] 14.5 Verify no performance regression
- [ ] 14.6 Document manual test results

---

## Phase 8: Documentation and Cleanup

### Task 15: Update Documentation

**Objective**: Update project documentation to reflect the fix and new routing behavior.

**Files to Update**:
1. `项目信息/打印机连接与控制/cloud-home-fix-summary.md` - Add section about Studio bridge fix
2. `client-agent/README.md` (if exists) - Update routing documentation
3. Code comments in `printer.js` - Ensure inline comments explain the fix

**Success Criteria**:
- Documentation accurately describes the fix
- Routing behavior is clearly documented
- Examples show cloud-only printer control

**Subtasks**:
- [ ] 15.1 Update cloud-home-fix-summary.md with Studio bridge information
- [ ] 15.2 Update client-agent README (if exists)
- [ ] 15.3 Review and update inline code comments
- [ ] 15.4 Add examples of cloud-only printer control

---

### Task 16: Code Review and Cleanup

**Objective**: Review all changes for code quality, consistency, and best practices.

**Review Checklist**:
- [ ] Code follows existing style and conventions
- [ ] No console.log statements left in production code
- [ ] Error handling is appropriate
- [ ] Comments are clear and helpful
- [ ] No dead code or unused variables
- [ ] Function names are descriptive
- [ ] Test coverage is adequate

**Success Criteria**:
- Code passes review checklist
- No style or quality issues
- Code is ready for production

**Subtasks**:
- [ ] 16.1 Review `createRouteAvailability` changes
- [ ] 16.2 Review `buildCommandRoutes` changes
- [ ] 16.3 Review all test files
- [ ] 16.4 Run linter (if available): `npm run lint`
- [ ] 16.5 Fix any linting issues
- [ ] 16.6 Commit changes with clear commit message

---

## Summary

**Total Tasks**: 16 main tasks with multiple subtasks each

**Estimated Effort**:
- Phase 1 (Exploration): 2-3 hours
- Phase 2 (Implementation): 1-2 hours
- Phase 3 (Unit Testing): 3-4 hours
- Phase 4 (Property Testing): 3-4 hours
- Phase 5 (Integration Testing): 2-3 hours
- Phase 6 (Verification): 1-2 hours
- Phase 7 (Manual Testing): 2-3 hours
- Phase 8 (Documentation): 1-2 hours

**Total Estimated Time**: 15-23 hours

**Critical Path**:
1. Task 1 (Exploration) → Task 2 (Fix Studio Route) → Task 3 (Add Cloud Fallback) → Task 11 (Verify Fix)
2. All other tasks can be done in parallel after Task 3

**Success Metrics**:
- ✅ Bug condition exploration test passes on fixed code
- ✅ All unit tests pass
- ✅ All property-based tests pass (300+ total iterations)
- ✅ All integration tests pass
- ✅ Manual tests confirm cloud-only printer control works
- ✅ Manual tests confirm no regression for LAN-connected printers
- ✅ Documentation is updated
