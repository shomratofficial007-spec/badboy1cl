import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { readLocalState, persistMessages, persistSettings, removeMemoryNote, storeMemoryNote } from '@/lib/assistant/storage';
import { DEFAULT_SETTINGS, type AssistantSettings, type ChatMessage, type MemoryNote } from '@/lib/assistant/types';

interface AssistantContextValue {
  ready: boolean;
  messages: ChatMessage[];
  memories: MemoryNote[];
  settings: AssistantSettings;
  storageError: string | null;
  setMessages: (messages: ChatMessage[]) => void;
  updateSettings: (update: Partial<AssistantSettings>) => void;
  saveMemory: (title: string, content: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearChat: () => Promise<void>;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);
let idCounter = 0;

function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant must be used inside AssistantProvider.');
  return value;
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryNote[]>([]);
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    readLocalState()
      .then((state) => {
        if (!mounted) return;
        setMessagesState(state.messages);
        setMemories(state.memories);
        setSettings({ ...DEFAULT_SETTINGS, ...state.settings });
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStorageError('Local storage could not be opened. Your data was not sent anywhere.');
        setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      persistMessages(messages).catch(() =>
        setStorageError('Chat history could not be saved on this device.'),
      );
    }
  }, [messages, ready]);

  useEffect(() => {
    if (ready) {
      persistSettings(settings).catch(() =>
        setStorageError('Assistant settings could not be saved on this device.'),
      );
    }
  }, [settings, ready]);

  const setMessages = useCallback((next: ChatMessage[]) => {
    setMessagesState(next);
  }, []);

  const updateSettings = useCallback((update: Partial<AssistantSettings>) => {
    setSettings((current) => ({ ...current, ...update }));
  }, []);

  const saveMemory = useCallback(
    async (title: string, content: string) => {
      const note: MemoryNote = {
        id: createId('memory'),
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      const next = [note, ...memories];
      await storeMemoryNote(note, next);
      setMemories(next);
    },
    [memories],
  );

  const deleteMemory = useCallback(
    async (id: string) => {
      const next = memories.filter((note) => note.id !== id);
      await removeMemoryNote(id, next);
      setMemories(next);
    },
    [memories],
  );

  const clearChat = useCallback(async () => {
    setMessagesState([]);
    await persistMessages([]);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      messages,
      memories,
      settings,
      storageError,
      setMessages,
      updateSettings,
      saveMemory,
      deleteMemory,
      clearChat,
    }),
    [ready, messages, memories, settings, storageError, setMessages, updateSettings, saveMemory, deleteMemory, clearChat],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
