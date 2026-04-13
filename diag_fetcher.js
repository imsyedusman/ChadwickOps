const http = require('http');

http.get('http://localhost:3000/api/inspect', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const lowerData = data.toLowerCase();
      console.log("CONTAINS 'baylocation':", lowerData.includes('baylocation'));
      console.log("CONTAINS 'bay location':", lowerData.includes('bay location'));
      console.log("CONTAINS 'reportingcategory':", lowerData.includes('reportingcategory'));
      
      const json = JSON.parse(data);
      console.log("TOTAL ITEMS:", json.result.items.length);
    } catch (e) {
      console.log("RAW DATA:", data.substring(0, 1000));
      console.error("Parse Error:", e.message);
    }
  });
}).on('error', (err) => {
  console.error("Fetch Error:", err.message);
});
