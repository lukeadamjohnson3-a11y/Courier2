/*
 * Courier Finder
 * This is a heuristic matcher, not a carrier verification service.
 * Patterns are approximate and may overlap. Update them only after checking
 * each carrier's current official guidance.
 */
"use strict";

const CARRIERS = [
  {
    id: "royal-mail",
    name: "Royal Mail",
    short: "RM",
    url: "https://www.royalmail.com/track-your-item",
    rules: [
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 96, label: "International postal format (XX + 9 digits + GB)", note: "Strong format match; this pattern is commonly used for UK-origin international postal items." },
      { regex: /^[A-Z]{2}\d{9}[A-Z]{2}$/, score: 78, label: "International postal-style format", note: "This resembles a UPU-style postal tracking code, which is not unique to Royal Mail." },
      { regex: /^\d{16}$/, score: 48, label: "16-digit numeric format", note: "Some Royal Mail services use numeric references, but this format is not unique." }
    ]
  },
  {
    id: "dpd",
    name: "DPD UK",
    short: "dpd",
    url: "https://www.dpd.co.uk/service/",
    rules: [
      { regex: /^\d{14}$/, score: 67, label: "14-digit numeric format", note: "A plausible DPD-style number, but numeric formats overlap with other carriers." },
      { regex: /^[A-Z]{2}\d{9}$/, score: 34, label: "Postal-style alphanumeric format", note: "This is not specific enough to identify DPD reliably." }
    ]
  },
  {
    id: "evri",
    name: "Evri",
    short: "evri",
    url: "https://www.evri.com/track-a-parcel",
    rules: [
      { regex: /^\d{16}$/, score: 64, label: "16-digit numeric format", note: "A plausible Evri-style format, but other services may use 16 digits too." },
      { regex: /^H\d{15,19}$/, score: 72, label: "H-prefixed numeric format", note: "This prefix and length can be associated with Evri references, but is not guaranteed." }
    ]
  },
  {
    id: "yodel",
    name: "Yodel",
    short: "Y",
    url: "https://www.yodel.co.uk/track",
    rules: [
      { regex: /^[A-Z0-9]{8,20}$/, score: 25, label: "General alphanumeric format", note: "Yodel references vary; this broad pattern alone is a weak clue." }
    ]
  },
  {
    id: "dhl",
    name: "DHL",
    short: "DHL",
    url: "https://www.dhl.com/gb-en/home/tracking.html",
    rules: [
      { regex: /^\d{10}$/, score: 68, label: "10-digit numeric format", note: "Often associated with DHL Express, but not unique to DHL." },
      { regex: /^[A-Z]{3}\d{7,}$/ , score: 44, label: "Letter prefix followed by digits", note: "Some DHL services use alphanumeric references; this is a broad match." },
      { regex: /^[A-Z]{2}\d{9}[A-Z]{2}$/, score: 38, label: "Postal-style format", note: "Some DHL eCommerce shipments use postal-style identifiers; other postal carriers do too." }
    ]
  },
  {
    id: "ups",
    name: "UPS",
    short: "UPS",
    url: "https://www.ups.com/track",
    rules: [
      { regex: /^1Z[A-Z0-9]{16}$/, score: 98, label: "UPS 1Z format", note: "Strong format match for a common UPS tracking number." },
      { regex: /^\d{9,12}$/, score: 28, label: "Numeric format", note: "Numeric references overlap heavily across carriers." }
    ]
  },
  {
    id: "fedex",
    name: "FedEx",
    short: "FedEx",
    url: "https://www.fedex.com/en-gb/tracking.html",
    rules: [
      { regex: /^\d{12}$/, score: 54, label: "12-digit numeric format", note: "A possible FedEx format, but it is not unique." },
      { regex: /^\d{15}$/, score: 60, label: "15-digit numeric format", note: "A possible FedEx format; other services can use numeric references too." },
      { regex: /^\d{20,22}$/, score: 56, label: "20–22 digit numeric format", note: "A possible FedEx format, but length alone cannot verify the carrier." }
    ]
  },
  {
    id: "parcelforce",
    name: "Parcelforce Worldwide",
    short: "PF",
    url: "https://www.parcelforce.com/track-trace",
    rules: [
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 42, label: "Postal-style international format", note: "Parcelforce and other postal services can use similar formats." },
      { regex: /^\d{9}$/, score: 38, label: "9-digit numeric format", note: "A short numeric reference is not unique enough to be reliable." }
    ]
  },
  {
    id: "inpost",
    name: "InPost UK",
    short: "InPost",
    url: "https://inpost.co.uk/track",
    rules: [
      { regex: /^[A-Z0-9]{10,20}$/, score: 24, label: "General alphanumeric format", note: "InPost references vary; this broad match is a weak clue." }
    ]
  },
  {
    id: "amazon",
    name: "Amazon Logistics",
    short: "a",
    url: "https://track.amazon.co.uk/",
    rules: [
      { regex: /^TBA\d{9,12}$/, score: 97, label: "Amazon TBA format", note: "Strong format match for an Amazon Logistics tracking ID." },
      { regex: /^TB[A-Z0-9]{10,}$/, score: 70, label: "TB-prefixed format", note: "Likely Amazon-related, but check the tracking details to confirm." }
    ]
  }
];

const form = document.querySelector("#finder-form");
const input = document.querySelector("#tracking-number");
const error = document.querySelector("#input-error");
const results = document.querySelector("#results");

function normaliseTrackingNumber(value) {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

function getConfidence(score) {
  if (score >= 85) return { label: `High confidence (${score}%)`, className: "high" };
  if (score >= 55) return { label: `Medium confidence (${score}%)`, className: "medium" };
  return { label: `Low confidence (${score}%)`, className: "low" };
}

function findMatches(trackingNumber) {
  const matches = [];

  for (const carrier of CARRIERS) {
    for (const rule of carrier.rules) {
      if (rule.regex.test(trackingNumber)) {
        matches.push({
          carrier,
          score: rule.score,
          format: rule.label,
          note: rule.note
        });
      }
    }
  }

  // Keep only the strongest matching rule for each carrier.
  const bestByCarrier = new Map();
  for (const match of matches) {
    const current = bestByCarrier.get(match.carrier.id);
    if (!current || match.score > current.score) bestByCarrier.set(match.carrier.id, match);
  }

  return [...bestByCarrier.values()].sort((a, b) => b.score - a.score);
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function carrierLogo(carrier) {
  return `<span class="result-logo" aria-hidden="true">${safeText(carrier.short)}</span>`;
}

function renderMatch(match, index, isAmbiguous) {
  const confidence = getConfidence(match.score);
  const trackingUrl = `${match.carrier.url}`;
  const safeUrl = safeText(trackingUrl);
  return `
    <article class="result-card ${index === 0 ? "best" : ""}">
      <div class="result-top">
        ${carrierLogo(match.carrier)}
        <div class="result-main">
          <strong>${safeText(match.carrier.name)}</strong>
          <p>${safeText(match.format)}</p>
        </div>
        <span class="confidence ${confidence.className}">${confidence.label}</span>
      </div>
      <p class="result-footnote">${safeText(match.note)}</p>
      <div class="result-actions">
        <a class="link-button" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Track on ${safeText(match.carrier.name)} <span aria-hidden="true">↗</span></a>
      </div>
    </article>`;
}

function renderResults(trackingNumber, matches) {
  results.hidden = false;

  if (matches.length === 0) {
    const multiCarrierUrl = `https://www.17track.net/en#nums=${encodeURIComponent(trackingNumber)}`;
    results.innerHTML = `
      <div class="no-match">
        <h3>We couldn't identify this number confidently</h3>
        <p>It may belong to a carrier not covered here, use a different format, or be an order number rather than a tracking number. Check the dispatch message for the courier name.</p>
        <a class="multi-link" href="${multiCarrierUrl}" target="_blank" rel="noopener noreferrer">Try a multi-carrier lookup ↗</a>
      </div>`;
    return;
  }

  const best = matches[0];
  const closeSecond = matches[1] && (best.score - matches[1].score <= 12);
  const broadMatch = best.score < 55;
  const ambiguous = closeSecond || broadMatch;

  let heading = "Most likely courier";
  let subheading = `Best format match for ${trackingNumber}.`;
  if (closeSecond) {
    heading = "More than one possible courier";
    subheading = "These formats overlap, so we can't choose a reliable winner from the number alone.";
  } else if (broadMatch) {
    heading = "Possible match — low confidence";
    subheading = "This number fits a broad pattern, but that isn't enough to identify the carrier reliably.";
  }

  const multiCarrierUrl = `https://www.17track.net/en#nums=${encodeURIComponent(trackingNumber)}`;
  results.innerHTML = `
    <div class="result-heading">
      <div><h2>${heading}</h2><p>${subheading}</p></div>
    </div>
    ${matches.slice(0, 3).map((match, index) => renderMatch(match, index, ambiguous)).join("")}
    <p class="result-footnote">Confidence is a heuristic estimate based on the number's shape, not a measured probability. The courier's site may reject the number if it is incorrect or not yet active.</p>
    <a class="multi-link" href="${multiCarrierUrl}" target="_blank" rel="noopener noreferrer">Try a multi-carrier lookup ↗</a>`;
}

form.addEventListener("submit", event => {
  event.preventDefault();
  error.hidden = true;
  error.textContent = "";
  results.hidden = true;
  results.innerHTML = "";

  const raw = input.value.trim();
  if (!raw) {
    error.textContent = "Enter a tracking number to continue.";
    error.hidden = false;
    input.focus();
    return;
  }

  const trackingNumber = normaliseTrackingNumber(raw);
  if (trackingNumber.length < 6) {
    error.textContent = "That number looks too short. Check it and try again.";
    error.hidden = false;
    input.focus();
    return;
  }

  if (trackingNumber.length > 50 || !/^[A-Z0-9]+$/.test(trackingNumber)) {
    error.textContent = "Use only letters and numbers in the tracking number. Spaces and hyphens are okay.";
    error.hidden = false;
    input.focus();
    return;
  }

  renderResults(trackingNumber, findMatches(trackingNumber));
});

input.addEventListener("input", () => {
  if (!error.hidden) {
    error.hidden = true;
    error.textContent = "";
  }
});
