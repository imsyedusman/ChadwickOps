const fs = require('fs');
try {
  const content = fs.readFileSync('diag_result.json', 'utf16le');
  const data = JSON.parse(content);
  const sample = data.result.items[0];
  console.log("Keys in project object:", Object.keys(sample));
  console.log("Custom Fields:", JSON.stringify(sample.customFields, null, 2));
} catch (e) {
  try {
    const content = fs.readFileSync('diag_result.json', 'utf8');
    const data = JSON.parse(content);
    const sample = data.result.items[0];
    console.log("Keys in project object:", Object.keys(sample));
    console.log("Custom Fields:", JSON.stringify(sample.customFields, null, 2));
  } catch (e2) {
    console.error("Failed to parse:", e2.message);
  }
}
