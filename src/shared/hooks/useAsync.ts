import { useState, useCallback } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

interface AsyncActions<T, Args extends any[]> {
    execute: (...args: Args) => Promise<T | null>;
    reset: () => void;
}

export type UseAsyncReturn<T, Args extends any[]> = AsyncState<T> & AsyncActions<T, Args>;

/**
 * Generic hook for handling async operations with loading and error states
 * @param asyncFunction - The async function to execute
 * @param immediate - Whether to execute immediately on mount
 */
export function useAsync<T, Args extends any[] = []>(
    asyncFunction: (...args: Args) => Promise<T>,
    immediate = false
): UseAsyncReturn<T, Args> {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        loading: immediate,
        error: null,
    });

    const execute = useCallback(
        async (...args: Args): Promise<T | null> => {
            setState({ data: null, loading: true, error: null });

            try {
                const data = await asyncFunction(...args);
                setState({ data, loading: false, error: null });
                return data;
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                setState({ data: null, loading: false, error: err });
                console.error('Async operation failed:', err);
                return null;
            }
        },
        [asyncFunction]
    );

    const reset = useCallback(() => {
        setState({ data: null, loading: false, error: null });
    }, []);

    return {
        ...state,
        execute,
        reset,
    };
}
