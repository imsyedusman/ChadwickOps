import fs from 'fs';

async function findProjectWithBayLocation() {
    try {
        let content = fs.readFileSync('diag_result_utf8.json', 'utf8');
        const data = JSON.parse(content);
        
        const projects = data.result?.items || [];
        console.log(`Searching through ${projects.length} projects...`);
        
        const targetId = 8925; // BayLocation
        const found = projects.filter(p => 
            p.customFieldValues?.some(v => v.customFieldId === targetId && v.value !== null && v.value !== '')
        );
        
        console.log(`Found ${found.length} projects with BayLocation data in LIST API.`);
        found.slice(0, 5).forEach(p => {
            const val = p.customFieldValues.find(v => v.customFieldId === targetId).value;
            console.log(`- ${p.projectNo} (ID: ${p.id}): "${val}"`);
        });

    } catch (e) {
        console.error(e);
    }
}

findProjectWithBayLocation();
