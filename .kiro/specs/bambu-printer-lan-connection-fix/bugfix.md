# Bugfix Requirements Document

## Introduction

After successfully logging into a Bambu Lab account, the client-agent retrieves printer information from the cloud including IP addresses (via cloud MQTT). However, it fails to establish direct LAN connections (MQTT on port 8883 and FTP on port 990) to these printers, resulting in `lan_online=false`, `mqtt=false`, and `ftp=false` even when the printer is accessible on the local network and Bambu Studio can connect to it successfully.

This bug prevents the client-agent from controlling printers or retrieving real-time status over LAN, forcing reliance on cloud-only connectivity which is slower and less reliable.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the client-agent logs into Bambu Lab account and retrieves printer IP addresses from cloud MQTT (ip_source: "cloud_mqtt_net_info") THEN the system shows `cloud_online=true` but `lan_online=false`, `mqtt=false`, `ftp=false`

1.2 WHEN `collectPrinterStatuses` calls `fetchMqttStatus` and `checkFtp` with the cloud-provided IP address THEN the connections timeout or fail even though the printer is reachable on the LAN

1.3 WHEN the IP address obtained from cloud MQTT is used for LAN connection attempts THEN the connection fails despite Bambu Studio successfully connecting to the same printer


### Expected Behavior (Correct)

2.1 WHEN the client-agent logs into Bambu Lab account and retrieves printer information THEN the system SHALL obtain a valid, reachable LAN IP address for each printer

2.2 WHEN `collectPrinterStatuses` attempts to connect to a printer on the LAN THEN the system SHALL successfully establish MQTT connection on port 8883 and FTP connection on port 990

2.3 WHEN a printer is accessible on the LAN and has a valid access_code THEN the system SHALL show `lan_online=true`, `mqtt=true`, and `ftp=true`

2.4 WHEN the IP address from cloud MQTT is not reachable on the LAN THEN the system SHALL attempt alternative IP discovery methods (Bambu Studio cache, local network scan) before marking LAN connections as failed

2.5 WHEN connection timeouts occur THEN the system SHALL use appropriate timeout values that allow sufficient time for network operations to complete

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a printer is offline or not on the local network THEN the system SHALL CONTINUE TO correctly report `lan_online=false`, `mqtt=false`, `ftp=false`

3.2 WHEN cloud connectivity is available but LAN connectivity is not THEN the system SHALL CONTINUE TO correctly show `cloud_online=true` with `lan_online=false`

3.3 WHEN printer information is retrieved from the cloud THEN the system SHALL CONTINUE TO correctly populate printer metadata (id, name, model, make, access_code)

3.4 WHEN multiple printers are configured THEN the system SHALL CONTINUE TO check each printer's status independently

3.5 WHEN Bambu Studio cache contains IP hints THEN the system SHALL CONTINUE TO use `enrichMachineIpsFromBambuStudioCache` to supplement missing IP addresses
