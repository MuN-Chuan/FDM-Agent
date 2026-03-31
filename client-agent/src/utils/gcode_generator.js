const fs = require('fs');
const path = require('path');

/**
 * G-code Generator Utility
 * 
 * Responsible for creating the G-code payload for "Fake Print" jobs.
 * Supports "Alignment Mode" (raw command) and "Safety Prep" (machine-specific start sequences).
 */

const RESOURCE_BASE = path.resolve(__dirname, '../../../backend/resources/bambu/profiles/BBL/machine');

/**
 * Map common printer names/IDs to their profile template base names.
 */
const PRINTER_MODEL_MAP = {
    'P1S': 'Bambu Lab P1S 0.4 nozzle',
    'P1P': 'Bambu Lab P1P 0.4 nozzle',
    'X1C': 'Bambu Lab X1 Carbon 0.4 nozzle',
    'X1': 'Bambu Lab X1 0.4 nozzle',
    'A1': 'Bambu Lab A1 0.4 nozzle',
    'A1mini': 'Bambu Lab A1 mini 0.4 nozzle',
    'A1 mini': 'Bambu Lab A1 mini 0.4 nozzle',
    'X1E': 'Bambu Lab X1E 0.4 nozzle',
};

/**
 * Normalizes printer model names to find the correct profile.
 */
function normalizeModelName(model) {
    if (!model) return null;
    const upper = model.toUpperCase().replace(/\s+/g, '');
    for (const [key, value] of Object.entries(PRINTER_MODEL_MAP)) {
        if (upper.includes(key.toUpperCase())) {
            return value;
        }
    }
    return null;
}

/**
 * Extracts start G-code from the JSON profile.
 */
function getMachineStartGcode(modelName) {
    const profileBase = normalizeModelName(modelName);
    if (!profileBase) {
        console.warn(`[GcodeGenerator] No profile found for model: ${modelName}`);
        return '';
    }

    const filePath = path.join(RESOURCE_BASE, `${profileBase} template machine_start_gcode.json`);
    if (!fs.existsSync(filePath)) {
        console.warn(`[GcodeGenerator] Start G-code file not found: ${filePath}`);
        return '';
    }

    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // The JSON often contains a single string or an array of lines.
        return Array.isArray(content) ? content.join('\n') : String(content || '');
    } catch (err) {
        console.error(`[GcodeGenerator] Failed to parse profile ${filePath}:`, err);
        return '';
    }
}

/**
 * Truncates G-code to stop at a specific command (default G28).
 */
function truncateAtHome(gcode) {
    if (!gcode) return '';
    const lines = gcode.split('\n');
    const result = [];
    for (const line of lines) {
        const trimmed = line.trim().toUpperCase();
        if (trimmed.startsWith('G28')) {
            result.push(line);
            break; // Stop after first G28
        }
        result.push(line);
    }
    return result.join('\n');
}

/**
 * Main entry point for generating G-code for a fake print task.
 */
function generateFakePrintGcode(modelName, targetCommands, useSafetyPrep = false) {
    let baseGcode = '';

    if (useSafetyPrep) {
        const fullStart = getMachineStartGcode(modelName);
        baseGcode = truncateAtHome(fullStart);
        // If truncation resulted in no G28, ensure we add one if homing is desired.
        if (!baseGcode.toUpperCase().includes('G28') && targetCommands.some(c => c.toUpperCase().startsWith('G28'))) {
             // We keep the safety header, then target commands will add the home.
        }
    }

    // append target commands
    const finalLines = [baseGcode];
    for (let cmd of targetCommands) {
        // Avoid duplicate G28 if safety prep already included it
        if (useSafetyPrep && cmd.toUpperCase().trim() === 'G28' && baseGcode.toUpperCase().includes('G28')) {
            continue;
        }
        finalLines.push(cmd);
    }

    return finalLines.filter(Boolean).join('\n') + '\n';
}

module.exports = {
    generateFakePrintGcode,
    normalizeModelName
};
