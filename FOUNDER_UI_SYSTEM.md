# Founder UI system

Pulse gate. Neutral executive iOS language. **Not Gagan branded.**

## Principles

Calm, quiet, premium, editorial. Typography and whitespace carry hierarchy. Not a SaaS dashboard.

Conceptual references (not copies): Apple Settings grouped lists, Apple Health / Stocks summary numbers.

Forbidden: Gagan logo or red/yellow, dal photography, giant gradients, glassmorphism, heavy shadows, card-everywhere, dashboard mosaics, decorative charts, marketing banners.

## Color (semantic tokens)

Light: warm off-white canvas `#F5F4F1`, grouped fill `#EBEAE6`, graphite text `#1C1C1E`, secondary `#6E6E73`, separators `#C6C6C8`.

Semantic only: green `#248A3D`, red `#D70015`, amber `#C93400`, blue `#007AFF`.

Dark: system-like backgrounds `#000000` / `#1C1C1E`, label `#F5F5F7`, secondary `#98989D`.

`useColorScheme()` selects the token set. No separate “dark aesthetic”.

## Type

Large navigation title ~34 / 700.
Greeting 17 / 400 secondary.
Headline statement 22 / 600.
Metric label 13 / 600 caps-ish tracking.
Metric value 28 / 600 tabular.
Caption 13 / 400 secondary.

System font. No display serif, no brand font.

## Surfaces

Inset grouped sections. Thin separators. Occasional 2×2 metric tiles for the four Pulse headlines only — hairline grouping, not floating marketing cards.

Tab bar: Pulse, Trends, Issues, Decisions. SF-style outline icons.

Trends: interpretation first, large number, thin SVG line, native segmented 7D/30D/90D. No chart cards.

Issues: native list, severity + impact + owner/age + chevron. Detail uses progressive disclosure.

Decisions: Open / History. Empty open state is positive (“Nothing needs your decision.”).

Settings: grouped list. Brief: editorial statements, no dashboard chrome.

## Motion

Respect `reduceMotion`. No decorative animation in V1 Pulse.

## INR

One helper: `formatInrExecutive`.

- ≥ ₹1 crore → `₹1.42Cr` (2 decimals, trim trailing zeros)
- ≥ ₹1 lakh → `₹48.2L` (1 decimal, trim `.0`)
- else Indian grouping `₹12,500`

Never mix crore words with L on the same surface.
