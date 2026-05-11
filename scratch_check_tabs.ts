import { getProcurementDashboardData, getBackordersData, getSupplierRiskData } from "@/app/actions/procurement";
import { ProcurementSummaryCards } from "@/components/procurement/ProcurementSummaryCards";
import { ProcurementProjectList } from "@/components/procurement/ProcurementProjectList";
import { BackorderTable } from "@/components/procurement/BackorderTable";
import { SupplierRiskTable } from "@/components/procurement/SupplierRiskTable";
import { ProcurementSyncStatus } from "@/components/dashboard/ProcurementSyncStatus";
import { Info, HelpCircle, LayoutGrid, Package, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// I need a Tabs component if it doesn't exist. I'll check first.
// Wait, I'll check if tabs exist in src/components/ui.
