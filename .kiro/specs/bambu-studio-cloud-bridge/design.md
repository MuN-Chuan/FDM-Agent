# Design Document: Bambu Studio Cloud-Bridge

## Overview

This design extends the Bambu printer control system to support routing commands through a locally-running Bambu Studio instance when printers are in cloud-only mode. Currently, cloud-only printers (`cloud_online: true`, `lan_online: false`) are controlled exclusively via cloud MQTT. This enhancement adds a "studio" route that leverages Bambu Studio's local automation interface as an intermediary, potentially providing better reliability or lower latency even for cloud-connected printers.

The design maintains full backward compatibility with existing LAN and cloud-only workflows while introducing a new routing option that sits between LAN (highest priority) and cloud (lowest priority) in the command routing hierarchy.

### Key Benefits

- Improved reliability for cloud-only printer control through Studio's established connection
- Potential latency reduction compared to direct cloud MQTT
- Unified control interface that automatically selects the best available route
- Graceful fallback when Studio is unavailable or fails

### Design Principles

1. Backward Compatibility: Existing LAN and cloud workflows remain unchanged
2. Transparent Routing: Frontend code requires no changes to benefit from Studio routing
3. Fail-Safe Fallback: Commands always attempt alternative routes on failure
4. Minimal Configuration: Studio route activates automatically when Studio is available

## Architecture

### System Context

