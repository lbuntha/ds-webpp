import { useState, useRef, useEffect } from 'react';

interface PINInputProps {
    length?: number;
    onComplete: (pin: string) => void;
    error?: string | null;
    disabled?: boolean;
    autoFocus?: boolean;
}

/**
 * Reusable PIN input component with individual digit boxes
 */
export function PINInput({
    length = 4,
    onComplete,
    error,
    disabled = false,
    autoFocus = true
}: PINInputProps) {
    const [values, setValues] = useState<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [autoFocus]);

    const handleChange = (index: number, value: string) => {
        if (disabled) return;

        // Only allow single digit
        const digit = value.replace(/\D/g, '').slice(-1);

        const newValues = [...values];
        newValues[index] = digit;
        setValues(newValues);

        // Move to next input
        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Check if complete
        const pin = newValues.join('');
        if (pin.length === length && !newValues.includes('')) {
            onComplete(pin);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'Backspace' && !values[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (disabled) return;

        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

        const newValues = [...values];
        pastedData.split('').forEach((digit, i) => {
            if (i < length) newValues[i] = digit;
        });
        setValues(newValues);

        // Focus last filled or next empty
        const nextIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[nextIndex]?.focus();

        if (pastedData.length === length) {
            onComplete(pastedData);
        }
    };

    const reset = () => {
        setValues(Array(length).fill(''));
        inputRefs.current[0]?.focus();
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-center gap-3">
                {values.map((value, index) => (
                    <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={value}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        disabled={disabled}
                        className={`
                            w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 
                            transition-all duration-200 outline-none
                            ${error
                                ? 'border-red-400 bg-red-50 text-red-700 shake'
                                : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}
                        `}
                    />
                ))}
            </div>
            {error && (
                <p className="text-center text-sm text-red-600 animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
}

// Export reset function via ref pattern if needed
export default PINInput;
