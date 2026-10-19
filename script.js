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
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 94, label: "S10 format ending GB", note: "Strong match for Royal Mail Tracked, Signed For, Special Delivery and international items." },
      { regex: /^(02|05)\d{11,19}$/, score: 78, label: "Domestic Tracked numeric", note: "Common for Tracked 24 / Tracked 48 labels." },
      { regex: /^[A-Z]{2}\d{9}[A-Z]{2}$/, score: 55, label: "Postal-style alphanumeric", note: "Resembles UPU S10; could also be Parcelforce." }
    ]
  },
  {
    id: "dpd",
    name: "DPD UK",
    short: "dpd",
    url: "https://www.dpd.co.uk/service/",
    rules: [
      { regex: /^\d{14}$/, score: 82, label: "14-digit numeric", note: "Standard DPD UK parcel number." },
      { regex: /^\d{10}$/, score: 68, label: "10-digit numeric", note: "Common for DPD Local / older references." },
      { regex: /^\d{14}[A-Z]$/, score: 70, label: "14-digit + letter", note: "Seen on some DPD labels." }
    ]
  },
  {
    id: "evri",
    name: "Evri",
    short: "evri",
    url: "https://www.evri.com/track-a-parcel",
    rules: [
      { regex: /^H[A-Z0-9]{15}$/, score: 94, label: "H-prefixed 16-character format", note: "Strong match for Evri. Most current numbers start with H + letters/digits." },
      { regex: /^H[A-Z0-9]{14,18}$/, score: 88, label: "H-prefixed alphanumeric", note: "Common Evri style with slight length variation." },
      { regex: /^\d{16}$/, score: 72, label: "16-digit numeric", note: "Common Evri length (other carriers also use it)." },
      { regex: /^[A-Z][A-Z0-9]{15}$/, score: 60, label: "16-character alphanumeric", note: "Matches many Evri retailer labels." }
    ]
  },
  {
    id: "yodel",
    name: "Yodel",
    short: "Y",
    url: "https://www.yodel.co.uk/track",
    rules: [
      { regex: /^J{1,2}D\d{14,16}$/, score: 90, label: "JD / JJD + digits", note: "Most common Yodel retailer format." },
      { regex: /^YOL\d{6,10}$/, score: 88, label: "YOL-prefixed", note: "Typical for Yodel Direct bookings." },
      { regex: /^[0-9][A-Z]{2,4}\d{8,12}$/, score: 55, label: "Mixed alphanumeric", note: "Seen on some business/marketplace shipments." },
      { regex: /^[A-Z0-9]{8,20}$/, score: 22, label: "General alphanumeric", note: "Weak clue only – Yodel formats vary widely." }
    ]
  },
  {
    id: "dhl",
    name: "DHL",
    short: "DHL",
    url: "https://www.dhl.com/gb-en/home/tracking.html",
    rules: [
      { regex: /^\d{10}$/, score: 80, label: "10-digit numeric", note: "Classic DHL Express waybill." },
      { regex: /^\d{14}$/, score: 72, label: "14-digit numeric", note: "Common for DHL Parcel UK / eCommerce UK." },
      { regex: /^JJD\d{10,20}$/, score: 85, label: "JJD-prefixed", note: "Strong indicator of DHL return / eCommerce piece number." },
      { regex: /^JD\d{16,18}$/, score: 78, label: "JD-prefixed", note: "Often used by DHL eCommerce." },
      { regex: /^[A-Z]{3}\d{7,}$/, score: 40, label: "Letter prefix + digits", note: "Some DHL services use this; not unique." }
    ]
  },
  {
    id: "ups",
    name: "UPS",
    short: "UPS",
    url: "https://www.ups.com/track",
    rules: [
      { regex: /^1Z[A-Z0-9]{16}$/, score: 98, label: "UPS 1Z format", note: "Very strong match for standard UPS tracking numbers." },
      { regex: /^\d{9}$/, score: 30, label: "9-digit numeric", note: "Listed by UPS but heavily overlapped." },
      { regex: /^\d{12}$/, score: 32, label: "12-digit numeric", note: "Possible but not distinctive." }
    ]
  },
  {
    id: "fedex",
    name: "FedEx",
    short: "FedEx",
    url: "https://www.fedex.com/en-gb/tracking.html",
    rules: [
      { regex: /^\d{12}$/, score: 62, label: "12-digit numeric", note: "Common for FedEx Express / many Ground." },
      { regex: /^\d{15}$/, score: 68, label: "15-digit numeric", note: "Typical for FedEx Ground / Home Delivery." },
      { regex: /^\d{20}$/, score: 70, label: "20-digit numeric", note: "Often FedEx Ground Economy (SmartPost)." },
      { regex: /^\d{22}$/, score: 65, label: "22-digit numeric", note: "Some barcode / freight labels." }
    ]
  },
  {
    id: "parcelforce",
    name: "Parcelforce Worldwide",
    short: "PF",
    url: "https://www.parcelforce.com/track-trace",
    rules: [
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 58, label: "S10 format ending GB", note: "Shared with Royal Mail – track on either site." },
      { regex: /^(PB|PF|PZ|EZ|EE|EK|CU|LA|XH)\d{8,12}$/, score: 75, label: "Parcelforce-style prefix", note: "Matches several common Parcelforce patterns." },
      { regex: /^\d{9}$/, score: 35, label: "9-digit numeric", note: "Possible short reference but not distinctive." }
    ]
  },
  {
    id: "inpost",
    name: "InPost UK",
    short: "InPost",
    url: "https://inpost.co.uk/track",
    rules: [
      { regex: /^J{1,2}D\d{14,16}$/, score: 45, label: "JD / JJD format (shared with Yodel)", note: "Many former Yodel numbers now track on InPost." },
      { regex: /^[A-Z0-9]{10,20}$/, score: 28, label: "General alphanumeric", note: "Weak clue only." }
    ]
  },
  {
    id: "amazon",
    name: "Amazon Logistics",
    short: "a",
    url: "https://track.amazon.co.uk/",
    rules: [
      { regex: /^TBA\d{9,12}$/, score: 97, label: "Amazon TBA format", note: "Very strong match for Amazon Logistics IDs." },
      { regex: /^TB[A-Z0-9]{10,}$/, score: 72, label: "TB-prefixed format", note: "Likely Amazon-related." }
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
