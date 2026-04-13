const fs = require('fs');
try {
  const content = fs.readFileSync('diag_result_v2.json', 'utf8');
  const data = JSON.parse(content);
  const sample = data.result.items[0];
  console.log("Keys in project object:", Object.keys(sample));
  console.log("Custom Fields:", JSON.stringify(sample.customFields, null, 2));
} catch (e) {
  console.error("Failed to parse:", e.message);
}
