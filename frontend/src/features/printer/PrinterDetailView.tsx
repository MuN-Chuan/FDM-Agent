import React, { useState, useEffect, useRef } from 'react';
import { 
    Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, 
    Box, Camera, CornerRightUp, 
    Fan, Home, Maximize2, 
    Move, Play, Square, Pause, 
    Settings, Thermometer, Wind, Zap
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { PrinterStatus, PrinterLogEntry } from './types';
import { useClientAgent } from '../slicer/useClientAgent';
import { formatLayerProgress, formatPrinterStage, formatRemainingTime, isPrinterBusy, parseProgressPercent } from './statusDisplay';
import { HomeConfirmModal } from './HomeConfirmModal';

interface PrinterDetailViewProps {
    printer: PrinterStatus;
    logs: PrinterLogEntry[];
    onBack: () => void;
}

export const PrinterDetailView: React.FC<PrinterDetailViewProps> = ({
    printer,
    logs,
    onBack,
}) => {
    const { t, locale } = useI18n();
    const { bridge } = useClientAgent();
    const [selectedTab, setSelectedTab] = useState<'control' | 'logs' | 'params'>('control');
    const [moveStep, setMoveStep] = useState(10);
    const [targetNozzleTemp, setTargetNozzleTemp] = useState('');
    const [targetBedTemp, setTargetBedTemp] = useState('');
    const [isHomeDialogOpen, setIsHomeDialogOpen] = useState(false);
    const [cloudMode, setCloudMode] = useState<'normal' | 'fake_print' | 'fara_7b'>('normal');
    const [useSafetyPrep, setUseSafetyPrep] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedTab === 'logs') {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, selectedTab]);

    const isPrinting = isPrinterBusy(printer);
    const progressValue = parseProgressPercent(printer.progress_percent);
    const stageLabel = formatPrinterStage(printer, t);
    const remainingLabel = formatRemainingTime(printer.remaining_time, locale);
    const layerLabel = formatLayerProgress(printer);
    const getCommandRoutes = (command: keyof NonNullable<PrinterStatus['command_routes']>) => {
        return printer.command_routes?.[command] ?? [];
    };
    const isCommandUnavailable = (command: keyof NonNullable<PrinterStatus['command_routes']>) => {
        return getCommandRoutes(command).length === 0;
    };
    const getCommandHint = (command: keyof NonNullable<PrinterStatus['command_routes']>) => {
        if (!isCommandUnavailable(command)) {
            return undefined;
        }
        if (['printer_home', 'move_axis', 'set_bed_temperature', 'set_nozzle_temperature', 'set_print_speed', 'set_fan_speed', 'extrude_filament', 'send_gcode'].includes(command)) {
            return t('printer.lanControlRequired');
        }
        return t('printer.controlRequired');
    };
    const motionUnavailable = isCommandUnavailable('move_axis');
    const homeUnavailable = isCommandUnavailable('printer_home');
    const nozzleTempUnavailable = isCommandUnavailable('set_nozzle_temperature');
    const bedTempUnavailable = isCommandUnavailable('set_bed_temperature');
    const fanUnavailable = isCommandUnavailable('set_fan_speed');
    const extrudeUnavailable = isCommandUnavailable('extrude_filament');
    const lightUnavailable = isCommandUnavailable('printer_light_control');
    const amsUnavailable = isCommandUnavailable('ams_status');

    const handleMove = (axis: 'X' | 'Y' | 'Z', distance: number) => {
        if (motionUnavailable || cloudMode === 'normal') {
            return;
        }
        bridge.moveAxis(printer.id, axis, distance, undefined, cloudMode, useSafetyPrep);
    };

    const handleOpenHomeDialog = () => {
        if (homeUnavailable || cloudMode === 'normal') {
            return;
        }
        setIsHomeDialogOpen(true);
    };

    const handleConfirmHome = () => {
        bridge.homePrinter(printer.id, cloudMode, useSafetyPrep);
        setIsHomeDialogOpen(false);
    };

    const handleSetTemp = (type: 'nozzle' | 'bed') => {
        const temp = parseInt(type === 'nozzle' ? targetNozzleTemp : targetBedTemp, 10);
        if (isNaN(temp)) return;
        if (type === 'nozzle') bridge.setNozzleTemperature(printer.id, temp, cloudMode);
        else bridge.setBedTemperature(printer.id, temp, cloudMode);
    };
    const nozzleTemp = printer.nozzle_temp ?? 0;
    const nozzleTargetTemp = printer.nozzle_target_temp ?? 0;
    const bedTemp = printer.bed_temp ?? 0;
    const bedTargetTemp = printer.bed_target_temp ?? 0;
    const nozzleProgress = Math.max(0, Math.min(100, ((nozzleTargetTemp > 0 ? nozzleTemp / nozzleTargetTemp : nozzleTemp / 300) || 0) * 100));
    const bedProgress = Math.max(0, Math.min(100, ((bedTargetTemp > 0 ? bedTemp / bedTargetTemp : bedTemp / 120) || 0) * 100));

    const amsTrays = printer.ams_modules.flatMap((module) =>
        module.trays.map((tray, index) => {
            const colors = Array.isArray(tray.colors) && tray.colors.length > 0
                ? tray.colors
                : tray.color
                    ? [tray.color]
                    : [];
            const trayLabel = module.letter ? `AMS ${module.letter}${index + 1}` : `TRAY ${index + 1}`;
            return {
                ...tray,
                key: `${module.id}-${tray.id || index}`,
                label: trayLabel,
                isActive: printer.active_tray === trayLabel,
                colors,
            };
        }),
    );

    return (
        <div className="flex h-full flex-col gap-6 animate-in fade-in duration-500">
            {/* Header / Status Bar */}
            <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)]">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)] transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-heading text-xl font-bold text-slate-900">{printer.name}</h2>
                            <span className={`h-2 w-2 rounded-full ${printer.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                            {printer.make || printer.model} • {printer.id}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                    <div className="flex items-center gap-2 mr-2">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Cloud Mode:</label>
                        <select 
                            value={cloudMode}
                            onChange={(e) => setCloudMode(e.target.value as any)}
                            className="bg-[var(--color-surface-muted)] border border-[var(--shell-border)] text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--color-primary)] font-medium text-slate-700"
                        >
                            <option value="normal">Normal (Restricted)</option>
                            <option value="fake_print">Fake Print Job</option>
                            <option value="fara_7b">Fara-7B Vision</option>
                        </select>
                    </div>
                    {cloudMode === 'fake_print' && (
                        <div className="flex items-center gap-2 mr-2 bg-slate-50 border border-slate-200 rounded px-2 py-1 shadow-sm animate-in slide-in-from-right-2 fade-in duration-300">
                            <input 
                                type="checkbox" 
                                id="safety-prep-toggle"
                                checked={useSafetyPrep}
                                onChange={(e) => setUseSafetyPrep(e.target.checked)}
                                className="h-3 w-3 rounded text-[var(--color-primary)] border-slate-300 focus:ring-0 cursor-pointer"
                            />
                            <label 
                                htmlFor="safety-prep-toggle" 
                                className="text-[10px] font-bold text-slate-600 uppercase tracking-tight cursor-pointer hover:text-[var(--color-primary)] transition-colors"
                            >
                                Safety Prep (Safe Buffer)
                            </label>
                        </div>
                    )}
                    <div className="min-w-[280px] rounded-lg border border-[var(--shell-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{t('printer.machineProgress')}</span>
                                <span className="text-lg font-bold text-[var(--color-primary)]">{printer.progress_percent}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{t('printer.currentStage')}</span>
                                <span className="text-sm font-bold text-slate-800">{stageLabel}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{t('printer.remainingTime')}</span>
                                <span className="text-sm font-bold text-slate-800">{remainingLabel}</span>
                            </div>
                        </div>
                        {layerLabel && (
                            <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--shell-border)] pt-3 text-xs font-medium text-[var(--color-text-muted)]">
                                <span>{t('printer.layerProgress')}</span>
                                <span className="font-bold text-slate-800">{layerLabel}</span>
                            </div>
                        )}
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500"
                                style={{ width: `${progressValue}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isPrinting ? (
                            <>
                                <button 
                                    onClick={() => bridge.printPause(printer.id)}
                                    className="flex items-center gap-2 rounded bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-amber-600 transition-all"
                                >
                                    <Pause size={16} fill="currentColor" /> {t('printer.pause')}
                                </button>
                                <button 
                                    onClick={() => bridge.printStop(printer.id, true)}
                                    className="flex items-center gap-2 rounded bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-rose-700 transition-all"
                                >
                                    <Square size={16} fill="currentColor" /> {t('printer.stop')}
                                </button>
                            </>
                        ) : (
                            <button 
                                disabled={!printer.online}
                                className="flex items-center gap-2 rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-container)] transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                <Play size={16} fill="currentColor" /> {t('printer.start')}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Workbench Layout */}
            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] min-h-0">
                {/* Left Column: Vision & Controls */}
                <div className="flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Vision Module */}
                    <div className="relative aspect-video w-full rounded-lg bg-slate-950 overflow-hidden shadow-inner ring-1 ring-slate-800">
                        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
                            <div className="flex items-center gap-2 text-white/90">
                                <Activity size={16} className="text-emerald-400" />
                                <span className="text-xs font-bold uppercase tracking-widest">Live Feed - 1080p</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => bridge.cameraSnapshot(printer.id)}
                                    className="text-white/70 hover:text-white p-1"
                                    title="Take Snapshot"
                                >
                                    <Camera size={16} />
                                </button>
                                <button className="text-white/70 hover:text-white p-1">
                                    <Maximize2 size={16} />
                                </button>
                            </div>
                        </div>
                        {/* Camera Content Placeholder */}
                        <div className="h-full w-full flex items-center justify-center">
                            <Zap size={48} className="text-white/5 animate-pulse" />
                        </div>
                    </div>

                    {/* Interaction Tabs */}
                    <div className="flex gap-1 border-b border-[var(--shell-border)]">
                        <button 
                            onClick={() => setSelectedTab('control')}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${selectedTab === 'control' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-slate-900'}`}
                        >
                            {t('printer.capabilityPanel')}
                        </button>
                        <button 
                            onClick={() => setSelectedTab('logs')}
                            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${selectedTab === 'logs' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-slate-900'}`}
                        >
                            {t('printer.activityLog')}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1">
                        {selectedTab === 'control' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                                {/* Movement Module */}
                                <div className="rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)]">
                                            <div className="flex items-center gap-2 mb-6">
                                                <Move size={18} className="text-[var(--color-primary)]" />
                                                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">Motion Control</h3>
                                            </div>
                                    {motionUnavailable && (
                                        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                                            {t('printer.lanControlRequired')}
                                        </div>
                                    )}
                                    {printer.local_mode_required && (
                                        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-800">
                                            {t('printer.localModeRequired')}
                                        </div>
                                    )}
                                    <div className="flex justify-center gap-8">
                                        {/* XY Pad */}
                                        <div className="relative h-40 w-40 rounded-full bg-[var(--color-surface-muted)] shadow-inner ring-1 ring-[var(--shell-border)]">
                                            <button 
                                                onClick={() => handleMove('Y', moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="absolute left-1/2 top-4 -translate-x-1/2 p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600 disabled:opacity-30 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowUp size={24} />
                                            </button>
                                            <button 
                                                onClick={() => handleMove('X', -moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600 disabled:opacity-30 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowLeft size={24} />
                                            </button>
                                            <button 
                                                onClick={() => handleMove('X', moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600 disabled:opacity-30 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowRight size={24} />
                                            </button>
                                            <button 
                                                onClick={() => handleMove('Y', -moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="absolute left-1/2 bottom-4 -translate-x-1/2 p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600 disabled:opacity-30 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowDown size={24} />
                                            </button>
                                            <button 
                                                onClick={handleOpenHomeDialog}
                                                disabled={homeUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('printer_home') : undefined}
                                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center text-[var(--color-primary)] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:active:scale-100 disabled:bg-slate-50 disabled:text-slate-400"
                                            >
                                                <Home size={24} />
                                            </button>
                                        </div>
                                        {/* Z Pad */}
                                        <div className="flex flex-col gap-4">
                                            <button 
                                                onClick={() => handleMove('Z', moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-white hover:shadow-md transition-all disabled:opacity-40 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowUp size={20} />
                                                <span className="text-[10px] font-bold">Z+</span>
                                            </button>
                                            <button 
                                                onClick={() => handleMove('Z', -moveStep)}
                                                disabled={motionUnavailable || cloudMode === 'normal'}
                                                title={cloudMode === 'normal' ? getCommandHint('move_axis') : undefined}
                                                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-white hover:shadow-md transition-all disabled:opacity-40 disabled:hover:shadow-none disabled:hover:bg-transparent"
                                            >
                                                <ArrowDown size={20} />
                                                <span className="text-[10px] font-bold">Z-</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex justify-center gap-2">
                                        {[0.1, 1, 10, 50, 100].map(val => (
                                            <button 
                                                key={val} 
                                                onClick={() => setMoveStep(val)}
                                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${moveStep === val ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-muted)] text-slate-600 hover:bg-white hover:ring-1 hover:ring-[var(--color-primary)]'}`}
                                            >
                                                {val}mm
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Thermal Module */}
                                <div className="rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)]">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Thermometer size={18} className="text-rose-600" />
                                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">Thermal Systems</h3>
                                    </div>
                                    <div className="space-y-6">
                                        {/* Nozzle */}
                                        <div className="group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Nozzle Temp</span>
                                                <span className="text-sm font-black text-slate-900">{nozzleTemp.toFixed(1)}°C <span className="text-slate-400 font-medium">/ {nozzleTargetTemp.toFixed(0)}°C</span></span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${nozzleProgress}%` }} />
                                            </div>
                                            <div className="mt-3 flex gap-2">
                                                <input 
                                                    type="number" 
                                                    value={targetNozzleTemp}
                                                    onChange={e => setTargetNozzleTemp(e.target.value)}
                                                    className="w-20 rounded border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-rose-500" 
                                                    placeholder="Target"
                                                />
                                                <button 
                                                    onClick={() => handleSetTemp('nozzle')}
                                                    disabled={nozzleTempUnavailable}
                                                    title={getCommandHint('set_nozzle_temperature')}
                                                    className="rounded bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                                                >
                                                    SET
                                                </button>
                                                <button 
                                                    onClick={() => bridge.setNozzleTemperature(printer.id, 0)}
                                                    disabled={nozzleTempUnavailable}
                                                    title={getCommandHint('set_nozzle_temperature')}
                                                    className="rounded bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                                                >
                                                    OFF
                                                </button>
                                            </div>
                                        </div>
                                        {/* Bed */}
                                        <div className="group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Heatbed Temp</span>
                                                <span className="text-sm font-black text-slate-900">{bedTemp.toFixed(1)}°C <span className="text-slate-400 font-medium">/ {bedTargetTemp.toFixed(0)}°C</span></span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${bedProgress}%` }} />
                                            </div>
                                            <div className="mt-3 flex gap-2">
                                                <input 
                                                    type="number" 
                                                    value={targetBedTemp}
                                                    onChange={e => setTargetBedTemp(e.target.value)}
                                                    className="w-20 rounded border border-slate-200 bg-[var(--color-surface-muted)] px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500" 
                                                    placeholder="Target"
                                                />
                                                <button 
                                                    onClick={() => handleSetTemp('bed')}
                                                    disabled={bedTempUnavailable}
                                                    title={getCommandHint('set_bed_temperature')}
                                                    className="rounded bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                                                >
                                                    SET
                                                </button>
                                                <button 
                                                    onClick={() => bridge.setBedTemperature(printer.id, 0)}
                                                    disabled={bedTempUnavailable}
                                                    title={getCommandHint('set_bed_temperature')}
                                                    className="rounded bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                                                >
                                                    OFF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Macro/Action Module */}
                                <div className="rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)] md:col-span-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings size={18} className="text-slate-500" />
                                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">Macros & Auxiliary</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                                            <div className="mb-3 flex items-center gap-2">
                                                <Zap size={16} className="text-amber-600" />
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">{t('printer.lightControl')}</h4>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => bridge.controlPrinterLight(printer.id, 'on')}
                                                    disabled={lightUnavailable}
                                                    title={getCommandHint('printer_light_control')}
                                                    className="rounded bg-white px-3 py-2 text-xs font-bold text-amber-800 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100"
                                                >
                                                    {t('printer.lightOn')}
                                                </button>
                                                <button
                                                    onClick={() => bridge.controlPrinterLight(printer.id, 'off')}
                                                    disabled={lightUnavailable}
                                                    title={getCommandHint('printer_light_control')}
                                                    className="rounded bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
                                                >
                                                    {t('printer.lightOff')}
                                                </button>
                                                <button
                                                    onClick={() => bridge.controlPrinterLight(printer.id, 'auto')}
                                                    disabled={lightUnavailable}
                                                    title={getCommandHint('printer_light_control')}
                                                    className="rounded bg-white px-3 py-2 text-xs font-bold text-sky-700 shadow-sm ring-1 ring-sky-200 transition hover:bg-sky-100"
                                                >
                                                    {t('printer.lightAuto')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                                            <div className="mb-3 flex items-center gap-2">
                                                <Fan size={16} className="text-emerald-600" />
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">{t('printer.fanControl')}</h4>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">{t('printer.fanPart')}</div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 0, 'part')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">0%</button>
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 50, 'part')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">50%</button>
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 100, 'part')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50">100%</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">{t('printer.fanChamber')}</div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 0, 'chamber')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">0%</button>
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 50, 'chamber')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50">50%</button>
                                                        <button onClick={() => bridge.setFanSpeed(printer.id, 100, 'chamber')} disabled={fanUnavailable} title={getCommandHint('set_fan_speed')} className="rounded bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50">100%</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => bridge.getAmsStatus(printer.id)}
                                            disabled={amsUnavailable}
                                            title={getCommandHint('ams_status')}
                                            className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                                        >
                                            <Wind size={14} className="text-sky-500" /> {t('printer.refreshAms')}
                                        </button>
                                        <button 
                                            onClick={() => bridge.extrudeFilament(printer.id, 50)}
                                            disabled={extrudeUnavailable}
                                            title={getCommandHint('extrude_filament')}
                                            className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                                        >
                                            <CornerRightUp size={14} className="text-rose-500" /> {t('printer.extrude')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedTab === 'logs' && (
                            <div className="flex flex-col h-[500px] rounded-lg bg-slate-950 p-4 shadow-inner">
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                    {logs.map((log) => (
                                        <div key={log.id} className="font-mono text-[11px] flex gap-3">
                                            <span className="text-slate-500 shrink-0">[{new Date(log.ts).toLocaleTimeString()}]</span>
                                            <span className={`px-1.5 rounded uppercase font-bold text-[9px] h-fit mt-0.5 ${
                                                log.type === 'error' ? 'bg-rose-900/40 text-rose-400' :
                                                log.type === 'done' ? 'bg-emerald-900/40 text-emerald-400' :
                                                'bg-slate-800 text-slate-400'
                                            }`}>
                                                {log.type}
                                            </span>
                                            <span className="text-slate-300 break-all">{log.message}</span>
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: AMS & Info */}
                <div className="hidden lg:flex flex-col gap-6">
                    {/* AMS Module */}
                    <div className="rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)]">
                        <div className="flex items-center gap-2 mb-4">
                            <Box size={18} className="text-sky-600" />
                            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">AMS Management</h3>
                        </div>
                        {printer.has_external_spool && (
                            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                                {t('printer.externalSpoolActive')}
                            </div>
                        )}
                        {amsTrays.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {amsTrays.map((tray) => (
                                    <div
                                        key={tray.key}
                                        className={`p-3 rounded-lg border ${tray.isActive ? 'border-[var(--color-primary)] bg-emerald-50/30' : 'border-slate-100 bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-slate-400">{tray.label}</span>
                                            <div className="flex items-center gap-1">
                                                {tray.colors.length > 0 ? tray.colors.slice(0, 2).map((color, idx) => (
                                                    <div
                                                        key={`${tray.key}-${idx}`}
                                                        className="h-3 w-3 rounded-full border border-white/60 shadow-sm"
                                                        style={{ backgroundColor: `#${color}` }}
                                                    />
                                                )) : (
                                                    <div className="h-3 w-3 rounded-full bg-slate-300 shadow-sm" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-slate-700">{tray.name || tray.type || 'Unknown filament'}</div>
                                        <div className="mt-2 text-[10px] font-medium text-[var(--color-text-muted)]">
                                            {tray.type || 'Unknown'} · {tray.remain != null ? `${tray.remain}% Remaining` : 'Remaining n/a'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                                {t('printer.noAmsData')}
                            </div>
                        )}
                    </div>

                    {/* Printer Info */}
                    <div className="rounded-lg bg-[var(--color-surface)] p-5 shadow-sm ring-1 ring-[var(--shell-border)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-slate-900">Technical Data</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">Nozzle Size</span>
                                <span className="font-bold text-slate-700">{printer.nozzle_diameter || '0.4mm'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">Chamber Temp</span>
                                <span className="font-bold text-slate-700">{printer.chamber_temp != null ? `${printer.chamber_temp}°C` : 'n/a'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">IP Address</span>
                                <span className="font-bold text-slate-700">{printer.ip || 'n/a'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">{t('printer.currentStage')}</span>
                                <span className="font-bold text-slate-700">{stageLabel}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">{t('printer.remainingTime')}</span>
                                <span className="font-bold text-slate-700">{remainingLabel}</span>
                            </div>
                            {layerLabel && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-[var(--color-text-muted)]">{t('printer.layerProgress')}</span>
                                    <span className="font-bold text-slate-700">{layerLabel}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-[var(--color-text-muted)]">Connection</span>
                                <div className="flex gap-1.5">
                                    <span className={`h-2.5 w-2.5 rounded-full ${printer.mqtt ? 'bg-sky-500' : 'bg-slate-300'}`} title="MQTT" />
                                    <span className={`h-2.5 w-2.5 rounded-full ${printer.ftp ? 'bg-violet-500' : 'bg-slate-300'}`} title="FTP" />
                                    <span className={`h-2.5 w-2.5 rounded-full ${printer.cloud_online ? 'bg-emerald-500' : 'bg-slate-300'}`} title="Cloud" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <HomeConfirmModal
                isOpen={isHomeDialogOpen}
                printerName={printer.name}
                stageLabel={stageLabel}
                isBusy={isPrinting}
                onClose={() => setIsHomeDialogOpen(false)}
                onConfirm={handleConfirmHome}
            />
        </div>
    );
};

