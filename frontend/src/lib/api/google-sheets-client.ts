/* eslint-disable @typescript-eslint/no-explicit-any */
import { AccessTokenResponse, SheetData } from '@/types/google-sheets.types';
import { SignJWT, importPKCS8 } from 'jose';


class GoogleSheetsClient {
  private spreadsheetId: string;
  private clientEmail: string;
  private privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor() {
    this.spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEETS_ID || '';
    this.clientEmail = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '';
    this.privateKey = (process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    
    if (!this.spreadsheetId) {
      throw new Error('Google Sheets ID is required. Set NEXT_PUBLIC_GOOGLE_SHEETS_ID or GOOGLE_SHEETS_ID environment variable.');
    }
    
    if (!this.clientEmail) {
      throw new Error('Google service account email is required. Set NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL or GOOGLE_CLIENT_EMAIL environment variable.');
    }
    
    if (!this.privateKey) {
      throw new Error('Google service account private key is required. Set NEXT_PUBLIC_GOOGLE_PRIVATE_KEY or GOOGLE_PRIVATE_KEY environment variable.');
    }
  }

  /**
   * Create JWT assertion for service account authentication
   */
  private async createJWT(): Promise<string> {
    try {
      // Import the private key
      const privateKeyObj = await importPKCS8(this.privateKey, 'RS256');
      
      const now = Math.floor(Date.now() / 1000);
      
      // Create JWT with the correct payload structure for Google OAuth
      const jwt = await new SignJWT({
        scope: 'https://www.googleapis.com/auth/spreadsheets'
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setIssuer(this.clientEmail)
        .setSubject(this.clientEmail)
        .setAudience('https://oauth2.googleapis.com/token')
        .setIssuedAt(now)
        .setExpirationTime(now + 3600) // 1 hour
        .sign(privateKeyObj);
        
      return jwt;
    } catch (error) {
      console.error('Error creating JWT:', error);
      throw new Error(`Failed to create JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Exchange JWT for access token
   */
  public async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Create JWT assertion
      const jwt = await this.createJWT();
      
      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth token exchange failed:', errorText);
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const tokenData: AccessTokenResponse = await response.json();
      
      // Cache the token (expires in 1 hour, refresh 5 min early)
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000; // -5 min buffer
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getSheetData(range?: string, retried: boolean = false): Promise<SheetData> {
    try {
      // If no range provided, discover the sheet name and use proper dimensions
      if (!range) {
        const sheetInfo = await this.getSheetInfo();
        console.log('🔍 All available sheets:', sheetInfo.sheets?.map((sheet: any) => ({
          name: sheet.properties.title,
          id: sheet.properties.sheetId,
          index: sheet.properties.index
        })));
        
        if (sheetInfo.sheets && sheetInfo.sheets.length > 0) {
          // Try to find the latest quarter sheet
          const quarterSheet = this.findLatestQuarterSheet(sheetInfo.sheets);
          const sheetName = quarterSheet || sheetInfo.sheets[0].properties.title;
          
          console.log('📊 Selected sheet for data:', sheetName);
          console.log('🎯 Quarter detection result:', {
            selectedSheet: sheetName,
            isQuarterSheet: !!quarterSheet,
            totalSheets: sheetInfo.sheets.length
          });
          
          // Get the proper data range based on actual sheet dimensions
          range = await this.getDataRange(sheetName);
        } else {
          throw new Error('No sheets found in the spreadsheet');
        }
      }
      
      // Get valid access token
      const accessToken = await this.getAccessToken();
      
      // Call Google Sheets API
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets API error:', errorText);
        
        if (response.status === 400 && !retried) {
          // Try with an even larger range if the current one fails
          const sheetName = range.includes('!') ? range.split('!')[0] : 'Sheet1';
          const simpleRange = `${sheetName}!A1:Z5000`;
          console.log(`Retrying with larger range: ${simpleRange}`);
          return this.getSheetData(simpleRange, true);
        } else if (response.status === 403) {
          throw new Error('Access denied to Google Sheets. Please check service account permissions.');
        } else if (response.status === 404) {
          throw new Error('Google Sheet not found. Please check the sheet ID and range.');
        } else if (response.status === 401) {
          // Clear cached token and retry once
          this.accessToken = null;
          this.tokenExpiry = 0;
          throw new Error('Authentication failed. Please check service account credentials.');
        }
        
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }

      const data: SheetData = await response.json();
      return data;
      
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
      throw new Error(`Failed to fetch data from Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getSheetInfo() {
    try {
      // Get valid access token
      const accessToken = await this.getAccessToken();
      
      // Get spreadsheet metadata
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets API error:', errorText);
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('Error fetching sheet info:', error);
      throw new Error(`Failed to fetch sheet info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Method to detect the actual data range of a sheet with proper dimensions
  async getDataRange(sheetName?: string): Promise<string> {
    try {
      if (!sheetName) {
        const sheetInfo = await this.getSheetInfo();
        sheetName = sheetInfo.sheets[0].properties.title;
      }
      
      // Get the sheet properties to find the actual dimensions
      const sheetInfo = await this.getSheetInfo();
      const sheet = sheetInfo.sheets?.find((s: any) => s.properties.title === sheetName);
      
      if (sheet?.properties?.gridProperties) {
        const { rowCount, columnCount } = sheet.properties.gridProperties;
        
        // Convert column count to letter (A, B, C, ..., AA, AB, etc.)
        const getColumnLetter = (col: number) => {
          let result = '';
          while (col > 0) {
            col--;
            result = String.fromCharCode(65 + (col % 26)) + result;
            col = Math.floor(col / 26);
          }
          return result;
        };
        
        const lastColumn = getColumnLetter(columnCount);
        const range = `${sheetName}!A1:${lastColumn}${rowCount}`;
        
        console.log(`📏 Detected sheet dimensions: ${rowCount} rows × ${columnCount} columns`);
        console.log(`📊 Using range: ${range}`);
        
        return range;
      }
      
      // Fallback: try to detect by checking for data
      // Use a larger range to capture more data (up to 5000 rows)
      return `${sheetName}!A:Z`;
      
    } catch (error) {
      console.error('Error detecting data range:', error);
      // Fallback to a larger default range
      return sheetName ? `${sheetName}!A1:Z5000` : 'A1:Z5000';
    }
  }

  /**
   * Finds the latest quarter sheet from available sheets
   * @param sheets - Array of sheet objects from Google Sheets API
   * @returns The name of the latest quarter sheet or null if none found
   */
  private findLatestQuarterSheet(sheets: any[]): string | null {
    console.log('🔍 Finding latest quarter sheet...');
    
    // Extract quarter sheets (format: Q{quarter}-{year} or similar)
    const quarterSheets = sheets
      .filter((sheet: any) => {
        const name = sheet.properties?.title || '';
        // Match patterns like Q3-2025, Q32025, q3-2025, etc.
        return /q\d+-?\d{4}/i.test(name);
      })
      .map((sheet: any) => {
        const name = sheet.properties?.title || '';
        const match = name.match(/q(\d+)-?(\d{4})/i);
        return {
          name,
          quarter: match ? parseInt(match[1]) : 0,
          year: match ? parseInt(match[2]) : 0,
          sheet: sheet
        };
      })
      .filter(item => item.quarter > 0 && item.year > 0);

    console.log('📊 Quarter sheets found:', quarterSheets.map(qs => ({
      name: qs.name,
      quarter: qs.quarter,
      year: qs.year
    })));

    if (quarterSheets.length === 0) {
      console.log('⚠️ No quarter sheets found, will use first available sheet');
      return null;
    }

    // Sort by year desc, then quarter desc to get the latest
    quarterSheets.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

    const latestSheet = quarterSheets[0];
    console.log('✅ Latest quarter sheet selected:', latestSheet.name);
    return latestSheet.name;
  }
  
  // Helper method to convert sheet data to objects with proper typing
  convertSheetDataToObjects<T = Record<string, string>>(sheetData: SheetData): T[] {
    if (!sheetData.values || sheetData.values.length < 2) {
      return [];
    }
    
    const [headers, ...rows] = sheetData.values;
    
    return rows.map((row: string[]) => {
      const obj = {} as Record<string, string>;
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj as T;
    });
  }

  /**
   * Update a single cell in the spreadsheet
   */
  async updateCell(range: string, value: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[value]]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets update error:', errorText);
        throw new Error(`Failed to update cell: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Successfully updated cell ${range} with value: ${value}`);
    } catch (error) {
      console.error(`Error updating cell ${range}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple cells in the spreadsheet using batch update (recommended approach)
   */
  async batchUpdateCells(updates: Array<{ range: string; value: string }>): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values:batchUpdate`;
      
      const requestBody = {
        valueInputOption: 'USER_ENTERED', // Parse formulas, dates, numbers etc.
        data: updates.map(update => ({
          range: update.range,
          values: [[update.value]]
        }))
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Sheets batch update error:', errorText);
        throw new Error(`Failed to batch update cells: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Successfully batch updated ${updates.length} cells. Total cells updated: ${result.totalUpdatedCells}`);
      return result;
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  }
}

// Singleton instance
let googleSheetsClient: GoogleSheetsClient | null = null;

export const getGoogleSheetsClient = (): GoogleSheetsClient => {
  if (!googleSheetsClient) {
    googleSheetsClient = new GoogleSheetsClient();
  }
  return googleSheetsClient;
};

export default GoogleSheetsClient;