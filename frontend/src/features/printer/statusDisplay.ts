import type { PrinterStatus } from './types';

export type PrinterStageKind = 'printing' | 'preparing' | 'paused' | 'complete' | 'failed' | 'idle' | 'unknown';
type Translate = (key: string, params?: Record<string, string | number>) => string;
type Locale = 'zh' | 'en';

export function parseProgressPercent(value?: string | null): number {
    const numeric = Number.parseInt(String(value ?? '').replace('%', ''), 10);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(100, numeric));
}

export function getPrinterStageKind(printer: Pick<PrinterStatus, 'printing_stage' | 'gcode_state' | 'progress_percent' | 'layer_num' | 'total_layers' | 'online'>): PrinterStageKind {
    const rawStage = String(printer.printing_stage ?? '').trim().toLowerCase();
    const rawGcode = String(printer.gcode_state ?? '').trim().toLowerCase();
    const progress = parseProgressPercent(printer.progress_percent);
    const layerNum = Number(printer.layer_num);
    const totalLayers = Number(printer.total_layers);
    const finishedByLayers = Number.isFinite(layerNum) && Number.isFinite(totalLayers) && totalLayers > 0 && layerNum >= totalLayers;

    if (rawGcode === 'finish' || progress >= 100 || finishedByLayers) {
        return 'complete';
    }
    if (rawGcode === 'failed' || rawStage.includes('fail')) {
        return 'failed';
    }
    if (rawGcode === 'pause' || rawStage.includes('pause')) {
        return 'paused';
    }
    if (rawStage.includes('print')) {
        return 'printing';
    }
    if (
        rawStage.includes('heat')
        || rawStage.includes('calibrat')
        || rawStage.includes('inspect')
        || rawStage.includes('homing')
        || rawStage.includes('clean')
        || rawStage.includes('load')
        || rawStage.includes('unload')
        || rawStage.includes('chang')
        || rawStage.includes('cool')
    ) {
        return 'preparing';
    }
    if (rawGcode === 'idle' || rawStage === 'idle') {
        return 'idle';
    }
    if (!printer.online && !rawStage) {
        return 'unknown';
    }
    if (rawStage && rawStage !== 'unknown') {
        return 'idle';
    }
    return 'unknown';
}

export function isPrinterBusy(printer: Pick<PrinterStatus, 'printing_stage' | 'gcode_state' | 'progress_percent' | 'layer_num' | 'total_layers' | 'online'>): boolean {
    const stage = getPrinterStageKind(printer);
    return stage === 'printing' || stage === 'preparing' || stage === 'paused';
}

export function formatPrinterStage(printer: Pick<PrinterStatus, 'printing_stage' | 'gcode_state' | 'progress_percent' | 'layer_num' | 'total_layers' | 'online'>, t: Translate): string {
    const stage = getPrinterStageKind(printer);
    switch (stage) {
        case 'printing':
            return t('printer.stagePrinting');
        case 'preparing':
            return t('printer.stagePreparing');
        case 'paused':
            return t('printer.stagePaused');
        case 'complete':
            return t('printer.stageComplete');
        case 'failed':
            return t('printer.stageFailed');
        case 'idle':
            return t('printer.stageIdle');
        default:
            return t('printer.stageUnknown');
    }
}

export function formatRemainingTime(value?: string | null, locale: Locale = 'en'): string {
    const normalized = String(value ?? '').trim();
    if (!normalized || normalized.toLowerCase() === 'n/a') {
        return '--';
    }

    const match = normalized.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(-?\d+)s)?$/i);
    if (!match) {
        return normalized;
    }

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Math.max(0, Number(match[3] ?? 0));
    const parts: string[] = [];
    const labels = locale === 'zh'
        ? { h: '小时', m: '分', s: '秒' }
        : { h: 'h', m: 'm', s: 's' };

    if (hours > 0) {
        parts.push(`${hours}${labels.h}`);
    }
    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}${labels.m}`);
    }
    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds}${labels.s}`);
    }

    return parts.join(' ');
}

export function formatLayerProgress(printer: Pick<PrinterStatus, 'layer_num' | 'total_layers'>): string | null {
    const layerNum = Number(printer.layer_num);
    const totalLayers = Number(printer.total_layers);
    if (!Number.isFinite(layerNum) || !Number.isFinite(totalLayers) || totalLayers <= 0) {
        return null;
    }
    return `${layerNum}/${totalLayers}`;
}
