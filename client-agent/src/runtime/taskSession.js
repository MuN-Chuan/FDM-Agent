const crypto = require('crypto');

class TaskSession {
    constructor({ task, maxSteps = 5, targetApp = 'bambu_studio', printerId = null }) {
        this.id = `dv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.task = task;
        this.maxSteps = maxSteps;
        this.targetApp = targetApp;
        this.printerId = printerId;
        this.step = 1;
        this.state = 'queued';
        this.cancelled = false;
        this.history = [];
        this.createdAt = Date.now();
    }

    setState(state) {
        this.state = state;
    }

    addHistory(entry) {
        this.history.push({
            step: this.step,
            ...entry,
        });
    }

    advance() {
        this.step += 1;
    }

    cancel() {
        this.cancelled = true;
        this.state = 'cancelled';
    }

    assertActive() {
        if (this.cancelled) {
            throw new Error(`Desktop vision session ${this.id} was cancelled`);
        }
        if (this.step > this.maxSteps) {
            throw new Error(`Desktop vision session ${this.id} exceeded max steps (${this.maxSteps})`);
        }
    }

    toProgress(message, extra = {}) {
        return {
            session_id: this.id,
            task: this.task,
            target_app: this.targetApp,
            printer_id: this.printerId,
            state: this.state,
            step: this.step,
            message,
            ...extra,
        };
    }
}

module.exports = {
    TaskSession,
};
