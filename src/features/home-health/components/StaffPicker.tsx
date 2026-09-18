import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import {
  listDoctors,
  getStaffProfileByUserId,
} from "@/features/doctor-calendar/api/doctor-calendar.api";

/**
 * Picks a staff member and resolves the underlying staff_profile_id
 * (home-health APIs key caregivers on staff_profile_id, but the staff
 * listing exposes user ids — resolve on select, like the appointment flow).
 */
export function StaffPicker({
  label = "Caregiver / staff",
  value,
  onChange,
  includeBlank = true,
  disabled,
}: {
  label?: string;
  value: number | null;
  onChange: (staffProfileId: number | null, name?: string) => void;
  includeBlank?: boolean;
  disabled?: boolean;
}) {
  const staffQuery = useQuery({
    queryKey: ["home-health", "staff-list"],
    queryFn: () => listDoctors({ limit: 300 }),
    staleTime: 5 * 60_000,
  });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [resolving, setResolving] = useState(false);

  const staff = staffQuery.data ?? [];

  const handle = async (userIdStr: string) => {
    setSelectedUserId(userIdStr);
    if (!userIdStr) {
      onChange(null);
      return;
    }
    const u = staff.find((s) => String(s.id) === userIdStr);
    const name = u ? `${u.first_name} ${u.last_name}`.trim() || u.username : undefined;
    try {
      setResolving(true);
      const profile = await getStaffProfileByUserId(Number(userIdStr));
      onChange(profile?.id ?? null, name);
    } catch {
      onChange(null, name);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Select
      label={label}
      value={selectedUserId}
      disabled={disabled || staffQuery.isLoading}
      hint={resolving ? "Resolving staff profile…" : undefined}
      onChange={(e) => void handle(e.target.value)}
      options={[
        ...(includeBlank ? [{ value: "", label: "Unassigned" }] : []),
        ...staff.map((s) => ({
          value: String(s.id),
          label: `${s.first_name} ${s.last_name}`.trim() || s.username,
        })),
      ]}
    />
  );
}
