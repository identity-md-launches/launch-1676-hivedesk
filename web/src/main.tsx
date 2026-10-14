import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { walletConfig } from './config';
import App from './App';
import './styles.css';

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode><WagmiProvider config={walletConfig}><QueryClientProvider client={queryClient}><App /></QueryClientProvider></WagmiProvider></StrictMode>,
);
