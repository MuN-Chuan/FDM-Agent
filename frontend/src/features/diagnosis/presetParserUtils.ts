import type { PresetSelection, RawPreset } from './presetTypes';

export const emptySelection = (): PresetSelection => ({
    printer: null,
    process: null,
    filaments: [],
    defectFilaments: [],
});

export function extractPresetName(data: Record<string, unknown>): string {
    if (typeof data.name === 'string') return data.name;
    if (typeof data.print_settings_id === 'string') return data.print_settings_id;
    return '(Unknown)';
}

export function ensureDefectFilaments(selection: PresetSelection): PresetSelection {
    if (selection.filaments.length <= 1) {
        return {
            ...selection,
            defectFilaments: selection.filaments.length === 1 ? [selection.filaments[0]] : [],
        };
    }

    return {
        ...selection,
        defectFilaments: selection.defectFilaments.filter((defectFilament) =>
            selection.filaments.some((filament) => filament.path === defectFilament.path),
        ),
    };
}

export function getPresetSelectionError(
    hasBundle: boolean,
    selection: PresetSelection,
): string | null {
    if (!hasBundle) return '请先上传预设文件。';
    if (!selection.printer) return '请选择机器预设。';
    if (!selection.process) return '请选择工艺预设。';
    if (selection.filaments.length === 0) return '请至少选择一个材料预设。';
    if (selection.filaments.length > 1 && selection.defectFilaments.length === 0) {
        return '多色打印时，请标记产生缺陷的材料。';
    }
    return null;
}

export function createFallbackPreset(path: string): RawPreset {
    return {
        name: path.split('/').pop() ?? path,
        path,
        data: {},
    };
}
