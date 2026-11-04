# V5.4 deployment and rollback guide

## Scope
PGICH Noida PHO/BMT mobile patient-audit web app, **V5.4.2 Smart Summary preload**, release `2026.11.04.3`.

**Source control and Apps Script deployment are separate.** A GitHub commit does not modify the live hospital app.

## Before deploying
1. Obtain hospital administrator approval and verify authorized users.
2. Back up the existing bound Apps Script project and Google Sheet; preserve the separate Daily Summary workbook and original Form Responses.
3. In **Apps Script → Project Settings → Script Properties**, set `PHO_SPREADSHEET_ID` to the existing approved patient-audit spreadsheet ID. **Do not put that value in this public repository.**
4. Confirm there is only one `doGet()`, one `PHO_MOBILE_CONFIG` and one `phoMobileSmartSummaryHistory()` across the project.

## Install code in the existing Apps Script project
1. Replace the **mobile backend only** with `PHO_Mobile_V5_4_History.gs`. Keep the original installer `Code.gs` if separate.
2. Replace HTML file **PHO_Mobile_UI** with `PHO_Mobile_UI.html` (same file name without .html in Apps Script editor).
3. Do **not** rerun `setupPHOPatientAuditUpgrade()`, `phoRepairAndFinishSetup()`, or `phoMobileInstallV3()` merely to apply this update.
5. Save and test first against a **nonproduction copy with fictional records**.
6. Verify five Smart Summary periods, including silent preloading while viewing Today, and explicit Refresh fetching new report data: Today, Yesterday, 2 Days Ago, 3 Days Ago, This Month.
7. Verify new unsaved patients show a 20 mL/hr editable IVF default, and check saved patients keep their actual rate. Confirm Today is the default and This Month uses a separate full-width button row.
8. Validate report dates using **Asia/Kolkata**, including November 1 going back to October 31.
9. Check totals and errors against archive rows. Monthly total is a count of **saved audits**, not unique people.
10. Verify normal Save, Save & Next, patient-name edit handling, and patient history still work.
11. Only after approval: **Deploy → Manage deployments → Edit existing deployment → New version → Deploy** with staff-only access.

## Preserve data
The history feature reads historical rows from `Patient Records` and has no migration. Do not reset or delete the existing source worksheet, archive, revision log, or Daily Summary workbook.

## Known integration caveat
The legacy original `Code.gs` next-day menu workflow may not clear newer patient-name fields in columns R:S. Until independently verified, prefer the mobile app's next-day workflow.

## Rollback
Restore the previously working **mobile backend** and **PHO_Mobile_UI**, then redeploy the previous web-app version. Do not roll back patient records to undo a code change.

## Public-source rules
Never commit real or exported patient records; confidential identifiers; deployment tokens; hospital Sheet IDs; private web-app URLs; or account credentials. GitHub is a version history for **source code**, not a patient database.

## Validation performed before this source release
The supplied V5.4 history logic passed 9 fictional-data backend tests (date boundaries, deduplication, empty periods and read-only checks), plus JavaScript syntax and offline preview checks. **The live hospital workbook was not tested or deployed through GitHub.**