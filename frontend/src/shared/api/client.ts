const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const LEGACY_TOKEN_KEY = "picaton_auth_token";
const CSRF_COOKIE_NAME = "picaton_csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

class ApiError extends Error {
  status: number;
  statusText: string;
  data?: unknown;

  constructor(status: number, statusText: string, data?: unknown) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

let accessToken: string | null = null;

export const tokenStorage = {
  get: (): string | null => accessToken,
  set: (token: string): void => {
    accessToken = token;
  },
  remove: (): void => {
    accessToken = null;
    // Cleanup legacy storage from old auth implementation.
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  },
};

function getCookieValue(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escaped}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function buildCsrfHeader(method?: string): Record<string, string> {
  const upperMethod = (method || "GET").toUpperCase();
  if (upperMethod === "GET" || upperMethod === "HEAD" || upperMethod === "OPTIONS") {
    return {};
  }

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
  if (!csrfToken) return {};

  return { [CSRF_HEADER_NAME]: csrfToken };
}

async function refreshAccessToken(): Promise<boolean> {
  const url = `${API_BASE_URL}/auth/refresh`;

  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...buildCsrfHeader("POST"),
      },
    });

    if (!response.ok) {
      tokenStorage.remove();
      return false;
    }

    const data = (await response.json().catch(() => null)) as
      | { access_token?: string }
      | null;

    if (!data?.access_token) {
      tokenStorage.remove();
      return false;
    }

    tokenStorage.set(data.access_token);
    return true;
  } catch {
    tokenStorage.remove();
    return false;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  canRetry = true,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = tokenStorage.get();

  const config: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...buildCsrfHeader(options.method),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (
    response.status === 401 &&
    canRetry &&
    endpoint !== "/auth/refresh" &&
    endpoint !== "/auth/logout"
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(endpoint, options, false);
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

async function uploadFile<T>(
  endpoint: string,
  file: File,
  fieldName = "file",
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = tokenStorage.get();

  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      ...buildCsrfHeader("POST"),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do NOT set Content-Type - browser will set it with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),

  upload: <T>(endpoint: string, file: File, fieldName?: string) =>
    uploadFile<T>(endpoint, file, fieldName),

  refreshAccessToken,
};

export { ApiError };
