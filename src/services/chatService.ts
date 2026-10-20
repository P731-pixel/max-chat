
import {
    sendMessage as sendGreenApiMessage,
    receiveNotification,
    deleteNotification,
    type GreenApiCredentials,
    type GreenApiNotification
} from './greenApi'

export type ChatMode = 'demo' | 'real'

export type ChatMessage = {
    id: string
    chatId?: string
    text: string
    direction: 'outgoing' | 'incoming'
    time: string
    status: 'sent' | 'received' | 'demo' | 'failed'
}

export type ChatConfig = {
    mode: ChatMode
    credentials: GreenApiCredentials
}

export type IncomingTextMessage = {
    chatId: string
    phone: string
    message: ChatMessage
}

export function formatTime(): string {
    return new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function createDemoMessage(
    text: string,
    direction: 'outgoing' | 'incoming',
): ChatMessage {
    return {
        id: `${Date.now()}-${Math.random()}`,
        text,
        direction,
        time: formatTime(),
        status: 'demo',
    }
}

export async function sendChatMessage(
    config: ChatConfig,
    chatId: string,
    text: string,
): Promise<ChatMessage> {
    if (config.mode === 'demo') {
        return {
            ...createDemoMessage(text, 'outgoing'),
            chatId
        }
    }

    const result = await sendGreenApiMessage(
        config.credentials,
        chatId,
        text,
    )

    return {
        id: result.idMessage,
        chatId,
        text,
        direction: 'outgoing',
        time: formatTime(),
        status: 'sent',
    }
}

export async function receiveIncomingText(
    credentials: GreenApiCredentials,
    signal?: AbortSignal,
): Promise<IncomingTextMessage | null> {
    const notification = await receiveNotification(credentials)

    if (!notification) {
        return null
    }

    if (signal?.aborted) {
        return null;
    }

    try {
        return parseIncomingText(notification)
    } finally {
        if (!signal?.aborted) {
            await deleteNotification(credentials, notification.receiptId);
        }
    }
}

function parseIncomingText(
    notification: GreenApiNotification,
): IncomingTextMessage | null {
    const body = notification.body

    if (
        body.typeWebhook !== 'incomingMessageReceived' ||
        body.messageData?.typeMessage !== 'textMessage'
    ) {
        return null
    }

    const text = body.messageData.textMessageData?.textMessage
    const chatId = body.senderData?.chatId

    if (!text?.trim() || !chatId) {
        return null
    }

    return {
        chatId,
        phone: chatId.split('@')[0],
        message: {
            id: `incoming-${notification.receiptId}`,
            chatId,
            text,
            direction: 'incoming',
            time: formatTime(),
            status: 'received',
        },
    }
}
