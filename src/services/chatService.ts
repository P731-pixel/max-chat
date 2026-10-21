
import {
    sendMessage as sendGreenApiMessage,
    receiveNotification,
    deleteNotification,
    type GreenApiCredentials,
    type GreenApiNotification,
} from './greenApi'

export type MessageStatus =
    | 'sent'
    | 'delivered'
    | 'read'
    | 'received'
    | 'failed'

export type ChatMessage = {
    id: string
    chatId?: string
    text: string
    direction: 'outgoing' | 'incoming'
    time: string
    status: MessageStatus
}

export type IncomingTextMessage = {
    chatId: string
    phone: string
    title: string
    message: ChatMessage
}

export type MessageStatusUpdate = {
    idMessage: string
    status: MessageStatus
    chatId?: string
}

export type ChatNotification =
    | { type: 'incoming'; data: IncomingTextMessage }
    | { type: 'status'; data: MessageStatusUpdate }

export function formatTime(): string {
    return new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export async function sendChatMessage(
    credentials: GreenApiCredentials,
    chatId: string,
    text: string,
): Promise<ChatMessage> {
    const result = await sendGreenApiMessage(credentials, chatId, text)

    return {
        id: result.idMessage,
        chatId,
        text,
        direction: 'outgoing',
        time: formatTime(),
        status: 'sent',
    }
}

export async function receiveChatNotification(
    credentials: GreenApiCredentials,
    signal?: AbortSignal,
): Promise<ChatNotification | null> {
    const notification = await receiveNotification(credentials, signal)

    if (!notification || signal?.aborted) {
        return null
    }

    try {
        return parseNotification(notification)
    } finally {
        if (!signal?.aborted) {
            await deleteNotification(credentials, notification.receiptId)
        }
    }
}

function parseNotification(
    notification: GreenApiNotification,
): ChatNotification | null {
    const body = notification.body

    if (body.typeWebhook === 'outgoingMessageStatus') {
        const idMessage = body.idMessage
        const status = body.status

        if (
            !idMessage ||
            !status ||
            !['sent', 'delivered', 'read', 'failed'].includes(status)
        ) {
            return null
        }

        return {
            type: 'status',
            data: {
                idMessage,
                status: status as MessageStatus,
                chatId: body.chatId,
            },
        }
    }

    if (
        body.typeWebhook !== 'incomingMessageReceived' ||
        body.senderData?.chatType !== 'user' ||
        body.messageData?.typeMessage !== 'textMessage'
    ) {
        return null
    }

    const text = body.messageData.textMessageData?.textMessage
    const chatId = body.senderData.chatId

    if (!text?.trim() || !chatId) {
        return null
    }

    const title =
        body.senderData.chatName ||
        body.senderData.senderName ||
        chatId

    return {
        type: 'incoming',
        data: {
            chatId,
            phone: body.senderData.senderPhoneNumber
                ? String(body.senderData.senderPhoneNumber)
                : chatId,
            title,
            message: {
                id: `incoming-${notification.receiptId}`,
                chatId,
                text,
                direction: 'incoming',
                time: formatTime(),
                status: 'received',
            },
        },
    }
}
