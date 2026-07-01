import { useEffect, useState } from 'react';
import { bandColor } from './lib/derive';
import { analyzeInstant, analyzeViaAgents, checkAgentsLive, type Report } from './lib/backend';

const EXAMPLES = ['facebook/react', 'angular/angular.js', 'expressjs/express'];

export function TryIt() {
  const [repo, setRepo] = useState('');
  const [agentsLive, setAgentsLive] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'agents' | 'instant'>('idle');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void checkAgentsLive().then((v) => {
      if (alive) setAgentsLive(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const busy = status !== 'idle';

  const run = async (target?: string) => {
    const q = (target ?? repo).trim();
    if (!q || busy) return;
    if (target) setRepo(target);
    setError(null);
    setReport(null);

    if (agentsLive) {
      setStatus('agents');
      try {
        setReport(await analyzeViaAgents(q));
        setStatus('idle');
        return;
      } catch (e) {
        setError(`Live agents: ${e instanceof Error ? e.message : 'failed'} — showing an instant preview instead.`);
      }
    }

    setStatus('instant');
    try {
      setReport(await analyzeInstant(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setStatus('idle');
    }
  };

  const btnLabel = status === 'agents' ? 'Hiring agents…' : status === 'instant' ? 'Analyzing…' : 'Analyze';

  return (
    <section className="tryit">
      <div className="tryit__head">
        <span className="tryit__kicker">Analyze a repo</span>
        <h2 className="tryit__title">Score any GitHub repo</h2>
        <p className="tryit__sub">
          {agentsLive
            ? 'Your request is fulfilled by the real agent economy below — the agents discover each other, negotiate, and settle on-chain (≈20–40s). Watch it happen live.'
            : "Runs the analyst's exact logic — maintenance signals plus a live OSV.dev dependency-CVE scan. Free and instant."}
        </p>
        <AgentStatus live={agentsLive} />
      </div>

      <form
        className="tryit__form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          className="tryit__input"
          placeholder="owner/repo  ·  e.g. facebook/react"
          value={repo}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setRepo(e.target.value)}
        />
        <button className="tryit__btn" type="submit" disabled={busy}>
          {btnLabel}
        </button>
      </form>

      <div className="tryit__examples">
        <span className="tryit__try">try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => void run(ex)} disabled={busy}>
            {ex}
          </button>
        ))}
      </div>

      {status === 'agents' && (
        <div className="tryit__working">
          <span className="tryit__spin" /> Hiring the analyst, paying on-chain, analyzing…
          <span className="tryit__hint">↓ watch the agents below</span>
        </div>
      )}
      {error && <div className="tryit__error">⚠ {error}</div>}
      {report && <ReportCard report={report} />}
    </section>
  );
}

function AgentStatus({ live }: { live: boolean | null }) {
  if (live === null) {
    return <div className="agentstat agentstat--wait">checking live agents…</div>;
  }
  if (live) {
    return (
      <div className="agentstat agentstat--on">
        <span className="agentstat__dot" /> Live agents ready — analyses run through the real economy
      </div>
    );
  }
  return <div className="agentstat agentstat--off">Live agents offline — instant preview mode</div>;
}

function ReportCard({ report }: { report: Report }) {
  const color = bandColor(report.riskBand);
  return (
    <div className="report">
      <div className="report__score" style={{ color }}>
        <div className="report__num">{report.riskScore}</div>
        <div className="report__band">{report.riskBand} risk</div>
      </div>
      <div className="report__body">
        <div className="report__repo">{report.repo}</div>
        {report.source === 'agents' ? (
          <div className="report__badge report__badge--agents">✓ delivered by the live agents · paid on-chain</div>
        ) : (
          <div className="report__badge">instant preview</div>
        )}
        <ul className="report__signals">
          {report.signals.length === 0 ? (
            <li className="report__sig">
              <span className="report__sig-name">clean</span>
              <span className="report__sig-detail">no notable risk signals detected</span>
            </li>
          ) : (
            report.signals.map((s) => (
              <li key={s.name} className="report__sig">
                <span className="report__sig-w" style={{ color }}>
                  +{s.weight}
                </span>
                <span className="report__sig-name">{s.name}</span>
                <span className="report__sig-detail">{s.detail}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
