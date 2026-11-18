import { useState, useEffect } from "react";
import {
  ArchiveRestore,
  Database,
  Download,
  Play,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  DxPage,
  DxPageHeader,
  DxPanel,
  DxBadge,
  DxButton,
  DxGrid,
  DxInput,
  DxCheckbox,
  DxPopup,
  DxMessage,
  type DxGridColumn,
  type DxBadgeTone,
} from "@/components/dx";
import { backupsApi, type Backup, type BackupSummary } from "../api/backups.api";
import { resolveTenantCode } from "@/lib/tenant/tenant-resolver";

// Download responses are Blobs (responseType: "blob"), so an error body also
// arrives as a Blob — read + parse it to recover the backend's message.
async function extractErrorMessage(err: any, fallback: string): Promise<string> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json?.message || json?.detail || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || data?.detail || fallback;
}

function statusTone(status: string): DxBadgeTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "FAILED":
      return "danger";
    default:
      return "warning";
  }
}

export function DatabaseBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // Restore flow
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [safetyBackup, setSafetyBackup] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  // Delete / cleanup flow
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tenantCode = resolveTenantCode() || "";
  const canConfirmRestore =
    tenantCode.length > 0 &&
    confirmText.trim().toUpperCase() === tenantCode.trim().toUpperCase();

  // Feedback modal state
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    message: "",
    type: "success" as "success" | "error",
  });

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await backupsApi.getDashboard();
      setBackups(data.backups || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error("Backup load error:", err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      if (!err?.response) {
        setError("Cannot reach the API server. Check that the backend is running, then retry.");
      } else if (status === 401 || status === 403) {
        setError(
          serverMsg ||
            "You don't have permission to view backups (requires BACKUP_READ). Ask your administrator to grant it via Roles & Permissions.",
        );
      } else {
        setError(serverMsg || "The backup service returned an error. Please retry, and contact support if it persists.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsTriggering(true);
    try {
      await backupsApi.trigger();
      setModalConfig({
        title: "Backup Initiated",
        message:
          "The system has successfully started a manual database snapshot. This recovery point will appear in the registry once processing is complete.",
        type: "success",
      });
      setShowModal(true);
      await load();
    } catch (err: any) {
      setModalConfig({
        title: "Backup Failed",
        message:
          err.response?.data?.message ||
          "The system was unable to trigger a manual backup. Please verify your administrative permissions and storage availability.",
        type: "error",
      });
      setShowModal(true);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const { blob, filename } = await backupsApi.download(id);
      // Name the saved file after the record, with the .enc wrapper stripped —
      // the server already strips it, this is just a resilient fallback.
      const record = backups.find((b) => b.id === id);
      const fallbackName = (record?.filename || `backup_${id}.dump`).replace(/\.enc$/i, "");
      const name = filename || fallbackName;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download error", err);
      const message = await extractErrorMessage(err, "The backup file could not be retrieved.");
      setModalConfig({ title: "Download Failed", message, type: "error" });
      setShowModal(true);
    }
  };

  const openRestore = (bk: Backup) => {
    setRestoreTarget(bk);
    setConfirmText("");
    setSafetyBackup(true);
  };

  const handleRestore = async () => {
    if (!restoreTarget || !canConfirmRestore) return;
    setIsRestoring(true);
    try {
      const res = await backupsApi.restore(restoreTarget.id, {
        confirm_tenant_code: confirmText.trim(),
        safety_backup: safetyBackup,
      });
      setRestoreTarget(null);
      setConfirmText("");
      setModalConfig({
        title: "Restore Complete",
        message:
          `The database was restored from ${res.filename || "the selected backup"}` +
          `${res.safety_backup_id ? " (a safety snapshot was saved first)" : ""}.` +
          ` Completed in ${(res.duration_ms / 1000).toFixed(1)}s.`,
        type: "success",
      });
      setShowModal(true);
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "The restore could not be completed.";
      setModalConfig({ title: "Restore Failed", message, type: "error" });
      setShowModal(true);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await backupsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "The recovery point could not be deleted.";
      setDeleteTarget(null);
      setModalConfig({ title: "Delete Failed", message, type: "error" });
      setShowModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const columns: DxGridColumn<Backup>[] = [
    {
      key: "filename",
      header: "Recovery Point",
      render: (bk) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-[var(--dx-text)]">{bk.filename}</span>
            <span className="text-[11px] text-[var(--dx-text-muted)]">
              {new Date(bk.date_created).toLocaleString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      render: (bk) => (
        <span className="text-[13px] font-semibold text-[var(--dx-text)]">{formatSize(bk.size_bytes)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (bk) => (
        <DxBadge tone={statusTone(bk.status)} dot>
          {bk.status}
        </DxBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (bk) => (
        <div className="flex items-center justify-end gap-1">
          {bk.status === "FAILED" && bk.error_message ? (
            <DxButton
              icon
              size="sm"
              variant="text"
              title="View failure details"
              onClick={() => {
                setModalConfig({
                  title: "Backup Failed",
                  message: bk.error_message || "This backup failed.",
                  type: "error",
                });
                setShowModal(true);
              }}
            >
              <AlertCircle />
            </DxButton>
          ) : null}
          <DxButton
            icon
            size="sm"
            variant="text"
            title="Download"
            disabled={bk.status !== "COMPLETED"}
            onClick={() => handleDownload(bk.id)}
          >
            <Download />
          </DxButton>
          <DxButton
            icon
            size="sm"
            variant="outline-danger"
            title="Restore from this backup"
            disabled={bk.status !== "COMPLETED"}
            onClick={() => openRestore(bk)}
          >
            <ArchiveRestore />
          </DxButton>
          <DxButton
            icon
            size="sm"
            variant="text"
            title="Delete recovery point"
            onClick={() => setDeleteTarget(bk)}
          >
            <Trash2 />
          </DxButton>
        </div>
      ),
    },
  ];

  return (
    <DxPage>
      <DxPageHeader
        crumbs={[{ label: "Settings" }, { label: "Backups" }]}
        title="System Backups"
        subtitle="Automated database snapshots and manual recovery points."
        actions={
          <>
            <DxButton icon title="Refresh" onClick={load} isLoading={isLoading}>
              <RotateCcw />
            </DxButton>
            <DxButton
              variant="primary"
              onClick={handleTriggerBackup}
              isLoading={isTriggering}
              leftIcon={<Play className="h-4 w-4" />}
            >
              {isTriggering ? "Initializing…" : "Trigger manual backup"}
            </DxButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Backup health */}
        <div className="space-y-4 lg:col-span-1">
          <DxPanel>
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--dx-accent-soft)] text-[var(--dx-accent)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <div className="dx-skeleton h-6 w-40" />
                <div className="dx-skeleton h-4 w-full" />
              </div>
            ) : (
              <>
                <h4 className="text-[17px] font-bold text-[var(--dx-text)]">
                  Health: {summary?.health_status ?? "—"}
                </h4>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--dx-text-muted)]">
                  {summary?.health_description ?? "Backup health information is unavailable."}
                </p>
                <div className="mt-6 space-y-5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                      Last Backup
                    </span>
                    <span className="text-[13px] font-bold text-[var(--dx-text)]">
                      {summary?.last_backup_at ? new Date(summary.last_backup_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dx-text-muted)]">
                      Retention Policy
                    </span>
                    <span className="text-[13px] font-bold text-[var(--dx-text)]">
                      {summary?.retention_policy ?? "—"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </DxPanel>

          <DxPanel>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dx-success-soft)] text-[var(--dx-success)]">
              <HardDrive className="h-6 w-6" />
            </div>
            <h4 className="text-[15px] font-bold text-[var(--dx-text)]">Storage Usage</h4>
            {isLoading ? (
              <div className="dx-skeleton mt-2 h-8 w-28" />
            ) : (
              <p className="mt-1 text-[26px] font-bold tracking-tight text-[var(--dx-success)]">
                {summary ? `${summary.storage_usage_gb.toLocaleString()} GB` : "—"}
              </p>
            )}
            <p className="mt-1 text-[12px] text-[var(--dx-text-muted)]">
              {summary
                ? `Used across ${summary.recovery_points_count.toLocaleString()} recovery point${summary.recovery_points_count === 1 ? "" : "s"}`
                : "Recovery point information unavailable"}
            </p>
          </DxPanel>
        </div>

        {/* Backup history */}
        <div className="space-y-5 lg:col-span-3">
          {error ? (
            <DxMessage
              tone="danger"
              title="Couldn't load backups"
              action={
                <DxButton size="sm" variant="danger" onClick={load}>
                  Retry
                </DxButton>
              }
            >
              {error}
              <span className="mt-1 block text-[11px] font-semibold uppercase tracking-widest">
                Workspace: {resolveTenantCode() || "—"}
              </span>
            </DxMessage>
          ) : null}

          <DxPanel flush>
            <DxGrid
              columns={columns}
              data={backups}
              rowKey={(bk) => bk.id}
              isLoading={isLoading}
              borderless
              empty={{
                icon: Database,
                title: "No Recovery Points",
                description: "Historical snapshots will appear here.",
              }}
            />
          </DxPanel>
        </div>
      </div>

      {/* Restore confirmation */}
      <DxPopup
        isOpen={restoreTarget !== null}
        onClose={() => !isRestoring && setRestoreTarget(null)}
        title="Restore database from backup"
        size="md"
        locked={isRestoring}
        footer={
          <>
            <DxButton onClick={() => setRestoreTarget(null)} disabled={isRestoring}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              onClick={handleRestore}
              isLoading={isRestoring}
              disabled={!canConfirmRestore}
              leftIcon={<ArchiveRestore className="h-4 w-4" />}
            >
              Restore now
            </DxButton>
          </>
        }
      >
        <div className="space-y-4">
          <DxMessage tone="danger" title="This overwrites the live database">
            Restoring from{" "}
            <strong>{(restoreTarget?.filename || "").replace(/\.enc$/i, "")}</strong>
            {restoreTarget?.date_created
              ? ` (${new Date(restoreTarget.date_created).toLocaleString()})`
              : ""}{" "}
            replaces all current data for this hospital. It cannot be undone except by restoring
            another backup.
          </DxMessage>
          <DxCheckbox
            label="Take a safety snapshot of the current database first"
            description="Recommended — lets you roll back if this restore was a mistake."
            checked={safetyBackup}
            onChange={(e) => setSafetyBackup(e.target.checked)}
          />
          <DxInput
            label={`Type the workspace code to confirm${tenantCode ? ` (${tenantCode})` : ""}`}
            mono
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={tenantCode || "workspace code"}
          />
        </div>
      </DxPopup>

      {/* Delete confirmation */}
      <DxPopup
        isOpen={deleteTarget !== null}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Delete recovery point"
        size="sm"
        locked={isDeleting}
        footer={
          <>
            <DxButton onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </DxButton>
            <DxButton
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </DxButton>
          </>
        }
      >
        <DxMessage
          tone={deleteTarget?.status === "COMPLETED" ? "danger" : "warning"}
          title={deleteTarget?.status === "COMPLETED" ? "This deletes a completed backup" : "Remove this recovery point"}
        >
          {deleteTarget?.status === "COMPLETED" ? (
            <>
              Deleting <strong>{(deleteTarget?.filename || "").replace(/\.enc$/i, "")}</strong> permanently
              removes this recovery point and its stored artifact. You will no longer be able to
              restore from it.
            </>
          ) : (
            <>
              Remove <strong>{(deleteTarget?.filename || "").replace(/\.enc$/i, "")}</strong>
              {deleteTarget?.status ? ` (${deleteTarget.status.toLowerCase()})` : ""} from the registry.
              This clears the entry and any stored artifact.
            </>
          )}
        </DxMessage>
      </DxPopup>

      {/* Feedback modal */}
      <DxPopup
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalConfig.title}
        size="sm"
        footer={
          <DxButton
            variant={modalConfig.type === "success" ? "primary" : "danger"}
            onClick={() => setShowModal(false)}
          >
            Acknowledge
          </DxButton>
        }
      >
        <DxMessage tone={modalConfig.type === "success" ? "success" : "danger"} title={modalConfig.title}>
          {modalConfig.message}
        </DxMessage>
      </DxPopup>
    </DxPage>
  );
}
