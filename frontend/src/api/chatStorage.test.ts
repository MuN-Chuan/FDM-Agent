import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatStorage, type ChatSessionData } from './chatStorage';
import { api } from './api';


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
        vi.restoreAllMocks();
    });

    it('saves and loads a backend session', async () => {
        const session = buildSession();
        vi.spyOn(api, 'saveChatSession').mockResolvedValue(session);
        vi.spyOn(api, 'getChatSession').mockResolvedValue(session);

        await chatStorage.saveSession(session);

        await expect(chatStorage.getSession(session.id)).resolves.toEqual(session);
    });

    it('lists sessions by newest timestamp first', async () => {
        vi.spyOn(api, 'listChatSessions').mockResolvedValue([
            { id: 'newer', timestamp: 20, title: 'New' },
            { id: 'older', timestamp: 10, title: 'Old' },
        ]);

        await expect(chatStorage.listSessions()).resolves.toEqual([
            { id: 'newer', title: 'New', timestamp: 20 },
            { id: 'older', title: 'Old', timestamp: 10 },
        ]);
    });

    it('deletes a backend session', async () => {
        vi.spyOn(api, 'deleteChatSession').mockResolvedValue();
        const getSessionSpy = vi.spyOn(api, 'getChatSession').mockRejectedValue(new Error('not found'));

        await chatStorage.deleteSession('delete-me');

        expect(getSessionSpy).not.toHaveBeenCalled();
        await expect(chatStorage.getSession('delete-me')).resolves.toBeNull();
    });
});
