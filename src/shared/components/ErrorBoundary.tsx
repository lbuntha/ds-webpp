import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Premium Error Boundary component to catch and display runtime errors
 * Provides a professional fallback UI with recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('CRITICAL UI ERROR:', error, errorInfo);
    }

    private handleReset = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
                        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Unexpected Application Error</h1>
                        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
                            Something went wrong while rendering this page. Our team has been notified.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-8 p-4 bg-slate-100 rounded-lg text-left overflow-auto max-h-40">
                                <code className="text-xs text-red-600 whitespace-pre font-mono">
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}

                        {this.state.error?.toString().includes('Failed to fetch dynamically imported module') && (
                            <div className="mb-4 text-amber-600 bg-amber-50 p-3 rounded-lg text-sm">
                                <strong>Tip:</strong> This usually happens when a new version is deployed or your connection is interrupted.
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95"
                            >
                                Reload Page
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="w-full bg-white hover:bg-slate-50 text-slate-600 font-semibold py-3 px-6 border border-slate-200 rounded-xl transition-all"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-slate-400 text-xs font-medium uppercase tracking-widest">
                        Doorstep Logistics Engine
                    </div>
                </div >
            );
        }

        return this.props.children;
    }
}
