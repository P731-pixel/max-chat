import type { Chat } from "./chatTypes";
import type { ChatMessage } from "./chatService";

const CHATS_KEY = "max-chat.chats";
const MESSAGES_KEY = "max-chat.messages";

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadChats(): Chat[] {
  const value = readJson<unknown>(CHATS_KEY, []);

  return Array.isArray(value) ? (value as Chat[]) : [];
}

export function loadMessages(): ChatMessage[] {
  const value = readJson<unknown>(MESSAGES_KEY, []);

  return Array.isArray(value) ? (value as ChatMessage[]) : [];
}

export function saveChats(chats: Chat[]): void {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error("Не удалось сохранить чаты.", error);
  }
}

export function saveMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error("Не удалось сохранить сообщения.", error);
  }
}
