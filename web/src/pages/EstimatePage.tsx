import { useMemo, useState } from 'react';
import { estimate, scaleTable, type EstimateInput } from '../../../shared/estimate/calc.ts';
import { PRICING_NOTE } from '../../../shared/estimate/pricing.ts';
import { ESTIMATE_SCENARIOS } from '../../../shared/estimate/scenarios.ts';

const DEFAULTS: EstimateInput = {
  users: 1_000_000,
  actionsPerUserPerDay: 10,
  peakMultiplier: 3,
  avgRequestBytes: 500,
  avgResponseBytes: 2_000,
  writesPerUserPerDay: 1,
  avgObjectBytes: 1_000_000,
  retentionDays: 30,
  replicationFactor: 3,
  qpsPerServer: 500,
};

const SCALE_LEVELS = [1_000_000, 10_000_000, 100_000_000];

interface FieldDef {
  key: keyof EstimateInput;
  label: string;
  hint: string;
}

const FIELDS: FieldDef[] = [
  { key: 'users', label: 'Daily active users', hint: 'e.g. 1,000,000' },
  { key: 'actionsPerUserPerDay', label: 'Actions (requests) per user per day', hint: 'reads + writes combined' },
  { key: 'peakMultiplier', label: 'Peak / average multiplier', hint: 'how much busier than average your busiest hour is' },
  { key: 'avgRequestBytes', label: 'Avg request size (bytes)', hint: 'a typical API request payload' },
  { key: 'avgResponseBytes', label: 'Avg response size (bytes)', hint: 'a typical API response payload' },
  { key: 'writesPerUserPerDay', label: 'Writes (new objects) per user per day', hint: 'drives the storage estimate' },
  { key: 'avgObjectBytes', label: 'Avg object size (bytes)', hint: 'e.g. an uploaded photo' },
  { key: 'retentionDays', label: 'Retention (days)', hint: 'how long you keep written data' },
  { key: 'replicationFactor', label: 'Replication factor', hint: 'copies kept, e.g. 3 = primary + 2 replicas' },
  { key: 'qpsPerServer', label: 'QPS one app server can sustain', hint: 'your capacity-per-instance assumption' },
];

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function EstimatePage() {
  const [input, setInput] = useState<EstimateInput>(DEFAULTS);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const result = useMemo(() => estimate(input), [input]);
  const table = useMemo(() => scaleTable(input, SCALE_LEVELS), [input]);
  const activeScenario = ESTIMATE_SCENARIOS.find((s) => s.id === scenarioId) ?? null;

  const set = (key: keyof EstimateInput, value: string) => {
    const n = Number(value);
    setInput((prev) => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : prev[key] }));
    setScenarioId(null);
  };

  const loadScenario = (id: string) => {
    const scenario = ESTIMATE_SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    setInput(scenario.input);
    setScenarioId(id);
  };

  return (
    <main className="page">
      <h1>Capacity estimation</h1>
      <p className="muted">
        The back-of-envelope math from the estimation phase — QPS, storage, bandwidth, and a rough server/AWS-cost
        order of magnitude, from the numbers you'd actually state out loud in an interview.
      </p>
      <div className="callout small" style={{ marginTop: '0.75rem' }}>
        {PRICING_NOTE}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.35rem' }}>Reference scenarios</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Don't want to guess plausible numbers from scratch? Load a real-world-grounded scenario, then tweak it.
        </p>
        <div className="row">
          {ESTIMATE_SCENARIOS.map((s) => (
            <button key={s.id} className={`chip ${scenarioId === s.id ? 'selected' : ''}`} onClick={() => loadScenario(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        {activeScenario && (
          <p className="small muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {activeScenario.description}
          </p>
        )}
      </div>

      <div className="split" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <h2>Inputs</h2>
          <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '0.75rem' }}>
            {FIELDS.map((f) => (
              <label key={f.key} className="stack" style={{ gap: '0.2rem' }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  {f.label}
                </span>
                <input className="input" type="number" min={0} value={input[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                <span className="tiny muted">{f.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>At {fmt(input.users)} users</h2>
            <div className="grid grid-3">
              <Stat label="Avg QPS" value={fmt(result.avgQps)} />
              <Stat label="Peak QPS" value={fmt(result.peakQps)} />
              <Stat label="App servers needed" value={fmt(result.serversNeeded)} />
              <Stat label="Ingress bandwidth" value={`${fmt(result.ingressMBps)} MB/s`} />
              <Stat label="Egress bandwidth" value={`${fmt(result.egressMBps)} MB/s`} />
              <Stat label="Storage (with replication)" value={`${fmt(result.storageGbTotal)} GB`} />
            </div>
            <div className="ref-h" style={{ marginTop: '1rem' }}>
              Monthly AWS cost ballpark
            </div>
            <table className="table">
              <tbody>
                <tr>
                  <td>S3 storage</td>
                  <td className="mono">${fmt(result.monthlyS3Cost)}</td>
                </tr>
                <tr>
                  <td>Internet egress (no CDN)</td>
                  <td className="mono">${fmt(result.monthlyEgressCost)}</td>
                </tr>
                <tr>
                  <td>CloudFront egress (with a CDN)</td>
                  <td className="mono">${fmt(result.monthlyCdnCost)}</td>
                </tr>
                <tr>
                  <td>Compute ({result.serversNeeded} servers)</td>
                  <td className="mono">${fmt(result.monthlyComputeCost)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total (storage + raw egress + compute)</strong>
                  </td>
                  <td className="mono">
                    <strong>${fmt(result.monthlyTotalCost)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="tiny muted" style={{ marginTop: '0.5rem' }}>
              A CDN's egress price is usually lower than raw internet egress AND it cuts latency for far-away
              users — the total row uses raw egress as the conservative default.
            </p>
          </div>

          <div className="card">
            <h2>Scaling 1M → 100M users</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Users</th>
                    <th>Peak QPS</th>
                    <th>Servers</th>
                    <th>Storage</th>
                    <th>Monthly cost</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.users}>
                      <td>{fmt(row.users)}</td>
                      <td>{fmt(row.result.peakQps)}</td>
                      <td>{fmt(row.result.serversNeeded)}</td>
                      <td>{fmt(row.result.storageGbTotal)} GB</td>
                      <td>${fmt(row.result.monthlyTotalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>CDN regions — a rule of thumb, not a formula</h2>
            <p className="small">
              "How many CDN regions" isn't really computable from a user count alone — CloudFront/Cloudflare/Fastly
              already run hundreds of edge points-of-presence globally, and you don't provision those yourself. The
              real decision is how many <strong>origin/API regions</strong> to run, which trades latency for
              operational and data-replication cost:
            </p>
            <ul className="small" style={{ paddingLeft: '1.1rem' }}>
              <li>
                <strong>Single country/region:</strong> one origin region; the CDN's edge network handles static/cacheable
                content close to users automatically.
              </li>
              <li>
                <strong>Continental (e.g. all of North America):</strong> usually still one origin region is fine for
                dynamic requests; the CDN absorbs most of the latency difference for cacheable content.
              </li>
              <li>
                <strong>Global (NA + EU + APAC):</strong> worth a second (and maybe third) origin/API region if
                dynamic (non-cacheable) request latency matters — which then means cross-region data replication
                becomes a real design question, not just an infra checkbox.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-value" style={{ fontSize: '1.3rem' }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
