/**
 * P1-STANDINGS-ISO — orchestrator execution-order invariant.
 *
 * Guarantees the six LIVE league standings tasks run BEFORE any WC provider task,
 * so a WC (or team) provider failure — which trips the GLOBAL rate-safe latch and
 * then skips every *subsequent* task in the run — can never starve the six live
 * league standings of their refresh opportunity in the same run.
 *
 * Team enrichment (/teams/{id}) is Phase D: it executes in the GET handler AFTER
 * the entire buildTasks() list, so by construction no team call precedes standings.
 *
 * These tests inspect only the task ORDER (labels). They never invoke task.run(),
 * so no provider or KV call is made.
 *
 * Source: src/app/api/cron/orchestrator/route.ts buildTasks()
 */
import { buildTasks } from '@/app/api/cron/orchestrator/route';

const LEAGUES = [
  'standings-pl', 'standings-pd', 'standings-bl1',
  'standings-sa', 'standings-fl1', 'standings-cl',
];
const WC_TASKS = ['wc-all-matches', 'wc-upcoming', 'wc-finished', 'wc-recent', 'standings-wc'];

describe('orchestrator task order (P1-STANDINGS-ISO)', () => {
  const labels = buildTasks().map((t) => t.label);
  const idx = (label: string) => labels.indexOf(label);
  const lastLeagueIdx = Math.max(...LEAGUES.map(idx));
  const firstWcIdx = Math.min(...WC_TASKS.map(idx));

  test('all six live league standings tasks are present', () => {
    for (const l of LEAGUES) expect(labels).toContain(l);
  });

  test('the six league standings are the first six tasks (Phase A)', () => {
    expect([...labels.slice(0, 6)].sort()).toEqual([...LEAGUES].sort());
  });

  test('CRITICAL INVARIANT: no WC provider task precedes any league standings', () => {
    for (const l of LEAGUES) expect(idx(l)).toBeLessThan(firstWcIdx);
  });

  test('every league standings task runs before every WC task', () => {
    for (const wc of WC_TASKS) expect(idx(wc)).toBeGreaterThan(lastLeagueIdx);
  });

  test('WC standings (standings-wc) is a Phase-C task, after the league standings', () => {
    expect(idx('standings-wc')).toBeGreaterThan(lastLeagueIdx);
  });

  test('today/live cross-competition tasks run after leagues and before WC (Phase B)', () => {
    for (const x of ['today-matches', 'live-matches']) {
      expect(idx(x)).toBeGreaterThan(lastLeagueIdx);
      expect(idx(x)).toBeLessThan(firstWcIdx);
    }
  });
});
