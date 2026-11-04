/**
 * PGICH V5.3 Fast Load
 * Additive-only performance enhancement.
 * Existing patient-saving, pharmacist handover, Smart Summary and archive
 * functions stay unchanged. Uses PHO_MOBILE_CONFIG from the mobile backend.
 */
function phoMobileFastSS_(requireV3) {
  const ss = SpreadsheetApp.openById(PHO_MOBILE_CONFIG.spreadsheetId);
  const entry = ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
  const archive = ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
  const lists = ss.getSheetByName(PHO_MOBILE_CONFIG.lists);
  const history = ss.getSheetByName(PHO_MOBILE_CONFIG.history);
  if (!entry || !archive || !lists || !history ||
      !ss.getSheetByName('Form Responses 1')) {
    throw new Error('Existing PGICH Patient Audit spreadsheet structure not recognized. No changes made.');
  }
  const entryHeaders = entry.getRange('A7:S7').getDisplayValues()[0];
  const archiveHeaders = archive.getRange('A1:T1').getDisplayValues()[0];
  if (entryHeaders[0] !== 'No.' || entryHeaders[13] !== 'SAVE ✓' ||
      archiveHeaders[0] !== 'Record ID') {
    throw new Error('Existing PGICH Patient Audit spreadsheet structure not recognized. No changes made.');
  }
  if (requireV3) {
    const listHeaders = lists.getRange('G1:H1').getDisplayValues()[0];
    if (entryHeaders[17] !== 'Patient Name' ||
        entryHeaders[18] !== 'Name audit date' ||
        archiveHeaders[19] !== 'Patient Name' ||
        listHeaders[0] !== 'Clinical Pharmacist' ||
        listHeaders[1] !== 'Bed cubicle (optional)') {
      throw new Error('V3 setup is incomplete. Run phoMobileInstallV3 once, then reload.');
    }
  }
  return ss;
}
function phoMobileFastLoad_() {
  const ss = phoMobileFastSS_(true);
  const entry = ss.getSheetByName(PHO_MOBILE_CONFIG.entry);
  const header = entry.getRange('B3:E3').getDisplayValues()[0];
  const date = header[0].trim();
  const pharmacist = header[3].trim();
  const rows = entry.getRange(8, 1, 70, 19).getValues();
  const savedIds = new Set(rows.filter(function(r) {
    return phoMobileStr_(r[14]) === 'Saved' && !!r[16];
  }).map(function(r) {
    return phoMobileStr_(r[16]);
  }));
  const recordedBy = {};
  if (savedIds.size) {
    const archive = ss.getSheetByName(PHO_MOBILE_CONFIG.archive);
    const last = archive.getLastRow();
    if (last > 1) {
      const limit = 300;
      const tailLength = Math.min(last - 1, limit);
      const tailStart = last - tailLength + 1;
      const recent = archive.getRange(tailStart, 1, tailLength, 3).getDisplayValues();
      recent.forEach(function(r) {
        if (savedIds.has(r[0]) && r[1] === date) recordedBy[r[0]] = r[2];
      });
      if (Object.keys(recordedBy).length < savedIds.size && tailStart > 2) {
        archive.getRange(2, 1, tailStart - 2, 3).getDisplayValues().forEach(function(r) {
          if (savedIds.has(r[0]) && r[1] === date) recordedBy[r[0]] = r[2];
        });
        recent.forEach(function(r) {
          if (savedIds.has(r[0]) && r[1] === date) recordedBy[r[0]] = r[2];
        });
      }
    }
  }
  return {
    date: date,
    today: phoMobileToday_(),
    pharmacist: pharmacist,
    options: phoMobileReadOptions_(ss),
    rows: rows.map(function(r) {
      return phoMobileRow_(r, date, pharmacist, recordedBy[r[16]] || '');
    })
  };
}
function phoMobileFastBootstrap() {
  const data = phoMobileFastLoad_();
  if (data.date === data.today) return data;
  try {
    return phoMobileStartToday();
  } catch (error) {
    console.warn('PHO_AUTO_DATE_CHANGE_BLOCKED: ' +
      (error && error.message || error));
    return phoMobileFastLoad_();
  }
}
