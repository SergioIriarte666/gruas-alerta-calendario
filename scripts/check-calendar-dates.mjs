import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Explicit calendar fields. Timestamps (created_at, movement_date, tracking GPS)
// intentionally are not in this list: they must retain their absolute instant.
const fields = /^(date|serviceDate|service_date|requestDate|request_date|issueDate|issue_date|dueDate|due_date|paymentDate|payment_date|paid_date|expiryDate|expiry_date|expiration_date|exam_expiry|technicalReviewExpiry|insuranceExpiry|circulationPermitExpiry|custodyStartDate|custodyEndDate|scheduled_date|completed_date|price_date|purchase_date|dateFrom|dateTo)$/;
const violations = [];
function isCalendarArgument(node) {
  if (ts.isNonNullExpression(node)) return isCalendarArgument(node.expression);
  if (ts.isIdentifier(node)) return fields.test(node.text);
  if (ts.isPropertyAccessExpression(node)) return fields.test(node.name.text);
  if (ts.isStringLiteral(node)) return /^\d{4}-\d{2}-\d{2}$/.test(node.text);
  return false;
}
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '__tests__') scan(file); continue; }
    if (!/\.tsx?$/.test(file) || /(?:calendarDate|businessClock|timezoneUtils)\.ts$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const report = (node, reason) => violations.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${reason}`);
    function visit(node) {
      if (ts.isNewExpression(node) && node.expression.getText(ast) === 'Date' && node.arguments?.length === 1 && isCalendarArgument(node.arguments[0])) {
        report(node, 'Calendar field passed to new Date: use parseDateValue or preserve YYYY-MM-DD.');
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['slice', 'split', 'substring'].includes(node.expression.name.text)) {
        const receiver = node.expression.expression;
        if (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) && receiver.expression.name.text === 'toISOString') {
          // logger extracts only the time for diagnostics, never a document date.
          if (file !== 'src/lib/logger.ts') report(node, 'Do not derive a calendar date by slicing a UTC timestamp.');
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toISOString' && isCalendarArgument(node.expression.expression)) {
        report(node, 'Calendar field serialized as UTC: use calendarDateString or businessClock.toTimestamp for timestamp columns.');
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
scan('src');
if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
else console.log('Calendar date contract: no unsafe date-field constructors or UTC date serialization.');
