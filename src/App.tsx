import { useState, useEffect, useCallback } from 'react'

// ── Types ──
interface Article {
  title: string;
  source: string;
  published: string;
  link: string;
  is_top_story?: boolean;
  region?: string;
  feed_position?: number; // 0 = feed's lead story
}

interface Topic {
  topic: string;
  count: number;
  sources: string[];
}

interface FeedStatus {
  source: string;
  status: string;
  count: number;
}

interface NewsData {
  articles: Article[];
  trending_topics: Topic[];
  feed_status: FeedStatus[];
  generated_at: string;
}

// ── Source colors ──
const SRC_COLORS: Record<string, string> = {
  "STT": "#3b82f6",
  "Yle Uutiset": "#22c55e", "Yle Ulkomaat": "#22c55e",
  "HS Tuoreimmat": "#f59e0b", "HS Ulkomaat": "#f59e0b",
  "Kauppalehti": "#06b6d4",
  "BBC World": "#ef4444", "BBC Top": "#ef4444",
  "Politico EU": "#a855f7",
  "Al Jazeera": "#f97316",
  "Guardian World": "#22d3ee",
  "CNN Top": "#dc2626", "CNN World": "#dc2626",
  "NY Times World": "#9ca3af",
  "France24": "#facc15",
  "DW": "#60a5fa",
  "IS Tuoreimmat": "#fb923c", "IS Ulkomaat": "#fb923c",
  "IL Uutiset": "#f472b6",
  "SVT": "#ec4899",
};

function srcColor(source: string): string {
  return SRC_COLORS[source] || "#06b6d4";
}

function shortName(source: string): string {
  const map: Record<string, string> = {
    "Yle Uutiset": "YLE", "Yle Ulkomaat": "YLE", "Yle Suosituimmat": "YLE",
    "HS Tuoreimmat": "HS", "HS Ulkomaat": "HS",
    "BBC World": "BBC", "BBC Top": "BBC",
    "CNN Top": "CNN", "CNN World": "CNN",
    "Guardian World": "GUARDIAN",
    "NY Times World": "NYTIMES",
    "IS Tuoreimmat": "IS", "IS Ulkomaat": "IS",
    "IL Uutiset": "IL",
    "Al Jazeera": "ALJAZ",
    "Politico EU": "POLIT.",
    "France24": "FRANCE24",
    "DW": "DW",
    "Kauppalehti": "KL",
    "SVT": "SVT",
    "STT": "STT",
  };
  return map[source] || source.toUpperCase();
}

// ── Helpers ──
function getAgeMinutes(dateStr: string): number {
  try {
    if (!dateStr) return 9999;
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return 9999;
    return Math.max(0, Math.floor((Date.now() - ts) / 60000));
  } catch {
    return 9999;
  }
}

function timeDisplay(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function timeClass(dateStr: string): string {
  const age = getAgeMinutes(dateStr);
  if (age <= 15) return 'time-fresh';
  if (age <= 60) return 'time-recent';
  return 'time-old';
}

function isNew(dateStr: string): boolean {
  return getAgeMinutes(dateStr) <= 15;
}

const WORLD_CLOCKS = [
  { city: 'NEW YORK', tz: 'America/New_York' },
  { city: 'LONTOO',   tz: 'Europe/London' },
  { city: 'MOSKOVA',  tz: 'Europe/Moscow' },
  { city: 'TOKIO',    tz: 'Asia/Tokyo' },
  { city: 'SYDNEY',   tz: 'Australia/Sydney' },
];

function formatTz(d: Date, tz: string): string {
  return d.toLocaleTimeString('fi-FI', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function tzParts(d: Date, tz: string): { h: number; m: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  return { h: get('hour') % 12, m: get('minute'), s: get('second') };
}

function AnalogClock({ d, tz, city }: { d: Date; tz: string; city: string }) {
  const { h, m, s } = tzParts(d, tz);
  const hAngle = (h + m / 60) * 30;   // 360/12
  const mAngle = (m + s / 60) * 6;    // 360/60
  const sAngle = s * 6;
  const R = 44; // clock radius
  const CX = 50, CY = 50;

  const hand = (angle: number, len: number, w: number, color: string) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x2 = CX + len * Math.cos(rad);
    const y2 = CY + len * Math.sin(rad);
    return <line x1={CX} y1={CY} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };

  // hour markers
  const markers = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * Math.PI / 180;
    const r1 = R - (i % 3 === 0 ? 8 : 4);
    const r2 = R;
    return <line key={i} x1={CX + r1 * Math.cos(a)} y1={CY + r1 * Math.sin(a)}
                 x2={CX + r2 * Math.cos(a)} y2={CY + r2 * Math.sin(a)}
                 stroke="#8899aa" strokeWidth={i % 3 === 0 ? 2.5 : 1.2} />;
  });

  return (
    <div className="world-clock">
      <svg viewBox="0 0 100 100" className="wc-face">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#334466" strokeWidth="2" />
        {markers}
        {hand(hAngle, 24, 3.5, '#ffffff')}
        {hand(mAngle, 34, 2.5, '#ffffff')}
        {hand(sAngle, 38, 1, '#ef4444')}
        <circle cx={CX} cy={CY} r="2.5" fill="#ef4444" />
      </svg>
      <span className="wc-city">{city}</span>
      <span className="wc-digital">{formatTz(d, tz)}</span>
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Source classification ──
// Hard news sources for pääuutiset (no tabloids IS/IL)
const FI_HARD = ["Yle", "HS", "STT", "Kauppalehti"];
const INTL_HARD = ["BBC", "Al Jazeera", "Guardian", "CNN", "NY Times", "DW", "Politico"];
const ALL_FI = ["Yle", "HS", "IS", "IL", "STT", "Kauppalehti"];
const ALL_INTL = ["BBC", "Al Jazeera", "CNN", "Guardian", "NY Times", "Politico", "France24", "DW", "SVT"];

function isFi(source: string): boolean {
  return ALL_FI.some(p => source.startsWith(p));
}

function isIntl(source: string): boolean {
  return ALL_INTL.some(p => source.startsWith(p));
}

/** Pick 3 Finnish + 3 international top stories.
 *  Yle: suosituimmat-feedin ykkösjuttu (toimituksen/yleisön valinta).
 *  Muut: kunkin lähteen uusin artikkeli (feed_position 0). */
function pickTopStories(articles: Article[]): Article[] {
  const fi: Article[] = [];
  const intl: Article[] = [];
  const seen = new Set<string>();

  // 1. Yle: pick #1 from "Yle Suosituimmat" feed
  const ylePop = articles
    .filter(a => a.source === 'Yle Suosituimmat' && a.feed_position === 0);
  if (ylePop.length > 0) {
    fi.push(ylePop[0]);
    seen.add('Yle');
  }

  // 2. Other hard sources: pick feed_position 0 (= newest), sorted by freshness
  const leads = articles.filter(a => a.feed_position === 0);
  leads.sort((a, b) => {
    const ta = new Date(a.published).getTime() || 0;
    const tb = new Date(b.published).getTime() || 0;
    return tb - ta;
  });

  for (const a of leads) {
    if (fi.length < 3) {
      const fam = FI_HARD.find(p => a.source.startsWith(p));
      if (fam && !seen.has(fam)) { seen.add(fam); fi.push(a); }
    }
    if (intl.length < 3) {
      const fam = INTL_HARD.find(p => a.source.startsWith(p));
      if (fam && !seen.has(fam)) { seen.add(fam); intl.push(a); }
    }
    if (fi.length >= 3 && intl.length >= 3) break;
  }
  return [...fi, ...intl];
}

/** Pick latest articles not already in top stories: 8 FI + 7 INTL */
function pickLatest(articles: Article[], topStories: Article[], countFi = 8, countIntl = 7): Article[] {
  const MAX_PER_SOURCE = 2;
  const topTitles = new Set(topStories.map(a => a.title));
  const fi: Article[] = [];
  const intl: Article[] = [];
  const srcCount: Record<string, number> = {};
  for (const a of articles) {
    if (topTitles.has(a.title)) continue;
    const prefix = [...ALL_FI, ...ALL_INTL].find(p => a.source.startsWith(p)) ?? a.source;
    const c = srcCount[prefix] ?? 0;
    if (c >= MAX_PER_SOURCE) continue;
    if (isFi(a.source) && fi.length < countFi) { fi.push(a); srcCount[prefix] = c + 1; }
    else if (isIntl(a.source) && intl.length < countIntl) { intl.push(a); srcCount[prefix] = c + 1; }
    if (fi.length >= countFi && intl.length >= countIntl) break;
  }
  // Re-sort each group by time (newest first) after diversity pick
  const byTime = (a: Article, b: Article) =>
    new Date(b.published).getTime() - new Date(a.published).getTime();
  fi.sort(byTime);
  intl.sort(byTime);
  return [...fi, ...intl];
}

// ── App ──
export default function App() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchNews = useCallback(async () => {
    try {
      const resp = await fetch(`./data/news.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Datan haku epäonnistui');
      const parsed: NewsData = await resp.json();
      setData(parsed);
      setLastUpdate(formatTime(new Date()));
      setError(null);
    } catch (e: unknown) {
      console.error('Fetch error:', e);
      if (!data) setError('Uutisten haku epäonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchNews();
    const t = setInterval(fetchNews, 60 * 1000);
    return () => clearInterval(t);
  }, [fetchNews]);

  if (loading && !data) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div className="loading-text">Haetaan uutisia...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <div className="error-text">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Sort all articles by actual UTC time (handles mixed timezones)
  const articles = [...(data.articles || [])].sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );
  const trendingTopics = (data.trending_topics || []).slice(0, 6);
  const topStories = pickTopStories(articles);
  const latestNews = pickLatest(articles, topStories);

  return (
    <div className="app-root">
      {/* ─── HEADER ─── */}
      <header className="header">
        <div className="header-left">
          <div className="live-dot" />
          <span className="header-title">STT — UUTISKATSAUS</span>
        </div>
        <div className="header-right">
          <span className="header-clock">{formatTime(clock)}</span>
        </div>
      </header>

      {/* ─── WORLD CLOCKS ─── */}
      <div className="world-clocks">
        {WORLD_CLOCKS.map(({ city, tz }) => (
          <AnalogClock key={city} d={clock} tz={tz} city={city} />
        ))}
      </div>

      {/* ─── DATE BAR ─── */}
      <div className="date-bar">
        <span>{formatDate(clock)}</span>
        <span className="update-info">Päivitetty {lastUpdate || '—'}</span>
      </div>

      {/* ─── TOP STORIES — 4 big headlines ─── */}
      <section className="top-stories">
        <div className="section-label">PÄÄUUTISET</div>
        {topStories.map((h, i) => (
          <div key={i} className="headline-row top-row">
            <div className="hl-source-col">
              <span className="hl-dot" style={{ backgroundColor: srcColor(h.source) }} />
              <span className="hl-source" style={{ color: srcColor(h.source) }}>
                {shortName(h.source)}
              </span>
            </div>
            <div className="hl-title">{h.title}</div>
            <div className={`hl-time ${timeClass(h.published)}`}>
              {timeDisplay(h.published)}
              {isNew(h.published) && <span className="new-badge">UUSI</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ─── LATEST NEWS — 15 smaller headlines ─── */}
      <section className="latest-news">
        <div className="section-label">TUOREIMMAT</div>
        {latestNews.map((h, i) => (
          <div key={i} className="headline-row latest-row">
            <div className="hl-source-col">
              <span className="hl-dot dot-sm" style={{ backgroundColor: srcColor(h.source) }} />
              <span className="hl-source src-sm" style={{ color: srcColor(h.source) }}>
                {shortName(h.source)}
              </span>
            </div>
            <div className="hl-title title-sm">{h.title}</div>
            <div className={`hl-time time-sm ${timeClass(h.published)}`}>
              {timeDisplay(h.published)}
              {isNew(h.published) && <span className="new-badge">UUSI</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ─── TRENDS ─── */}
      <div className="trend-bar">
        {trendingTopics.map((t, i) => (
          <span key={i} className="trend-pill">
            {t.topic}
            <span className="trend-count">{t.count}</span>
          </span>
        ))}
      </div>


    </div>
  );
}
