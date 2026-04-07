function verifyResult({ beforeCapture, afterCapture, verification }) {
    if (!verification || verification.mode === 'none') {
        return { ok: true, reason: 'verification_skipped' };
    }

    if (!beforeCapture || !afterCapture) {
        return { ok: false, reason: 'missing_capture' };
    }

    if (verification.mode === 'screen_change' || verification.mode === 'target_state') {
        if (beforeCapture.imageBase64 !== afterCapture.imageBase64) {
            return { ok: true, reason: 'screen_changed' };
        }
        return {
            ok: false,
            reason: 'screen_unchanged',
            expectation: verification.expectation || null,
        };
    }

    return { ok: true, reason: 'verification_passthrough' };
}

module.exports = {
    verifyResult,
};
