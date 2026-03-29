import type { AgentMessage } from '../slicer/ClientAgentBridge';

export interface DiscoveredPrinter {
    id: string;
    name: string;
    ip: string | null;
    ip_source?: string | null;
    model: string | null;
    make: string | null;
    has_access_code: boolean;
    selected: boolean;
    cloud_online?: boolean;
}

export type PrinterRoute = 'lan' | 'studio' | 'cloud';

export interface PrinterRouteAvailability {
    lan: boolean;
    studio: boolean;
    cloud: boolean;
}

export type PrinterCommandRouteMap = Partial<Record<
    | 'printer_status'
    | 'ams_status'
    | 'printer_light_control'
    | 'print_start'
    | 'print_pause'
    | 'print_resume'
    | 'print_stop'
    | 'printer_home'
    | 'move_axis'
    | 'set_bed_temperature'
    | 'set_nozzle_temperature'
    | 'set_print_speed'
    | 'set_fan_speed'
    | 'extrude_filament'
    | 'send_gcode',
    PrinterRoute[]
>>;

export interface AmsTray {
    id: string;
    type: string | null;
    color: string | null;
    colors?: string[];
    remain: number | null;
    name: string | null;
}

export interface AmsModule {
    id: string;
    letter?: string;
    humidity: string | number | null;
    temp: string | number | null;
    trays: AmsTray[];
}

export interface PrinterStatus {
    id: string;
    name: string;
    ip: string | null;
    ip_source?: string | null;
    model: string | null;
    make: string | null;
    selected: boolean;
    online: boolean;
    cloud_online?: boolean;
    lan_online?: boolean;
    local_mode_required?: boolean;
    studio_available?: boolean;
    routes?: PrinterRouteAvailability;
    command_routes?: PrinterCommandRouteMap;
    ftp: boolean;
    mqtt: boolean;
    printing_stage: string;
    task_name: string;
    progress_percent: string;
    remaining_time: string;
    speed: string;
    nozzle_diameter: string;
    gcode_state?: string | null;
    layer_num?: number | null;
    total_layers?: number | null;
    nozzle_temp?: number | null;
    nozzle_target_temp?: number | null;
    bed_temp?: number | null;
    bed_target_temp?: number | null;
    chamber_temp?: number | null;
    ams_modules: AmsModule[];
    active_tray: string | null;
    has_external_spool: boolean;
    hms_errors: Array<{ code: string; message: string }>;
}

export interface DiscoveryResponse {
    config_file: string;
    username: string | null;
    mqtt_user: string | null;
    studio_status?: BambuStudioStatus;
    account_linked?: boolean;
    login_required: boolean;
    binding_required?: boolean;
    selected_printer_id: string | null;
    machines: DiscoveredPrinter[];
}

export interface StatusResponse extends DiscoveryResponse {
    checked_at?: string;
    message?: string;
    statuses: PrinterStatus[];
}

export interface PrinterLogEntry {
    id: string;
    ts: number;
    type: AgentMessage['type'];
    cmd?: string;
    message: string;
    raw?: string;
}

export interface BambuStudioStatus {
    installed: boolean;
    running: boolean;
    automation_ready: boolean;
    path: string | null;
    process_name: string | null;
    launched?: boolean;
}
