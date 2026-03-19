import { beforeEach, describe, expect, it } from 'vitest';

import { chatStorage, type ChatSessionData } from './chatStorage';


class LocalStorageMock {
    private store = new Map<string, string>();

    clear() {
        this.store.clear();
    }

    getItem(key: string) {
        return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number) {
        return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string) {
        this.store.delete(key);
    }

    setItem(key: string, value: string) {
        this.store.set(key, value);
    }

    get length() {
        return this.store.size;
    }
}


const localStorageMock = new LocalStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
});


function buildSession(overrides: Partial<ChatSessionData> = {}): ChatSessionData {
    return {
        id: 'chat-1',
        title: 'First question',
        timestamp: 100,
        messages: [{ id: 'm1', role: 'user', content: 'hello' }],
        modifications: [],
        selection: {
            printer: null,
            process: null,
            filaments: [],
            defectFilaments: [],
        },
        bundle: null,
        presetFileName: null,
        ...overrides,
    };
}


describe('chatStorage', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('saves and loads a local session', async () => {
        const session = buildSession();

        await chatStorage.saveSession(session);

        await expect(chatStorage.getSession(session.id)).resolves.toEqual(session);
    });

    it('lists sessions by newest timestamp first', async () => {
        await chatStorage.saveSession(buildSession({ id: 'older', timestamp: 10, title: 'Old' }));
        await chatStorage.saveSession(buildSession({ id: 'newer', timestamp: 20, title: 'New' }));

        await expect(chatStorage.listSessions()).resolves.toEqual([
            { id: 'newer', title: 'New', timestamp: 20 },
            { id: 'older', title: 'Old', timestamp: 10 },
        ]);
    });

    it('deletes session metadata and content together', async () => {
        const session = buildSession({ id: 'delete-me' });
        await chatStorage.saveSession(session);

        await chatStorage.deleteSession(session.id);

        await expect(chatStorage.getSession(session.id)).resolves.toBeNull();
        await expect(chatStorage.listSessions()).resolves.toEqual([]);
    });
});
