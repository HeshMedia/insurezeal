import { AdvancedFilterOptions, QuarterlySheetRecord } from "@/types/admin-mis.types";
import { getGoogleSheetsClient } from "../api/google-sheets-client";
import { BulkUpdateRequest, BulkUpdateResponse, MasterSheetExportParams, MasterSheetListParams, MasterSheetRecord } from "@/types/mis.types";

export class GoogleSheetsMISService {
  private sheetsClient;

  constructor() {
    this.sheetsClient = getGoogleSheetsClient();
  }

  /**
   * Fetch all master sheet data (no server-side filtering)
   * Client-side filtering will be applied in the UI
   */
  async fetchAllQuarterlySheetData(): Promise<QuarterlySheetRecord[]> {
    try {
      console.log('📊 Fetching all quarterly sheet data for client-side filtering');

      const startTime = Date.now();
      
      // Get raw sheet data
      const sheetData = await this.sheetsClient.getSheetData();
      const allRecords = this.sheetsClient.convertSheetDataToObjects<QuarterlySheetRecord>(sheetData);

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Fetched ${allRecords.length} records in ${processingTime}s`);

      return allRecords;
    } catch (error) {
      console.error('Error fetching all master sheet data:', error);
      throw new Error(`Failed to fetch master sheet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Fetch master sheet fields (headers)
   */
  async fetchMasterSheetFields(): Promise<string[]> {
    try {
      const sheetData = await this.sheetsClient.getSheetData();
      return sheetData.values?.[0] || [];
    } catch (error) {
      console.error('Error fetching master sheet fields:', error);
      throw new Error(`Failed to fetch master sheet fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update multiple cells in the Google Sheet
   */
  async bulkUpdateSheet(updates: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    try {
      console.log(`🔄 Starting bulk update with ${updates.updates.length} changes`);
      
      const startTime = Date.now();
      const results: BulkUpdateResponse['results'] = [];
      let successfulUpdates = 0;
      let failedUpdates = 0;

      // Get current data to validate updates
      const sheetData = await this.sheetsClient.getSheetData();
      const headers = sheetData.values?.[0] || [];
      const rows = sheetData.values?.slice(1) || [];

      // Group updates by row for efficiency
      const updatesByRow = new Map<number, Array<{ field_name: string; new_value: string; record_id: string }>>();
      
      for (const update of updates.updates) {
        // Find the row index for this record_id
        const rowIndex = rows.findIndex((row: string[]) => {
          // Assuming the first column contains a unique identifier
          return row[0] === update.record_id;
        });

        if (rowIndex === -1) {
          results.push({
            record_id: update.record_id,
            field_name: update.field_name,
            old_value: '',
            new_value: update.new_value,
            success: false,
            error_message: 'Record not found'
          });
          failedUpdates++;
          continue;
        }

        if (!updatesByRow.has(rowIndex)) {
          updatesByRow.set(rowIndex, []);
        }
        updatesByRow.get(rowIndex)!.push(update);
      }

      // Apply updates row by row
      for (const [rowIndex, rowUpdates] of updatesByRow) {
        const row = [...rows[rowIndex]]; // Create a copy
        
        for (const update of rowUpdates) {
          const columnIndex = headers.indexOf(update.field_name);
          
          if (columnIndex === -1) {
            results.push({
              record_id: update.record_id,
              field_name: update.field_name,
              old_value: '',
              new_value: update.new_value,
              success: false,
              error_message: 'Field not found'
            });
            failedUpdates++;
            continue;
          }

          const oldValue = row[columnIndex] || '';
          
          try {
            // Update the Google Sheet using the Sheets API
            await this.updateSingleCell(rowIndex + 2, columnIndex + 1, update.new_value); // +2 for header and 0-based index
            
            results.push({
              record_id: update.record_id,
              field_name: update.field_name,
              old_value: oldValue,
              new_value: update.new_value,
              success: true,
              error_message: ''
            });
            successfulUpdates++;
          } catch (error) {
            results.push({
              record_id: update.record_id,
              field_name: update.field_name,
              old_value: oldValue,
              new_value: update.new_value,
              success: false,
              error_message: error instanceof Error ? error.message : 'Unknown error'
            });
            failedUpdates++;
          }
        }
      }

      const processingTime = (Date.now() - startTime) / 1000;
      
      console.log(`✅ Bulk update completed: ${successfulUpdates} successful, ${failedUpdates} failed in ${processingTime}s`);

      return {
        message: `Bulk update completed: ${successfulUpdates} successful, ${failedUpdates} failed`,
        total_updates: updates.updates.length,
        successful_updates: successfulUpdates,
        failed_updates: failedUpdates,
        results,
        processing_time_seconds: processingTime
      };
    } catch (error) {
      console.error('Error in bulk update:', error);
      throw new Error(`Failed to perform bulk update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a single cell in the Google Sheet
   */
  private async updateSingleCell(row: number, column: number, value: string): Promise<void> {
    try {
      const accessToken = await this.sheetsClient.getAccessToken();
      const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID;
      
      // Convert column number to letter (A, B, C, etc.)
      const columnLetter = String.fromCharCode(64 + column);
      const range = `${columnLetter}${row}`;
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`;
      
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
        throw new Error(`Failed to update cell: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating single cell:', error);
      throw error;
    }
  }

//   /**
//    * Export master sheet data as blob
//    */
//   async exportMasterSheet(params: MasterSheetExportParams): Promise<Blob> {
//     try {
//       const sheetData = await this.sheetsClient.getSheetData();
//       const allRecords = this.sheetsClient.convertSheetDataToObjects<MasterSheetRecord>(sheetData);
      
//       // Apply filters if specified
//       let filteredRecords = allRecords;
//       if (params.search || params.agent_code) {
//         filteredRecords = this.applyFilters(allRecords, params);
//       }
      
//       // Convert to CSV or JSON based on format
//       const format = params.format || 'csv';
      
//       if (format === 'csv') {
//         return this.convertToCSV(filteredRecords);
//       } else {
//         return this.convertToJSON(filteredRecords);
//       }
//     } catch (error) {
//       console.error('Error exporting master sheet:', error);
//       throw new Error(`Failed to export master sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }

  /**
   * Get Google Sheets metadata (sheet info, connection status, etc.)
   */
  async getSheetInfo() {
    return this.sheetsClient.getSheetInfo();
  }

  /**
   * Test connection to Google Sheets
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sheetsClient.getSheetInfo();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  /**
   * Apply basic filters (search, agent_code)
   */
  private applyBasicFilters(
    records: QuarterlySheetRecord[],
    params: MasterSheetListParams | MasterSheetExportParams
  ): QuarterlySheetRecord[] {
    let filtered = records;

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filtered = filtered.filter(record =>
        Object.values(record).some(value =>
          value?.toString().toLowerCase().includes(searchLower)
        )
      );
    }

    if (params.agent_code) {
      filtered = filtered.filter(record =>
        record["Agent Code"]?.toString().toLowerCase().includes(params.agent_code!.toLowerCase())
      );
    }

    return filtered;
  }

  /**
   * Check if advanced filters are present
   */
  private hasAdvancedFilters(params: AdvancedFilterOptions): boolean {
    const advancedFields = [
      'insurer_name', 'policy_number', 'reporting_month', 'product_type',
      'payment_by', 'invoice_status', 'major_categorisation', 'state',
      'broker_name', 'booking_date_from', 'booking_date_to',
      'gross_premium_min', 'gross_premium_max', 'net_premium_min', 'net_premium_max',
      'policy_start_date_from', 'policy_start_date_to', 'policy_end_date_from', 'policy_end_date_to',
      'business_type', 'fuel_type', 'ncb', 'plan_type', 'rto', 'cluster'
    ];
    
    return advancedFields.some(field => params[field as keyof AdvancedFilterOptions] !== undefined);
  }

   /**
   * Convert records to CSV format
   */
  private convertToCSV(records: MasterSheetRecord[]): Blob {
    if (records.length === 0) {
      return new Blob(['No data to export'], { type: 'text/csv' });
    }

    const headers = Object.keys(records[0]);
    const csvContent = [
      headers.join(','),
      ...records.map(record =>
        headers.map(header => {
          const value = record[header as keyof MasterSheetRecord];
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"` // Escape quotes and wrap in quotes
            : value?.toString() || '';
        }).join(',')
      )
    ].join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }

  /**
   * Convert records to JSON format
   */
  private convertToJSON(records: MasterSheetRecord[]): Blob {
    const jsonContent = JSON.stringify(records, null, 2);
    return new Blob([jsonContent], { type: 'application/json' });
  }
}

export const googleSheetsMISService = new GoogleSheetsMISService();