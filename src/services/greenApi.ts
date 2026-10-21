
export type GreenApiCredentials = {
    idInstance: string
    apiTokenInstance: string
    apiUrl: string
}

export type SendMessageResult = {
    idMessage: string
}

export type GreenApiNotification = {
    receiptId: number
    body: {
        typeWebhook?: string
        idMessage?: string
        chatId?: string
        status?: 'sent' | 'delivered' | 'read' | 'failed' | 'noAccount'
        description?: string
        senderData?: {
            chatId?: string
            chatType?: string
            senderType?: string
            chatName?: string
            senderName?: string
            senderPhoneNumber?: string
        }
        messageData?: {
            typeMessage?: string
            textMessageData?: {
                textMessage?: string
            }
        }
    }
}

export type CheckAccountResult = {
    exist?: boolean
    chatId?: string
    fromCache?: boolean
    status?: boolean
    reason?: string
}

export class GreenApiError extends Error {
    public readonly status?: number

    constructor(message: string, status?: number) {
        super(message)

        this.name = 'GreenApiError'
        this.status = status
    }
}

function getBaseUrl(credentials: GreenApiCredentials) {
    const apiUrl = credentials.apiUrl.replace(/\/+$/, '')

    return `${apiUrl}/waInstance${encodeURIComponent(
        credentials.idInstance,
    )}`
}

function validateCredentials(credentials: GreenApiCredentials) {
    if (
        !credentials.idInstance.trim() ||
        !credentials.apiTokenInstance.trim() ||
        !credentials.apiUrl.trim()
    ) {
        throw new GreenApiError('Заполните все параметры подключения.')
    }
}


async function request<T>(
    url: string,
    init?: RequestInit,
    signal?: AbortSignal,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(url, {
            ...init,
            signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw error;
        }

        throw new GreenApiError("Не удалось подключиться к GREEN-API.");
    }

    const responseText = await response.text();

    if (!response.ok) {
        throw new GreenApiError(
            responseText || `Ошибка GREEN-API: ${response.status}`,
            response.status,
        );
    }

    if (!responseText) {
        return undefined as T;
    }

    try {
        return JSON.parse(responseText) as T;
    } catch {
        throw new GreenApiError("GREEN-API вернул некорректный ответ.");
    }
}


export async function sendMessage(
    credentials: GreenApiCredentials,
    chatId: string,
    message: string,
): Promise<SendMessageResult> {
    validateCredentials(credentials)

    if (!chatId.trim()) {
        throw new GreenApiError('Не указан идентификатор чата.')
    }

    if (!message.trim() || message.length > 4000) {
        throw new GreenApiError(
            'Сообщение должно содержать от 1 до 4000 символов.',
        )
    }

    const url =
        `${getBaseUrl(credentials)}/sendMessage/` +
        encodeURIComponent(credentials.apiTokenInstance)

    return request<SendMessageResult>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chatId,
            message,
        }),
    })
}

export async function receiveNotification(
    credentials: GreenApiCredentials,
    signal?: AbortSignal,
): Promise<GreenApiNotification | null> {
    validateCredentials(credentials)

    const url =
        `${getBaseUrl(credentials)}/receiveNotification/` +
        `${encodeURIComponent(credentials.apiTokenInstance)}` +
        '?receiveTimeout=5'

    const notification = await request<
        GreenApiNotification | null
    >(url, undefined, signal)

    return notification
}

export async function deleteNotification(
    credentials: GreenApiCredentials,
    receiptId: number,
): Promise<void> {
    validateCredentials(credentials)

    const url =
        `${getBaseUrl(credentials)}/deleteNotification/` +
        `${encodeURIComponent(credentials.apiTokenInstance)}/` +
        encodeURIComponent(String(receiptId))

    await request<unknown>(url, {
        method: 'DELETE',
    })
}


export async function checkAccount(
    credentials: GreenApiCredentials,
    phoneNumber: string,
): Promise<CheckAccountResult> {
    validateCredentials(credentials)

    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    if (!/^(7\d{10}|375\d{9})$/.test(normalizedPhone)) {
        throw new GreenApiError(
            'Введите номер в международном формате.',
        )
    }

    const url =
        `${getBaseUrl(credentials)}/checkAccount/` +
        encodeURIComponent(credentials.apiTokenInstance)

    const result = await request<CheckAccountResult>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phoneNumber: Number(normalizedPhone),
        }),
    })

    if (result.status === false) {
        throw new GreenApiError(
            result.reason ?? 'Инстанс не готов к работе.',
        )
    }

    if (!result.exist || !result.chatId) {
        throw new GreenApiError(
            'Аккаунт MAX для этого номера не найден или номер скрыт настройками приватности.',
        )
    }

    return result
}

