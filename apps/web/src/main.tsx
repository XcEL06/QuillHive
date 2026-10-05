import { API_BASE_URL, apiUrl } from "./lib/api";
import { captureBrowserException, initializeSentryClient } from "./lib/sentryClient";

initializeSentryClient();

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const parsedUrl = new URL(rawUrl, window.location.origin);
  const isApiRequest = parsedUrl.pathname.startsWith("/api/") || parsedUrl.pathname === "/api";
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  let target: RequestInfo | URL = input;

  if (API_BASE_URL) {
    if (typeof input === "string" && input.startsWith("/api")) {
      target = apiUrl(input);
    } else if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith("/api")) {
      target = apiUrl(`${input.pathname}${input.search}`);
    } else if (input instanceof Request && input.url.startsWith(`${window.location.origin}/api`)) {
      target = new Request(apiUrl(input.url.replace(window.location.origin, "")), input);
    }
  }

  try {
    const response = await originalFetch(target, init);
    if (isApiRequest && response.status >= 500) {
      captureBrowserException(new Error(`API request returned HTTP ${response.status}`), {
        tags: { source: "api_request", status_code: String(response.status) },
        extra: { method, path: parsedUrl.pathname },
      });
    }
    return response;
  } catch (error) {
    if (isApiRequest) {
      captureBrowserException(error, { tags: { source: "api_request", failure: "network" }, extra: { method, path: parsedUrl.pathname } });
    }
    throw error;
  }
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            window.location.reload();
          }
        });
      });
      reg.update();
    });
  });
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { useI18n } from './lib/i18n'
import { setBaseUrl } from '@workspace/api-client-react'

if (API_BASE_URL) {
  setBaseUrl(API_BASE_URL);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never auto-retry on 4xx errors (especially 429 rate limits).
      // Allow one retry only for transient network/5xx issues.
      retry: (failureCount, error) => {
        const msg = ((error as Error)?.message ?? '').toLowerCase();
        if (
          msg.includes('429') ||
          msg.includes('too many') ||
          msg.includes('rate limit') ||
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('404')
        ) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      // Never auto-retry mutations - auth actions must fire exactly once.
      retry: false,
    },
  },
})

useI18n.getState().init().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  )
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
