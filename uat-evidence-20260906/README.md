# UAT Evidence — 2026-09-06

This directory is the persistent evidence set for the corrected UAT candidate.
It contains the native Android, local Admin/browser, and bounded hosted-release
screenshots captured during this run. The files are intentionally kept outside
the application source tree and contain no credentials or authentication-state
files.

The evidence is tied to candidate commit `b0bd68911d7fe2c61ccd954ab8b3e4683b0d9054`.

Important boundaries:

- local native golden paths use the isolated app database and mock providers;
- exact hosted-release APK smoke evidence is separate from the local candidate
  flow evidence;
- screenshot evidence proves the visible interface shown in that screenshot,
  not an unperformed backend or employee action;
- the older root-level screenshots remain untouched for continuity, while this
  directory is the versioned evidence copy used by the final report.
