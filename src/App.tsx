import { useEffect, useState } from "react";
import "./index.css";

import {
  checkAccount,
  GreenApiError,
  type GreenApiCredentials,
} from "./services/greenApi";

import {
  createDemoMessage,
  receiveIncomingText,
  sendChatMessage,
  type ChatMessage,
  type ChatMode,
} from "./services/chatService";

import type { Chat } from "./services/chatTypes";

function App() {
  const [idInstance, setIdInstance] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.green-api.com");

  const [mode, setMode] = useState<ChatMode>("demo");
  const [connected, setConnected] = useState(false);

  const [phone, setPhone] = useState("");
  const [chatId, setChatId] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const visibleMessages = messages.filter(
    (message) => message.chatId === chatId,
  );
  const [messageText, setMessageText] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const credentials: GreenApiCredentials = {
    idInstance,
    apiTokenInstance: apiToken,
    apiUrl,
  };

  function connect() {
    setError("");
    setInfo("");

    if (!idInstance.trim() || !apiToken.trim() || !apiUrl.trim()) {
      setError("Заполните ID Instance, API Token и API URL.");
      return;
    }

    setConnected(true);
    setChatId("");
    setPhone("");
    setMessages([]);

    setInfo(
      mode === "demo"
        ? "Демо-режим активирован. Сообщения тестовые."
        : "Параметры сохранены. Реальная проверка выполнится при создании чата.",
    );
  }

  async function createChat() {
    if (!connected || busy) return;

    setError("");
    setInfo("");

    const normalizedPhone = phone.replace(/\D/g, "");

    if (normalizedPhone.length < 10) {
      setError("Введите корректный номер телефона.");
      return;
    }

    setBusy(true);

    try {
      let newChat: Chat;

      if (mode === "demo") {
        newChat = {
          id: `demo-${normalizedPhone}`,
          phone: normalizedPhone,
          title: normalizedPhone,
        };
      } else {
        const result = await checkAccount(credentials, normalizedPhone);

        newChat = {
          id: result.chatId!,
          phone: normalizedPhone,
          title: normalizedPhone,
        };
      }

      setChats((current) => {
        const existing = current.find((chat) => chat.id === newChat.id);

        if (existing) {
          return current;
        }

        return [...current, newChat];
      });

      setChatId(newChat.id);
      setPhone(newChat.phone);

      setInfo(
        mode === "demo"
          ? "Демо-чат создан."
          : "Аккаунт MAX найден. Чат создан.",
      );
    } catch (err) {
      setError(
        err instanceof GreenApiError ? err.message : "Не удалось создать чат.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const text = messageText.trim();
    const currentChatId = chatId;

    if (!text || !currentChatId || !connected || busy) return;

    setError("");
    setInfo("");
    setBusy(true);

    try {
      const outgoing = await sendChatMessage(
        { mode, credentials },
        currentChatId,
        text,
      );

      setMessages((current) => [...current, outgoing]);
      setMessageText("");

      if (mode === "demo") {
        window.setTimeout(() => {
          setMessages((current) => [
            ...current,
            {
              ...createDemoMessage(
                `Демо-ответ на сообщение: ${text}`,
                "incoming",
              ),
              chatId: currentChatId,
            },
          ]);
        }, 1200);
      }
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Не удалось отправить сообщение.";

      setError(errorText);

      setMessages((current) => [
        ...current,
        {
          id: `failed-${Date.now()}-${Math.random()}`,
          chatId: currentChatId,
          text,
          direction: "outgoing",
          time: new Date().toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: "failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!connected || mode !== "real") return;

    let active = true;
    const controller = new AbortController();

    async function pollNotifications() {
      while (active) {
        try {
          const incoming = await receiveIncomingText(
            credentials,
            controller.signal,
          );

          if (!active || controller.signal.aborted)
            break;

          if (incoming) {
            setMessages((current) => {
              if (current.some((item) => item.id === incoming.message.id)) {
                return current;
              }

              return [...current, incoming.message];
            });

            setChats((current) => {
              const existing = current.find(
                (chat) => chat.id === incoming.chatId,
              );

              if (existing) return current;

              return [
                ...current,
                {
                  id: incoming.chatId,
                  phone: incoming.phone,
                  title: incoming.phone,
                },
              ];
            });
          }
        } catch (err) {
          if (!active || controller.signal.aborted) break;

          setError(
            err instanceof Error
              ? err.message
              : "Ошибка получения уведомлений.",
          );

          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
    }

    void pollNotifications();

    return () => {
      active = false;
      controller.abort();
    };
  }, [connected, mode, idInstance, apiToken, apiUrl]);

  return (
    <main className="app">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-icon">M</div>
          <div>
            <h1>MAX Chat</h1>
            <span>GREEN-API integration</span>
          </div>
        </header>

        <section className="panel">
          <h2>Подключение</h2>
          <p className="muted">Параметры GREEN-API</p>

          <label htmlFor="mode">Режим работы</label>
          <select
            id="mode"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as ChatMode);
              setConnected(false);
              setChatId("");
              setPhone("");
              setChats([]);
              setMessages([]);
              setMessageText("");
              setError("");
              setInfo("");
            }}
          >
            <option value="demo">DEMO — тестовый режим</option>
            <option value="real">REAL — настоящий API</option>
          </select>

          <label htmlFor="apiUrl">API URL</label>
          <input
            id="apiUrl"
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder="https://api.green-api.com"
            disabled={connected}
          />

          <label htmlFor="instance">ID Instance</label>
          <input
            id="instance"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            placeholder="Введите idInstance"
            autoComplete="off"
            disabled={connected}
          />

          <label htmlFor="token">API Token</label>
          <input
            id="token"
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder="Введите apiTokenInstance"
            autoComplete="off"
            disabled={connected}
          />

          <button
            className="primary-button"
            type="button"
            onClick={connect}
            disabled={connected}
          >
            Подключиться
          </button>

          {connected && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setConnected(false);
                setChatId("");
                setPhone("");
                setChats([]);
                setMessages([]);
                setMessageText("");
                setInfo("Подключение остановлено.");
                setError("");
              }}
            >
              Отключиться
            </button>
          )}

          {info && <p className="status">{info}</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <h2>Мои чаты</h2>

          {chats.length === 0 ? (
            <p className="muted">Пока нет созданных чатов.</p>
          ) : (
            <div className="chat-list">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-list-item ${
                    chat.id === chatId ? "active" : ""
                  }`}
                  onClick={() => {
                    setChatId(chat.id);
                    setPhone(chat.phone);
                    setError("");
                    setInfo("");
                  }}
                >
                  <span className="chat-list-avatar">
                    {chat.phone.slice(-2)}
                  </span>
                  <span className="chat-list-title">{chat.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Новый чат</h2>

          <label htmlFor="phone">Номер телефона получателя</label>
          <input
            id="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Например, 79001234567"
            disabled={!connected || busy}
          />

          <button
            className="secondary-button"
            type="button"
            onClick={() => void createChat()}
            disabled={!connected || busy}
          >
            {busy ? "Обработка..." : "Создать чат"}
          </button>
        </section>

        <div className="sidebar-footer">
          <span className="demo-badge">
            {mode === "demo" ? "DEMO" : "REAL"}
          </span>
          <span>{mode === "demo" ? "Сообщения тестовые" : "GREEN-API"}</span>
        </div>
      </aside>

      <section className="chat">
        <header className="chat-header">
          <div className="avatar">{phone ? phone.slice(-2) : "?"}</div>
          <div>
            <h2>{phone || "Выберите собеседника"}</h2>
            <p className="muted">
              {chatId ? "Текстовые сообщения" : "Чат ещё не создан"}
            </p>
          </div>
        </header>

        <div className="messages">
          {!chatId && (
            <div className="empty-state">
              <div className="empty-icon">M</div>
              <h2>Ваши сообщения</h2>
              <p>Подключитесь и создайте чат, чтобы начать переписку.</p>
            </div>
          )}

          {chatId && visibleMessages.length === 0 && (
            <div className="empty-chat">
              <p>Чат создан</p>
              <span>
                {mode === "demo"
                  ? "Отправьте тестовое сообщение."
                  : "Ожидайте сообщения или отправьте первое."}
              </span>
            </div>
          )}

          {visibleMessages.map((message) => (
            <div key={message.id} className={`message ${message.direction}`}>
              <div className="message-text">{message.text}</div>
              <div className="message-meta">
                {message.time}
                {message.status === "demo" && <span>DEMO</span>}
                {message.status === "sent" && <span>✓ Отправлено</span>}
                {message.status === "received" && <span>Входящее</span>}

                {message.status === "failed" && (
                  <button
                    type="button"
                    className="retry-button"
                    disabled={busy}
                    onClick={() => {
                      setChatId(message.chatId ?? "");
                      setPhone(
                        chats.find((chat) => chat.id === message.chatId)
                          ?.phone ?? "",
                      );
                      setMessageText(message.text);
                      setError("");
                    }}
                  >
                    Ошибка · Повторить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          className="message-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={
              chatId ? "Введите сообщение..." : "Сначала создайте чат"
            }
            disabled={!connected || !chatId || busy}
          />

          <button
            type="submit"
            className="send-button"
            disabled={!connected || !chatId || busy || !messageText.trim()}
            aria-label="Отправить сообщение"
            title="Отправить сообщение"
          >
            ➤
          </button>
        </form>

        <footer className="chat-footer">
          {mode === "demo"
            ? "DEMO — сообщения не отправляются в MAX"
            : "GREEN-API — реальный режим"}
        </footer>
      </section>
    </main>
  );
}

export default App;
