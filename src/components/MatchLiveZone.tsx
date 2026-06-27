'use client';

// LIVE-1: Client-side live score poller for the match page hero.
// Renders the status badge + score for IN_PLAY/PAUSED matches and polls
// /api/live-score/[matchId] every 30s. Auto-stops on terminal status.
// DATA-18WC.RUNTIME.TRUTH Phase 4: poll interval from runtime-clock.ts (ONE CLOCK).
// DATA-18WC.RUNTIME.TRUTH Phase 5: tracks live version from API responses.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Score, MatchStatus } from '@/lib/types';
import { RUNTIME_POLL_INTERVAL } from '@/lib/runtime-clock';

const LIVE_STATUSES: MatchStatus[] = ['IN_PLAY', 'PAUSED'];
const TERMINAL_STATUSES: MatchStatus[] = ['FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED'];

interface LiveScoreResponse {
  status:      MatchStatus;
  score:       Score;
  minute?:     number | null;
  lastUpdated?: string | null;
}

interface Props {
  matchId:        string;
  initialStatus:  MatchStatus;
  initialScore:   Score;
  initialMinute?: number | null;
  initialVersion?: number;
}

function matchProgress(status: MatchStatus, minute: number | null): string | null {
  if (status === 'PAUSED') return 'Half Time';
  if (status !== 'IN_PLAY' || minute === null) return null;
  if (minute <= 45) return 'First Half';
  if (minute <= 90) return 'Second Half';
  return 'Stoppage Time';
}

function StatusBadge({ status, minute }: { status: MatchStatus; minute: number | null }) {
  if (status === 'IN_PLAY') {
    const clockLabel = minute != null ? `${minute}'` : 'LIVE';
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-sm font-bold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        {clockLabel}
      </span>
    );
  }
  if (status === 'PAUSED') {
    return (
      <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-sm font-bold">
        HT
      </span>
    );
  }
  if (status === 'FINISHED') {
    return (
      <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-bold">
        FULL TIME
      </span>
    );
  }
  return (
    <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-sm font-bold">
      {status}
    </span>
  );
}

export default function MatchLiveZone({ matchId, initialStatus, initialScore, initialMinute, initialVersion }: Props) {
  const [status, setStatus]   = useState<MatchStatus>(initialStatus);
  const [score, setScore]     = useState<Score>(initialScore);
  const [minute, setMinute]   = useState<number | null>(initialMinute ?? null);
  const [liveVersion, setLiveVersion] = useState<number>(initialVersion ?? 0);
  const [countdown, setCountdown]     = useState(RUNTIME_POLL_INTERVAL);
  const [polling, setPolling]         = useState(LIVE_STATUSES.includes(initialStatus));

  const prevScore = useRef(initialScore);

  const poll = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/live-score/${matchId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as LiveScoreResponse;
      const latencyMs = Math.round(performance.now() - t0);

      const prev = prevScore.current;
      const scoreChanged =
        data.score?.fullTime?.home !== prev?.fullTime?.home ||
        data.score?.fullTime?.away !== prev?.fullTime?.away;

      setStatus(data.status);
      if (data.score) {
        setScore(data.score);
        prevScore.current = data.score;
      }
      setMinute(data.minute ?? null);
      // Phase 5: update live version from API response timestamp
      if (data.lastUpdated) {
        const v = Math.floor(new Date(data.lastUpdated).getTime() / 1000);
        if (v > 0) setLiveVersion(v);
      }

      // Phase 4: fire-and-forget telemetry beacon
      fetch('/api/telemetry/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, latencyMs, scoreChanged }),
      }).catch(() => {});

      // Phase 3: auto-stop on terminal status
      if (TERMINAL_STATUSES.includes(data.status)) {
        setPolling(false);
      }
    } catch {
      // silent — don't disrupt the UI on transient network errors
    }
  }, [matchId]);

  useEffect(() => {
    if (!polling) return;

    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          poll();
          return RUNTIME_POLL_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [polling, poll]);

  const showScore = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(status);

  return (
    // data-live-version: Phase 5 — allows check-runtime-version.mjs to compare
    // this client-side live version with the server-rendered data-match-version.
    <div data-live-version={liveVersion || undefined}>
      <div className="flex flex-col items-center gap-1 mb-4">
        <StatusBadge status={status} minute={minute} />
        {matchProgress(status, minute) && (
          <span className="text-[11px] text-gray-500">{matchProgress(status, minute)}</span>
        )}
      </div>

      {showScore ? (
        <>
          <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
            {score.fullTime.home ?? '–'}
            <span className="text-gray-600 mx-1">–</span>
            {score.fullTime.away ?? '–'}
          </div>
          {score.halfTime.home !== null && (
            <p className="text-xs text-gray-500 mt-2">
              HT {score.halfTime.home} – {score.halfTime.away}
            </p>
          )}
        </>
      ) : (
        <div className="text-3xl font-bold text-gray-600">vs</div>
      )}

      {polling && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-3">
          <span className="w-3 h-3 rounded-full border-2 border-gray-700 border-t-green-400 animate-spin" aria-hidden />
          Refreshes in {countdown}s
        </div>
      )}
    </div>
  );
}
