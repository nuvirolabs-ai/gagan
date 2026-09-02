# Admin visual system

Gagan Admin is a **desktop-first business operating system**, not a marketing dashboard.

## Colour

| Token | Use |
|---|---|
| Ivory-gray canvas `#F4F1EA` | Page background |
| White | Tables, queues, forms |
| Near-black `#141C18` | Primary text |
| Graphite `#6F7B74` | Secondary |
| Deep green `#101C16` | Primary actions, sidebar |
| Forest `#1F5132` | Links, selected chrome |
| Gold `#8A6A12` / fill `#C9992B` | Achievement only, never as body text on white |
| Amber `#9A6510` | Warning queues |
| Red `#C4462F` | Critical / reject |
| Blue `#2F5B8F` | Info only when semantic |

Do not cover the OS in brand green. Green is for action and navigation.

## Type

System UI stack. Page titles ~26px, body 13.5px, table headers 11px uppercase.

## Spacing / radius

8px radius. Prefer gap and section bands over stacked cards. Tables are denser than consumer UI (9–12px row padding).

## Components

- **Queues:** list rows with count + label + Open.
- **Tables:** sticky header, hover, right-aligned money where used.
- **Pills:** status only.
- **Buttons:** deep green primary, quiet secondary, red danger.
- **Focus:** 2px green outline.
- **Empty:** explain whether empty is healthy.
- **Error:** `.banner.error` / `.alert.error` — human copy, no raw SAP.

## Navigation

Grouped: Home · Work · Sales · Finance · Field · System. Permission-filtered. Routes are guarded.

## What not to do

No glassmorphism, no huge corner radius, no vanity charts on Home, no fake warehouse SKUs.
