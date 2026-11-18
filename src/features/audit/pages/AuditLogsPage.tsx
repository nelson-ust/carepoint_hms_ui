import { useState } from "react";
import { AuditLogView } from "../components/AuditLogView";
import { useTenantAuditLogs } from "../hooks/use-audit";
import type { AuditQuery } from "../api/audit.api";

export function AuditLogsPage() {
  const [query, setQuery] = useState<AuditQuery>({ limit: 50, offset: 0 });
  const { data, isLoading, isFetching } = useTenantAuditLogs(query);

  return (
    <AuditLogView
      crumbs={[{ label: "Administration" }, { label: "Audit Logs" }]}
      title="Audit Logs"
      subtitle="Every create, update, delete and sign-in across your workspace."
      variant="tenant"
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      query={query}
      setQuery={setQuery}
    />
  );
}

export default AuditLogsPage;
