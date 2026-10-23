import * as SecureStore from 'expo-secure-store';
import { fetch as expoFetch } from 'expo/fetch';

const TOKEN_KEY = 'oi-assistant-telegram-token';
const CHAT_ID_KEY = 'oi-assistant-telegram-chat-id';
const UPDATE_OFFSET_KEY = 'oi-assistant-telegram-offset';

interface TelegramEnvelope<T> {
  ok: boolean;
  result?: T;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; first_name?: string; username?: string };
  };
}

async function telegramCall<T>(token: string, method: string, body?: object) {
  const response = await expoFetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const data = (await response.json().catch(() => null)) as
    | TelegramEnvelope<T>
    | null;
  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new Error('Telegram could not complete this request. Check the bot connection and try again.');
  }
  return data.result;
}

export async function connectTelegramBot(token: string) {
  const bot = await telegramCall<{ id: number; username: string }>(token, 'getMe');
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return bot;
}

export async function hasTelegramBot() {
  return Boolean(await SecureStore.getItemAsync(TOKEN_KEY));
}

export async function disconnectTelegramBot() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(CHAT_ID_KEY),
    SecureStore.deleteItemAsync(UPDATE_OFFSET_KEY),
  ]);
}

export async function checkTelegramMessages() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error('Connect your bot first.');
  const offset = Number((await SecureStore.getItemAsync(UPDATE_OFFSET_KEY)) ?? 0);
  const updates = await telegramCall<TelegramUpdate[]>(token, 'getUpdates', {
    offset,
    timeout: 0,
    allowed_updates: ['message'],
  });
  const messages = updates.flatMap((update) => {
    const message = update.message;
    if (!message) return [];
    return [{
      id: update.update_id,
      chatId: message.chat.id,
      sender: message.chat.first_name || message.chat.username || 'Telegram user',
      text: message.text || '(non-text message)',
      date: message.date,
    }];
  });
  if (messages.length) {
    const last = messages[messages.length - 1];
    await SecureStore.setItemAsync(CHAT_ID_KEY, String(last.chatId));
    await SecureStore.setItemAsync(
      UPDATE_OFFSET_KEY,
      String(updates[updates.length - 1].update_id + 1),
    );
  }
  return messages;
}

export async function sendTelegramMessage(text: string) {
  const [token, chatId] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(CHAT_ID_KEY),
  ]);
  if (!token) throw new Error('Connect your bot first.');
  if (!chatId) throw new Error('Open your bot in Telegram and send it /start first.');
  await telegramCall(token, 'sendMessage', { chat_id: chatId, text });
}
