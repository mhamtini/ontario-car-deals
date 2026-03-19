/**
 * Ontario Car Dealer Fetcher
 * Uses Google Places API (New) to fetch real dealer data.
 *
 * RUN:
 *   node fetch-dealers.js YOUR_GOOGLE_API_KEY
 *
 * OUTPUT:
 *   Writes ../dealers.js (replaces the hardcoded file used by index.html)
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error("\n❌  Missing API key.\n   Usage: node fetch-dealers.js YOUR_GOOGLE_API_KEY\n");
  process.exit(1);
}

// Ontario search centres (lat/lng) with radius in metres
const SEARCH_ZONES = [
  { label: "Toronto GTA",  lat: 43.7001, lng: -79.4163, radius: 50000 },
  { label: "Mississauga",  lat: 43.5890, lng: -79.6441, radius: 30000 },
  { label: "Brampton",     lat: 43.7315, lng: -79.7624, radius: 25000 },
  { label: "Hamilton",     lat: 43.2557, lng: -79.8711, radius: 30000 },
  { label: "London",       lat: 42.9849, lng: -81.2453, radius: 35000 },
  { label: "Windsor",      lat: 42.3149, lng: -83.0364, radius: 30000 },
  { label: "Barrie",       lat: 44.3894, lng: -79.6903, radius: 30000 },
  { label: "Kitchener",    lat: 43.4516, lng: -80.4925, radius: 25000 },
  { label: "Ottawa",       lat: 45.4215, lng: -75.6972, radius: 40000 },
  { label: "Oshawa",       lat: 43.8971, lng: -78.8658, radius: 25000 },
];

const MAKES = [
  { id: "ford",      label: "Ford",      color: "#003478" },
  { id: "toyota",    label: "Toyota",    color: "#eb0a1e" },
  { id: "honda",     label: "Honda",     color: "#cc0000" },
  { id: "chevrolet", label: "Chevrolet", color: "#c8a84b" },
  { id: "hyundai",   label: "Hyundai",   color: "#002c5f" },
  { id: "kia",       label: "Kia",       color: "#05141f" },
  { id: "nissan",    label: "Nissan",    color: "#c3002f" },
  { id: "subaru",    label: "Subaru",    color: "#1a3a6e" },
  { id: "jeep",      label: "Jeep",      color: "#2a6d1f" },
  { id: "ram",       label: "Ram",       color: "#1a1a1a" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function guessRegion(address = "") {
  const a = address.toLowerCase();
  if (a.includes("windsor") || a.includes("essex") || a.includes("leamington") || a.includes("tilbury") || a.includes("kingsville")) return "windsor";
  if (a.includes("london") || a.includes("st. thomas") || a.includes("strathroy") || a.includes("woodstock")) return "london";
  if (a.includes("barrie") || a.includes("orillia") || a.includes("midland") || a.includes("collingwood") || a.includes("owen sound") || a.includes("sudbury") || a.includes("north bay")) return "barrie";
  if (a.includes("mississauga") || a.includes("brampton") || a.includes("scarborough") || a.includes("etobicoke") || a.includes("toronto") || a.includes("markham") || a.includes("richmond hill") || a.includes("vaughan") || a.includes("oakville") || a.includes("burlington") || a.includes("ajax") || a.includes("oshawa") || a.includes("pickering") || a.includes("whitby")) return "toronto-gta";
  return "other";
}

function guessSize(userRatingCount = 0, rating = 0) {
  if (userRatingCount > 1000) return "large";
  if (userRatingCount > 300)  return "medium";
  return "small";
}

function cleanWebsite(url = "") {
  if (!url) return "";
  // remove tracking params and simplify
  try {
    const u = new URL(url);
    return u.origin + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

// ─── PLACES API CALL ─────────────────────────────────────────────────────────
async function searchDealers(make, zone) {
  const query = `${make.label} dealership ${zone.label} Ontario Canada`;

  try {
    const res = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: query,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: zone.lat, longitude: zone.lng },
            radius: zone.radius,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.websiteUri",
            "places.rating",
            "places.userRatingCount",
            "places.location",
            "places.regularOpeningHours",
          ].join(","),
        },
      }
    );

    return res.data.places ?? [];
  } catch (err) {
    const msg = err.response?.data?.error?.message ?? err.message;
    console.warn(`  ⚠ API error for [${make.label} / ${zone.label}]: ${msg}`);
    return [];
  }
}

// ─── FILTER: keep only actual dealerships for this make ───────────────────────
function isRelevantDealer(place, make) {
  const name = (place.displayName?.text ?? "").toLowerCase();
  const makeKeywords = {
    ford:      ["ford"],
    toyota:    ["toyota"],
    honda:     ["honda"],
    chevrolet: ["chevrolet", "chevy", "chev", "gmc", "buick", "cadillac"],
    hyundai:   ["hyundai"],
    kia:       ["kia"],
    nissan:    ["nissan", "infiniti"],
    subaru:    ["subaru"],
    jeep:      ["jeep", "chrysler", "dodge", "stellantis", "fiat"],
    ram:       ["ram", "chrysler", "dodge"],
  };

  const keys = makeKeywords[make.id] ?? [make.id];
  return keys.some(k => name.includes(k));
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍  Ontario Car Dealer Fetcher — Google Places API");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const seen    = new Set();    // deduplicate by place ID
  const dealers = [];
  let   idCounter = 1;

  for (const make of MAKES) {
    console.log(`\n🚗  Fetching ${make.label} dealers...`);

    for (const zone of SEARCH_ZONES) {
      process.stdout.write(`   📍 ${zone.label}... `);
      const places = await searchDealers(make, zone);

      let added = 0;
      for (const p of places) {
        if (!p.id || seen.has(p.id)) continue;
        if (!isRelevantDealer(p, make))  continue;

        seen.add(p.id);

        const address  = p.formattedAddress ?? "";
        const region   = guessRegion(address);
        const size     = guessSize(p.userRatingCount ?? 0, p.rating ?? 0);
        const name     = p.displayName?.text ?? "Unknown Dealer";
        const phone    = p.nationalPhoneNumber ?? "";
        const website  = cleanWebsite(p.websiteUri ?? "");
        const rating   = p.rating ? `Rated ${p.rating}★ (${p.userRatingCount?.toLocaleString() ?? 0} reviews)` : "";

        dealers.push({
          id:              idCounter++,
          make:            make.id,
          name,
          city:            address.split(",").slice(-3, -2)[0]?.trim() ?? "",
          address,
          region,
          size,
          website,
          phone,
          rating:          p.rating ?? 0,
          reviewCount:     p.userRatingCount ?? 0,
          hasZeroPercent:  false,   // ← requires live manufacturer incentive data
          islamicFriendly: false,   // ← requires manual / community verification
          notes:           rating,
          googlePlaceId:   p.id,
        });
        added++;
      }

      console.log(`${added} new dealers`);
      await sleep(200); // be polite to the API
    }
  }

  // ─── Sort: by make then by reviewCount desc ──────────────────────────────
  dealers.sort((a, b) => {
    if (a.make !== b.make) return MAKES.findIndex(m => m.id === a.make) - MAKES.findIndex(m => m.id === b.make);
    return b.reviewCount - a.reviewCount;
  });

  // ─── Write dealers.js ────────────────────────────────────────────────────
  const makesJs = `const MAKES = ${JSON.stringify(MAKES, null, 2)};\n`;

  const dealersJs = `const DEALERS = ${JSON.stringify(dealers, null, 2)};\n`;

  const header = `// ⚠  AUTO-GENERATED — DO NOT EDIT MANUALLY
// Generated on: ${new Date().toISOString()}
// Source: Google Places API (New) — Text Search
// Total dealers: ${dealers.length}
//
// hasZeroPercent  → requires live manufacturer incentive scraper (see ROADMAP.md)
// islamicFriendly → requires manual verification with Amanah Finance / Manzil
//
`;

  const output = header + makesJs + "\n" + dealersJs;

  const outPath = path.resolve(__dirname, "../dealers.js");
  fs.writeFileSync(outPath, output, "utf8");

  console.log(`\n✅  Done!`);
  console.log(`   Fetched : ${dealers.length} unique dealers across ${MAKES.length} makes`);
  console.log(`   Written : ${outPath}`);
  console.log(`\n⚠  Note: hasZeroPercent and islamicFriendly are set to false.`);
  console.log(`   See ROADMAP.md for how to add live incentive data.\n`);
}

main().catch(err => {
  console.error("\n❌  Fatal error:", err.message);
  process.exit(1);
});
