import { useWalletCtx } from './WalletContext';

export function ConnectWallet() {
  const { status, identity, error, connect, disconnect } = useWalletCtx();

  if (status === 'connected' && identity) {
    const label = identity.nametag
      ? `@${identity.nametag}`
      : `${identity.directAddress?.slice(0, 12) ?? 'wallet'}…`;
    return (
      <div className="wallet wallet--on" title={identity.directAddress ?? identity.chainPubkey}>
        <span className="wallet__dot" />
        <span className="wallet__name">{label}</span>
        <button
          className="wallet__x"
          onClick={() => void disconnect()}
          title="Disconnect"
          aria-label="Disconnect wallet"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <button
      className="wallet wallet__btn"
      onClick={() => void connect()}
      disabled={status === 'connecting'}
      title={error ?? 'Connect your Unicity (Sphere) wallet'}
    >
      {status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Retry connect' : 'Connect Wallet'}
    </button>
  );
}
