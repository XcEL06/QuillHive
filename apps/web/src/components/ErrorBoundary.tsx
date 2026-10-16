import { Component, type ReactNode } from "react";
import { captureBrowserException } from "@/lib/sentryClient";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  componentStack?: string;
}

const CHUNK_RELOAD_KEY = "qh_chunk_reload_attempted";

function isChunkLoadError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes("failed to fetch dynamically imported module")
    || message.includes("importing a module script failed")
    || message.includes("loading chunk")
    || message.includes("error loading dynamically imported module");
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    captureBrowserException(error, { extra: { componentStack: info.componentStack } });
    console.error("[ErrorBoundary] Unhandled render error", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.setState({ error, componentStack: info.componentStack });

    if (isChunkLoadError(error)) {
      try {
        const retryKey = `${CHUNK_RELOAD_KEY}:${window.location.pathname}`;
        if (window.sessionStorage.getItem(retryKey) !== "1") {
          window.sessionStorage.setItem(retryKey, "1");
          window.location.reload();
        }
      } catch {
        // Keep the manual recovery UI available when session storage is blocked.
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    const t = useI18n.getState().t;
    const chunkLoadFailed = this.state.error && isChunkLoadError(this.state.error);
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {chunkLoadFailed ? "Update available — reload" : t("common.somethingWentWrong", "Something went wrong")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {chunkLoadFailed
                ? "QuillHive was updated while this page was open. Reload to get the latest version."
                : t("common.pageErrorSafe", "This page hit an error. Your data is safe.")}
            </p>
          </div>
          {this.state.error && !chunkLoadFailed && (
            <div className="text-left">
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40 text-destructive whitespace-pre-wrap break-words">
                {this.state.error.name}: {this.state.error.message}
              </pre>
              {this.state.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Show technical details
                  </summary>
                  <pre className="text-[10px] bg-muted p-3 rounded-lg overflow-auto max-h-48 mt-1 whitespace-pre-wrap break-words">
                    {this.state.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
            <RotateCcw className="w-4 h-4" />
            {chunkLoadFailed ? "Reload" : t("common.reloadPage", "Reload page")}
          </button>
        </div>
      </div>
    );
  }
}
