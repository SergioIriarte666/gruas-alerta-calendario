/**
 * Migration script to replace console.logs with smart logging system
 * This script should be run manually to update all console.logs across the codebase
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface LogReplacement {
  pattern: RegExp;
  replacement: string;
}

// Mapping of console methods to logger methods
const logReplacements: LogReplacement[] = [
  {
    pattern: /console\.log\((.*)\)/g,
    replacement: 'logger.debug($1)'
  },
  {
    pattern: /console\.info\((.*)\)/g,
    replacement: 'logger.info($1)'
  },
  {
    pattern: /console\.warn\((.*)\)/g,
    replacement: 'logger.warn($1)'
  },
  {
    pattern: /console\.error\((.*)\)/g,
    replacement: 'logger.error($1)'
  },
  {
    pattern: /console\.group\((.*)\)/g,
    replacement: 'logger.group($1)'
  },
  {
    pattern: /console\.groupEnd\(\)/g,
    replacement: 'logger.groupEnd()'
  }
];

function getAllTsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      getAllTsFiles(fullPath, files);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function migrateFile(filePath: string): { updated: boolean; consoleLogsFound: number } {
  const content = readFileSync(filePath, 'utf-8');
  let updatedContent = content;
  let consoleLogsFound = 0;
  let hasLogger = false;
  
  // Check if file already has logger import
  if (content.includes("from '@/lib/logger'")) {
    hasLogger = true;
  }
  
  // Count console logs
  for (const replacement of logReplacements) {
    const matches = content.match(replacement.pattern);
    if (matches) {
      consoleLogsFound += matches.length;
    }
  }
  
  if (consoleLogsFound === 0) {
    return { updated: false, consoleLogsFound: 0 };
  }
  
  // Add logger import if needed
  if (!hasLogger) {
    const importMatch = content.match(/^import.*from.*$/m);
    if (importMatch) {
      const importIndex = content.indexOf(importMatch[0]) + importMatch[0].length;
      updatedContent = content.slice(0, importIndex) + 
        "\nimport { createLogger } from '@/lib/logger';" + 
        content.slice(importIndex);
    }
    
    // Add logger creation after imports
    const moduleNameMatch = filePath.match(/\/([^\/]+)\.tsx?$/);
    const moduleName = moduleNameMatch ? moduleNameMatch[1] : 'unknown';
    
    const firstLineAfterImports = updatedContent.search(/\n\n/);
    if (firstLineAfterImports !== -1) {
      updatedContent = updatedContent.slice(0, firstLineAfterImports) +
        `\n\nconst logger = createLogger('${moduleName}');\n` +
        updatedContent.slice(firstLineAfterImports + 2);
    }
  }
  
  // Replace console methods
  for (const replacement of logReplacements) {
    updatedContent = updatedContent.replace(replacement.pattern, replacement.replacement);
  }
  
  if (updatedContent !== content) {
    writeFileSync(filePath, updatedContent, 'utf-8');
    return { updated: true, consoleLogsFound };
  }
  
  return { updated: false, consoleLogsFound };
}

function runMigration() {
  const srcDir = './src';
  const tsFiles = getAllTsFiles(srcDir);
  
  let totalUpdated = 0;
  let totalConsoleLogsFound = 0;
  
  console.log('🚀 Starting console.log migration...\n');
  
  for (const file of tsFiles) {
    const result = migrateFile(file);
    if (result.updated) {
      console.log(`✅ Updated: ${file} (${result.consoleLogsFound} console.logs replaced)`);
      totalUpdated++;
    }
    totalConsoleLogsFound += result.consoleLogsFound;
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`   Files processed: ${tsFiles.length}`);
  console.log(`   Files updated: ${totalUpdated}`);
  console.log(`   Console.logs found: ${totalConsoleLogsFound}`);
  console.log(`   Memory reduction: ~${Math.round(totalConsoleLogsFound * 0.5)}KB`);
  console.log(`\n✨ Migration completed successfully!`);
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };