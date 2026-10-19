/*/*
 * Courier Finder v2
 * Improved weighted scoring engine
 */

"use strict";

const CARRIERS = [
  {
    id: "royal-mail",
    name: "Royal Mail",
    short: "RM",
    url: "https://www.royalmail.com/track-your-item",
    rules: [
      {
        regex: /^[A-Z]{2}\d{9}GB$/i,
        score: 96,
        strength: "strong",
        label: "Royal Mail international format",
        note: "Strong Royal Mail tracking format."
      },
      {
        regex: /^[A-Z]{2}\d{9}[A-Z]{2}$/i,
        score: 75,
        strength: "medium",
        label: "Postal format",
        note: "Postal-style tracking code."
      }
    ]
  },

  {
    id: "evri",
    name: "Evri",
    short: "Evri",
    url: "https://www.evri.com/track-a-parcel",
    rules: [
      {
        regex: /^H[A-Z0-9]{15}$/i,
        score: 95,
        strength: "strong",
        label: "Evri H-prefixed format",
        note: "Strong match for modern Evri tracking numbers."
      },
      {
        regex: /^\d{16}$/,
        score: 65,
        strength: "medium",
        label: "16-digit numeric format",
        note: "Possible Evri tracking number."
      }
    ]
  },

  {
    id: "dpd",
    name: "DPD UK",
    short: "DPD",
    url: "https://www.dpd.co.uk/service/",
    rules: [
      {
        regex: /^\d{14}$/,
        score: 80,
        strength: "strong",
        label: "14-digit DPD format",
        note: "Strong format match."
      },
      {
        regex: /^\d{12}$/,
        score: 55,
        strength: "medium",
        label: "12-digit numeric format",
        note: "Could be DPD."
      }
    ]
  },

  {
    id: "ups",
    name: "UPS",
    short: "UPS",
    url: "https://www.ups.com/track",
    rules: [
      {
        regex: /^1Z[A-Z0-9]{16}$/i,
        score: 99,
        strength: "strong",
        label: "UPS 1Z format",
        note: "Very strong UPS identifier."
      }
    ]
  },

  {
    id: "fedex",
    name: "FedEx",
    short: "FedEx",
    url: "https://www.fedex.com/en-gb/tracking.html",
    rules: [
      {
        regex: /^\d{12}$/,
        score: 70,
        strength: "medium",
        label: "12-digit FedEx format",
        note: "Possible FedEx tracking number."
      },
      {
        regex: /^\d{15}$/,
        score: 75,
        strength: "medium",
        label: "15-digit FedEx format",
        note: "Possible FedEx tracking number."
      },
      {
        regex: /^\d{20,22}$/,
        score: 72,
        strength: "medium",
        label: "20-22 digit FedEx format",
        note: "Possible FedEx tracking number."
      }
    ]
  },

  {
    id: "dhl",
    name: "DHL",
    short: "DHL",
    url: "https://www.dhl.com/gb-en/home/tracking.html",
    rules: [
      {
        regex: /^\d{10}$/,
        score: 75,
        strength: "medium",
        label: "10-digit DHL format",
        note: "Often associated with DHL Express."
      }
    ]
  },

  {
    id: "amazon",
    name: "Amazon Logistics",
    short: "AMZ",
    url: "https://track.amazon.co.uk/",
    rules: [
      {
        regex: /^TBA\d{9,12}$/i,
        score: 99,
        strength: "strong",
        label: "Amazon TBA format",
        note: "Strong Amazon Logistics match."
      }
    ]
  },

  {
    id: "parcelforce",
    name: "Parcelforce Worldwide",
    short: "PF",
    url: "https://www.parcelforce.com/track-trace",
    rules: [
      {
        regex: /^[A-Z]{2}\d{9}GB$/i,
        score: 45,
        strength: "weak",
        label: "Postal format",
        note: "Shared with other postal networks."
      }
    ]
  },

  {
    id: "yodel",
    name: "Yodel",
    short: "Y",
    url: "https://www.yodel.co.uk/track",
    rules: [
      {
        regex: /^[A-Z0-9]{8,20}$/i,
        score: 15,
        strength: "weak",
        label: "Generic alphanumeric format",
        note: "Very broad format."
      }
    ]
  },

  {
    id: "inpost",
    name: "InPost UK",
    short: "InPost",
    url: "https://inpost.co.uk/track",
    rules: [
      {
        regex: /^[A-Z0-9]{10,20}$/i,
        score: 12,
        strength: "weak",
        label: "Generic alphanumeric format",
        note: "Very broad format."
      }
    ]
  }
];

function normaliseTrackingNumber(value) {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

function getConfidence(score) {
  if (score >= 90)
    return { label: `High confidence (${score}%)`, className: "high" };

  if (score >= 60)
    return { label: `Medium confidence (${score}%)`, className: "medium" };

  return { label: `Low confidence (${score}%)`, className: "low" };
}

function getBonusScore(carrierId, trackingNumber) {
  let bonus = 0;
  const reasons = [];

  if (carrierId === "evri") {
    if (trackingNumber.startsWith("H")) {
      bonus += 15;
      reasons.push("Starts with H");
    }

    if (trackingNumber.length === 16) {
      bonus += 10;
      reasons.push("16 characters long");
    }

    if (/[A-Z]/.test(trackingNumber)) {
      bonus += 5;
      reasons.push("Contains letter-number pattern");
    }
  }

  if (carrierId === "ups" && trackingNumber.startsWith("1Z")) {
    bonus += 25;
    reasons.push("UPS 1Z prefix");
  }

  if (carrierId === "amazon" && trackingNumber.startsWith("TBA")) {
    bonus += 25;
    reasons.push("Amazon TBA prefix");
  }

  return { bonus, reasons };
}

function findMatches(trackingNumber) {
  const matches = [];

  for (const carrier of CARRIERS) {
    for (const rule of carrier.rules) {
      if (rule.regex.test(trackingNumber)) {

        const extra = getBonusScore(
          carrier.id,
          trackingNumber
        );

        matches.push({
          carrier,
          score: Math.min(rule.score + extra.bonus, 99),
          format: rule.label,
          note: rule.note,
          strength: rule.strength,
          reasons: extra.reasons
        });
      }
    }
  }

  const bestByCarrier = new Map();

  for (const match of matches) {
    const current = bestByCarrier.get(match.carrier.id);

    if (!current || match.score > current.score) {
      bestByCarrier.set(match.carrier.id, match);
    }
  }

  const results = [...bestByCarrier.values()]
    .sort((a, b) => b.score - a.score);

  const strongWinner =
    results.length &&
    results[0].score >= 90;

  if (strongWinner) {
    return results.filter(
      x => x.score >= results[0].score - 15
    );
  }

  return results;
}

function safeText(value) {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&",
      "<": "<",
      ">": ">",
      '"': """,
      "'": "'"
    })[character]
  );
}

function carrierLogo(carrier) {
  return `
    <span class="result-logo">
      ${safeText(carrier.short)}
    </span>
  `;
}

function renderMatch(match, index) {

  const confidence = getConfidence(match.score);

  const reasonsHtml =
    match.reasons.length
      ? `
        <ul class="match-reasons">
          ${match.reasons
            .map(r => `<li>${safeText(r)}</li>`)
            .join("")}
        </ul>
      `
      : "";

  return `
    <article class="result-card ${index === 0 ? "best" : ""}">
      <div class="result-top">

        ${carrierLogo(match.carrier)}

        <div class="result-main">
          <strong>${safeText(match.carrier.name)}</strong>
          <p>${safeText(match.format)}</p>
        </div>

        <span class="confidence ${confidence.className}">
          ${confidence.label}
        </span>

      </div>

      <p class="result-footnote">
        ${safeText(match.note)}
      </p>

      ${reasonsHtml}

      <div class="result-actions">
        <a
          class="link-button"
          href="${safeText(match.carrier.url)}"
          target="_blank"
          rel="noopener noreferrer">
          Track on ${safeText(match.carrier.name)} ↗
        </a>
      </div>
    </article>
  `;
}

 * Courier Finder
 * This is a heuristic matcher, not a carrier verification service.
 * Patterns are approximate and may overlap. Update them only after checking
 * each carrier's current official 
