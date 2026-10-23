import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AssistantSettings, ChatMessage, MemoryNote } from './types';

const CHAT_KEY = 'oi-assistant-chat-v1';
const SETTINGS_KEY = 'oi-assistant-settings-v1';
const MEMORY_INDEX_KEY = 'oi-assistant-memory-index-v1';
const MEMORY_PREFIX = 'oi-assistant-memory-';

type MemoryIndexItem = Pick<MemoryNote, 'id' | 'title' | 'createdAt'>;

export async function readLocalState() {
  const [messagesValue, settingsValue, indexValue] = await Promise.all([
    AsyncStorage.getItem(CHAT_KEY),
    AsyncStorage.getItem(SETTINGS_KEY),
    AsyncStorage.getItem(MEMORY_INDEX_KEY),
  ]);

  const messages = messagesValue
    ? (JSON.parse(messagesValue) as ChatMessage[])
    : [];
  const settings = settingsValue
    ? (JSON.parse(settingsValue) as Partial<AssistantSettings>)
    : {};
  const index = indexValue ? (JSON.parse(indexValue) as MemoryIndexItem[]) : [];

  const memories = await Promise.all(
    index.map(async (item) => ({
      ...item,
      content:
        (await SecureStore.getItemAsync(`${MEMORY_PREFIX}${item.id}`)) ?? '',
    })),
  );

  return { messages, settings, memories };
}

export function persistMessages(messages: ChatMessage[]) {
  return AsyncStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function persistSettings(settings: AssistantSettings) {
  return AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function persistMemoryIndex(memories: MemoryNote[]) {
  const index: MemoryIndexItem[] = memories.map(
    ({ id, title, createdAt }) => ({ id, title, createdAt }),
  );
  await AsyncStorage.setItem(MEMORY_INDEX_KEY, JSON.stringify(index));
}

export async function storeMemoryNote(note: MemoryNote, memories: MemoryNote[]) {
  await SecureStore.setItemAsync(
    `${MEMORY_PREFIX}${note.id}`,
    note.content,
  );
  await persistMemoryIndex(memories);
}

export async function removeMemoryNote(id: string, memories: MemoryNote[]) {
  await SecureStore.deleteItemAsync(`${MEMORY_PREFIX}${id}`);
  await persistMemoryIndex(memories);
}

export async function clearLocalAssistantData() {
  const indexValue = await AsyncStorage.getItem(MEMORY_INDEX_KEY);
  const index = indexValue ? (JSON.parse(indexValue) as MemoryIndexItem[]) : [];
  await Promise.all(
    index.map((item) =>
      SecureStore.deleteItemAsync(`${MEMORY_PREFIX}${item.id}`),
    ),
  );
  await AsyncStorage.multiRemove([CHAT_KEY, SETTINGS_KEY, MEMORY_INDEX_KEY]);
}
