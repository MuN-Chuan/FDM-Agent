export type BundleFormat = 'bambu' | 'orca';

export interface RawPreset {
    name: string;
    path: string;
    data: Record<string, unknown>;
}

export interface ParsedBundle {
    format: BundleFormat;
    bundleId: string;
    printers: RawPreset[];
    filaments: RawPreset[];
    processes: RawPreset[];
}

export interface PresetSelection {
    printer: RawPreset | null;
    process: RawPreset | null;
    filaments: RawPreset[];
    defectFilaments: RawPreset[];
}
