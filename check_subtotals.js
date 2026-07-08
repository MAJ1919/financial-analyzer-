const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'frontend/src/utils/statementTemplateStructure.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

const calcPath = path.join(__dirname, 'frontend/src/utils/calculations.js');
const calcCode = fs.readFileSync(calcPath, 'utf8');

// Find all setVal calls
const setValRegex = /setVal\(['"]([^'"]+)['"]/g;
const calculatedKeys = new Set();
let match;
while ((match = setValRegex.exec(calcCode)) !== null) {
  calculatedKeys.add(match[1]);
}

console.log('--- Uncalculated Subtotals / Headers ---');

['income_statement', 'balance_sheet'].forEach(type => {
  console.log(`\nChecking ${type}...`);
  data[type].forEach(item => {
    if ((item.is_subtotal || item.is_header) && !calculatedKeys.has(item.key)) {
      console.log(`- ${item.label} (${item.key}) is marked as subtotal/header but NOT calculated in calculations.js`);
    }
  });
});
