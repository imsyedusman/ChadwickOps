const fs = require('fs');
try {
  const content = fs.readFileSync('diag_result_v2.json', 'utf8');
  const data = JSON.parse(content);
  const sample = data.result.items[0];
  console.log("Full Keys in project object:", Object.keys(sample));
  // Look for any key that might be custom fields or have BayLocation in it
  for (const key of Object.keys(sample)) {
    if (key.toLowerCase().includes('bay') || key.toLowerCase().includes('custom')) {
      console.log(`Found relevant key: ${key} =`, sample[key]);
    }
  }
  
  // Also check if any other item has custom fields
  for (const item of data.result.items) {
    if (item.customFields) {
        console.log("Found project with customFields:", item.projectNo);
        console.log(JSON.stringify(item.customFields, null, 2));
        break;
    }
  }
} catch (e) {
  console.error("Failed to parse:", e.message);
}
