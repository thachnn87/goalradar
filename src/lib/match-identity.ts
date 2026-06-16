/**
 * match-identity.ts — Canonical Match Identity Layer (DATA-15A)
 *
 * ⚠️  SKELETON / DORMANT MODULE — not yet wired into the snapshot pipeline.
 *     Nothing in production imports this file. It introduces NO changes to
 *     existing cache keys and does NOT touch match-snapshot.ts. Activation is
 *     gated behind IDENTITY_LAYER_ENABLED (default OFF) per the DATA-15A
 *     migration plan (see DATA15A_CANONICAL_ARCHITECTURE.md §Migration).
 *
 * ── Purpose ──────────────────────────────────────────────────────────────────
 * Every provider uses a different match identifier:
 *     football-data.org (FD)   537364
 *     ESPN hidden API           760427
 *     api-football (AF)         <fixture id>
 *
 * This layer mints ONE canonical, deterministic, provider-independent ID per
 * match and stores the cross-provider mapping in a single record, replacing the
 * ad-hoc FD→ESPN and FD→AF resolution scattered across espn-id-map.ts and
 * af-id-map.ts.
 *
 * ── Canonical ID ─────────────────────────────────────────────────────────────
 * Format:   wc2026_{fdMatchId}        e.g. "wc2026_537364"
 * Rationale: FD is already the system's authority for fixtures. FD IDs are
 *            stable forever and globally unique, so anchoring the canonical ID
 *            to the FD ID is deterministic and collision-free. The fragile
 *            human-readable alternative (wc2026_iran_new-zealand_2026-06-15) is
 *            kept only as the `naturalKey` for reverse-resolution from provider
 *            data when no FD ID is in hand. See architecture doc for full
 *            trade-off analysis.
 *
 * ── KV schema (see architecture doc §KV Schema for the authoritative spec) ─────
 *   goalradar:identity:{canonicalId}   MatchIdentity JSON   TTL 60 d
 *   goalradar:idx:fd:{fdId}            canonicalId (string) TTL 60 d
 *   goalradar:idx:espn:{espnEventId}   canonicalId (string) TTL 60 d
 *   goalradar:idx:af:{afFixtureId}     canonicalId (string) TTL 60 d
 *   goalradar:idx:nat:{naturalKey}     canonicalId (string) TTL 60 d
 *
 * NOTE on namespace: the DATA-15A spec proposed goalradar:fd:{id} /
 * goalradar:espn:{id} / goalradar:af:{id}. We use the `idx:` prefix instead to
 * avoid kv.scan() namespace collisions with the existing enrichment keys
 * goalradar:espn:event:* / goalradar:espn:lookup:* / goalradar:af:events:* /
 * goalradar:af:lookup:*. See audit doc §Migration Risks.
 */

import { kv } from '@vercel/kv';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const KV_ENABLED =
  typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
  typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

/**
 * Master feature flag. The identity layer performs NO reads or writes until
 * this is explicitly enabled. Defaults OFF so deploying this module is inert.
 */
export const IDENTITY_LAYER_ENABLED =
  process.env.IDENTITY_LAYER_ENABLED === 'true' && KV_ENABLED;

export const IDENTITY_TTL_SEC = 60 * 24 * 3600; // 60 days — covers a full tournament

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = 'fd' | 'espn' | 'af';

export interface MatchIdentity {
  /** Canonical, deterministic, provider-independent ID. e.g. "wc2026_537364". */
  canonicalId: string;

  /** Competition code, e.g. "WC" (matches FD competition.code). */
  competition: string;

  /** Kickoff time, ISO-8601 UTC truncated to the minute, e.g. "2026-06-16T01:00Z". */
  kickoffUtc: string;

  /** Normalised home team token (lowercased, diacritics stripped, alias-mapped). */
  homeTeam: string;

  /** Normalised away team token. */
  awayTeam: string;

  /**
   * Deterministic natural key "{home}|{away}|{kickoffUtc}". Used to resolve a
   * canonical ID from provider data when no FD ID is available. Mirrors
   * af-id-map.ts buildMappingKey() output so existing AF data aligns.
   */
  naturalKey: string;

  // ── Provider IDs (filled in as each provider resolves) ──────────────────────
  fdMatchId?:   number;
  espnEventId?: number;
  afFixtureId?: number;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Team-name normalisation (single source of truth for the identity layer)
// ---------------------------------------------------------------------------

/**
 * Union of the alias maps currently duplicated in af-id-map.ts and
 * providers/espn.ts. Consolidating them here is one of the goals of the
 * identity layer — both providers' spellings must collapse to one token.
 */
const CANONICAL_ALIASES: Record<string, string> = {
  'united states':        'usa',
  'united states men':    'usa',
  'trinidad & tobago':    'trinidad and tobago',
  'korea republic':       'south korea',
  "côte d'ivoire":        'ivory coast',
  "cote d'ivoire":        'ivory coast',
  'czechia':              'czech republic',
  'bosnia-herzegovina':   'bosnia',
  'cape verde islands':   'cape verde',
  'república dominicana': 'dominican republic',
};

/** Lowercase, strip diacritics, apply canonical aliases. */
export function normaliseTeam(name: string): string {
  const stripped = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return CANONICAL_ALIASES[stripped] ?? stripped;
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/** Identity record key: goalradar:identity:{canonicalId} */
export function buildIdentityKey(canonicalId: string): string {
  return `goalradar:identity:${canonicalId}`;
}

/** Reverse-index key for a provider ID: goalradar:idx:{provider}:{id} */
export function buildReverseIndexKey(provider: ProviderName, providerId: string | number): string {
  return `goalradar:idx:${provider}:${providerId}`;
}

/** Natural-key reverse index: goalradar:idx:nat:{naturalKey} */
export function buildNaturalIndexKey(naturalKey: string): string {
  return `goalradar:idx:nat:${naturalKey}`;
}

/**
 * Deterministic natural key "{home}|{away}|{kickoffUtc}".
 * Identical in shape to af-id-map.ts buildMappingKey() so AF data lines up.
 */
export function buildNaturalKey(input: {
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
}): string {
  const home = normaliseTeam(input.homeTeam);
  const away = normaliseTeam(input.awayTeam);
  const ts   = input.kickoffUtc.slice(0, 16) + 'Z';
  return `${home}|${away}|${ts}`;
}

// ---------------------------------------------------------------------------
// resolveCanonicalId
// ---------------------------------------------------------------------------

/**
 * Mint the canonical ID for a match. Deterministic — the same FD match always
 * yields the same canonical ID.
 *
 * Format: "{competitionSlug}_{fdMatchId}", e.g. "wc2026_537364".
 *
 * @param competition FD competition code (e.g. "WC")
 * @param fdMatchId   FD match ID — the stable anchor
 */
export function resolveCanonicalId(competition: string, fdMatchId: number): string {
  // WC → wc2026 (the only competition in scope for DATA-15A). Generalise the
  // season suffix when expanding to league play (PL/PD/etc. carry a season).
  const slug = competition.toLowerCase() === 'wc' ? 'wc2026' : competition.toLowerCase();
  return `${slug}_${fdMatchId}`;
}

// ---------------------------------------------------------------------------
// saveIdentity
// ---------------------------------------------------------------------------

/**
 * Persist an identity record plus all reverse indexes for the provider IDs it
 * carries. Additive and idempotent — safe to call on every enrichment.
 *
 * Writes:
 *   goalradar:identity:{canonicalId}
 *   goalradar:idx:fd:{fdMatchId}        (if present)
 *   goalradar:idx:espn:{espnEventId}    (if present)
 *   goalradar:idx:af:{afFixtureId}      (if present)
 *   goalradar:idx:nat:{naturalKey}
 *
 * No-op when the layer is disabled.
 *
 * TODO(DATA-15B): merge with any existing record before writing so a later
 * provider-ID discovery does not clobber earlier ones.
 */
export async function saveIdentity(identity: MatchIdentity): Promise<void> {
  if (!IDENTITY_LAYER_ENABLED) return;

  const writes: Array<Promise<unknown>> = [
    kv.set(buildIdentityKey(identity.canonicalId), identity, { ex: IDENTITY_TTL_SEC }),
    kv.set(buildNaturalIndexKey(identity.naturalKey), identity.canonicalId, { ex: IDENTITY_TTL_SEC }),
  ];

  if (identity.fdMatchId !== undefined) {
    writes.push(kv.set(buildReverseIndexKey('fd', identity.fdMatchId), identity.canonicalId, { ex: IDENTITY_TTL_SEC }));
  }
  if (identity.espnEventId !== undefined) {
    writes.push(kv.set(buildReverseIndexKey('espn', identity.espnEventId), identity.canonicalId, { ex: IDENTITY_TTL_SEC }));
  }
  if (identity.afFixtureId !== undefined) {
    writes.push(kv.set(buildReverseIndexKey('af', identity.afFixtureId), identity.canonicalId, { ex: IDENTITY_TTL_SEC }));
  }

  try {
    await Promise.all(writes);
  } catch (err) {
    console.error('[IDENTITY] saveIdentity failed:', err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// loadIdentity
// ---------------------------------------------------------------------------

/**
 * Load an identity record by canonical ID, or by any provider ID via the
 * reverse indexes.
 *
 * @param ref Either a canonicalId string, or { provider, id } to resolve via
 *            a reverse index, or { naturalKey } to resolve via the natural index.
 */
export async function loadIdentity(
  ref:
    | string
    | { provider: ProviderName; id: string | number }
    | { naturalKey: string },
): Promise<MatchIdentity | null> {
  if (!IDENTITY_LAYER_ENABLED) return null;

  try {
    let canonicalId: string | null;

    if (typeof ref === 'string') {
      canonicalId = ref;
    } else if ('naturalKey' in ref) {
      canonicalId = await kv.get<string>(buildNaturalIndexKey(ref.naturalKey));
    } else {
      canonicalId = await kv.get<string>(buildReverseIndexKey(ref.provider, ref.id));
    }

    if (!canonicalId) return null;
    return await kv.get<MatchIdentity>(buildIdentityKey(canonicalId));
  } catch (err) {
    console.error('[IDENTITY] loadIdentity failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveProviderIds
// ---------------------------------------------------------------------------

/**
 * Return the known provider IDs for a match, resolving and (lazily) filling in
 * any that are missing.
 *
 * TODO(DATA-15C): when a provider ID is absent, call the provider's resolver
 * (findEspnMatch / resolveAfFixtureId), then merge the result back via
 * saveIdentity(). For the skeleton this only reads what is already stored.
 *
 * @returns the provider-ID subset of the identity, or null when unknown.
 */
export async function resolveProviderIds(
  ref: string | { provider: ProviderName; id: string | number } | { naturalKey: string },
): Promise<Pick<MatchIdentity, 'fdMatchId' | 'espnEventId' | 'afFixtureId'> | null> {
  const identity = await loadIdentity(ref);
  if (!identity) return null;
  return {
    fdMatchId:   identity.fdMatchId,
    espnEventId: identity.espnEventId,
    afFixtureId: identity.afFixtureId,
  };
}
