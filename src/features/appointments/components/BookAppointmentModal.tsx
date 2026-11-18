import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Search, UserRound } from "lucide-react";
import { DxPopup, DxButton, DxInput, DxSelect, DxTextarea } from "@/components/dx";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/api/api-error";
import { searchPatients } from "@/features/patients/api/patients.api";
import {
  listDoctors,
  getStaffProfileByUserId,
} from "@/features/doctor-calendar/api/doctor-calendar.api";
import { listActiveServiceDeliveryPoints } from "@/features/service-delivery-points/api/service-delivery-points.api";
import { appointmentsApi } from "../api/appointments.api";

type PickedPatient = { id: number; name: string; hospital_number?: string };

const DURATIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "", label: "No end time" },
];

export function BookAppointmentModal({
  isOpen,
  onClose,
  onBooked,
}: {
  isOpen: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [doctorUserId, setDoctorUserId] = useState("");
  const [sdpId, setSdpId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setPatient(null);
      setDate("");
      setTime("");
      setDuration("30");
      setDoctorUserId("");
      setSdpId("");
      setReason("");
    }
  }, [isOpen]);

  const searchQuery = useQuery({
    queryKey: ["patient-search", query],
    queryFn: () => searchPatients(query),
    enabled: isOpen && query.trim().length >= 2 && !patient,
  });
  const results = ((searchQuery.data as any)?.items ??
    (Array.isArray(searchQuery.data) ? searchQuery.data : [])) as any[];

  const doctorsQuery = useQuery({
    queryKey: ["appointment-doctors"],
    queryFn: () => listDoctors({ limit: 300 }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });
  const sdpQuery = useQuery({
    queryKey: ["appointment-sdps"],
    queryFn: () => listActiveServiceDeliveryPoints({ limit: 200 }),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const doctorOptions = [
    { value: "", label: "No specific clinician" },
    ...(doctorsQuery.data ?? []).map((d) => ({
      value: String(d.id),
      label: `${d.first_name} ${d.last_name}`.trim() || d.username,
    })),
  ];
  const sdpOptions = [
    { value: "", label: "No service point" },
    ...(((sdpQuery.data as any)?.items ?? []) as any[]).map((s) => ({
      value: String(s.id),
      label: s.name,
    })),
  ];

  const canSubmit = !!patient && !!date && !!time;

  const book = useMutation({
    mutationFn: async () => {
      const start = new Date(`${date}T${time}`);
      const startIso = start.toISOString();
      let endIso: string | undefined;
      if (duration) {
        const end = new Date(start.getTime() + Number(duration) * 60_000);
        endIso = end.toISOString();
      }

      // The appointment API keys the clinician on staff_profile_id, but the
      // doctor picker lists user ids — resolve it on submit (best-effort).
      let staffProfileId: number | undefined;
      if (doctorUserId) {
        try {
          const profile = await getStaffProfileByUserId(Number(doctorUserId));
          staffProfileId = profile?.id;
        } catch {
          staffProfileId = undefined;
        }
      }

      return appointmentsApi.book({
        patient_id: patient!.id,
        scheduled_start_at: startIso,
        scheduled_end_at: endIso ?? null,
        staff_profile_id: staffProfileId ?? null,
        service_delivery_point_id: sdpId ? Number(sdpId) : null,
        reason: reason.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Appointment booked", `Scheduled for ${patient?.name}.`);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onBooked();
      onClose();
    },
    onError: (err) =>
      toast.error("Couldn't book appointment", apiErrorMessage(err, "Please review the details and try again.")),
  });

  return (
    <DxPopup
      isOpen={isOpen}
      onClose={onClose}
      title="Book an appointment"
      size="lg"
      locked={book.isPending}
      footer={
        <>
          <DxButton onClick={onClose} disabled={book.isPending}>
            Cancel
          </DxButton>
          <DxButton
            variant="primary"
            onClick={() => book.mutate()}
            isLoading={book.isPending}
            disabled={!canSubmit}
            leftIcon={<CalendarPlus className="h-4 w-4" />}
          >
            Book appointment
          </DxButton>
        </>
      }
    >
      <div className="space-y-5">
        {/* Patient picker */}
        {patient ? (
          <div className="flex items-center justify-between rounded-md border border-[var(--dx-accent)] bg-[var(--dx-accent-soft)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--dx-surface)] text-[var(--dx-accent)]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--dx-text)]">{patient.name}</p>
                {patient.hospital_number ? (
                  <p className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{patient.hospital_number}</p>
                ) : null}
              </div>
            </div>
            <DxButton variant="text" size="sm" onClick={() => setPatient(null)}>
              Change
            </DxButton>
          </div>
        ) : (
          <div>
            <label className="dx-field-label mb-1.5 block">Patient <span className="dx-required">*</span></label>
            <DxInput
              leftIcon={<Search className="h-3.5 w-3.5" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient by name…"
            />
            {query.trim().length >= 2 ? (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-[var(--dx-border)]">
                {searchQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-[12px] text-[var(--dx-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-[12px] font-medium text-[var(--dx-text-muted)]">No patients found.</p>
                ) : (
                  results.slice(0, 10).map((p) => {
                    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || `Patient #${p.id}`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setPatient({ id: p.id, name, hospital_number: p.hospital_number })
                        }
                        className="flex w-full items-center justify-between border-b border-[var(--dx-border)] px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-[var(--dx-surface-sunken)]"
                      >
                        <span className="text-[13px] font-semibold text-[var(--dx-text)]">{name}</span>
                        {p.hospital_number ? (
                          <span className="dx-mono text-[11px] text-[var(--dx-text-muted)]">{p.hospital_number}</span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Date / time / duration */}
        <div className="grid gap-4 sm:grid-cols-3">
          <DxInput label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <DxInput label="Time" required type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <DxSelect
            label="Duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            options={DURATIONS}
          />
        </div>

        {/* Clinician / service point */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DxSelect
            label="Clinician (optional)"
            value={doctorUserId}
            onChange={(e) => setDoctorUserId(e.target.value)}
            options={doctorOptions}
            disabled={doctorsQuery.isLoading}
          />
          <DxSelect
            label="Service point (optional)"
            value={sdpId}
            onChange={(e) => setSdpId(e.target.value)}
            options={sdpOptions}
            disabled={sdpQuery.isLoading}
          />
        </div>

        <DxTextarea
          label="Reason (optional)"
          placeholder="e.g. Follow-up consultation"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
      </div>
    </DxPopup>
  );
}
