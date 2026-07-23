#!/usr/bin/env python3
"""Fetch news from multiple RSS feeds, extract trending topics.
Output: public/data/news.json (for GitHub Pages) with field names matching the React app.
"""

import xml.etree.ElementTree as ET
import json
import os
import re
import sys
import urllib.request
import urllib.error
from collections import Counter
from datetime import datetime, timezone
import hashlib
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed


# Disable SSL verification for RSS feeds (some have cert issues)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

RSS_FEEDS = [
    # International
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("BBC Top", "https://feeds.bbci.co.uk/news/rss.xml"),
    ("Guardian World", "https://www.theguardian.com/world/rss"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Politico EU", "https://www.politico.eu/feed/"),
    ("CNN Top", "http://rss.cnn.com/rss/edition.rss"),
    ("CNN World", "http://rss.cnn.com/rss/edition_world.rss"),
    ("NY Times World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
    ("France24", "https://www.france24.com/en/rss"),
    ("DW", "https://rss.dw.com/xml/rss-en-world"),
    # Finnish media
    ("Yle Suosituimmat", "https://feeds.yle.fi/uutiset/v1/mostRead/YLE_UUTISET.rss"),
    ("Yle Uutiset", "https://yle.fi/rss/uutiset/tuoreimmat"),
    ("Yle Ulkomaat", "https://yle.fi/rss/t/18-34953/fi"),
    ("IS Tuoreimmat", "https://www.is.fi/rss/tuoreimmat.xml"),
    ("IS Ulkomaat", "https://www.is.fi/rss/ulkomaat.xml"),
    ("IL Uutiset", "https://www.iltalehti.fi/rss/uutiset.xml"),
    ("HS Tuoreimmat", "https://www.hs.fi/rss/tuoreimmat.xml"),
    ("HS Ulkomaat", "https://www.hs.fi/rss/maailma.xml"),
]

# English + Finnish stop words for filtering
STOP_WORDS = set("""
a about above after again against all am an and any are aren't as at be because been before being
below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down
during each few for from further get got had hadn't has hasn't have haven't having he he'd he'll
he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is
isn't it it's its itself just let's me more most mustn't my myself no nor not of off on once only
or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't
so some such than that that's the their theirs them themselves then there there's these they they'd
they'll they're they've this those through to too under until up very was wasn't we we'd we'll
we're we've were weren't what what's when when's where where's which while who who's whom why why's
with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
new says said also may will one two first last still even many much now get since would could
make like made back going us use used way well news video live just says told year years old
people time day days week today world report reports according updated published top latest
watch read show shows watch home story stories editorial opinion analysis comment comments
share subscribe sign follow join free click photo photos image images video videos
say says said tell told ask asked think know called monday tuesday wednesday thursday friday
saturday sunday january february march april may june july august september october november
december inside outside whether three four five six seven eight nine ten officials official
government state country former president minister need help set take taken away taken long
look looking keep move right left part full something every another high already last next
alla asian asti edessä ei eikä eivätkä eli enemmän ennen erityisesti että hän hänen itse
jälkeen joka jokin joku jolla jossa josta joten joukossa juuri kaksi kanssa kautta kertoo
kesken koska kun kunnes kuten kyllä lähes liian lisäksi maanantai maan mennessä miksi mikä
missä mitä mitään mukaan mutta myös niin niistä noin nyt olla ollut olemassa olla ollut
oman osalta ovat paitsi paljon pelkästään pitää poikki päälle saakka sekä seuraa siellä
sillä siten suomen suomessa tämä tämän tässä tällä tänään taas takana takia toinen toista
tuli tulee tällä uusi uutiset vaikkapa vain vielä viime vuoden vuonna vuotta yhä yksi yli
uutinen juttu kertoo lähde julkaistu päivitetty tilaajille katso lue artikkeli lukijat
oli ole ovat olla ollut olisi olisivat olleet ole olet olen olemme olette
ker kertoo kertoi kertoivat sanoo sanoi sanoivat väittää arvioi toteaa totesi
mukaan mutta myös joka jokin joku koska miten milloin millainen millaista
despite amid across after before since until between among through without
maanantaina tiistaina keskiviikkona torstaina perjantaina lauantaina sunnuntaina
tammikuu helmikuu maaliskuu huhtikuu toukokuu kesäkuu heinäkuu elokuu syyskuu lokakuu
marraskuu joulukuu kommentoi jaa tallenna tilaa ilmoitus kirjaudu etusivu video kuvat
voi voisi voivat voitiin voit voitte kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän
kymmenen sata tuhat miljoona euro euroa dollaria prosenttia asian authorities arrested
court chinese russian american european update breaking alert latest headline exclusive
sen siitä siihen sitä siinä näin näitä nämä niitä niiden noita silloin tuolla täällä
tuolla sieltä sinne minne miten miksi milloin paljon enemmän vähemmän lisää useita
monia muita muiden muuten muualla muualle ainoa ainoastaan aivan aina usein harvoin
koskaan ehkä kenties ilmeisesti luultavasti todennäköisesti selvästi lähinnä suunnilleen
""".split())


DATE_FORMATS = [
    "%a, %d %b %Y %H:%M:%S %z",      # RFC 2822: Tue, 22 Jul 2026 09:30:00 +0000
    "%a, %d %b %Y %H:%M:%S %Z",      # RFC 2822 with zone name: ... GMT
    "%Y-%m-%dT%H:%M:%S%z",            # ISO 8601: 2026-07-22T09:30:00+00:00
    "%Y-%m-%dT%H:%M:%SZ",             # ISO 8601 UTC: 2026-07-22T09:30:00Z
    "%Y-%m-%dT%H:%M:%S.%f%z",         # ISO with microseconds
    "%Y-%m-%d %H:%M:%S",              # Simple datetime
    "%d %b %Y %H:%M:%S %z",           # 22 Jul 2026 09:30:00 +0000
]


def parse_pub_date(raw: str) -> str:
    """Parse various date formats to ISO 8601 string."""
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    # Fallback: try Python's email.utils for RFC 2822
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(raw)
        return dt.isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def fetch_feed(name: str, url: str) -> list[dict]:
    """Fetch and parse a single RSS feed."""
    articles = []
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
        })
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            data = resp.read()

        root = ET.fromstring(data)

        # Handle both RSS and Atom feeds
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        items = root.findall('.//item') or root.findall('.//atom:entry', ns)

        for idx, item in enumerate(items[:30]):  # Limit per feed; idx=0 is lead story
            title = ''
            desc = ''
            link = ''
            pub_date = ''

            # RSS format
            t = item.find('title')
            if t is not None and t.text:
                title = t.text.strip()

            d = item.find('description')
            if d is not None and d.text:
                desc = d.text.strip()
                desc = re.sub(r'<[^>]+>', '', desc).strip()

            l = item.find('link')
            if l is not None and l.text:
                link = l.text.strip()
            elif l is not None and l.get('href'):
                link = l.get('href', '').strip()

            # Atom format fallback
            if not title:
                t = item.find('atom:title', ns)
                if t is not None and t.text:
                    title = t.text.strip()

            if not link:
                l = item.find('atom:link', ns)
                if l is not None:
                    link = l.get('href', '').strip()

            # Find publication date — check each candidate explicitly
            # (Element truth value is unreliable; use 'is not None' + .text check)
            pub_date_raw = ''
            for tag in ['pubDate', 'published', 'updated', 'dc:date']:
                el = item.find(tag)
                if el is not None and el.text:
                    pub_date_raw = el.text.strip()
                    break
            if not pub_date_raw:
                for atag in ['atom:published', 'atom:updated']:
                    el = item.find(atag, ns)
                    if el is not None and el.text:
                        pub_date_raw = el.text.strip()
                        break
            pub_date = parse_pub_date(pub_date_raw) if pub_date_raw else datetime.now(timezone.utc).isoformat()

            if title:
                article_id = hashlib.md5((title + link).encode()).hexdigest()[:12]
                # Determine region based on source
                fi_prefixes = ("Yle", "HS", "IS", "IL", "STT", "Kauppalehti")
                region = "fi" if name.startswith(fi_prefixes) else "intl"
                articles.append({
                    'id': article_id,
                    'source': name,
                    'title': title,
                    'description': desc[:300] if desc else '',
                    'link': link,
                    'published': pub_date,  # React app expects 'published'
                    'region': region,
                    'feed_position': idx,  # 0 = feed's lead story
                })
    except Exception as e:
        print(f"Error fetching {name}: {e}", file=sys.stderr)

    return articles


def extract_keywords(text: str) -> list[str]:
    """Extract significant words from text."""
    text = text.lower()
    text = re.sub(r'[^a-zäöåüàáâãèéêìíîòóôùúûñß\s\'-]', ' ', text)
    words = text.split()
    return [w for w in words if len(w) > 2 and w not in STOP_WORDS and not w.isdigit()]


def extract_bigrams(words: list[str]) -> list[str]:
    """Extract meaningful bigrams (two-word phrases)."""
    bigrams = []
    for i in range(len(words) - 1):
        if words[i] not in STOP_WORDS and words[i+1] not in STOP_WORDS:
            bigrams.append(f"{words[i]} {words[i+1]}")
    return bigrams


def detect_topics(articles: list[dict]) -> list[dict]:
    """Detect trending topics from article keywords."""
    keyword_counter = Counter()
    bigram_counter = Counter()
    keyword_articles: dict[str, set] = {}
    bigram_articles: dict[str, set] = {}
    keyword_sources: dict[str, set] = {}
    bigram_sources: dict[str, set] = {}

    for article in articles:
        text = f"{article['title']} {article['description']}"
        words = extract_keywords(text)
        bigrams = extract_bigrams(words)

        unique_words = set(words)
        unique_bigrams = set(bigrams)

        for w in unique_words:
            keyword_counter[w] += 1
            keyword_articles.setdefault(w, set()).add(article['id'])
            keyword_sources.setdefault(w, set()).add(article['source'])

        for b in unique_bigrams:
            bigram_counter[b] += 1
            bigram_articles.setdefault(b, set()).add(article['id'])
            bigram_sources.setdefault(b, set()).add(article['source'])

    topics = []

    # Top bigrams (more meaningful as topics)
    for phrase, count in bigram_counter.most_common(30):
        sources = bigram_sources.get(phrase, set())
        if count >= 3 and len(sources) >= 2:
            topics.append({
                'topic': phrase.title(),
                'count': count,
                'sources': sorted(sources),
            })

    # Top single keywords
    for word, count in keyword_counter.most_common(50):
        sources = keyword_sources.get(word, set())
        if count >= 4 and len(sources) >= 2:
            covered = any(word in t['topic'].lower() for t in topics)
            if not covered:
                topics.append({
                    'topic': word.title(),
                    'count': count,
                    'sources': sorted(sources),
                })

    # Deduplicate topics by name
    seen_names: set[str] = set()
    deduped: list[dict] = []
    topics.sort(key=lambda t: (len(t['sources']) * 2 + t['count']), reverse=True)
    for t in topics:
        name_lower = t['topic'].lower()
        if name_lower not in seen_names:
            seen_names.add(name_lower)
            deduped.append(t)
    return deduped[:25]


def main():
    all_articles = []
    feed_status = []

    # Fetch all feeds in parallel (max 8 threads)
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_feed, name, url): name
            for name, url in RSS_FEEDS
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                articles = future.result(timeout=15)
            except Exception:
                articles = []
            all_articles.extend(articles)
            feed_status.append({
                'source': name,
                'status': 'ok' if len(articles) > 0 else 'error',
                'count': len(articles),
            })

    # Deduplicate by similar titles
    seen_titles = {}
    unique_articles = []
    for a in all_articles:
        normalized = re.sub(r'[^a-z0-9]', '', a['title'].lower())[:60]
        if normalized not in seen_titles:
            seen_titles[normalized] = True
            unique_articles.append(a)

    topics = detect_topics(unique_articles)

    # Sort all articles by published time, newest first
    # This ensures pickTopStories in React gets the freshest article per source
    unique_articles.sort(key=lambda a: a['published'], reverse=True)

    # Output uses field names matching the React app's TypeScript interfaces
    result = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'articles': unique_articles[:150],
        'trending_topics': topics,
        'feed_status': feed_status,
    }

    # Write to public/data/news.json (relative to repo root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    output_dir = os.path.join(repo_root, 'public', 'data')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'news.json')

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"OK — {len(unique_articles[:150])} articles, {len(topics)} topics → {output_path}")


if __name__ == '__main__':
    main()
