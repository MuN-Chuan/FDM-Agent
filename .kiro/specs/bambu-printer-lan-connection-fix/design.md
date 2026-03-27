# Bambu Printer LAN Connection Bugfix Design

## Overview

The client-agent successfully retrieves printer information from Bambu Lab cloud MQTT, including IP addresses, but fails to establish direct LAN connections (MQTT on port 8883 and FTP on port 990) to these printers. This results in `lan_online=false`, `mqtt=false`, and `ftp=false` even when the printer is accessible on the local network and Bambu Studio can connect successfully.

The fix will ensure that IP addresses obtained from cloud MQTT are validated and supplemented with alternative discovery methods when they fail to establish LAN connectivity. The solution prioritizes same-subnet IP addresses and implements proper timeout handling for network operations.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when IP addresses from cloud MQTT fail to establish LAN connections despite the printer being reachable
- **Property (P)**: The desired behavior - successful MQTT and FTP connections to printers on the LAN with correct status reporting
- **Preservation**: Existing cloud connectivity, offline detection, and multi-printer handling that must remain unchanged
- **enrichMachineIpsFromCloud**: Function in `client-agent/src/handlers/printer.js` that retrieves IP addresses from cloud MQTT by subscribing to device reports
- **collectPrinterStatuses**: Function that checks printer connectivity by calling `fetchMqttStatus` and `checkFtp` for each machine
- **ip_source**: Property tracking where the IP address came from (cloud_mqtt_net_info, cloud_mqtt_rtsp, bambu_studio_cache, etc.)
- **same-subnet**: IP addresses on the same local network subnet as the client-agent, scored highest for connectivity likelihood

## Bug Details

### Bug Condition

The bug manifests when the client-agent obtains an IP address from cloud MQTT (via `enrichMachineIpsFromCloud`) but this IP address fails to establish LAN connections in `collectPrinterStatuses`. The `fetchMqttStatus` and `checkFtp` functions timeout or fail even though the printer is reachable on the LAN and Bambu Studio successfully connects to it.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { machine, mqttResult, ftpResult }
  OUTPUT: boolean
  
  RETURN input.machine.ip IS NOT NULL
         AND input.machine.ip_source IN ['cloud_mqtt_net_info', 'cloud_mqtt_rtsp']
         AND input.machine.cloud_online == true
         AND input.mqttResult.mqtt == false
         AND input.ftpResult == false
         AND printerIsActuallyReachableOnLAN(input.machine)
END FUNCTION
```

### Examples

- **Example 1**: Printer X1C has `ip="192.168.1.100"` from cloud_mqtt_net_info, `cloud_online=true`, but `fetchMqttStatus` times out after 7 seconds, resulting in `mqtt=false`, `lan_online=false`. Bambu Studio connects successfully to the same printer.

- **Example 2**: Printer P1S has `ip="10.0.0.50"` from cloud_mqtt_rtsp, but the actual LAN IP is `192.168.1.150`. The connection fails because the IP from cloud is not on the same subnet as the client-agent.

- **Example 3**: Printer A1 has `ip="172.16.0.10"` from cloud_mqtt_net_info, but this is a stale IP from a previous network. The printer's current IP is `192.168.1.200`, which is in Bambu Studio cache.

- **Edge Case**: Printer with no IP from cloud MQTT should fall back to Bambu Studio cache discovery - expected behavior is to find the IP and connect successfully.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Offline printers must continue to correctly report `lan_online=false`, `mqtt=false`, `ftp=false`
- Cloud-only connectivity (printer not on LAN) must continue to show `cloud_online=true` with `lan_online=false`
- Printer metadata (id, name, model, make, access_code) retrieval must remain unchanged
- Multi-printer status checking must continue to work independently for each printer
- Bambu Studio cache enrichment via `enrichMachineIpsFromBambuStudioCache` must continue to function

**Scope:**
All inputs that do NOT involve LAN connection failures due to incorrect/stale IP addresses should be completely unaffected by this fix. This includes:
- Printers that are genuinely offline or not on the local network
- Cloud-only connectivity scenarios
- Printer discovery and metadata retrieval
- Bambu Studio cache scanning

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Stale or Incorrect IP from Cloud MQTT**: The IP address returned in cloud MQTT payloads (`extractIpFromCloudMqttPayload`) may be outdated, from a different network, or incorrectly formatted (endianness issues in `convertUint32ToIpv4`).
   - The `enrichMachineIpsFromCloud` function has a 9-second timeout but may receive stale IPs before timeout
   - The `shouldReplaceMachineIp` logic may not properly prioritize same-subnet IPs over cloud-provided IPs

2. **Insufficient Timeout Values**: The connection timeouts may be too short for some network conditions:
   - `MQTT_TIMEOUT_MS = 7000` (7 seconds)
   - `FTP_TIMEOUT_MS = 5000` (5 seconds)
   - These may not allow sufficient time for connection establishment on slower networks

3. **Missing IP Validation**: The code does not validate that cloud-provided IPs are reachable before using them:
   - No ping or quick connectivity check before attempting full MQTT/FTP connections
   - No fallback to alternative IPs when cloud IP fails

4. **Bambu Studio Cache Not Prioritized**: The `enrichMachineIpsFromBambuStudioCache` only runs after cloud MQTT enrichment and only fills missing IPs:
   - It doesn't replace bad IPs from cloud with better IPs from cache
   - The cache may contain more recent, same-subnet IPs that should be preferred

5. **No Retry Logic**: When `fetchMqttStatus` or `checkFtp` fail, there's no attempt to:
   - Try alternative IP addresses from cache
   - Re-discover the printer using different methods
   - Validate the IP before marking connections as failed

## Correctness Properties

Property 1: Bug Condition - LAN Connection Success with Valid IP

_For any_ printer where the bug condition holds (cloud-provided IP fails LAN connection but printer is reachable), the fixed system SHALL successfully establish MQTT and FTP connections by discovering and using a valid, reachable LAN IP address, resulting in `lan_online=true`, `mqtt=true`, and `ftp=true`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Offline and Cloud-Only Detection

_For any_ printer where the bug condition does NOT hold (genuinely offline, cloud-only, or already has working LAN connection), the fixed system SHALL produce exactly the same status results as the original system, preserving correct offline detection, cloud-only connectivity reporting, and successful LAN connections.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `client-agent/src/handlers/printer.js`

**Function**: `enrichMachineIpsFromCloud`, `collectPrinterStatuses`, and helper functions

**Specific Changes**:

1. **Enhance IP Scoring and Selection**: Modify `shouldReplaceMachineIp` to consider subnet matching
   - Add subnet scoring using existing `scoreIpCandidate` function
   - Prefer same-subnet IPs (score 100) over different-subnet private IPs (score 10)
   - Only replace existing same-subnet IPs with other same-subnet IPs

2. **Add IP Validation Before Use**: Create a new `validateIpReachability` function
   - Perform quick connectivity check (ping or TCP connect with short timeout)
   - Return boolean indicating if IP is likely reachable
   - Use this before attempting full MQTT/FTP connections

3. **Implement Fallback IP Discovery**: Modify `collectPrinterStatuses` to retry with alternative IPs
   - When MQTT/FTP connections fail, check Bambu Studio cache for alternative IPs
   - Try same-subnet IPs from cache before giving up
   - Update machine IP if alternative succeeds

4. **Prioritize Bambu Studio Cache for Same-Subnet IPs**: Enhance `enrichMachineIpsFromBambuStudioCache`
   - Allow it to replace cloud IPs when cache has higher-scored IPs (same-subnet)
   - Run cache enrichment after cloud enrichment but before status collection
   - Add logic to prefer cache IPs with score 100 over cloud IPs with lower scores

5. **Increase Timeout Values**: Adjust timeout constants for more reliable connections
   - Consider increasing `MQTT_TIMEOUT_MS` from 7000 to 10000 (10 seconds)
   - Consider increasing `FTP_TIMEOUT_MS` from 5000 to 7000 (7 seconds)
   - Ensure `DISCOVERY_TIMEOUT_MS` remains sufficient at 9000ms

6. **Add Logging for Debugging**: Insert debug logging to track IP selection and connection attempts
   - Log which IP source is being used (cloud_mqtt vs cache)
   - Log IP scores and subnet matching results
   - Log connection failure reasons for troubleshooting

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate cloud MQTT returning stale/incorrect IPs and verify that LAN connections fail on UNFIXED code. Mock the cloud MQTT responses and Bambu Studio cache to control IP sources. Run these tests to observe failures and understand the root cause.

**Test Cases**:
1. **Stale IP from Cloud Test**: Mock cloud MQTT to return `192.168.1.100`, but printer is actually at `192.168.1.200` (will fail on unfixed code)
2. **Wrong Subnet IP Test**: Mock cloud MQTT to return `10.0.0.50`, but printer is on `192.168.1.x` subnet (will fail on unfixed code)
3. **Cache Has Better IP Test**: Mock cloud MQTT to return wrong IP, but Bambu Studio cache has correct same-subnet IP (will fail on unfixed code - cache not used)
4. **Timeout Too Short Test**: Simulate slow network where 7-second MQTT timeout is insufficient (may fail on unfixed code)

**Expected Counterexamples**:
- LAN connections fail (`mqtt=false`, `ftp=false`) even though printer is reachable
- Possible causes: stale cloud IP, wrong subnet, cache not prioritized, insufficient timeout

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := collectPrinterStatuses_fixed(input)
  ASSERT result.lan_online == true
  ASSERT result.mqtt == true
  ASSERT result.ftp == true
  ASSERT result.ip IS valid_reachable_ip
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT collectPrinterStatuses_original(input) = collectPrinterStatuses_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for offline printers, cloud-only printers, and working LAN connections, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Offline Printer Preservation**: Observe that offline printers show `lan_online=false` on unfixed code, then verify this continues after fix
2. **Cloud-Only Preservation**: Observe that cloud-only printers (not on LAN) show `cloud_online=true`, `lan_online=false` on unfixed code, then verify this continues after fix
3. **Working LAN Connection Preservation**: Observe that printers with correct IPs connect successfully on unfixed code, then verify this continues after fix
4. **Multi-Printer Independence Preservation**: Observe that multiple printers are checked independently on unfixed code, then verify this continues after fix

### Unit Tests

- Test `shouldReplaceMachineIp` with same-subnet vs different-subnet IPs
- Test `scoreIpCandidate` with various IP addresses and network configurations
- Test `validateIpReachability` (new function) with reachable and unreachable IPs
- Test `enrichMachineIpsFromBambuStudioCache` with cache containing better IPs than cloud
- Test `extractIpFromCloudMqttPayload` with various MQTT payload formats
- Test `convertUint32ToIpv4` with big-endian and little-endian values

### Property-Based Tests

- Generate random printer configurations with various IP sources and verify correct IP selection
- Generate random network configurations (different subnets) and verify same-subnet IPs are preferred
- Generate random cloud MQTT payloads and verify IP extraction handles all formats
- Test that offline detection works correctly across many random scenarios
- Test that cloud-only connectivity is preserved across many random scenarios

### Integration Tests

- Test full login flow with cloud MQTT enrichment and LAN connection attempts
- Test printer status collection with mixed scenarios (some online, some offline, some cloud-only)
- Test fallback from failed cloud IP to successful cache IP
- Test that Bambu Studio cache is properly scanned and prioritized
- Test timeout handling with simulated slow networks
