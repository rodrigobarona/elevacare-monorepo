/**
 * Script to remove MDX page metadata from messages/*.json files
 * These metadata are now stored directly in MDX files using Next.js 16 native approach
 */
import fs from 'fs';
import path from 'path';

const locales = ['en', 'es', 'pt', 'br'];

// Keys to remove from messages
const keysToRemove = ['AboutPage', 'HistoryPage', 'TrustPage', 'LegalPage'];

locales.forEach((locale) => {
  const filePath = path.join(process.cwd(), `src/messages/${locale}.json`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = JSON.parse(content);

    // Remove the keys
    keysToRemove.forEach((key) => {
      if (messages[key]) {
        delete messages[key];
        console.log(`✓ Removed ${key} from ${locale}.json`);
      }
    });

    // Write back to file with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2) + '\n', 'utf-8');
    console.log(`✓ Updated ${locale}.json`);
  } catch (error) {
    console.error(`✗ Error processing ${locale}.json:`, error);
  }
});

console.log('\n✓ Cleanup complete! MDX page metadata removed from messages files.');
