const fs = require('fs');
let content = fs.readFileSync('diag_result.json', 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
const data = JSON.parse(content);
const projectsWithFields = data.result.items.filter(p => p.customFieldValues && p.customFieldValues.length > 0);
console.log(`Found ${projectsWithFields.length} projects with custom fields.`);
if (projectsWithFields.length > 0) {
    projectsWithFields.slice(0, 3).forEach(p => {
        console.log(`- ${p.projectNo} (ID: ${p.id}): ${p.customFieldValues.length} fields`);
    });
}
