import * as schema from '@/drizzle/schema';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'dotenv/config';
import postgres from 'postgres';

// Define a safer type for Drizzle tables
type TableWithColumns = {
  _: {
    // Drizzle stores metadata in the _ property
    columns: Record<string, { name: string }>;
  };
};

// SECTION 1: Analyze code schema structure
console.log('🔍 ANALYZING SCHEMA STRUCTURE IN CODE');
console.log('=====================================');

// Get all tables from the schema
const tables = Object.entries(schema)
  .filter(([key, value]) => key.endsWith('Table') && typeof value === 'object')
  .map(([key, value]) => ({ name: key, table: value as TableWithColumns }));

console.log(`Found ${tables.length} tables in schema.ts definition`);

// Extract actual database table names from the schema.ts file
function extractTableNames(): Record<string, string> {
  const schemaPath = path.join(process.cwd(), 'drizzle', 'schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const tableMapping: Record<string, string> = {};

  // Pattern to match export const TableName = pgTable('table_name', {...})
  // And export const TableName = pgTable(table_name, {...}) without quotes
  const pattern = /export\s+const\s+(\w+Table)\s*=\s*pgTable\s*\(\s*['"]?(\w+)['"]?/g;

  let match: RegExpExecArray | null = null;
  while (true) {
    match = pattern.exec(schemaContent);
    if (match === null) break;

    const [, tableName, dbName] = match;
    tableMapping[tableName] = dbName;
  }

  // For tables without an explicit name, default to camelCase of the variable name
  for (const { name } of tables) {
    if (!tableMapping[name]) {
      // Convert PascalCase to snake_case for the default name
      tableMapping[name] = name
        .replace(/Table$/, '')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }
  }

  return tableMapping;
}

// Get the mapping between code table names and actual database table names
const tableNameMapping = extractTableNames();
console.log('\n--- Table Name Mapping ---');
for (const [codeName, dbName] of Object.entries(tableNameMapping)) {
  console.log(`${codeName} => ${dbName}`);
}

// Function to directly extract column names from a table definition in schema.ts
function parseTableColumns(codeName: string): Record<string, string> {
  const schemaPath = path.join(process.cwd(), 'drizzle', 'schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // First try to find the entire table definition block
  const tableBlockRegex = new RegExp(
    `export\\s+const\\s+${codeName}\\s*=\\s*pgTable\\s*\\(\\s*['"]?\\w+['"]?\\s*,\\s*\\{([\\s\\S]*?)\\}\\s*,?\\s*(?:\\([^)]*\\))?\\s*\\)`,
    's',
  );
  const tableBlockMatch = tableBlockRegex.exec(schemaContent);

  if (!tableBlockMatch) {
    console.log(`Warning: Could not find complete table definition for ${codeName}`);

    // Fall back to simpler regex for just the column definitions
    const tableDefRegex = new RegExp(
      `export\\s+const\\s+${codeName}\\s*=\\s*pgTable\\s*\\(\\s*['"]?\\w+['"]?\\s*,\\s*\\{([^\\}]+)\\}`,
      's',
    );
    const tableDefMatch = tableDefRegex.exec(schemaContent);

    if (!tableDefMatch) return {};
    return extractColumnsFromBlock(tableDefMatch[1], codeName);
  }

  return extractColumnsFromBlock(tableBlockMatch[1], codeName);
}

// Extract columns from a table definition block
function extractColumnsFromBlock(
  columnDefSection: string,
  tableName: string,
): Record<string, string> {
  const result: Record<string, string> = {};

  // Common column patterns
  const patterns = [
    // Basic pattern: name: type('db_name')
    { regex: /(\w+)\s*:\s*[^(]+\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // UUID pattern: id: uuid('id').primaryKey().defaultRandom()
    { regex: /(\w+)\s*:\s*uuid\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // Text pattern: name: text('name').notNull()
    { regex: /(\w+)\s*:\s*text\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // Integer pattern: count: integer('count')
    { regex: /(\w+)\s*:\s*integer\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // Boolean pattern: isActive: boolean('is_active')
    { regex: /(\w+)\s*:\s*boolean\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // JSON pattern: data: json('data')
    { regex: /(\w+)\s*:\s*json\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // Timestamp pattern: createdAt: timestamp('created_at')
    { regex: /(\w+)\s*:\s*timestamp\(\s*['"]([^'"]+)['"]/g, jsGroup: 1, dbGroup: 2 },

    // References pattern: userId: integer('user_id').references(() => users.id)
    {
      regex: /(\w+)\s*:\s*\w+\(\s*['"]([^'"]+)['"]\)(?:\.\w+\([^)]*\))*\.references/g,
      jsGroup: 1,
      dbGroup: 2,
    },
  ];

  // Apply each pattern
  for (const pattern of patterns) {
    const { regex, jsGroup, dbGroup } = pattern;
    let match: RegExpExecArray | null = null;

    while ((match = regex.exec(columnDefSection)) !== null) {
      const jsName = match[jsGroup];
      const dbName = match[dbGroup];

      if (!result[jsName]) {
        result[jsName] = dbName;
      }
    }
  }

  // Special handling for standard fields
  if (columnDefSection.includes('createdAt') && !result.createdAt) {
    // Check if explicitly defined or uses the variable
    if (columnDefSection.match(/createdAt\s*,/) || columnDefSection.match(/createdAt\s*:/)) {
      result.createdAt = 'createdAt';
    }
  }

  if (columnDefSection.includes('updatedAt') && !result.updatedAt) {
    if (columnDefSection.match(/updatedAt\s*,/) || columnDefSection.match(/updatedAt\s*:/)) {
      result.updatedAt = 'updatedAt';
    }
  }

  // Table-specific additional columns based on the schema comments
  if (tableName === 'ScheduleAvailabilityTable') {
    if (!result.startTime) result.startTime = 'startTime';
    if (!result.endTime) result.endTime = 'endTime';
    if (!result.dayOfWeek) result.dayOfWeek = 'dayOfWeek';
  }

  if (tableName === 'MeetingTable') {
    const meetingColumns = [
      'clerkUserId',
      'guestEmail',
      'guestName',
      'guestNotes',
      'startTime',
      'endTime',
      'timezone',
      'meetingUrl',
      'stripePaymentIntentId',
      'stripeSessionId',
      'stripePaymentStatus',
      'stripeAmount',
      'stripeApplicationFeeAmount',
      'stripeApplicationFeeId',
      'stripeRefundId',
      'stripeMetadata',
      'lastProcessedAt',
      'stripeTransferId',
      'stripeTransferAmount',
      'stripeTransferStatus',
      'stripeTransferScheduledAt',
      'stripePayoutId',
      'stripePayoutAmount',
      'stripePayoutFailureCode',
      'stripePayoutFailureMessage',
      'stripePayoutPaidAt',
    ];

    for (const col of meetingColumns) {
      if (!result[col]) {
        result[col] = col.replace(/([A-Z])/g, (match, p1) =>
          col.startsWith('stripe') && p1.match(/[A-Z]/)
            ? `${'_' + p1.toLowerCase()}`
            : p1.toLowerCase(),
        );
      }
    }
  }

  if (tableName === 'RecordTable') {
    const recordColumns = [
      'expertId',
      'guestEmail',
      'encryptedContent',
      'encryptedMetadata',
      'lastModifiedAt',
      'createdAt',
      'version',
    ];

    for (const col of recordColumns) {
      if (!result[col]) {
        result[col] = col.replace(/([A-Z])/g, '_$1').toLowerCase();
      }
    }
  }

  if (tableName === 'ProfileTable') {
    if (!result.isVerified) result.isVerified = 'isVerified';
    if (!result.isTopExpert) result.isTopExpert = 'isTopExpert';
    if (!result.order) result.order = 'order';
  }

  return result;
}

// List of columns to ignore when calculating duplication
const ignoredColumns = ['id', 'createdAt', 'updatedAt'];

// Find columns that appear in multiple tables (potential duplication)
const columnOccurrences: Record<string, string[]> = {};

for (const { name } of tables) {
  // Parse columns from schema file
  const columns = parseTableColumns(name);

  for (const [colName] of Object.entries(columns)) {
    // Skip common columns that are expected to appear in multiple tables
    if (ignoredColumns.includes(colName)) continue;

    if (!columnOccurrences[colName]) {
      columnOccurrences[colName] = [];
    }
    columnOccurrences[colName].push(name);
  }
}

console.log('\n--- Potentially duplicated columns ---');
for (const [column, tables] of Object.entries(columnOccurrences)) {
  if (tables.length > 1) {
    console.log(`Column "${column}" appears in tables: ${tables.join(', ')}`);
  }
}

// Check for inconsistent naming patterns
console.log('\n--- Inconsistent naming patterns ---');
const camelCaseColumns = new Set<string>();
const snake_case_columns = new Set<string>();

// Use object destructuring to only get the keys, ignoring the values
const columnNames = Object.keys(columnOccurrences);
for (const column of columnNames) {
  if (column.includes('_')) {
    snake_case_columns.add(column);
  } else if (/[a-z][A-Z]/.test(column)) {
    camelCaseColumns.add(column);
  }
}

if (camelCaseColumns.size > 0 && snake_case_columns.size > 0) {
  console.log('Mixed naming conventions detected:');
  console.log('camelCase columns:', Array.from(camelCaseColumns).join(', '));
  console.log('snake_case columns:', Array.from(snake_case_columns).join(', '));
}

// List of common columns to ignore in mismatch reports
const commonAutoGeneratedColumns = [
  'created_at',
  'updated_at',
  'createdat',
  'updatedat',
  'createdAt',
  'updatedAt',
];

// SECTION 2: Compare with actual database (if DATABASE_URL is set)
console.log('\n\n🔍 COMPARING WITH ACTUAL DATABASE');
console.log('==================================');

async function compareWithDatabase() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log('⚠️ DATABASE_URL not set. Skipping database comparison.');
      return;
    }

    // Connect to the database
    console.log('Connecting to Neon database...');
    const client = postgres(process.env.DATABASE_URL);

    // Get all tables in the database
    const dbTables = await client.unsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const dbTableNames = dbTables.map((t) => t.table_name);
    console.log(`Found ${dbTableNames.length} tables in actual database`);

    // Tables in code but not in database
    const tablesInCodeNotInDb = [];

    for (const [codeName, dbName] of Object.entries(tableNameMapping)) {
      if (!dbTableNames.includes(dbName)) {
        tablesInCodeNotInDb.push(`${codeName} (expected db name: ${dbName})`);
      }
    }

    if (tablesInCodeNotInDb.length > 0) {
      console.log('\n⚠️ Tables defined in code but not found in database:');
      for (const name of tablesInCodeNotInDb) {
        console.log(`- ${name}`);
      }
    } else {
      console.log('\n✅ All tables defined in code exist in the database');
    }

    // Tables in database but not in code
    const dbTableNamesInCode = Object.values(tableNameMapping);
    const tablesInDbNotInCode = dbTableNames.filter((dbName) => {
      return (
        !dbTableNamesInCode.includes(dbName) &&
        dbName !== 'drizzle_migrations' &&
        dbName !== 'audit_logs'
      );
    });

    if (tablesInDbNotInCode.length > 0) {
      console.log('\n⚠️ Tables in database but not defined in code:');
      for (const name of tablesInDbNotInCode) {
        console.log(`- ${name}`);
      }
    } else {
      console.log('\n✅ All database tables are defined in code');
    }

    // Check column consistency for each table in code
    console.log('\n--- Checking column consistency ---');
    for (const [codeName, dbName] of Object.entries(tableNameMapping)) {
      if (!dbTableNames.includes(dbName)) {
        continue; // Skip tables not in DB
      }

      // Parse columns from schema file for this table
      const codeColumns = parseTableColumns(codeName);

      // Filter out index columns which aren't actual columns but table metadata
      const filteredCodeColumns: Record<string, string> = {};
      for (const [jsName, dbColName] of Object.entries(codeColumns)) {
        // Skip index columns that end with "Index" or contain the word "index"
        if (jsName.endsWith('Index') || jsName.includes('Index')) {
          continue;
        }
        filteredCodeColumns[jsName] = dbColName;
      }

      // Display the columns we found in code for debugging
      console.log(`\n📋 Table ${codeName} (${dbName}): Found columns in code:`);
      for (const [jsName, dbColName] of Object.entries(filteredCodeColumns)) {
        console.log(`- ${jsName} => ${dbColName}`);
      }

      // Get columns from database
      const dbColumns = await client.unsafe(
        `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
        [dbName],
      );

      const dbColumnNames = dbColumns.map((c) => c.column_name);

      // Try to normalize column names for better comparison (handle camelCase vs snake_case)
      const normalizedDbColumnNames = dbColumnNames.map((name) =>
        name.toLowerCase().replace(/_/g, ''),
      );

      // Create mapping for normalized names
      const normalizedToOriginal: Record<string, string> = {};
      for (const name of dbColumnNames) {
        normalizedToOriginal[name.toLowerCase().replace(/_/g, '')] = name;
      }

      // Columns in code but not in database (with improved matching)
      const columnsInCodeNotInDb = [];
      for (const [jsName, dbColName] of Object.entries(filteredCodeColumns)) {
        // Check direct match
        if (dbColumnNames.includes(dbColName)) {
          continue;
        }

        // Check case-insensitive and without underscores
        const normalizedColName = dbColName.toLowerCase().replace(/_/g, '');
        if (normalizedDbColumnNames.includes(normalizedColName)) {
          continue;
        }

        // Skip common automatically generated columns to reduce noise
        if (commonAutoGeneratedColumns.includes(dbColName.toLowerCase())) {
          continue;
        }

        // If we get here, it's truly missing
        columnsInCodeNotInDb.push(`${jsName} (db: ${dbColName})`);
      }

      if (columnsInCodeNotInDb.length > 0) {
        console.log(`\n⚠️ Table ${codeName} (${dbName}): Columns in code but not in database:`);
        for (const col of columnsInCodeNotInDb) {
          console.log(`- ${col}`);
        }
      }

      // Columns in database but not in code (with improved matching)
      const columnsInDbNotInCode = [];
      const codeDbColNames = Object.values(filteredCodeColumns);
      const normalizedCodeDbColNames = codeDbColNames.map((name) =>
        name.toLowerCase().replace(/_/g, ''),
      );

      for (const dbColumn of dbColumnNames) {
        // Check direct match
        if (codeDbColNames.includes(dbColumn)) {
          continue;
        }

        // Check case-insensitive and without underscores
        const normalizedColName = dbColumn.toLowerCase().replace(/_/g, '');
        if (normalizedCodeDbColNames.includes(normalizedColName)) {
          continue;
        }

        // Skip common automatically generated columns to reduce noise
        if (commonAutoGeneratedColumns.includes(dbColumn.toLowerCase())) {
          continue;
        }

        // If we get here, it's truly missing
        columnsInDbNotInCode.push(dbColumn);
      }

      if (columnsInDbNotInCode.length > 0) {
        console.log(`\n⚠️ Table ${codeName} (${dbName}): Columns in database but not in code:`);
        for (const col of columnsInDbNotInCode) {
          console.log(`- ${col}`);
        }
      }
    }

    await client.end();
    console.log('\n✅ Database schema comparison completed');
  } catch (error) {
    console.error('Error connecting to database:', error);
    console.log('⛔ Could not compare with database due to connection error');
  }
}

// Run the database comparison
compareWithDatabase().catch(console.error);
