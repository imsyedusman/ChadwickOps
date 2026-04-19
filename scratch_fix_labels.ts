import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/components/dashboard/project-table.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldText = 'drawingSubmittedDate: "Drawing Submitted",';
const newText = `drawingSubmittedDate: "Drawing Submitted",
                          sheetmetalOrderedDate: "S/Metal Ordered",
                          sheetmetalDeliveredDate: "S/Metal Delivered",
                          switchgearOrderedDate: "S/Gear Ordered",
                          switchgearDeliveredDate: "S/Gear Delivered",`;

if (content.includes(oldText)) {
    console.log('Found old text, replacing...');
    content = content.replace(oldText, newText);
    fs.writeFileSync(filePath, content);
    console.log('SUCCESS: Labels updated.');
} else {
    console.error('ERROR: Could not find old text.');
    // Try with single quotes just in case
    const oldTextSingle = "drawingSubmittedDate: 'Drawing Submitted',";
    if (content.includes(oldTextSingle)) {
        console.log('Found old text with single quotes, replacing...');
        content = content.replace(oldTextSingle, newText);
        fs.writeFileSync(filePath, content);
    } else {
        console.log('Sample content around where labels should be:');
        const index = content.indexOf('drawingSubmittedDate');
        if (index !== -1) {
            console.log('"' + content.substring(index - 50, index + 100) + '"');
        }
    }
}
process.exit(0);
