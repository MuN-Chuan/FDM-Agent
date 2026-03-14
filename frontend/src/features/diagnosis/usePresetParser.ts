import { useCallback, useState } from 'react';
import JSZip from 'jszip';

export type BundleFormat = 'bambu' | 'orca';

export interface RawPreset {
    name: string;
    path: string; // path inside zip (e.g. "printer/xxx.json")
    data: Record<string, unknown>;
}

export interface ParsedBundle {
    format: BundleFormat;
    bundleId: string;
    // Raw lists from bundle_structure.json
    printers: RawPreset[];
    filaments: RawPreset[];
    processes: RawPreset[];
}

export interface PresetSelection {
    printer: RawPreset | null;
    process: RawPreset | null;
    // Multiple filaments supported (multi-material/multi-color)
    filaments: RawPreset[];
    // When >1 filament selected, user can pick "defect" ones (can be multiple)
    defectFilaments: RawPreset[];
}

export interface PresetParseError {
    type: 'invalid_format' | 'missing_category' | 'parse_error';
    message: string;
}

function extractPresetName(data: Record<string, unknown>): string {
    if (typeof data['name'] === 'string') return data['name'];
    if (typeof data['print_settings_id'] === 'string') return data['print_settings_id'];
    return '(Unknown)';
}

export function usePresetParser() {
    const [bundle, setBundle] = useState<ParsedBundle | null>(null);
    const [parseError, setParseError] = useState<PresetParseError | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [selection, setSelection] = useState<PresetSelection>({
        printer: null,
        process: null,
        filaments: [],
        defectFilaments: []
    });

    const parsePresetFile = useCallback(async (file: File) => {
        setIsParsing(true);
        setParseError(null);
        setBundle(null);
        setSelection({ printer: null, process: null, filaments: [], defectFilaments: [] });

        try {
            // Validate extension
            const ext = file.name.toLowerCase();
            const isBambu = ext.endsWith('.bbscfg');
            const isOrca = ext.endsWith('.orca_printer');
            if (!isBambu && !isOrca) {
                setParseError({
                    type: 'invalid_format',
                    message: `不支持的文件格式: ${file.name}。请上传 .bbscfg（拓竹）或 .orca_printer（OrcaSlicer）文件。`,
                });
                setIsParsing(false);
                return null;
            }
            const format: BundleFormat = isBambu ? 'bambu' : 'orca';

            // Load ZIP
            const zip = await JSZip.loadAsync(file);

            // Read bundle_structure.json
            const bundleFile = zip.file('bundle_structure.json');
            if (!bundleFile) {
                setParseError({
                    type: 'missing_category',
                    message: '文件损坏或格式不正确：缺少 bundle_structure.json 清单文件。',
                });
                setIsParsing(false);
                return null;
            }

            const bundleJson = JSON.parse(await bundleFile.async('text')) as {
                bundle_id?: string;
                printer_config?: string[];
                filament_config?: string[];
                process_config?: string[];
            };

            // Validate all three categories exist
            if (!bundleJson.printer_config?.length) {
                setParseError({ type: 'missing_category', message: '预设包缺少机器预设（printer_config）。' });
                setIsParsing(false);
                return null;
            }
            if (!bundleJson.filament_config?.length) {
                setParseError({ type: 'missing_category', message: '预设包缺少材料预设（filament_config）。' });
                setIsParsing(false);
                return null;
            }
            if (!bundleJson.process_config?.length) {
                setParseError({ type: 'missing_category', message: '预设包缺少工艺预设（process_config）。' });
                setIsParsing(false);
                return null;
            }

            // Helper to read presets from zip
            async function readPresets(paths: string[]): Promise<RawPreset[]> {
                const results: RawPreset[] = [];
                for (const p of paths) {
                    const f = zip.file(p);
                    if (!f) continue;
                    try {
                        const text = await f.async('text');
                        const data = JSON.parse(text) as Record<string, unknown>;
                        results.push({ name: extractPresetName(data), path: p, data });
                    } catch {
                        results.push({ name: p.split('/').pop() ?? p, path: p, data: {} });
                    }
                }
                return results;
            }

            const [printers, filaments, processes] = await Promise.all([
                readPresets(bundleJson.printer_config),
                readPresets(bundleJson.filament_config),
                readPresets(bundleJson.process_config),
            ]);

            const parsed: ParsedBundle = {
                format,
                bundleId: bundleJson.bundle_id ?? file.name,
                printers,
                filaments,
                processes,
            };
            setBundle(parsed);
            setIsParsing(false);
            return parsed;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setParseError({ type: 'parse_error', message: `解析失败：${message}` });
            setIsParsing(false);
            return null;
        }
    }, []);

    /** Update a part of the selection and clear dependent fields as needed. */
    const updateSelection = (patch: Partial<PresetSelection>) => {
        setSelection(prev => {
            const next = { ...prev, ...patch };
            // Auto-fallback for defect material if count becomes small
            if (next.filaments.length <= 1) {
                next.defectFilaments = next.filaments.length === 1 ? [next.filaments[0]] : [];
            } else {
                // Remove any defect materials that are no longer in the selections
                next.defectFilaments = next.defectFilaments.filter(df =>
                    next.filaments.some(f => f.path === df.path)
                );
            }
            return next;
        });
    };

    /** Validate that all selected presets are from the same bundle and relations hold. */
    const validateSelection = useCallback((): string | null => {
        if (!bundle) return '请先上传预设文件。';
        if (!selection.printer) return '请选择机器预设';
        if (!selection.process) return '请选择工艺预设';
        if (selection.filaments.length === 0) return '请至少选择一个材料预设';
        if (selection.filaments.length > 1 && selection.defectFilaments.length === 0) {
            return '多色打印请标记产生缺陷的材料';
        }
        return null;
    }, [bundle, selection]);

    const restoreBundle = useCallback((newBundle: ParsedBundle, newSelection: PresetSelection) => {
        setBundle(newBundle);
        setSelection(newSelection);
    }, []);

    return {
        bundle,
        parseError,
        isParsing,
        selection,
        parsePresetFile,
        updateSelection,
        validateSelection,
        restoreBundle
    };
}
