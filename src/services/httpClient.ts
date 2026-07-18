const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export interface ApiErrorBody {
  error: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error ?? `request failed with status ${status}`);

    this.status = status;
    this.body = body;
  }
}

interface ApiRequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  accessToken?: string | null;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export async function apiRequest<ResponseBody>(options: ApiRequestOptions): Promise<ResponseBody> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.accessToken) {
    headers["Authorization"] = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl}${options.path}`, {
    method: options.method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as ResponseBody;
  }

  return (await response.json()) as ResponseBody;
}
