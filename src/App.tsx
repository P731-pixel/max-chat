import { useEffect, useState } from 'react'
import './index.css'

import { checkAccount, type GreenApiCredentials } from './services/greenApi'

import {
  receiveChatNotification,
  sendChatMessage,
  type ChatMessage,
} from './services/chatService'

import type { Chat } from './services/chatTypes'

import {
  loadChats,
  loadMessages,
  saveChats,
  saveMessages,
} from './services/storageService'

function App() {
  const [idInstance, setIdInstance] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [apiUrl, setApiUrl] = useState("https://api.green-api.com");

  const [connected, setConnected] = useState(false);

  const [newPhone, setNewPhone] = useState("");
  const [chatId, setChatId] = useState("");
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [messageText, setMessageText] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);


  const credentials: GreenApiCredentials = {
    idInstance,
    apiTokenInstance: apiToken,
    apiUrl,
  };

  const activeChat = chats.find((chat) => chat.id === chatId);

  const visibleMessages = messages.filter(
    (message) => message.chatId === chatId,
  );

  function connect() {
    setError("");
    setInfo("");

    if (!idInstance.trim() || !apiToken.trim() || !apiUrl.trim()) {
      setError("Заполните ID Instance, API Token и API URL.");
      return;
    }

    setConnected(true);
    setChatId("");
    setNewPhone("");

    setInfo("Подключение настроено. Введите номер телефона получателя.");
  }

  function disconnect() {
    setConnected(false);
    setChatId("");
    setNewPhone("");
    setMessageText("");
    setError("");
    setInfo("Подключение остановлено.");
  }

  async function createChat() {
    if (!connected || busy) return;

    setError("");
    setInfo("");

    const phone = newPhone.trim();

    if (!phone) {
      setError("Введите номер телефона получателя.");
      return;
    }

    setBusy(true);

    try {
      const result = await checkAccount(credentials, phone);

      const existing = chats.find((chat) => chat.id === result.chatId);

      if (existing) {
        setChatId(existing.id);
        setNewPhone("");
        setInfo("Этот чат уже существует. Он открыт.");
        return;
      }

      const newChat: Chat = {
        id: result.chatId!,
        phone,
        title: phone,
      };

      setChats((current) => {
        if (current.some((chat) => chat.id === newChat.id)) {
          return current;
        }

        return [...current, newChat];
      });

      setChatId(newChat.id);
      setNewPhone("");
      setInfo("Чат создан. Теперь можно отправлять сообщения.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать чат.");
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
      const outgoing = await sendChatMessage(credentials, currentChatId, text);

      setMessages((current) => [...current, outgoing]);
      setMessageText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось отправить сообщение.",
      );

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
    if (!connected) return;

    let active = true;
    const controller = new AbortController();

    async function pollNotifications() {
      while (active) {
        try {
          const notification = await receiveChatNotification(
            credentials,
            controller.signal,
          );

          if (!active || controller.signal.aborted) break;
          if (!notification) continue;

          if (notification.type === "status") {
            const update = notification.data;

            setMessages((current) =>
              current.map((message) =>
                message.id === update.idMessage &&
                message.direction === "outgoing"
                  ? { ...message, status: update.status }
                  : message,
              ),
            );

            continue;
          }

          const incoming = notification.data;

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

            if (existing) {
              if (existing.title === incoming.title) {
                return current;
              }

              return current.map((chat) =>
                chat.id === incoming.chatId
                  ? { ...chat, title: incoming.title }
                  : chat,
              );
            }

            return [
              ...current,
              {
                id: incoming.chatId,
                phone: incoming.phone,
                title: incoming.title,
              },
            ];
          });
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
  }, [connected, idInstance, apiToken, apiUrl]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  return (
    <main className="app">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-icon">M</div>
          <div>
            <h1>MAX Chat</h1>
            <span>MAX · GREEN-API</span>
          </div>
        </header>

        <section className="panel">
          <h2>Подключение</h2>
          <p className="muted">Параметры GREEN-API</p>

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
              onClick={disconnect}
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
            <p className="muted">Пока нет чатов.</p>
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
                    setError("");
                    setInfo("");
                  }}
                >
                  <span className="chat-list-avatar">
                    {chat.title.slice(-2)}
                  </span>
                  <span className="chat-list-title">{chat.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Создать чат</h2>

          <label htmlFor="newPhone">Номер телефона получателя</label>
          <input
            id="newPhone"
            type="tel"
            value={newPhone}
            onChange={(event) => setNewPhone(event.target.value)}
            placeholder="+79991234567"
            autoComplete="tel"
            disabled={!connected || busy}
          />

          <p className="muted">Укажите номер в международном формате.</p>

          <button
            className="secondary-button"
            type="button"
            onClick={() => void createChat()}
            disabled={!connected || busy || !newPhone.trim()}
          >
            {busy ? "Обработка..." : "Создать чат"}
          </button>
        </section>

        <div className="sidebar-footer">
          <span className="demo-badge">REAL</span>
          <span>MAX через GREEN-API</span>
        </div>
      </aside>

      <section className="chat">
        <header className="chat-header">
          <div className="avatar">
            {activeChat ? activeChat.title.slice(-2) : "?"}
          </div>
          <div>
            <h2>{activeChat?.title ?? "Выберите собеседника"}</h2>
            <p className="muted">
              {chatId ? "MAX · Текстовые сообщения" : "Чат не выбран"}
            </p>
          </div>
        </header>

        <div className="messages">
          {!chatId && (
            <div className="empty-state">
              <div className="empty-icon">M</div>
              <h2>Ваши сообщения</h2>
              <p>Подключитесь и создайте чат по номеру телефона.</p>
            </div>
          )}

          {chatId && visibleMessages.length === 0 && (
            <div className="empty-chat">
              <p>Чат открыт</p>
              <span>Ожидайте входящее сообщение или отправьте первое.</span>
            </div>
          )}

          {visibleMessages.map((message) => (
            <div key={message.id} className={`message ${message.direction}`}>
              <div className="message-text">{message.text}</div>
              <div className="message-meta">
                {message.time}
                {message.status === "sent" && <span>✓ Отправлено</span>}
                {message.status === "delivered" && <span>✓✓ Доставлено</span>}
                {message.status === "read" && <span>✓✓ Прочитано</span>}
                {message.status === "received" && <span>Входящее</span>}
                {message.status === "failed" && (
                  <button
                    type="button"
                    className="retry-button"
                    disabled={busy}
                    onClick={() => {
                      setChatId(message.chatId ?? "");
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
          Реальный режим · MAX через GREEN-API
        </footer>
      </section>
    </main>
  );
}

export default App;
