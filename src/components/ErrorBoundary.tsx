import React, { Component, ErrorInfo, ReactNode } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.mjs';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('sonora_active_user_id');
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">Ha ocurrido un problema</h2>
            <p className="text-xs text-neutral-400">
              Se detectó un detalle al cargar los datos guardados en tu navegador.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-red-400 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 break-words text-left">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar Música
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
