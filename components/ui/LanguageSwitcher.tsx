
import React from 'react';
import { useLanguage } from '../../src/shared/contexts/LanguageContext';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`flex items-center space-x-1 bg-gray-100 rounded-lg p-1 border border-gray-200 ${className}`}>
      <button
        onClick={() => setLanguage('en')}
        className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
          language === 'en' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        🇺🇸 EN
      </button>
      <button
        onClick={() => setLanguage('km')}
        className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
          language === 'km' 
            ? 'bg-white text-indigo-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        🇰🇭 KH
      </button>
    </div>
  );
};
