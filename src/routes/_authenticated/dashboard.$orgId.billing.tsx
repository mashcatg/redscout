import { createFileRoute } from "@tanstack/react-router";
import { BillingPortal } from "@/components/BillingPortal";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/billing")({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <BillingPortal />
    </div>
  );
}
