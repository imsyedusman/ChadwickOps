import { getProductionSchedulingData } from "./src/app/actions/production-scheduling";

async function run() {
  process.env.BYPASS_AUTH_FOR_TEST = "true";
  try {
    const res = await getProductionSchedulingData();
    if (res.success) {
      console.log(`Action now returns ${res.data.projects.length} projects.`);
    } else {
      console.error("Action failed:", res);
    }
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

run();
