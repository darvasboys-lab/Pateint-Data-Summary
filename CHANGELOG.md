# Change log

All changes should be committed to this repository with a versioned commit message before a separate, explicitly authorized Apps Script deployment.

## V5.4 — 2026-11-04
- Added Today, Yesterday, 2 Days Ago, 3 Days Ago and This Month in Smart Summary.
- Historical reports read saved rows from `Patient Records`; no patient-data migration.
- Added month-to-date aggregates and daily count breakdown; avoids fabricated 70-per-day monthly completion counts.
- Fixed client bootstrap call to `phoMobileBootstrap()`.
- Continued original patient-entry, Save and Save & Next workflows.
- Published a fictional-data offline preview.
- Changed public-source configuration to private Apps Script Script Property `PHO_SPREADSHEET_ID` instead of committing the hospital Sheet ID.
- Added safe deployment/rollback instructions and data-export exclusions.

**Validation:** 9/9 simulated history tests, syntax checks, and offline UI checks. **Status:** Source committed to GitHub. Hospital Apps Script production deployment is separate and has **not** been performed by this repository update.
