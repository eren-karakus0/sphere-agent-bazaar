import { useCallback, useEffect, useRef, useState } from 'react';
import { useWalletCtx } from './WalletContext';
import {
  fetchLeaderboard,
  hasBackend,
  newRound,
  playRound,
  verifyCommit,
  type LeaderRow,
  type Move,
  type NewRound,
  type PlayResult,
} from './lib/arcade';

const HAND: Record<Move, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const MOVES: Move[] = ['rock', 'paper', 'scissors'];

interface IdLike {
  nametag?: string;
  directAddress?: string;
  chainPubkey?: string;
}
const addressOf = (id: IdLike): string | undefined =>
  id.directAddress ?? id.chainPubkey ?? (id.nametag ? `@${id.nametag}` : undefined);
const nameOf = (id: IdLike): string => {
  if (id.nametag) return id.nametag.replace(/^@/, '');
  if (id.directAddress) return `${id.directAddress.slice(0, 10)}…`;
  return 'anon';
};

export function Arcade() {
  const wallet = useWalletCtx();
  const connected = wallet.status === 'connected' && !!wallet.identity;

  const [round, setRound] = useState<NewRound | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [house, setHouse] = useState<string | null>(null);
  const [reward, setReward] = useState(1);
  const dealing = useRef(false);

  const refreshBoard = useCallback(() => {
    void fetchLeaderboard()
      .then((b) => {
        setBoard(b.rows);
        if (b.house) setHouse(b.house);
        if (b.rewardUct) setReward(b.rewardUct);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  const deal = useCallback(async () => {
    if (!connected || dealing.current || !wallet.identity) return;
    dealing.current = true;
    setError(null);
    try {
      const r = await newRound(addressOf(wallet.identity));
      setRound(r);
      setHouse(r.house);
      setReward(r.rewardUct);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a round.');
    } finally {
      dealing.current = false;
    }
  }, [connected, wallet.identity]);

  // Auto-deal a fresh round whenever we're connected with none in play.
  useEffect(() => {
    if (connected && !round && !result) void deal();
  }, [connected, round, result, deal]);

  const pick = async (move: Move) => {
    if (!round || status !== 'idle' || !wallet.identity) return;
    setStatus('playing');
    setError(null);
    try {
      const res = await playRound({
        roundId: round.roundId,
        move,
        address: addressOf(wallet.identity),
        name: nameOf(wallet.identity),
      });
      setRound(null);
      setResult(res);
      setVerified(null);
      verifyCommit(res.dealerMove, res.nonce, res.commit)
        .then(setVerified)
        .catch(() => setVerified(false));
      refreshBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Play failed.');
    } finally {
      setStatus('idle');
    }
  };

  const again = () => {
    setResult(null);
    setVerified(null);
  };

  if (!hasBackend()) {
    return (
      <section className="arcade">
        <div className="empty">The arcade needs the live backend — it isn&apos;t configured here.</div>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="arcade">
        <div className="arcade__hero">
          <h2 className="arcade__title">Agent Arcade</h2>
          <p className="arcade__lede">
            Play rock–paper–scissors against an autonomous house agent. Beat it and it pays you
            real testnet UCT on-chain — no human in the loop. Provably fair.
          </p>
        </div>
        <div className="empty empty--locked">
          <div className="empty__lock">🔒</div>
          <div>Connect your Unicity wallet to play and get paid.</div>
          <button
            className="empty__connect"
            onClick={() => void wallet.connect()}
            disabled={wallet.status === 'connecting'}
          >
            {wallet.status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
      </section>
    );
  }

  const outcome = result?.outcome;

  return (
    <section className="arcade">
      <div className="arcade__hero">
        <h2 className="arcade__title">Agent Arcade</h2>
        <p className="arcade__lede">
          Rock–paper–scissors vs an autonomous house. Win and it sends you{' '}
          <span className="ink-accent">{reward} UCT</span> on-chain, automatically.
        </p>
        <div className="arcade__meta">
          <span className="arcade__chip">🤖 house {house ? `@${house}` : '…'}</span>
          <span className="arcade__chip">🎁 {reward} UCT / win</span>
          <span className="arcade__chip" title="The dealer commits sha256(move:nonce) before you pick.">
            🔐 provably fair
          </span>
        </div>
      </div>

      <div className="arena">
        <Hand
          label="you"
          face={result ? HAND[result.playerMove] : '❔'}
          state={result ? (outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : 'tie') : 'idle'}
        />
        <div className="arena__vs">
          {result ? (
            <div className={`verdict verdict--${outcome}`}>
              {outcome === 'win' ? 'YOU WON' : outcome === 'lose' ? 'YOU LOST' : 'TIE'}
            </div>
          ) : (
            <div className="arena__vs-txt">vs</div>
          )}
        </div>
        <Hand
          label="house"
          face={result ? HAND[result.dealerMove] : status === 'playing' ? '⏳' : '🤖'}
          state={result ? (outcome === 'lose' ? 'win' : outcome === 'win' ? 'lose' : 'tie') : 'idle'}
        />
      </div>

      {!result ? (
        <>
          <div className="commit" title={round?.commit}>
            {round ? (
              <>
                🔒 dealer committed <code>{round.commit.slice(0, 20)}…</code> — pick your move
              </>
            ) : (
              'dealing a fresh round…'
            )}
          </div>
          <div className="moves">
            {MOVES.map((m) => (
              <button
                key={m}
                className="move"
                onClick={() => void pick(m)}
                disabled={!round || status === 'playing'}
                aria-label={m}
              >
                <span className="move__hand">{HAND[m]}</span>
                <span className="move__name">{m}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="outcome">
          <div className="outcome__pay">
            {outcome === 'win' ? (
              result.paid ? (
                <span className="pay pay--ok">✓ {result.rewardUct} UCT sent to your wallet</span>
              ) : (
                <span className="pay pay--pend">payout pending — {result.payoutError ?? 'retrying on testnet'}</span>
              )
            ) : outcome === 'tie' ? (
              <span className="pay">a tie — no payout, go again</span>
            ) : (
              <span className="pay">the house took this one</span>
            )}
          </div>
          <div className="outcome__verify">
            {verified === null ? (
              <span className="verify verify--wait">verifying commitment…</span>
            ) : verified ? (
              <span className="verify verify--ok">
                🔐 provably fair — reveal matches the commit ({HAND[result.dealerMove]} {result.dealerMove})
              </span>
            ) : (
              <span className="verify verify--bad">⚠ commitment did not verify</span>
            )}
          </div>
          <button className="again" onClick={again}>
            Play again
          </button>
        </div>
      )}

      {error && <div className="tryit__error">⚠ {error}</div>}

      <div className="board">
        <div className="board__head">
          <span className="board__title">Leaderboard</span>
          <span className="board__note">top players · resets on redeploy</span>
        </div>
        {board.length === 0 ? (
          <div className="empty">No games yet — be the first to beat the house.</div>
        ) : (
          <div className="board__rows">
            {board.map((r, i) => (
              <div className="brow" key={r.name}>
                <span className="brow__rank">{i + 1}</span>
                <span className="brow__name">@{r.name}</span>
                <span className="brow__wl">
                  {r.wins}W · {r.losses}L · {r.ties}T
                </span>
                <span className="brow__earned">{r.earnedUct} UCT</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Hand({ label, face, state }: { label: string; face: string; state: 'idle' | 'win' | 'lose' | 'tie' }) {
  return (
    <div className={`hand hand--${state}`}>
      <div className="hand__face">{face}</div>
      <div className="hand__label">{label}</div>
    </div>
  );
}
