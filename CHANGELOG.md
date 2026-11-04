# Change log

All changes should be committed to this repository with a versioned commit message before a separate, explicitly authorized Apps Script deployment.

## V5.4.1 — 2026-11-04
- New, unsaved patient entries prefill the editable IVF Rate field to 20 mL/hr; stored values are not modified by viewing the form.
- Opening Smart Summary always starts on Today, even after viewing a different period.
- Redesigned the selector into a four-button daily row plus a larger full-width This Month button below.
- Added a visible reminder to verify the actual patient IVF rate before saving.
- Bumped Apps Script client/backend release to `2026.11.04.2`.
- Passed 9 client-side IVF preservation/default assertions, script syntax validation and headless mobile UI flows at 320px, 393px and 768px. Production Sheets and live web app have not been modified.

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
