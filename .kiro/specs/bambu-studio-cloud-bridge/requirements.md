# Requirements Document

## Introduction

This document specifies requirements for enhancing the Bambu printer control system with a cloud-bridge capability. Currently, when a printer is in cloud-only mode (`cloud_online: true`, `lan_online: false`), the system uses cloud MQTT for control. This feature investigates and implements the ability to route commands through a locally-running Bambu Studio instance, which may provide more reliable or lower-latency control even for cloud-only printers.

The enhancement maintains backward compatibility with existing LAN and cloud-only workflows while adding a new routing option that leverages Bambu Studio's local automation interface as an intermediary for cloud-connected printers.

## Glossary

- **ClientAgentBridge**: Frontend TypeScript module that manages WebSocket communication with the local Client Agent
- **Client_Agent**: Node.js service running on the user's machine that executes local automation tasks
- **Bambu_Studio**: Bambu Lab's desktop slicer application with local automation capabilities
- **Cloud_MQTT**: MQTT broker hosted by Bambu Lab for remote printer control
- **LAN_MQTT**: Local network MQTT connection directly to printer
- **Studio_Local_Control**: Control method that sends commands via Bambu Studio's local API
- **Route**: A communication path for sending commands to a printer (lan, studio, or cloud)
- **Route_Availability**: Object indicating which routes are currently available for a printer
- **Command_Routes**: Mapping of command types to their preferred route priority lists
- **Cloud_Only_Printer**: A printer with `cloud_online: true` and `lan_online: false`

## Requirements

### Requirement 1: Investigate Studio Cloud-Bridge Capability

**User Story:** As a system architect, I want to understand whether Bambu Studio can control cloud-only printers, so that I can determine if this routing option is technically feasible.

#### Acceptance Criteria

1. THE Investigation SHALL determine if Bambu Studio can send commands to printers that Studio itself connects to via cloud
2. THE Investigation SHALL document the command types supported through Studio's cloud connection
3. THE Investigation SHALL measure latency and reliability differences between Studio cloud-bridge and direct cloud MQTT
4. THE Investigation SHALL identify any limitations or constraints of using Studio as a cloud intermediary
5. IF Studio cannot control cloud-only printers, THEN THE Investigation SHALL document this finding and recommend alternative approaches

### Requirement 2: Extend Route Availability Detection

**User Story:** As a developer, I want the system to detect when Studio local control is available for cloud-only printers, so that routing logic can make informed decisions.

#### Acceptance Criteria

1. WHEN a printer is cloud-only and Bambu Studio is running, THE Route_Detection_System SHALL mark the studio route as available
2. THE Route_Detection_System SHALL verify that Bambu Studio can reach the cloud-only printer before marking studio route available
3. THE Route_Availability object SHALL include a `studio` boolean field indicating Studio local control availability
4. THE `createRouteAvailability` function SHALL accept printer state, MQTT state, FTP state, and agent configuration as inputs
5. THE `isStudioLocalControlAvailable` function SHALL return true when Studio is installed, running, and can reach the target printer

### Requirement 3: Support Studio Route for Cloud-Only Printers

**User Story:** As a user with a cloud-only printer, I want commands to route through my local Bambu Studio when available, so that I can benefit from potentially better reliability or lower latency.

#### Acceptance Criteria

1. WHEN a printer is cloud-only and Studio local control is available, THE Command_Router SHALL include `studio` in the available routes
2. THE `buildCommandRoutes` function SHALL prioritize studio route over cloud route for supported command types
3. FOR commands `printer_status`, `printer_home`, and `move_axis`, THE Command_Router SHALL prefer routes in order: `['lan', 'studio', 'cloud']`
4. FOR commands `print_pause`, `print_resume`, and `print_stop`, THE Command_Router SHALL prefer routes in order: `['lan', 'studio', 'cloud']`
5. FOR commands `printer_light_control`, THE Command_Router SHALL prefer routes in order: `['lan', 'studio', 'cloud']`
6. WHEN studio route is selected, THE Command_Dispatcher SHALL invoke `runStudioLocalCommand` with the printer machine object and command payload

### Requirement 4: Implement Studio Cloud-Send Command

**User Story:** As a Client Agent developer, I want a `cloud_send` command type in the Studio bridge, so that Studio can send commands to cloud-connected printers.

#### Acceptance Criteria

1. THE Studio_Bridge SHALL support a `--command cloud_send` option in addition to existing `local_send`
2. WHEN `cloud_send` is invoked, THE Studio_Bridge SHALL use Bambu Studio's cloud connection to send the command
3. THE Studio_Bridge SHALL accept `--printer-id`, `--payload`, and authentication parameters for cloud_send
4. THE Studio_Bridge SHALL return a JSON response with `ok`, `error`, and response data fields
5. IF cloud_send fails, THEN THE Studio_Bridge SHALL return `ok: false` with a descriptive error message

### Requirement 5: Fallback to Cloud MQTT on Studio Failure

**User Story:** As a user, I want the system to automatically use cloud MQTT if Studio control fails, so that my commands still reach the printer.

#### Acceptance Criteria

1. WHEN a command via studio route fails, THE Command_Dispatcher SHALL attempt the next available route in the priority list
2. IF studio route fails and cloud route is available, THEN THE Command_Dispatcher SHALL retry the command via cloud MQTT
3. THE Command_Dispatcher SHALL log route fallback events for debugging purposes
4. THE Command_Dispatcher SHALL return success if any route in the priority list succeeds
5. IF all routes fail, THEN THE Command_Dispatcher SHALL return an error with details of all attempted routes

### Requirement 6: Maintain Backward Compatibility

**User Story:** As a system maintainer, I want existing LAN and cloud-only workflows to continue working unchanged, so that current users are not disrupted.

#### Acceptance Criteria

1. WHEN a printer is LAN-online, THE Command_Router SHALL prioritize LAN routes as before
2. WHEN Studio is not available, THE Command_Router SHALL fall back to existing cloud MQTT behavior
3. THE ClientAgentBridge TypeScript interface SHALL remain unchanged for existing command methods
4. THE `printer.js` handler SHALL maintain existing function signatures for `sendLanMqttCommand` and `sendCloudMqttCommand`
5. FOR ALL existing command types, THE system SHALL produce equivalent results whether studio route is available or not (idempotence property)

### Requirement 7: Configuration and Capability Reporting

**User Story:** As a user, I want to see which control routes are available for my printer, so that I understand how my commands are being sent.

#### Acceptance Criteria

1. THE Client_Agent SHALL report studio route availability in the `hello` message capabilities
2. THE `printer_status` response SHALL include route availability for the selected printer
3. THE Frontend SHALL display route availability in the printer control UI
4. WHERE Studio is installed but not running, THE Client_Agent SHALL indicate `studio_available: false` in capabilities
5. THE Client_Agent configuration SHALL include an optional `prefer_studio_for_cloud` boolean setting

### Requirement 8: Error Handling and Diagnostics

**User Story:** As a developer, I want clear error messages when Studio cloud-bridge fails, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN Studio cloud-bridge connection fails, THE Studio_Bridge SHALL return a specific error code and message
2. THE Command_Dispatcher SHALL distinguish between "Studio not available" and "Studio command failed" errors
3. THE Client_Agent SHALL log all route selection decisions and fallback events
4. IF Studio is installed but the bridge binary fails to build, THEN THE Client_Agent SHALL report this in the status response
5. THE Frontend SHALL display route-specific error messages to help users understand control failures

### Requirement 9: Round-Trip Property for Command Routing

**User Story:** As a QA engineer, I want to verify that commands produce consistent results regardless of route, so that I can ensure system correctness.

#### Acceptance Criteria

1. FOR ALL supported commands, sending the same command via studio route and cloud route SHALL produce equivalent printer state changes
2. THE Test_Suite SHALL include property-based tests that verify command idempotence across routes
3. FOR commands like `printer_light_control`, toggling on then off then on SHALL produce the same final state regardless of route used
4. THE Test_Suite SHALL verify that route fallback does not cause duplicate command execution
5. FOR status query commands, THE response data format SHALL be consistent across all routes

### Requirement 10: Performance and Latency Monitoring

**User Story:** As a system operator, I want to measure command latency across different routes, so that I can validate the performance benefits of Studio cloud-bridge.

#### Acceptance Criteria

1. THE Command_Dispatcher SHALL record timestamp before and after each command execution
2. THE Command_Dispatcher SHALL include latency measurements in command response metadata
3. THE Client_Agent SHALL maintain rolling statistics of average latency per route type
4. WHEN a command completes, THE Client_Agent SHALL report which route was used and the execution time
5. THE Frontend SHALL optionally display route performance statistics in developer mode

