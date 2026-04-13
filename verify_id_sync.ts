import { SyncService } from "./src/lib/sync";
import fs from 'fs';

async function verifyIdSync() {
  console.log("=== VERIFYING ID-BASED MAPPING ===");

  // Create a dummy SyncService
  const syncService = new SyncService('dummy', 'dummy');

  // Load a real response from previous diagnostics if available, or create a mock
  let mockRemote: any;
  if (fs.existsSync('diag_deep_response.json')) {
      const content = fs.readFileSync('diag_deep_response.json', 'utf8');
      mockRemote = JSON.parse(content);
      console.log("Loaded real response from diag_deep_response.json");
  } else {
      mockRemote = {
        customFieldValues: [
            { customFieldId: 8925, value: "Bay 42" },
            { customFieldId: 9450, value: "2024-05-20" },
            { customFieldId: 9451, value: "20/05/2024" }
        ]
      };
      console.log("Using mock response data.");
  }

  // Manually add the target values to ensure we test the mapping even if the file had nulls
  if (mockRemote.customFieldValues) {
      if (!mockRemote.customFieldValues.some((v: any) => v.customFieldId === 8925)) {
          mockRemote.customFieldValues.push({ customFieldId: 8925, value: "Verification-Bay" });
      } else {
          mockRemote.customFieldValues.find((v: any) => v.customFieldId === 8925).value = "Verification-Bay";
      }
      
      if (!mockRemote.customFieldValues.some((v: any) => v.customFieldId === 9450)) {
          mockRemote.customFieldValues.push({ customFieldId: 9450, value: "2024-12-25" });
      } else {
          mockRemote.customFieldValues.find((v: any) => v.customFieldId === 9450).value = "2024-12-25";
      }
  }

  console.log("\nTesting getCustomFieldValue with deterministic keys:");
  
  const bay = syncService['getCustomFieldValue'](mockRemote, 'BayLocation');
  console.log(`- BayLocation (expected Verification-Bay): "${bay}"`);
  
  const approval = syncService['getCustomFieldValue'](mockRemote, 'ClientDrawingApprovalDate');
  console.log(`- Drawing Approval Date (expected 2024-12-25): "${approval}"`);

  const submitted = syncService['getCustomFieldValue'](mockRemote, 'DrawingSubmittedDate');
  console.log(`- Drawing Submitted Date: "${submitted}"`);

  if (bay === "Verification-Bay" && approval === "2024-12-25") {
      console.log("\nSUCCESS: Deterministic mapping verified!");
  } else {
      console.log("\nFAILURE: Mapping results do not match expected values.");
  }
}

verifyIdSync();
