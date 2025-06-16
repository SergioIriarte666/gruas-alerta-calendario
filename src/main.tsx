
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui/custom-toast';
import './index.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}

const container = document.getElementById("root");
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
