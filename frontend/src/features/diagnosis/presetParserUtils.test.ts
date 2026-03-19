import { describe, expect, it } from 'vitest';

import type { PresetSelection, RawPreset } from './presetTypes';
import {
    createFallbackPreset,
    emptySelection,
    ensureDefectFilaments,
    extractPresetName,
    getPresetSelectionError,
} from './presetParserUtils';

function makePreset(name: string, path: string): RawPreset {
    return { name, path, data: {} };
}

describe('presetParserUtils', () => {
    it('extractPresetName prefers name then print_settings_id', () => {
        expect(extractPresetName({ name: 'Fast PLA' })).toBe('Fast PLA');
        expect(extractPresetName({ print_settings_id: '0.20 Standard' })).toBe('0.20 Standard');
        expect(extractPresetName({})).toBe('(Unknown)');
    });

    it('ensureDefectFilaments keeps defect selection aligned with filament selection', () => {
        const pla = makePreset('PLA', 'filament/pla.json');
        const petg = makePreset('PETG', 'filament/petg.json');

        expect(ensureDefectFilaments({ ...emptySelection(), filaments: [pla] }).defectFilaments).toEqual([pla]);

        const selection: PresetSelection = {
            ...emptySelection(),
            filaments: [pla],
            defectFilaments: [pla, petg],
        };
        expect(ensureDefectFilaments({ ...selection, filaments: [pla, petg] }).defectFilaments).toEqual([pla, petg]);
        expect(ensureDefectFilaments({ ...selection, filaments: [petg] }).defectFilaments).toEqual([petg]);
    });

    it('returns readable validation messages for missing preset selections', () => {
        const printer = makePreset('P1P', 'printer/p1p.json');
        const process = makePreset('0.20 Standard', 'process/standard.json');
        const filament = makePreset('PLA', 'filament/pla.json');

        expect(getPresetSelectionError(false, emptySelection())).toBe('请先上传预设文件。');
        expect(getPresetSelectionError(true, { ...emptySelection(), printer })).toBe('请选择工艺预设。');
        expect(
            getPresetSelectionError(true, {
                ...emptySelection(),
                printer,
                process,
                filaments: [filament, makePreset('PETG', 'filament/petg.json')],
            }),
        ).toBe('多色打印时，请标记产生缺陷的材料。');
        expect(
            getPresetSelectionError(true, {
                ...emptySelection(),
                printer,
                process,
                filaments: [filament],
                defectFilaments: [filament],
            }),
        ).toBeNull();
    });

    it('creates a fallback preset name from the zip path', () => {
        expect(createFallbackPreset('process/standard.json')).toEqual({
            name: 'standard.json',
            path: 'process/standard.json',
            data: {},
        });
    });
});
