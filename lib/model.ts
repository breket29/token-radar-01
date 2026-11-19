// Token Radar's model, radar-3: one sealed snapshot of the protocol universe in,
// one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and every pre-token protocol below the floor that passes the house's
// own exclusion rule: no token recorded, not a wrapped, staked or bridged
// product of a token that already trades, not a versioned pool, not an
// exchange. A protocol is pre-token when its record carries no token (no
// market cap, no CoinGecko id, no symbol); the snapshot's live-token
// protocols are kept apart in the Live view and shown at the market's own
// values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, through a
// comparable the snapshot itself supplies:
//
//   ratio        = the row's category ratio, read on a ladder:
//                  (a) a category with traded names reads a SHRUNK
//                  log-median: the median of its names' log(mcap/TVL),
//                  pulled toward the global log-median with a prior worth
//                  3 notional names, so one wild name cannot set a
//                  category and a category with many names keeps almost
//                  all of its own reading;
//                  (b) a category with no traded name reads the SIZE LINE:
//                  the OLS line of log(mcap/TVL) on log(TVL) over every
//                  traded name in the snapshot (bigger protocols trade at
//                  lower multiples, correlation about -0.41), at this
//                  category's median TVL.
//   base         = tvl_usd x ratio
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity     = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365)
//   chainMult    = 1 + 0.02 x min(chains - 1, 5)
//   implied      = max(1, round(base x growthMult x maturity x chainMult))
//
// A category's ratio is what the market already pays for a dollar of TVL in
// that line of business: Dexs trade near 0.31x TVL, Lending near 0.14x, and
// a line with too few traded names to read on its own is pulled toward the
// snapshot's global median near 0.21x instead of taking it whole. No
// protocol name is ever special-cased: the same function scores every row,
// and the ratios, the prior and the size line are recomputed from the
// snapshot on every run, so a different snapshot gives different ratios.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the page recomputes them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
  shrinkage_names: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_cap: 5,
  shrinkage_names: 3,
};

/** The model's version label: the dashboard names it and the page states it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A category's comparable: its ratio, how it was read, and the reading behind it. */
export interface CategoryRatio {
  ratio: number;
  comparables: number;
  fallback: boolean;
  tier: 'category' | 'size';
  shrink_weight: number | null;
  category_median: number | null;
  size_median_log_tvl: number | null;
}

/** The size line: log(mcap/TVL) against log(TVL) over the traded names. */
export interface SizeLine {
  intercept: number;
  slope: number;
  correlation: number;
  n: number;
}

/** One traded name behind a category's ratio. */
export interface ComparableName {
  name: string;
  ratio: number;
  tvl_usd: number;
}

/** The comparables the snapshot supplies: one ratio per category, the global one, the size line, and the names behind each ratio. */
export interface Comparables {
  by_category: Record<string, CategoryRatio>;
  global: CategoryRatio;
  size_line: SizeLine;
  comparable_names: Record<string, ComparableName[]>;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_ratio: number;
    ratio_comparables: number;
    ratio_fallback: boolean;
    ratio_tier: 'category' | 'size';
    ratio_shrink_weight: number | null;
    ratio_category_median: number | null;
    size_median_log_tvl: number | null;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the farm plan travels with it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  implied_value_usd: number;
  category_ratio: number;
  ratio_comparables: number;
  ratio_fallback: boolean;
  ratio_tier: 'category' | 'size';
  ratio_shrink_weight: number | null;
  ratio_category_median: number | null;
  size_median_log_tvl: number | null;
  tvl_percentile_in_category: number | null;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the comparables and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  comparables: Comparables;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted list of numbers; 0 when it holds none. */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * OLS of log(mcap/TVL) on log(TVL) over the traded names: the size line.
 * The slope is negative in this snapshot (bigger protocols trade at lower
 * multiples); the line is recomputed from the snapshot on every run.
 */
export function fitSizeLine(points: { logTvl: number; logRatio: number }[]): SizeLine {
  const n = points.length;
  if (n < 2) return { intercept: 0, slope: 0, correlation: 0, n };
  let mx = 0, my = 0;
  for (const p of points) { mx += p.logTvl; my += p.logRatio; }
  mx /= n; my /= n;
  let cov = 0, vx = 0, vy = 0;
  for (const p of points) {
    const dx = p.logTvl - mx, dy = p.logRatio - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  const slope = vx === 0 ? 0 : cov / vx;
  const intercept = my - slope * mx;
  const correlation = vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
  return { intercept: round4(intercept), slope: round4(slope), correlation: round4(correlation), n };
}

/**
 * The comparables: for every category, a ratio read from the snapshot's own
 * traded names, and the size line for the categories that have none.
 *
 * A category with traded names reads a shrunk log-median: the median of its
 * names' log(mcap/TVL), pulled toward the global log-median with a prior
 * worth `shrinkage_names` notional names. One wild name (a 400x multiple on
 * a $6M TVL) cannot set a category on its own, and a category with many
 * names keeps almost all of its own reading.
 *
 * A category with no traded name reads the size line at its own median log
 * TVL: the multiple the traded universe pays at this line of business's
 * size. The line, the prior and every ratio are recomputed from the
 * snapshot on every run.
 */
export function categoryRatios(snapshot: Snapshot, model: ModelConstants = MODEL): Comparables {
  const perCategory = new Map<string, number[]>();
  const all: number[] = [];
  const allLog: number[] = [];
  const tradedPoints: { logTvl: number; logRatio: number }[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.gecko_id === null) continue;
    if (p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / p.tvl_usd;
    all.push(r);
    allLog.push(Math.log(r));
    tradedPoints.push({ logTvl: Math.log(p.tvl_usd), logRatio: Math.log(r) });
    const key = p.category ?? 'Unknown';
    const list = perCategory.get(key) ?? [];
    list.push(Math.log(r));
    perCategory.set(key, list);
  }
  all.sort((a, b) => a - b);
  allLog.sort((a, b) => a - b);
  const globalRatio = median(all);
  const globalLog = median(allLog);
  const global: CategoryRatio = { ratio: round4(globalRatio), comparables: all.length, fallback: false, tier: 'category', shrink_weight: null, category_median: round4(globalRatio), size_median_log_tvl: null };
  const sizeLine = fitSizeLine(tradedPoints);
  const allLogTvls = snapshot.protocols.filter((p) => p.tvl_usd > 0).map((p) => Math.log(p.tvl_usd)).sort((a, b) => a - b);
  const globalLogTvl = median(allLogTvls);
  const byCatProtocols = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? 'Unknown';
    const list = byCatProtocols.get(key) ?? [];
    list.push(p);
    byCatProtocols.set(key, list);
  }
  const by_category: Record<string, CategoryRatio> = {};
  for (const [key, list] of perCategory) {
    list.sort((a, b) => a - b);
    const n = list.length;
    const med = median(list);
    const w = n / (n + model.shrinkage_names);
    const shrunk = w * med + (1 - w) * globalLog;
    by_category[key] = { ratio: round4(Math.exp(shrunk)), comparables: n, fallback: false, tier: 'category', shrink_weight: round4(w), category_median: round4(Math.exp(med)), size_median_log_tvl: null };
  }
  for (const [key, ps] of byCatProtocols) {
    if (by_category[key] !== undefined) continue;
    const tvls = ps.filter((p) => p.tvl_usd > 0).map((p) => Math.log(p.tvl_usd)).sort((a, b) => a - b);
    const medLogTvl = tvls.length > 0 ? median(tvls) : globalLogTvl;
    const ratio = Math.exp(sizeLine.intercept + sizeLine.slope * medLogTvl);
    by_category[key] = { ratio: round4(ratio), comparables: 0, fallback: true, tier: 'size', shrink_weight: null, category_median: null, size_median_log_tvl: round4(medLogTvl) };
  }
  const comparable_names: Record<string, ComparableName[]> = {};
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.gecko_id === null) continue;
    if (p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const key = p.category ?? 'Unknown';
    const list = comparable_names[key] ?? [];
    list.push({ name: p.name, ratio: round4(p.mcap_usd / p.tvl_usd), tvl_usd: p.tvl_usd });
    comparable_names[key] = list;
  }
  for (const key of Object.keys(comparable_names)) {
    comparable_names[key]!.sort((a, b) => b.tvl_usd - a.tvl_usd);
    comparable_names[key] = comparable_names[key]!.slice(0, 5);
  }
  return { by_category, global, size_line: sizeLine, comparable_names };
}

/** The ratio one protocol's category reads, with its tier marked. */
export function ratioFor(p: SnapshotProtocol, comparables: Comparables): CategoryRatio {
  const key = p.category ?? 'Unknown';
  const own = comparables.by_category[key];
  if (own !== undefined) return own;
  return { ...comparables.global, fallback: true };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comparables: Comparables,
  model: ModelConstants = MODEL,
): { implied: number; ratio: CategoryRatio; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; age: number | null } {
  const ratio = ratioFor(protocol, comparables);
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = Math.max(0, protocol.chains.length - 1);
  const chainMult = 1 + model.chain_step * Math.min(chainCount, model.chain_cap);
  const base = protocol.tvl_usd * ratio.ratio;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult));
  return { implied, ratio, growthPct, growthMult, maturityMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;
/** The categories the house's watchlist rule keeps out: bridged, staked and exchange products. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** An exchange's name at the start of the protocol's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not a bridged,
 * staked or exchange product of a token that already trades, and not a
 * versioned pool. The same rule the house's watchlist applies, extended to
 * every row below the floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comparables = categoryRatios(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot
  // no longer carries (it cannot, but the board's coverage is the gate's
  // row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the floor, not
  // just the biggest by TVL. A chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) continue;
    if (!isRankable(p)) continue;
    chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comparables, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_ratio: s.ratio.ratio,
      ratio_comparables: s.ratio.comparables,
      ratio_fallback: s.ratio.fallback,
      ratio_tier: s.ratio.tier,
      ratio_shrink_weight: s.ratio.shrink_weight,
      ratio_category_median: s.ratio.category_median,
      size_median_log_tvl: s.ratio.size_median_log_tvl,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What a transaction costs on a chain: L2s and Solana are cents, Ethereum is dollars. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $8 of gas';
  if (c === 'solana') return 'about $0.05 of fees';
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'avalanche' || c === 'bsc' || c === 'linea' || c === 'scroll' || c === 'zksync era' || c === 'blast') return 'about $0.50 of gas';
  return 'about $2 of gas';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's first action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and borrow $20 against it, then repay the borrow.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a narrow range and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares for the full term.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('launchpad')) return `Commit $${capital} to ${name}'s next launch on ${chain} and complete its tasks.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second, different action: a second qualifying touchpoint. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Swap $${Math.max(10, Math.floor(capital / 5))} through ${name}'s own market on ${chain} so the wallet shows two action types.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${Math.max(10, Math.floor(capital / 5))} through ${name} on ${chain} and leave the receipt in the wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open a fresh one half its size, so the wallet shows repeated use.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Move $${Math.max(10, Math.floor(capital / 5))} between two ${name} vaults on ${chain} and keep the shares.`;
  if (c.includes('rwa')) return `Redeem a small part of the position on ${name} and re-mint it, so the wallet shows repeated use.`;
  return `Vote once in ${name}'s governance or community poll on ${chain}, if one is open, and keep the receipt.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a
 * time. The plan is derived from the protocol's own record (category,
 * chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about $${Math.max(10, Math.floor(capital / 5))} moved and ${gas}`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan travelling with it. */
export function radarRow(row: BoardRow, watchlist: Set<string>, tvlPercentile: number | null): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    watchlist: watchlist.has(row.slug),
    implied_value_usd: row.implied_value_usd,
    category_ratio: row.model.category_ratio,
    ratio_comparables: row.model.ratio_comparables,
    ratio_fallback: row.model.ratio_fallback,
    ratio_tier: row.model.ratio_tier,
    ratio_shrink_weight: row.model.ratio_shrink_weight,
    ratio_category_median: row.model.ratio_category_median,
    size_median_log_tvl: row.model.size_median_log_tvl,
    tvl_percentile_in_category: tvlPercentile,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const comparables = categoryRatios(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  // A row's TVL percentile inside its own category, over every protocol the
  // snapshot carries in it: where this protocol sits among its own kind.
  const catTvls = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? 'Unknown';
    const list = catTvls.get(key) ?? [];
    list.push(p.tvl_usd);
    catTvls.set(key, list);
  }
  for (const list of catTvls.values()) list.sort((a, b) => a - b);
  const percentileOf = (row: BoardRow): number | null => {
    const list = catTvls.get(row.category ?? 'Unknown');
    if (list === undefined || list.length === 0) return null;
    let atOrBelow = 0;
    for (const t of list) if (t <= row.tvl_usd) atOrBelow++;
    return Math.round((atOrBelow / list.length) * 100);
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    comparables,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, new Set(snapshot.watchlist), percentileOf(r))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
