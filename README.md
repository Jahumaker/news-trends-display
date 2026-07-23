# Uutistrendi-monitori 📡

Reaaliaikainen uutistrendien seurantanäyttö STT-Lehtikuvalle. Suunniteltu 65" pystynäytölle (portrait).

## Asennus

```bash
npm install
```

## Kehitys

```bash
npm run dev
```

## Deploy GitHub Pagesiin

1. Pushaa tämä repo GitHubiin (esim. `news-trends-display`)
2. **Settings → Pages → Source: GitHub Actions**
3. Ensimmäinen push `main`-haaraan käynnistää deployn automaattisesti
4. Uutisdata päivittyy automaattisesti 5 min välein GitHub Actionsin kautta

## Käyttö näytöllä

1. Avaa `https://<käyttäjä>.github.io/news-trends-display/`
2. Paina **F11** → koko ruudun tila
3. Valmis! Data päivittyy automaattisesti.

## Rakenne

| Tiedosto | Kuvaus |
|---|---|
| `src/App.tsx` | React-sovellus |
| `src/styles.css` | Pystynäyttö-tyylit (tumma teema) |
| `scripts/fetch_news.py` | RSS-syötteiden haku (17 lähdettä) |
| `.github/workflows/update-news.yml` | Automaattinen datapäivitys (5 min) |
| `.github/workflows/deploy.yml` | GitHub Pages -julkaisu |

## Muokkaus

- **Repo-nimi:** Jos repon nimi on muu kuin `news-trends-display`, muuta `base`-asetus tiedostossa `vite.config.ts`
- **RSS-syötteet:** Lisää/poista syötteitä tiedostossa `scripts/fetch_news.py` → `RSS_FEEDS`
