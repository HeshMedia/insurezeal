import { NextRequest, NextResponse } from 'next/server';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableData {
  name: string;
  data: Record<string, any>[];
  columns: ColumnInfo[];
  rowCount: number;
}

export async function POST(request: NextRequest) {
  try {
    const { databaseUrl } = await request.json();

    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'Database URL is required' },
        { status: 400 }
      );
    }

    // Validate PostgreSQL URL format
    if (!databaseUrl.includes('postgresql://') && !databaseUrl.includes('postgres://')) {
      return NextResponse.json(
        { error: 'Invalid PostgreSQL URL format' },
        { status: 400 }
      );
    }

    // Use a more robust connection approach with better SSL handling
    const result = await connectWithImprovedSSL(databaseUrl);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Database connection error:', error);
    
    let errorMessage = 'Failed to connect to PostgreSQL database';
    let suggestion = '';
    let troubleshooting: any = {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || 'Unknown',
      user: 'HarnoorSingh1234',
      suggestions: []
    };

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('ssl') || errorMsg.includes('certificate') || errorMsg.includes('handshake')) {
        errorMessage = 'SSL Certificate Error';
        suggestion = 'Using alternative connection method for Aiven databases';
        troubleshooting.suggestions = [
          'Enable connection pooling in your Aiven console',
          'Use ?sslmode=require in your connection string',
          'Try connecting from a non-serverless environment',
          'Check if your Aiven service allows external connections',
          'Verify your IP is whitelisted in Aiven console'
        ];
      } else if (errorMsg.includes('timeout')) {
        errorMessage = 'Connection Timeout';
        suggestion = 'Network connectivity issue detected';
        troubleshooting.suggestions = [
          'Check your internet connection',
          'Verify Aiven service is running',
          'Try connecting from a different network',
          'Check if your hosting provider blocks external database connections'
        ];
      } else {
        errorMessage = error.message;
        troubleshooting.suggestions = [
          'Verify your connection string is correct',
          'Check if the database exists',
          'Ensure your credentials are valid',
          'Try connecting with a PostgreSQL client first'
        ];
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion,
        troubleshooting
      },
      { status: 500 }
    );
  }
}

async function connectWithImprovedSSL(databaseUrl: string) {
  // Dynamic import to avoid issues
  const { Client } = await import('pg');
  
  // Parse URL
  const url = new URL(databaseUrl);
  
  // Create multiple connection attempts with different SSL configurations
  const connectionConfigs = [
    // Config 1: Standard SSL with reject unauthorized false
    {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined, // Skip hostname verification
      },
      connectionTimeoutMillis: 15000,
      query_timeout: 10000,
    },
    // Config 2: SSL disabled for testing
    {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: false,
      connectionTimeoutMillis: 15000,
      query_timeout: 10000,
    },
    // Config 3: SSL with different settings
    {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
        requestCert: false,
        agent: false,
      },
      connectionTimeoutMillis: 15000,
      query_timeout: 10000,
    }
  ];

  let lastError: Error | null = null;
  
  // Try each configuration
  for (let i = 0; i < connectionConfigs.length; i++) {
    const config = connectionConfigs[i];
    let client: any = null;
    
    try {
      console.log(`Attempting connection method ${i + 1}...`);
      
      // Temporarily disable SSL verification for Node.js
      const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      client = new Client(config);
      
      // Set a connection timeout
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Connection timeout (method ${i + 1})`)), 15000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Test the connection
      await client.query('SELECT 1 as test');
      console.log(`Connection method ${i + 1} successful!`);
      
      // If we get here, connection is successful
      const result = await fetchDatabaseInfo(client);
      
      await client.end();
      
      // Restore original SSL setting
      if (originalRejectUnauthorized !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      
      return result;
      
    } catch (error) {
      console.log(`Connection method ${i + 1} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error('Unknown connection error');
      
      if (client) {
        try {
          await client.end();
        } catch (closeError) {
          console.log('Error closing client:', closeError);
        }
      }
      
      // Restore original SSL setting
      const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      if (originalRejectUnauthorized !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
  }
  
  // If all methods failed, throw the last error
  throw lastError || new Error('All connection methods failed');
}

async function fetchDatabaseInfo(client: any) {
  const tablesData: TableData[] = [];
  let totalRows = 0;

  try {
    // Get all table names from public schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tablesResult = await client.query(tablesQuery);
    const tableNames = tablesResult.rows.map((row: any) => row.table_name);

    console.log(`Found ${tableNames.length} tables:`, tableNames);

    if (tableNames.length === 0) {
      return {
        tables: [],
        totalTables: 0,
        totalRows: 0,
        message: 'No tables found in the public schema'
      };
    }

    // Process each table (limit to first 15 for performance)
    const tablesToProcess = tableNames.slice(0, 15);
    
    for (const tableName of tablesToProcess) {
      try {
        console.log(`Processing table: ${tableName}`);
        
        // Get column information
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await client.query(columnsQuery, [tableName]);
        const columns: ColumnInfo[] = columnsResult.rows;

        // Get row count with timeout
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countPromise = client.query(countQuery);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Count query timeout')), 8000)
        );
        
        const countResult = await Promise.race([countPromise, timeoutPromise]) as any;
        const rowCount = parseInt(countResult.rows[0].count);
        totalRows += rowCount;

        // Get sample data (first 50 rows) with timeout
        const dataQuery = `SELECT * FROM "${tableName}" LIMIT 50`;
        const dataPromise = client.query(dataQuery);
        const dataTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Data query timeout')), 8000)
        );
        
        const dataResult = await Promise.race([dataPromise, dataTimeoutPromise]) as any;
        
        tablesData.push({
          name: tableName,
          data: dataResult.rows,
          columns,
          rowCount,
        });

        console.log(`Successfully processed table ${tableName}: ${rowCount} rows, ${columns.length} columns`);

      } catch (error) {
        console.error(`Error processing table ${tableName}:`, error);
        
        // Add table with minimal info even if queries fail
        tablesData.push({
          name: tableName,
          data: [],
          columns: [],
          rowCount: 0,
        });
      }
    }

    return {
      tables: tablesData,
      totalTables: tableNames.length,
      totalRows,
      processedTables: tablesToProcess.length,
      message: tablesToProcess.length < tableNames.length 
        ? `Showing first ${tablesToProcess.length} of ${tableNames.length} tables for performance`
        : undefined
    };

  } catch (error) {
    console.error('Error fetching database info:', error);
    throw new Error(`Failed to fetch database information: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}