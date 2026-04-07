const axios = require('axios');
const path = require('path');

const { ensureBambuStudioRunning } = require('./studio');
const { TaskSession } = require('../runtime/taskSession');
const { validateAction } = require('../runtime/actionValidator');
const { verifyResult } = require('../runtime/resultVerifier');
const { captureWindow, getVisionTargetConfig } = require('../runtime/windowCapture');
const { executeAction } = require('../runtime/inputExecutor');

const activeSessions = new Map();

function getDefaultAllowedActions(task) {
    if (task === 'home_printer') {
        return ['click', 'double_click', 'wait'];
    }
    return ['click', 'double_click', 'wait'];
}

function normalizeTask(task) {
    if (task === 'home') return 'home_printer';
    if (task === 'move') return 'move_axis';
    return task;
}

async function requestPlan(config, session, capture, allowedActions) {
    const url = `${(config.backend_url || 'http://localhost:8000').replace(/\/$/, '')}/api/agent/desktop-vision/plan`;
    const headers = {};
    if (config.desktop_vision_auth_token) {
        headers.Authorization = `Bearer ${config.desktop_vision_auth_token}`;
    }

    try {
        const response = await axios.post(url, {
            session_id: session.id,
            task: session.task,
            step: session.step,
            screen: {
                image_base64: capture.imageBase64,
                width: capture.width,
                height: capture.height,
                window_title: capture.window_title,
            },
            history: session.history.map((item) => ({
                step: item.step,
                action: item.action,
                result: item.result,
                x: item.x,
                y: item.y,
                reason: item.reason,
            })),
            allowed_actions: allowedActions,
        }, {
            headers,
            timeout: 45000,
        });
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            throw new Error('Desktop vision planner rejected the request with 401. Configure desktop_vision_auth_token or adjust backend auth.');
        }
        if (error.response && error.response.data) {
            throw new Error(`Desktop vision planner failed: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Desktop vision planner failed: ${error.message}`);
    }
}

async function runDesktopVision(params, push, config) {
    const requestedTask = typeof params.task === 'string' ? params.task.trim() : '';
    const task = normalizeTask(requestedTask || 'home_printer');
    const printerId = typeof params.printer_id === 'string' ? params.printer_id.trim() : null;
    const targetApp = typeof params.target_app === 'string' ? params.target_app.trim() : 'bambu_studio';
    const targetConfig = getVisionTargetConfig(config, targetApp);
    const maxSteps = Number.isInteger(params?.options?.max_steps) ? params.options.max_steps : (task === 'move_axis' ? 6 : 5);
    const allowedActions = Array.isArray(params.allowed_actions) && params.allowed_actions.length > 0
        ? params.allowed_actions
        : getDefaultAllowedActions(task);

    const session = new TaskSession({
        task,
        maxSteps,
        targetApp,
        printerId,
    });
    activeSessions.set(session.id, session);

    try {
        if (task !== 'home_printer') {
            throw new Error(`Desktop Vision phase-1 only supports home_printer. Received '${task}'.`);
        }

        session.setState('preparing');
        push({ type: 'progress', data: session.toProgress('Preparing desktop vision session') });

        if (targetApp === 'bambu_studio') {
            await ensureBambuStudioRunning(config);
        }

        while (true) {
            session.assertActive();

            session.setState('capturing');
            push({ type: 'progress', data: session.toProgress('Capturing current window') });
            const beforeCapture = await captureWindow({
                config,
                targetApp,
                windowTitle: params.window_title || targetConfig.window_title,
                outputPath: path.join(path.resolve(__dirname, '../..'), `tmp-desktop-vision-${session.id}-before-${session.step}.png`),
            });

            session.setState('planning');
            push({ type: 'progress', data: session.toProgress('Requesting next action plan') });
            const plan = await requestPlan(config, session, beforeCapture, allowedActions);

            if (plan.status === 'done') {
                session.setState('completed');
                const result = {
                    session_id: session.id,
                    success: true,
                    steps: session.history.length,
                    task,
                    message: plan.message || 'Desktop vision task completed',
                };
                push({ type: 'done', data: result, message: result.message });
                return result;
            }

            if (plan.status === 'failed') {
                throw new Error(plan.message || 'Desktop vision planner returned failed');
            }

            session.setState('validating_action');
            const action = validateAction(plan.action, allowedActions, beforeCapture);
            push({
                type: 'progress',
                data: session.toProgress('Validated planner action', {
                    action: action.type,
                    reason: action.reason,
                }),
            });

            session.setState('executing');
            push({
                type: 'progress',
                data: session.toProgress('Executing planner action', {
                    action: action.type,
                    reason: action.reason,
                }),
            });
            await executeAction(action, beforeCapture);

            session.setState('verifying');
            const afterCapture = await captureWindow({
                config,
                targetApp,
                windowTitle: params.window_title || targetConfig.window_title,
                outputPath: path.join(path.resolve(__dirname, '../..'), `tmp-desktop-vision-${session.id}-after-${session.step}.png`),
            });
            const verificationResult = verifyResult({
                beforeCapture,
                afterCapture,
                verification: plan.verification,
            });
            if (!verificationResult.ok) {
                throw new Error(
                    verificationResult.expectation
                        ? `Desktop vision verification failed: ${verificationResult.reason} (${verificationResult.expectation})`
                        : `Desktop vision verification failed: ${verificationResult.reason}`
                );
            }

            session.addHistory({
                action: action.type,
                result: 'ok',
                x: action.x ?? null,
                y: action.y ?? null,
                reason: action.reason,
            });

            push({
                type: 'progress',
                data: session.toProgress('Action verified successfully', {
                    action: action.type,
                    verification: verificationResult.reason,
                }),
            });

            session.advance();
        }
    } finally {
        activeSessions.delete(session.id);
    }
}

function cancelDesktopVision(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) {
        return { ok: false, message: `Desktop vision session '${sessionId}' not found` };
    }
    session.cancel();
    return { ok: true, session_id: sessionId };
}

async function runLegacyVisionControl(params, push, config) {
    return runDesktopVision({
        ...params,
        task: normalizeTask(params.task || 'home_printer'),
        target_app: params.target_app || 'bambu_studio',
    }, push, config);
}

module.exports = {
    runDesktopVision,
    cancelDesktopVision,
    runLegacyVisionControl,
    activeSessions,
};
