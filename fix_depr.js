const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'frontend/src/utils/statementTemplateStructure.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// Check if depreciationCostOfSales exists
const hasDepr = data.income_statement.some(item => item.key === 'depreciationCostOfSales');

if (!hasDepr) {
  // Find where to insert it, maybe after inventoryWriteDown or costOfServices
  const idx = data.income_statement.findIndex(item => item.key === 'costOfServices');
  if (idx !== -1) {
    data.income_statement.splice(idx + 1, 0, {
      label: "Depreciation (Cost of Sales)",
      key: "depreciationCostOfSales",
      section: "Revenue",
      is_subtotal: false,
      level: 3
    });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.log("Added depreciationCostOfSales to template structure.");
  }
} else {
  console.log("depreciationCostOfSales already exists.");
}
