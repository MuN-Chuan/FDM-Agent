import { useCallback, useState } from 'react';
import JSZip from 'jszip';

import type { BundleFormat, ParsedBundle, PresetSelection, RawPreset } from './presetTypes';
import {
    createFallbackPreset,
    emptySelection,
    ensureDefectFilaments,
    extractPresetName,
    getPresetSelectionError,
} from './presetParserUtils';

export interface PresetParseError {
    type: 'invalid_format' | 'missing_category' | 'parse_error';
    message: string;
}

export function usePresetParser() {
    const [bundle, setBundle] = useState<ParsedBundle | null>(null);
    const [parseError, setParseError] = useState<PresetParseError | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [selection, setSelection] = useState<PresetSelection>(emptySelection);

    const parsePresetFile = useCallback(async (file: File) => {
        setIsParsing(true);
        setParseError(null);
        setBundle(null);
        setSelection(emptySelection());

        try {
            const ext = file.name.toLowerCase();
            const isBambu = ext.endsWith('.bbscfg');
            const isOrca = ext.endsWith('.orca_printer');

            if (!isBambu && !isOrca) {
                setParseError({
                    type: 'invalid_format',
                    message: `不支持的文件格式：${file.name}。请上传 .bbscfg 或 .orca_printer 文件。`,
                });
                setIsParsing(false);
                return null;
            }

            const format: BundleFormat = isBambu ? 'bambu' : 'orca';
            const zip = await JSZip.loadAsync(file);
            const bundleFile = zip.file('bundle_structure.json');

            if (!bundleFile) {
                setParseError({
                    type: 'missing_category',
                    message: '预设包损坏或格式不正确：缺少 bundle_structure.json。',
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

            async function readPresets(paths: string[]): Promise<RawPreset[]> {
                const results: RawPreset[] = [];
                for (const path of paths) {
                    const fileEntry = zip.file(path);
                    if (!fileEntry) continue;
                    try {
                        const text = await fileEntry.async('text');
                        const data = JSON.parse(text) as Record<string, unknown>;
                        results.push({ name: extractPresetName(data), path, data });
                    } catch {
                        results.push(createFallbackPreset(path));
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setParseError({ type: 'parse_error', message: `解析失败：${message}` });
            setIsParsing(false);
            return null;
        }
    }, []);

    const updateSelection = (patch: Partial<PresetSelection>) => {
        setSelection((previous) => ensureDefectFilaments({ ...previous, ...patch }));
    };

    const validateSelection = useCallback((): string | null => {
        return getPresetSelectionError(!!bundle, selection);
    }, [bundle, selection]);

    const restoreBundle = useCallback((newBundle: ParsedBundle, newSelection: PresetSelection) => {
        setBundle(newBundle);
        setSelection(newSelection);
    }, []);

    const resetPresetState = useCallback(() => {
        setBundle(null);
        setParseError(null);
        setIsParsing(false);
        setSelection(emptySelection());
    }, []);

    return {
        bundle,
        parseError,
        isParsing,
        selection,
        parsePresetFile,
        updateSelection,
        validateSelection,
        restoreBundle,
        resetPresetState,
    };
}
