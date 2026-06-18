export const dynamic = 'force-dynamic';

import { getWorkshopArrivals, getWorkshopInProgress, getWorkshopDepartures } from "@/app/actions/workshop";
import WorkshopBoard from "./_components/WorkshopBoard";

export default async function WorkshopPage() {
    const arrivals = await getWorkshopArrivals();
    const inProgress = await getWorkshopInProgress();
    const departures = await getWorkshopDepartures();

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-50">
            <WorkshopBoard 
                arrivals={arrivals} 
                inProgress={inProgress} 
                departures={departures} 
            />
        </div>
    );
}
