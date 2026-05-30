import type { ChatSessionData, ChatSessionMetadata } from '../features/chat/chatSessionTypes';
import { api } from './api';

export type { ChatSessionData, ChatSessionMetadata } from '../features/chat/chatSessionTypes';

function normalizeSession(data: Awaited<ReturnType<typeof api.getChatSession>>): ChatSessionData {
    return {
        ...data,
        messages: data.messages.map((message) => ({
            ...message,
            role: message.role === 'assistant' ? 'assistant' : 'user',
        })),
    };
}

export const chatStorage = {
    async listSessions(): Promise<ChatSessionMetadata[]> {
        return api.listChatSessions();
    },

    async getSession(id: string): Promise<ChatSessionData | null> {
        try {
            return normalizeSession(await api.getChatSession(id));
        } catch {
            return null;
        }
    },

    async saveSession(data: ChatSessionData): Promise<void> {
        await api.saveChatSession(data.id, data);
    },

    async deleteSession(id: string): Promise<void> {
        await api.deleteChatSession(id);
    },
};
