export const VK_API_VERSION = '5.199';

// VK error codes that mean the token is invalid/expired
export const INVALID_TOKEN_CODES = [5, 15, 17];

export class VKTokenError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'VKTokenError';
    this.code = code;
  }
}

export function isVKTokenError(err: unknown): err is VKTokenError {
  return err instanceof VKTokenError;
}

// Имя метода попадает в путь URL — допускаем только формат VK API
// (`users.get`, `execute.someMethod`), чтобы исключить выход из /method/.
const VK_METHOD_RE = /^[a-zA-Z][\w.]{0,63}$/;

export async function fetchVKMethod(
  method: string,
  token: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  if (!VK_METHOD_RE.test(method)) {
    throw new Error(`Invalid VK API method name: ${method}`);
  }

  const body = new URLSearchParams();
  body.set('access_token', token);
  body.set('v', VK_API_VERSION);
  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value));
  }

  const response = await fetch(`https://api.vk.ru/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json() as {
    response?: unknown;
    error?: { error_code: number; error_msg: string };
  };

  if (data.error) {
    if (INVALID_TOKEN_CODES.includes(data.error.error_code)) {
      throw new VKTokenError('Token expired or invalid', 'TOKEN_EXPIRED');
    }
    throw new Error(data.error.error_msg || 'API Error');
  }

  return data.response;
}
