import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Search, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
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
    <Modal isOpen={isOpen} onClose={onClose} title="Book an appointment" size="lg">
      <div className="space-y-5">
        {/* Patient picker */}
        {patient ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary-200 bg-primary-500/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-secondary-900">{patient.name}</p>
                {patient.hospital_number ? (
                  <p className="data-mono text-[11px] text-secondary-400">{patient.hospital_number}</p>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-secondary-500">
              Patient *
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient by name…"
                className="w-full rounded-2xl border border-secondary-300 bg-white/60 py-3 pl-11 pr-4 text-sm outline-none focus:border-primary-500 dark:bg-white/5"
              />
            </div>
            {query.trim().length >= 2 ? (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-secondary-200 dark:border-white/10">
                {searchQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-xs text-secondary-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs font-medium text-secondary-400">No patients found.</p>
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
                        className="flex w-full items-center justify-between border-b border-secondary-100 px-4 py-2.5 text-left last:border-0 hover:bg-primary-500/5 dark:border-white/5"
                      >
                        <span className="text-sm font-semibold text-secondary-800 dark:text-secondary-100">
                          {name}
                        </span>
                        {p.hospital_number ? (
                          <span className="data-mono text-[11px] text-secondary-400">{p.hospital_number}</span>
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
          <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time *" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Select
            label="Duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            options={DURATIONS}
          />
        </div>

        {/* Clinician / service point */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Clinician (optional)"
            value={doctorUserId}
            onChange={(e) => setDoctorUserId(e.target.value)}
            options={doctorOptions}
            disabled={doctorsQuery.isLoading}
          />
          <Select
            label="Service point (optional)"
            value={sdpId}
            onChange={(e) => setSdpId(e.target.value)}
            options={sdpOptions}
            disabled={sdpQuery.isLoading}
          />
        </div>

        <Textarea
          label="Reason (optional)"
          placeholder="e.g. Follow-up consultation"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={book.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => book.mutate()}
            isLoading={book.isPending}
            disabled={!canSubmit}
            leftIcon={<CalendarPlus className="h-4 w-4" />}
          >
            Book appointment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
