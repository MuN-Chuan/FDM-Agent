import { api } from './api';
import type { Modification, SessionMetadata, SessionPayload, UserProfile } from './api';

export type ChatSessionMetadata = SessionMetadata;

export interface ChatSessionData extends ChatSessionMetadata {
    messages: any[];
    modifications: Modification[];
    selection: any;
    bundle: any;
    presetFileName: string | null;
}

const METADATA_KEY = 'fdm_chat_sessions_metadata';
const SESSION_PREFIX = 'fdm_chat_session_';

function readLocalMetadata(): ChatSessionMetadata[] {
    const raw = localStorage.getItem(METADATA_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw).sort((a: ChatSessionMetadata, b: ChatSessionMetadata) => b.timestamp - a.timestamp);
    } catch {
        return [];
    }
}

function readLocalSession(id: string): ChatSessionData | null {
    const raw = localStorage.getItem(SESSION_PREFIX + id);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function writeLocalSession(data: ChatSessionData) {
    localStorage.setItem(SESSION_PREFIX + data.id, JSON.stringify(data));

    const metadataList = readLocalMetadata();
    const existingIdx = metadataList.findIndex(m => m.id === data.id);
    const meta: ChatSessionMetadata = {
        id: data.id,
        title: data.title,
        timestamp: data.timestamp,
    };

    if (existingIdx >= 0) {
        metadataList[existingIdx] = meta;
    } else {
        metadataList.unshift(meta);
    }

    localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
}

function deleteLocalSession(id: string) {
    localStorage.removeItem(SESSION_PREFIX + id);
    const metadataList = readLocalMetadata().filter(m => m.id !== id);
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
}

function normalizeSession(session: SessionPayload): ChatSessionData {
    return {
        id: session.id,
        title: session.title,
        timestamp: session.timestamp,
        messages: session.messages,
        modifications: session.modifications || [],
        selection: session.selection,
        bundle: session.bundle,
        presetFileName: session.presetFileName,
    };
}

function toPayload(data: ChatSessionData): SessionPayload {
    return {
        id: data.id,
        title: data.title,
        timestamp: data.timestamp,
        messages: data.messages,
        modifications: data.modifications,
        selection: data.selection,
        bundle: data.bundle,
        presetFileName: data.presetFileName,
    };
}

export const chatStorage = {
    async getCurrentUser(): Promise<UserProfile | null> {
        try {
            return await api.getCurrentUser();
        } catch {
            return null;
        }
    },

    async listSessions(): Promise<ChatSessionMetadata[]> {
        const user = await this.getCurrentUser();
        if (!user) {
            return readLocalMetadata();
        }

        try {
            return await api.listChatSessions();
        } catch (error) {
            console.error('Failed to load remote chat sessions, falling back to local:', error);
            return readLocalMetadata();
        }
    },

    async getSession(id: string): Promise<ChatSessionData | null> {
        const user = await this.getCurrentUser();
        if (!user) {
            return readLocalSession(id);
        }

        try {
            const session = await api.getChatSession(id);
            return normalizeSession(session);
        } catch (error) {
            console.error('Failed to load remote session, falling back to local:', error);
            return readLocalSession(id);
        }
    },

    async saveSession(data: ChatSessionData): Promise<void> {
        const user = await this.getCurrentUser();
        if (!user) {
            writeLocalSession(data);
            return;
        }

        try {
            await api.saveChatSession(data.id, toPayload(data));
        } catch (error) {
            console.error('Failed to save remote session, falling back to local:', error);
            writeLocalSession(data);
        }
    },

    async deleteSession(id: string): Promise<void> {
        const user = await this.getCurrentUser();
        if (!user) {
            deleteLocalSession(id);
            return;
        }

        try {
            await api.deleteChatSession(id);
        } catch (error) {
            console.error('Failed to delete remote session, falling back to local:', error);
            deleteLocalSession(id);
        }
    },
};
