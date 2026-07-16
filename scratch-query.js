const postgres = require('postgres');
const sql = postgres('postgresql://wip-user:Developer%402k26!@localhost:5432/wip-db');

async function run() {
  const res1 = await sql`
    SELECT COUNT(*) as null_sm_delivered
    FROM projects
    WHERE raw_status IN ('1.3 - Drawings Approved', '2.1 - Sheetmetal and switchgear ordrered', '2.2 - In Progress', 'In Progress', 'Waiting to Start', '2.3 - Ready for Testing', '2.4 - Tested Defective', 'On Hold', '2.5 - Tested Passed', '2.6 - Ready for Invoicing')
      AND sheetmetal_delivered_date IS NULL
      AND is_archived = false
      AND project_type IS NOT NULL
      AND project_number NOT LIKE '99%'
  `;
  console.log('Count:', res1);

  const res2 = await sql`
    SELECT project_number, name, raw_status, sheetmetal_delivered_date, switchgear_delivered_date
    FROM projects
    WHERE raw_status IN ('1.3 - Drawings Approved', '2.1 - Sheetmetal and switchgear ordrered', '2.2 - In Progress', 'In Progress', 'Waiting to Start', '2.3 - Ready for Testing', '2.4 - Tested Defective', 'On Hold', '2.5 - Tested Passed', '2.6 - Ready for Invoicing')
      AND sheetmetal_delivered_date IS NULL
      AND is_archived = false
      AND project_type IS NOT NULL
      AND project_number NOT LIKE '99%'
    LIMIT 10
  `;
  console.log('Sample:', res2);

  process.exit(0);
}

run();
