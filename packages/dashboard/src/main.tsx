import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './WalletContext';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
);
