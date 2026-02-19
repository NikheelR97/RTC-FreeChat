import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-void text-starlight h-screen flex flex-col items-center justify-center">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Space Debris Impact (Crash)</h1>
                    <pre className="bg-black/50 p-4 rounded border border-white/10 text-xs overflow-auto max-w-2xl">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-nebula text-void font-bold rounded"
                    >
                        Re-Initialize (Reload)
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
