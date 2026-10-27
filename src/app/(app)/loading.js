import { DashboardSkeleton } from "@/components/shared/PageSkeletons";

// The dashboard (/) and any page in (app) without its own loading.js
export default function AppLoading() {
  return <DashboardSkeleton />;
}
