import React, { useRef, useState } from 'react';
import { Button } from './Button';

interface Props {
  label?: string;
  value?: string; // base64 string
  onChange: (value: string) => void;
  className?: string;
}

export const ImageUpload: React.FC<Props> = ({ label, value, onChange, className = '' }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      // Limit increased to 5MB for Cloud Storage
      if (file.size > 5 * 1024 * 1024) {
        setError("File is too large. Max size is 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      
      <div className="flex items-start space-x-4">
        {value ? (
          <div className="relative group">
            <div className="h-24 w-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              title="Remove Image"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div 
            className="h-24 w-24 flex-shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:bg-indigo-50 transition-colors cursor-pointer bg-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-medium uppercase">Upload</span>
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        
        <div className="flex-1 min-w-0">
            {!value ? (
                <>
                    <p className="text-xs text-gray-500 mt-1">
                        Upload QR code (JPG/PNG). Max 5MB.
                    </p>
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs h-8">
                        Select Image
                    </Button>
                </>
            ) : (
                <div className="mt-1">
                    <span className="text-xs text-green-600 font-medium flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        Image Selected
                    </span>
                    <p className="text-xs text-gray-400 mt-1">Click the X to remove.</p>
                </div>
            )}
            {error && (
                <p className="text-xs text-red-600 mt-2 font-medium animate-pulse">
                    {error}
                </p>
            )}
         </div>
      </div>
    </div>
  );
};
