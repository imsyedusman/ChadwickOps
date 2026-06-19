export const dynamic = 'force-dynamic';

import { getWorkshopArrivals, getWorkshopInProgress, getWorkshopDepartures } from "@/app/actions/workshop";
import WorkshopBoard from "./_components/WorkshopBoard";
import { db } from "@/db";
import { syncLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function WorkshopPage() {
    const arrivals = await getWorkshopArrivals();
    const inProgress = await getWorkshopInProgress();
    const departures = await getWorkshopDepartures();

    const latestSync = await db.query.syncLogs.findFirst({
        orderBy: [desc(syncLogs.timestamp)],
    });

    const lastUpdatedText = latestSync 
        ? new Date(latestSync.timestamp).toLocaleString('en-AU', {
            timeZone: 'Australia/Sydney',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        : "Never";

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-50">
            <WorkshopBoard 
                arrivals={arrivals} 
                inProgress={inProgress} 
                departures={departures} 
                lastUpdatedText={lastUpdatedText}
            />
        </div>
    );
}
