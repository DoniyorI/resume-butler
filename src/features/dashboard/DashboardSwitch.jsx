import ViewSwitch from "@/components/shared/ViewSwitch";

const VIEWS = [
  { href: "/dash", label: "Classic" },
  { href: "/dash/new", label: "New (shadcn)" },
];

// Temporary switch for comparing the two dashboards; remove once one is chosen
export default function DashboardSwitch({ current }) {
  return <ViewSwitch views={VIEWS} current={current} />;
}
