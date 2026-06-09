import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllUsers } from "@/lib/admin.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const fn = useServerFn(listAllUsers);
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fn() });
  const [filter, setFilter] = useState("");

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    );
  }
  const rows = (q.data ?? []).filter((u) =>
    !filter || u.email.toLowerCase().includes(filter.toLowerCase()) || (u.name ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Input placeholder="Search by email or name…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <span className="text-xs text-muted-foreground">{rows.length} users</span>
      </div>
      <div className="border border-border rounded overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Orgs</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.name ?? "—"}</TableCell>
                <TableCell><span className="text-xs px-1.5 py-0.5 rounded bg-muted uppercase">{u.plan}</span></TableCell>
                <TableCell>{u.roles.join(", ") || "—"}</TableCell>
                <TableCell className="text-right">{u.org_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
