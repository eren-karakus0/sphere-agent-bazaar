import { useState } from 'react';
import { Arcade } from './Arcade';
import { ConnectWallet } from './ConnectWallet';
import { Die } from './arcade/art';
import { isMuted, setMuted, sfx } from './arcade/sound';

export function App() {
  return (
    <div className="app">
      <Header />
      <Arcade />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="hdr">
      <div className="hdr__mark">
        <Die n={5} size={26} />
      </div>
      <div className="hdr__titles">
        <div className="hdr__title">
          Unicity <em>Arcade House</em>
        </div>
        <div className="hdr__sub">Provably-fair games · on-chain payouts</div>
      </div>
      <div className="hdr__right">
        <MuteButton />
        <span className="hdr__net">testnet2</span>
        <ConnectWallet />
      </div>
    </header>
  );
}

function MuteButton() {
  const [muted, setM] = useState(isMuted);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setM(next);
    if (!next) sfx.click(); // audible confirmation when unmuting
  };
  return (
    <button className="mutebtn" onClick={toggle} aria-label={muted ? 'unmute sounds' : 'mute sounds'} title={muted ? 'unmute sounds' : 'mute sounds'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 9 v6 h4 l5 4 V5 L8 9 Z" fill="currentColor" />
        {muted ? (
          <path d="M16 9 l5 6 M21 9 l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.5 9.5 a4 4 0 0 1 0 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 7.5 a7.5 7.5 0 0 1 0 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span className="footer__brand">Unicity Arcade House</span>
      <span>Provably-fair games, on-chain payouts</span>
      <span>Built on the Sphere SDK · testnet2</span>
    </footer>
  );
}
