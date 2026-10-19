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
      // Classic UPU S10 – very strong for UK-origin items
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 94, label: "International / Tracked S10 format (XX + 9 digits + GB)", note: "Strong format match for Royal Mail Tracked, Signed For, Special Delivery and many international items." },
      // Domestic Tracked 24/48 style (often starts 02 or 05, longer numeric)
      { regex: /^(02|05)\d{11,19}$/, score: 78, label: "Domestic Tracked-style numeric format", note: "Common for Royal Mail Tracked 24 / Tracked 48 business and consumer labels." },
      // Generic 13–21 character alphanumeric that still looks postal
      { regex: /^[A-Z]{2}\d{9}[A-Z]{2}$/, score: 55, label: "Postal-style alphanumeric format", note: "Resembles a UPU S10 code. Could also be Parcelforce or another postal operator." }
    ]
  },
  {
    id: "dpd",
    name: "DPD UK",
    short: "dpd",
    url: "https://www.dpd.co.uk/service/",
    rules: [
      // Most common modern DPD UK parcel numbers
      { regex: /^\d{14}$/, score: 82, label: "14-digit numeric format", note: "The standard DPD UK parcel number length used by most retailers." },
      // Older / DPD Local style
      { regex: /^\d{10}$/, score: 68, label: "10-digit numeric format", note: "Common for DPD Local and some older or retailer-generated references." },
      // Occasional trailing letter variant
      { regex: /^\d{14}[A-Z]$/, score: 70, label: "14-digit + letter format", note: "Seen on some DPD labels; the trailing letter is part of the reference." }
    ]
  },
  {
    id: "evri",
    name: "Evri",
    short: "evri",
    url: "https://www.evri.com/track-a-parcel",
    rules: [
      // Classic Hermes/Evri H-prefix (very distinctive)
      { regex: /^H[A-Z0-9]{15}$/, score: 92, label: "H-prefixed 16-character format", note: "Strong match for Evri (formerly Hermes). Most modern Evri numbers begin with H." },
      // Pure 16-digit
      { regex: /^\d{16}$/, score: 75, label: "16-digit numeric format", note: "Common Evri parcel number length. Other carriers also use 16 digits, so confidence is medium." },
      // General 16-character alphanumeric (letter + mix)
      { regex: /^[A-Z]\d{2}[A-Z0-9]{13}$/, score: 65, label: "16-character alphanumeric format", note: "Matches many Evri retailer and international labels." }
    ]
  },
  {
    id: "yodel",
    name: "Yodel",
    short: "Y",
    url: "https://www.yodel.co.uk/track",
    rules: [
      // Most common retailer format
      { regex: /^J{1,2}D\d{14,16}$/, score: 90, label: "JD / JJD + digits format", note: "Strong match for the most common Yodel retailer tracking numbers." },
      // Yodel Direct consumer bookings
      { regex: /^YOL\d{6,10}$/, score: 88, label: "YOL-prefixed format", note: "Typical for parcels booked through Yodel Direct." },
      // Other common alphanumeric patterns
      { regex: /^[0-9][A-Z]{2,4}\d{8,12}$/, score: 55, label: "Mixed alphanumeric format", note: "Seen on some business and marketplace Yodel shipments." },
      // Broad fallback (kept low)
      { regex: /^[A-Z0-9]{8,20}$/, score: 22, label: "General alphanumeric format", note: "Yodel references vary widely; this is only a weak clue." }
    ]
  },
  {
    id: "dhl",
    name: "DHL",
    short: "DHL",
    url: "https://www.dhl.com/gb-en/home/tracking.html",
    rules: [
      // DHL Express classic
      { regex: /^\d{10}$/, score: 80, label: "10-digit numeric format", note: "Classic DHL Express waybill length. Other carriers also use 10 digits." },
      // DHL Parcel UK / eCommerce UK
      { regex: /^\d{14}$/, score: 72, label: "14-digit numeric format", note: "Common for DHL Parcel UK / eCommerce UK shipments." },
      // JJD return / piece numbers
      { regex: /^JJD\d{10,20}$/, score: 85, label: "JJD-prefixed format", note: "Strong indicator of a DHL return or eCommerce piece number." },
      // JD eCommerce style
      { regex: /^JD\d{16,18}$/, score: 78, label: "JD-prefixed format", note: "Often used by DHL eCommerce." },
      // Generic 3-letter + digits (lower confidence)
      { regex: /^[A-Z]{3}\d{7,}$/, score: 40, label: "Letter prefix + digits", note: "Some DHL services use this style, but it is not unique." }
    ]
  },
  {
    id: "ups",
    name: "UPS",
    short: "UPS",
    url: "https://www.ups.com/track",
    rules: [
      // The classic and highly distinctive format
      { regex: /^1Z[A-Z0-9]{16}$/, score: 98, label: "UPS 1Z format", note: "Very strong format match for a standard UPS tracking number." },
      // Less common numeric formats
      { regex: /^\d{9}$/, score: 30, label: "9-digit numeric format", note: "Listed by UPS but heavily overlapped with other carriers." },
      { regex: /^\d{12}$/, score: 32, label: "12-digit numeric format", note: "Possible UPS format, but not distinctive." }
    ]
  },
  {
    id: "fedex",
    name: "FedEx",
    short: "FedEx",
    url: "https://www.fedex.com/en-gb/tracking.html",
    rules: [
      { regex: /^\d{12}$/, score: 62, label: "12-digit numeric format", note: "Common for FedEx Express and many Ground shipments." },
      { regex: /^\d{15}$/, score: 68, label: "15-digit numeric format", note: "Typical for FedEx Ground / Home Delivery." },
      { regex: /^\d{20}$/, score: 70, label: "20-digit numeric format", note: "Often FedEx Ground Economy (SmartPost)." },
      { regex: /^\d{22}$/, score: 65, label: "22-digit numeric format", note: "Used by some FedEx barcode and freight labels." }
    ]
  },
  {
    id: "parcelforce",
    name: "Parcelforce Worldwide",
    short: "PF",
    url: "https://www.parcelforce.com/track-trace",
    rules: [
      // Classic S10 that ends in GB (shared with Royal Mail)
      { regex: /^[A-Z]{2}\d{9}GB$/, score: 58, label: "Postal-style international format ending GB", note: "Parcelforce and Royal Mail both use this S10 pattern. Track on either site." },
