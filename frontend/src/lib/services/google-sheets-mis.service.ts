import { AdvancedFilterOptions, QuarterlySheetRecord } from "@/types/admin-mis.types";
import { getGoogleSheetsClient } from "../api/google-sheets-client";
import { BulkUpdateRequest, BulkUpdateResponse, MasterSheetExportParams, MasterSheetListParams, MasterSheetRecord, MasterSheetStats } from "@/types/mis.types";
import { misApi } from "../api/mis";
import { createAuthenticatedClient } from "../api/client";

export class GoogleSheetsMISService {
  private sheetsClient;
  private apiClient;

  constructor() {
    this.sheetsClient = getGoogleSheetsClient();
    this.apiClient = createAuthenticatedClient();
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
   * Fetch data from a specific sheet by name
   */
  async fetchSheetData(sheetName: string): Promise<QuarterlySheetRecord[]> {
    try {
      console.log(`📊 Fetching data from specific sheet: ${sheetName}`);

      const startTime = Date.now();
      
      // Construct range for the specific sheet (get all data)
      const range = `${sheetName}!A:ZZ`;
      
      // Get raw sheet data from specific sheet
      const sheetData = await this.sheetsClient.getSheetData(range);
      const allRecords = this.sheetsClient.convertSheetDataToObjects<QuarterlySheetRecord>(sheetData);

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Fetched ${allRecords.length} records from sheet "${sheetName}" in ${processingTime}s`);

      return allRecords;
    } catch (error) {
      console.error(`Error fetching data from sheet "${sheetName}":`, error);
      throw new Error(`Failed to fetch data from sheet "${sheetName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Fetch balance sheet/summary statistics from the backend API
   */
  async fetchBalanceSheetStats(): Promise<MasterSheetStats> {
    try {
      console.log('📊 Fetching balance sheet statistics from API');
      
      // Use the existing misApi with proper authentication
      const data = await misApi.getMasterSheetStats();
      console.log('✅ Balance sheet data fetched successfully:', data);
      
      // The API returns the data directly
      return data;
    } catch (error) {
      console.error('Error fetching balance sheet stats:', error);
      throw new Error(`Failed to fetch balance sheet statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update multiple cells in a specific Google Sheet
   */
  async bulkUpdateSheetData(sheetName: string, updates: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    try {
      console.log(`🔄 Starting bulk update on sheet "${sheetName}" with ${updates.updates.length} changes`);
      console.log('📋 Updates to apply:', updates.updates);
      
      const startTime = Date.now();
      const results: BulkUpdateResponse['results'] = [];
      let successfulUpdates = 0;
      let failedUpdates = 0;

      // Get current data from the specific sheet
      const range = `${sheetName}!A:ZZ`;
      const sheetData = await this.sheetsClient.getSheetData(range);
      const headers = sheetData.values?.[0] || [];
      const rows = sheetData.values?.slice(1) || [];

      console.log(`📊 Sheet "${sheetName}" has ${headers.length} columns and ${rows.length} rows`);
      console.log(`📋 Headers:`, headers.slice(0, 10)); // Show first 10 headers
      
      // Find the Policy number column index
      const policyNumberColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('policy number') || 
        header.toLowerCase().includes('policy no') ||
        header === 'Policy number'
      );
      
      console.log(`🔍 Policy number column index: ${policyNumberColumnIndex} (header: "${headers[policyNumberColumnIndex]}")`);

      // Group updates by row for efficiency
      const updatesByRow = new Map<number, Array<{ field_name: string; new_value: string; record_id: string }>>();
      
      for (const update of updates.updates) {
        // Find the row index for this record_id using the Policy number column
        console.log(`🔍 Looking for record ID: "${update.record_id}" in ${rows.length} rows`);
        
        const rowIndex = rows.findIndex((row: string[]) => {
          // Use the Policy number column instead of assuming first column
          const policyNumberValue = policyNumberColumnIndex >= 0 ? row[policyNumberColumnIndex] : row[0];
          console.log(`🔍 Comparing "${policyNumberValue}" === "${update.record_id}"`);
          return policyNumberValue === update.record_id;
        });

        console.log(`🎯 Row index found: ${rowIndex} for record "${update.record_id}"`);

        if (rowIndex === -1) {
          console.log(`❌ Record "${update.record_id}" not found in sheet data`);
          console.log(`📋 Available policy numbers:`, rows.map(row => 
            policyNumberColumnIndex >= 0 ? row[policyNumberColumnIndex] : row[0]
          ).slice(0, 5));
          results.push({
            record_id: update.record_id,
            field_name: update.field_name,
            old_value: '',
            new_value: update.new_value,
            success: false,
            error_message: `Record with ID "${update.record_id}" not found in sheet "${sheetName}"`
          });
          failedUpdates++;
          continue;
        }

        if (!updatesByRow.has(rowIndex)) {
          updatesByRow.set(rowIndex, []);
        }
        updatesByRow.get(rowIndex)!.push(update);
      }

      // Apply updates row by row using batch update for efficiency
      const allUpdates: Array<{ range: string; value: string }> = [];
      
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
              error_message: `Field "${update.field_name}" not found in sheet "${sheetName}"`
            });
            failedUpdates++;
            continue;
          }

          const oldValue = row[columnIndex] || '';
          
          // Prepare batch update
          const range = `${sheetName}!${this.getColumnLetter(columnIndex + 1)}${rowIndex + 2}`;
          allUpdates.push({
            range: range,
            value: update.new_value
          });
          
          // Track the result for later processing
          results.push({
            record_id: update.record_id,
            field_name: update.field_name,
            old_value: oldValue,
            new_value: update.new_value,
            success: true, // Will be updated if batch fails
            error_message: ''
          });
        }
      }

      // Execute batch update if there are any updates
      if (allUpdates.length > 0) {
        try {
          console.log(`🔄 Executing batch update for ${allUpdates.length} cells...`);
          const batchResult = await this.sheetsClient.batchUpdateCells(allUpdates);
          successfulUpdates = allUpdates.length;
          console.log(`✅ Batch update successful: ${batchResult.totalUpdatedCells} cells updated`);
        } catch (error) {
          // If batch update fails, mark all results as failed
          console.error('❌ Batch update failed:', error);
          results.forEach(result => {
            if (result.success) {
              result.success = false;
              result.error_message = `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          });
          failedUpdates = allUpdates.length;
          successfulUpdates = 0;
        }
      }

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Bulk update completed in ${processingTime}s: ${successfulUpdates} successful, ${failedUpdates} failed`);

      return {
        message: `Bulk update on sheet "${sheetName}" completed: ${successfulUpdates} successful, ${failedUpdates} failed`,
        successful_updates: successfulUpdates,
        failed_updates: failedUpdates,
        total_updates: updates.updates.length,
        results,
        processing_time_seconds: processingTime
      };
    } catch (error) {
      console.error(`Error during bulk update on sheet "${sheetName}":`, error);
      throw new Error(`Failed to bulk update sheet "${sheetName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert column number to letter (A, B, C, ..., AA, AB, etc.)
   */
  private getColumnLetter(column: number): string {
    let result = '';
    while (column > 0) {
      column--;
      result = String.fromCharCode(65 + (column % 26)) + result;
      column = Math.floor(column / 26);
    }
    return result;
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

      console.log(`📊 Default sheet has ${headers.length} columns and ${rows.length} rows`);
      
      // Find the Policy number column index
      const policyNumberColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('policy number') || 
        header.toLowerCase().includes('policy no') ||
        header === 'Policy number'
      );
      
      console.log(`🔍 Policy number column index: ${policyNumberColumnIndex} (header: "${headers[policyNumberColumnIndex]}")`);

      // Group updates by row for efficiency
      const updatesByRow = new Map<number, Array<{ field_name: string; new_value: string; record_id: string }>>();
      
      for (const update of updates.updates) {
        // Find the row index for this record_id using the Policy number column
        const rowIndex = rows.findIndex((row: string[]) => {
          // Use the Policy number column instead of assuming first column
          const policyNumberValue = policyNumberColumnIndex >= 0 ? row[policyNumberColumnIndex] : row[0];
          return policyNumberValue === update.record_id;
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

      // Apply updates row by row using batch update for efficiency
      const allUpdates: Array<{ range: string; value: string }> = [];
      
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
          
          // Prepare batch update
          const range = `${this.getColumnLetter(columnIndex + 1)}${rowIndex + 2}`;
          allUpdates.push({
            range: range,
            value: update.new_value
          });
          
          // Track the result for later processing
          results.push({
            record_id: update.record_id,
            field_name: update.field_name,
            old_value: oldValue,
            new_value: update.new_value,
            success: true, // Will be updated if batch fails
            error_message: ''
          });
        }
      }

      // Execute batch update if there are any updates
      if (allUpdates.length > 0) {
        try {
          console.log(`🔄 Executing batch update for ${allUpdates.length} cells...`);
          const batchResult = await this.sheetsClient.batchUpdateCells(allUpdates);
          successfulUpdates = allUpdates.length;
          console.log(`✅ Batch update successful: ${batchResult.totalUpdatedCells} cells updated`);
        } catch (error) {
          // If batch update fails, mark all results as failed
          console.error('❌ Batch update failed:', error);
          results.forEach(result => {
            if (result.success) {
              result.success = false;
              result.error_message = `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          });
          failedUpdates = allUpdates.length;
          successfulUpdates = 0;
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