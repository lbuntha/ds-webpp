
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './src/shared/hooks/useToast';
import { ToastContainer } from './src/shared/components/ToastContainer';
import { PermissionsProvider } from './contexts/PermissionsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <PermissionsProvider>
          <App />
          <ToastContainer />
        </PermissionsProvider>
      </ToastProvider>
    </LanguageProvider>
  </React.StrictMode>
);
