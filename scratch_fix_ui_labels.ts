import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/components/dashboard/project-table.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix Labels Map
// Using a slightly more flexible search to handle potential whitespace variations
const labelsStartRegex = /const\s+labels:\s+Record<string,\s+string>\s+=\s+\{/;
const labelsEndText = 'progressPercent: "Progress %"';

// Rebuild the whole labels object to ensure it's clean and consistent
const newLabelsBlock = `const labels: Record<string, string> = {
                          projectNumber: "Project ID",
                          itemName: "Item",
                          projectName: "Project Name",
                          client: "Client",
                          projectManager: "Manager",
                          status: "Status",
                          bayLocation: "Bay Location",
                          deliveryDate: "Due Date",
                          drawingApprovalDate: "Drawing Approval",
                          drawingSubmittedDate: "Drawing Submitted",
                          sheetmetalOrderedDate: "SM Ordered",
                          sheetmetalDeliveredDate: "SM Delivered",
                          switchgearOrderedDate: "SG Ordered",
                          switchgearDeliveredDate: "SG Delivered",
                          budgetHours: "Budget",
                          actualHours: "Actual",
                          remainingHours: "Remaining",
                          progressPercent: "Progress %"`;

// Find labels block and replace
const startMatch = content.match(labelsStartRegex);
if (startMatch) {
    const startIndex = startMatch.index;
    const endIndex = content.indexOf(labelsEndText, startIndex);
    if (endIndex !== -1) {
        const fullEndIndex = endIndex + labelsEndText.length;
        content = content.substring(0, startIndex) + newLabelsBlock + content.substring(fullEndIndex);
        console.log('SUCCESS: Labels map updated.');
    } else {
        console.error('ERROR: Could not find end of labels block.');
    }
} else {
    console.error('ERROR: Could not find start of labels block.');
}

// 2. Fix Header Text
content = content.replace('S/Metal Ordered', 'SM Ordered');
content = content.replace('S/Metal Delivered', 'SM Delivered');
content = content.replace('S/Gear Ordered', 'SG Ordered');
content = content.replace('S/Gear Delivered', 'SG Delivered');

// 3. Fix Cell rendering (already correct as it uses keys, but ensure match if needed)
// Actually, cell rendering is fine as it just uses project[key].

fs.writeFileSync(filePath, content);
console.log('SUCCESS: UI labels and headers updated.');
process.exit(0);
