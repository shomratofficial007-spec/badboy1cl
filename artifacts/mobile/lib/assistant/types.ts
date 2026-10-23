export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface MemoryNote {
  id: string;
  title: string;
  createdAt: string;
  content: string;
}

export interface AssistantSettings {
  onlineAI: boolean;
  personality: string;
  autoImprove: boolean;
  developerMode: boolean;
  voiceProcessingConsent: boolean;
}

export const DEFAULT_SETTINGS: AssistantSettings = {
  onlineAI: true,
  personality: 'Warm, thoughtful, clear, and practical. Always reply in Bangla (Bengali).',
  autoImprove: true,
  developerMode: false,
  voiceProcessingConsent: false,
};
