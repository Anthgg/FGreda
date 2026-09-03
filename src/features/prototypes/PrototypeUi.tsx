import type { ReactNode } from "react";

import type { PrototypeApproval, PrototypeStatus } from "@/types/prototypes";
import { approvalLabel, statusLabel } from "@/features/prototypes/prototypeLabels";

export function PrototypeBadge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "green" | "amber" | "red" | "blue" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export const StatusBadge = ({ status }: { status: PrototypeStatus }) => (
  <PrototypeBadge tone={status === "COMPLETED" ? "green" : status === "STARTED" ? "blue" : status === "CANCELLED" ? "red" : "zinc"}>
    {statusLabel[status]}
  </PrototypeBadge>
);

export const ApprovalBadge = ({ approval }: { approval: PrototypeApproval }) => (
  <PrototypeBadge tone={approval === "APPROVED" ? "green" : approval === "REJECTED" ? "red" : "amber"}>
    {approvalLabel[approval]}
  </PrototypeBadge>
);

export function Alert({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "green" | "amber" }) {
  const style = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700";
  return <p role={tone === "red" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${style}`}>{children}</p>;
}

