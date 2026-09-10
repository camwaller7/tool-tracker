import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Register the service worker so the app is installable ("Add to Home Screen").
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
