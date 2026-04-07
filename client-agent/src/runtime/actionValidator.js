function validateAction(action, allowedActions, capture) {
    if (!action || typeof action !== 'object') {
        throw new Error('Desktop vision planner returned an empty action');
    }

    if (!allowedActions.includes(action.type)) {
        throw new Error(`Planner returned disallowed action '${action.type}'`);
    }

    if ((action.type === 'click' || action.type === 'double_click') && (!Number.isInteger(action.x) || !Number.isInteger(action.y))) {
        throw new Error(`${action.type} requires integer x/y coordinates`);
    }

    if ((action.type === 'click' || action.type === 'double_click') && capture) {
        const width = Number(capture.width || 0);
        const height = Number(capture.height || 0);
        if (action.x < 0 || action.x > width || action.y < 0 || action.y > height) {
            throw new Error(`Planner returned out-of-bounds coordinates (${action.x}, ${action.y}) for ${width}x${height}`);
        }
    }

    if (typeof action.confidence === 'number' && action.confidence < 0.35) {
        throw new Error(`Planner confidence too low (${action.confidence})`);
    }

    return action;
}

module.exports = {
    validateAction,
};
