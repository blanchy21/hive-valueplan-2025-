/**
 * Google Sheets utility functions
 * Main spreadsheet: https://docs.google.com/spreadsheets/d/1tqPtEbS5EsajO-kgEgNtK1-eqXdZS8IOLaZ0CRKBrN4
 */

export const MAIN_SHEETS_ID = '1tqPtEbS5EsajO-kgEgNtK1-eqXdZS8IOLaZ0CRKBrN4';

// Known sheet tabs (gid values)
// To find the correct gid for a tab:
// 1. Open the Google Sheet
// 2. Click on the tab you want
// 3. Look at the URL - the gid parameter is the tab ID
export const SHEET_TABS = {
  TRANSACTIONS: '1152760254', // Value Plan Reporting Template
  // VERTICALS: Update this with the correct gid from the verticals tab URL
  // Common gid values to try: '0', '1234567890', etc.
  // If verticals is in a separate spreadsheet, use that spreadsheet ID instead
  VERTICALS: '0', // ⚠️ This needs to be updated with the correct tab gid
} as const;

export function getSheetsCsvUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${MAIN_SHEETS_ID}/export?format=csv&gid=${gid}`;
}

