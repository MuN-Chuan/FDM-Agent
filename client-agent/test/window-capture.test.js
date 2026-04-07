const assert = require('assert');
const { describe, it } = require('node:test');

const { buildCaptureSelectors, getVisionTargetConfig } = require('../src/runtime/windowCapture');

describe('window capture selectors', () => {
    it('includes Bambu Studio fallback title and process candidates', () => {
        const selectors = buildCaptureSelectors({
            targetConfig: getVisionTargetConfig({}, 'bambu_studio'),
            targetApp: 'bambu_studio',
        });

        assert.ok(selectors.windowTitleCandidates.includes('BambuStudio'));
        assert.ok(selectors.windowTitleCandidates.includes('Bambu Studio'));
        assert.ok(selectors.processNames.includes('bambu-studio'));
    });

    it('prioritizes explicit window title without losing defaults', () => {
        const selectors = buildCaptureSelectors({
            targetConfig: getVisionTargetConfig({}, 'bambu_studio'),
            targetApp: 'bambu_studio',
            windowTitle: 'My Custom Title',
        });

        assert.strictEqual(selectors.windowTitleCandidates[0], 'My Custom Title');
        assert.ok(selectors.windowTitleCandidates.includes('BambuStudio'));
    });
});
