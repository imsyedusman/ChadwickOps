const defaultPreferences = {
  columnVisibility: {
    projectNumber: true,
    itemName: true,
    projectName: true,
    client: true,
    projectManager: true,
    status: true,
    bayLocation: true,
    deliveryDate: true,
    drawingApprovalDate: false,
    drawingSubmittedDate: false,
    budgetHours: true,
    actualHours: true,
    remainingHours: true,
    progressPercent: true,
  },
  theme: 'system',
  filters: {},
  isAdmin: false,
};

function testMerge(saved) {
  const parsed = JSON.parse(saved);
  const mergedColumnVisibility = {
    ...defaultPreferences.columnVisibility,
    ...(parsed.columnVisibility || {})
  };
  
  const final = { 
    ...defaultPreferences, 
    ...parsed,
    columnVisibility: mergedColumnVisibility 
  };
  
  console.log("OLD SAVED:", JSON.stringify(JSON.parse(saved).columnVisibility));
  console.log("NEW MERGED:", JSON.stringify(final.columnVisibility));
  
  const isBayInjected = final.columnVisibility.bayLocation === true;
  console.log("Bay Location Injected:", isBayInjected);
}

// Case 1: Existing user with old preferences (missing bayLocation)
const oldSaved = JSON.stringify({
  columnVisibility: {
    projectNumber: true,
    projectName: true
  }
});

testMerge(oldSaved);
