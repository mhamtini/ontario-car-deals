# Setup Guide — Making the Dealer Data Live

## Step 1 — Install Node.js (one time)

1. Go to https://nodejs.org
2. Download **LTS version** (the green button)
3. Run the installer — default options are fine
4. Open a new PowerShell window and verify:
   ```
   node --version
   npm --version
   ```

---

## Step 2 — Get a Free Google Places API Key

1. Go to https://console.cloud.google.com
2. Sign in with a Google account → **Create a new project** (e.g. "Ontario Dealer Finder")
3. In the left menu → **APIs & Services → Library**
4. Search for **Places API (New)** → click Enable
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. Copy the key (looks like `AIzaSyXXXXXXXXX...`)

> 💡 Google gives you $200 free credit/month.
> Fetching all 10 makes × 10 zones × 20 results = ~2,000 calls ≈ $3–5 USD → covered by free tier.

To protect your key:
- Click the key → **Restrict key**
- Under **API restrictions** → restrict to **Places API (New)** only

---

## Step 3 — Run the Fetcher

Open PowerShell in the `car search` folder:

```powershell
cd "c:\Users\m_ham\Documents\car search\fetcher"
npm install
node fetch-dealers.js YOUR_API_KEY_HERE
```

The script will:
- Search Google Places for all 10 makes across 10 Ontario regions
- Deduplicate results
- Sort by number of reviews (largest → smallest)
- **Overwrite `dealers.js`** with real data

Total runtime: ~2–3 minutes

---

## Step 4 — Refresh the Dealer Data (whenever you want)

Just re-run the same command with your API key. It always overwrites `dealers.js` with fresh data.

---

## What the script does NOT fetch automatically (and why)

| Field | Reason | How to add later |
|---|---|---|
| `hasZeroPercent` | Changes every month, requires scraping manufacturer offer pages | See ROADMAP.md |
| `islamicFriendly` | No public data source exists | Manual list or user submissions |

---

## ROADMAP — Adding Live Incentive Data

### Phase 2: Nightly Incentive Scraper

The manufacturer offer pages are:

| Make | URL to scrape |
|---|---|
| Ford | https://www.ford.ca/en/tools/offers |
| Toyota | https://www.toyota.ca/en/offers |
| Honda | https://www.honda.ca/offers |
| Chevrolet | https://www.chevrolet.ca/en/special-offers |
| Hyundai | https://www.hyundaicanada.com/en/offers |
| Kia | https://www.kia.com/ca/en/offers |

A scraper would:
1. Visit each URL with Puppeteer (headless Chrome)
2. Extract deals where APR = 0%
3. Store in a small database (Supabase free tier)
4. Your site reads from the database instead of `dealers.js`

### Phase 3: Full Backend (Next.js on Vercel)

- Move from static HTML to Next.js
- API routes handle dealer + incentive queries
- All data lives in Supabase (PostgreSQL)
- Deploy to Vercel (free tier handles ~100k visits/month)
- Add user login (to save favourite dealers)

---

## Folder structure (current)

```
car search/
├── index.html          ← the website (open in browser)
├── dealers.js          ← dealer data (overwritten by fetcher)
└── fetcher/
    ├── package.json
    ├── fetch-dealers.js ← run this to update dealer data
    └── SETUP.md         ← this file
```
