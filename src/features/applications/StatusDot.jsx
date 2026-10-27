import { STATUS_COLORS } from "@/lib/constants";

// Small color swatch for a status; the ring keeps the pale colors visible on white
export default function StatusDot({ status }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  );
}
