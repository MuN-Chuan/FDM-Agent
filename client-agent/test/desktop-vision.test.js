const assert = require('assert');
const { describe, it } = require('node:test');

const { TaskSession } = require('../src/runtime/taskSession');
const { validateAction } = require('../src/runtime/actionValidator');
const { verifyResult } = require('../src/runtime/resultVerifier');

describe('desktop vision runtime', () => {
    it('creates session and advances state', () => {
        const session = new TaskSession({ task: 'home_printer', maxSteps: 5, targetApp: 'bambu_studio' });
        assert.ok(session.id.startsWith('dv_'));
        assert.strictEqual(session.step, 1);
        session.setState('planning');
        session.addHistory({ action: 'click', result: 'ok', x: 10, y: 20 });
        session.advance();
        assert.strictEqual(session.state, 'planning');
        assert.strictEqual(session.step, 2);
        assert.strictEqual(session.history.length, 1);
    });

    it('rejects planner action outside allowed set', () => {
        assert.throws(() => validateAction(
            { type: 'scroll', delta: -1, reason: 'bad', confidence: 0.9 },
            ['click', 'wait'],
            { width: 100, height: 100 },
        ), /disallowed/);
    });

    it('verifies screen change by comparing captures', () => {
        const ok = verifyResult({
            beforeCapture: { imageBase64: 'aaa' },
            afterCapture: { imageBase64: 'bbb' },
            verification: { mode: 'screen_change', expectation: 'changed' },
        });
        const fail = verifyResult({
            beforeCapture: { imageBase64: 'aaa' },
            afterCapture: { imageBase64: 'aaa' },
            verification: { mode: 'screen_change', expectation: 'changed' },
        });

        assert.deepStrictEqual(ok, { ok: true, reason: 'screen_changed' });
        assert.strictEqual(fail.ok, false);
        assert.strictEqual(fail.reason, 'screen_unchanged');
    });
});
