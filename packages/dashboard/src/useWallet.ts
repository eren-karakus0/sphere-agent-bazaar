import { useCallback, useRef, useState } from 'react';
import { ConnectClient, SPHERE_NETWORKS } from '@unicitylabs/sphere-sdk/connect';
import { PostMessageTransport, ExtensionTransport } from '@unicitylabs/sphere-sdk/connect/browser';
import type { ConnectTransport, PublicIdentity } from '@unicitylabs/sphere-sdk/connect';

const WALLET_URL = 'https://sphere.unicity.network';

const DAPP = {
  name: 'Sphere Agent Bazaar',
  description: 'Autonomous agent marketplace — repo-risk analysis on Unicity',
  url: typeof location !== 'undefined' ? location.origin : 'https://sphere-agent-bazaar-dashboard.vercel.app',
  icon: '/icon.svg',
};

/** True when the Sphere browser extension is installed. */
function hasExtension(): boolean {
  try {
    const s = (window as unknown as { sphere?: { isInstalled?: () => boolean } }).sphere;
    return !!s && typeof s.isInstalled === 'function' && s.isInstalled() === true;
  } catch {
    return false;
  }
}

export type WalletStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface WalletState {
  status: WalletStatus;
  identity: PublicIdentity | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [status, setStatus] = useState<WalletStatus>('idle');
  const [identity, setIdentity] = useState<PublicIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<ConnectClient | null>(null);
  const popupRef = useRef<Window | null>(null);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      let transport: ConnectTransport;
      if (hasExtension()) {
        transport = ExtensionTransport.forClient();
      } else {
        const popup = window.open(
          `${WALLET_URL}/connect?origin=${encodeURIComponent(location.origin)}`,
          'sphere-connect',
          'width=440,height=680',
        );
        if (!popup) throw new Error('Popup blocked — please allow popups for this site.');
        popupRef.current = popup;
        transport = PostMessageTransport.forClient({ target: popup, targetOrigin: WALLET_URL });
      }

      const client = new ConnectClient({
        transport,
        dapp: DAPP,
        network: SPHERE_NETWORKS.testnet2,
      });
      const result = await client.connect();
      clientRef.current = client;
      setIdentity(result.identity);
      setStatus('connected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await clientRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    clientRef.current = null;
    try {
      popupRef.current?.close();
    } catch {
      /* ignore */
    }
    popupRef.current = null;
    setIdentity(null);
    setStatus('idle');
  }, []);

  return { status, identity, error, connect, disconnect };
}
