import { useState } from "react";
import { AuditLogView } from "../components/AuditLogView";
import { useSaasAuditLogs } from "../hooks/use-audit";
import type { AuditQuery } from "../api/audit.api";

export function SaaSAuditLogsPage() {
  const [query, setQuery] = useState<AuditQuery>({ limit: 50, offset: 0 });
  const { data, isLoading, isFetching } = useSaasAuditLogs(query);

  return (
    <AuditLogView
      crumbs={[{ label: "SaaS admin" }, { label: "Audit Logs" }]}
      title="Platform Audit Logs"
      subtitle="Every platform operation and SaaS-admin sign-in across the master database."
      variant="saas"
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      query={query}
      setQuery={setQuery}
    />
  );
}

export default SaaSAuditLogsPage;
