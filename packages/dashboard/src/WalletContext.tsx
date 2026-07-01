import { createContext, useContext, type ReactNode } from 'react';
import { useWallet, type WalletState } from './useWallet';

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  return <Ctx.Provider value={wallet}>{children}</Ctx.Provider>;
}

export function useWalletCtx(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWalletCtx must be used within a WalletProvider');
  return ctx;
}
