# PGICH Noida — PHO/BMT Patient Audit

Mobile Google Apps Script + Google Sheets medication-audit workflow.

## Current version
**V5.4.1 Smart Summary UX update** · 2026-11-04 · Apps Script client release `2026.11.04.2`

### V5.4.1 refinements
- The final integrated HTML continues to call `phoMobileFastBootstrap()` from the existing V5.3 FastLoad script. This preserves fast startup; no compatibility adapter is required.
- A new, unsaved patient form prefills **IVF Rate 20 mL/hr**; verify the patient's actual rate before saving. Previously saved records retain their recorded values.
- Opening **Smart Summary** now starts with **Today** selected.
- Today / Yesterday / 2 Days Ago / 3 Days Ago appear in one row; **This Month** spans its own full-width row.

### Smart Summary periods
- Today
- Yesterday
- 2 Days Ago
- 3 Days Ago
- This Month (calendar month-to-date, Asia/Kolkata)

The historical views read saved audits from **Patient Records** and do not modify patient records. Monthly totals are **audit counts**, not necessarily unique patients. An empty date does not imply a missed scheduled audit.

## Files
- `PHO_Mobile_V5_4_History.gs` — complete mobile Apps Script backend
- `PHO_Mobile_UI.html` — full client UI; create the Apps Script HTML file named `PHO_Mobile_UI`
- `PHO_V53_FastLoad.gs` — the existing V5.3 optimized bootstrap, needed by the live mobile UI
- `PHO_Smart_Summary_History_Offline_Preview.html` — standalone *fictional-data* demo
- `DEPLOYMENT.md` — safe setup/update guidance

## Privacy and security
**This repository is PUBLIC.** It contains application source and a simulated offline preview only. Never commit patient names, IDs, medication records, live audit exports, credentials, personal email addresses, web-app deployment URLs, or hospital spreadsheet IDs.

To avoid publishing the production Sheet ID, the GitHub version reads its target from Apps Script **Script Properties**, with the key `PHO_SPREADSHEET_ID`. Configure the actual value privately in **Project Settings → Script Properties** for the authorized, existing bound Apps Script project. Do not put the ID in GitHub.

This GitHub repository does **not** store live patient records, and pushing a commit does **not** automatically deploy the Google Apps Script web app.

## Deployment safety
Use the *existing* PGICH project, back up its current version, replace the mobile backend and `PHO_Mobile_UI` source only; keep the already-installed V5.3 FastLoad script unchanged, and verify on a non-production copy first. Do **not** rerun the legacy installer or recovery function. Keep deployment access restricted to approved hospital staff.

Prior versions are recoverable from Git commit history. Record each future approved update as a new versioned commit.