import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStaff, staffDisplayName, type Staff } from "../api/staff.api";

export const staffKeys = {
  all: ["staff"] as const,
  list: () => [...staffKeys.all, "list"] as const,
};

/** Full staff directory (used for id → name lookups across HR/payroll pages). */
export function useStaffDirectory() {
  return useQuery({
    queryKey: staffKeys.list(),
    queryFn: () => getStaff(0, 1000),
    staleTime: 5 * 60 * 1000,
  });
}

/** Convenience map of staff_profile_id → display name. */
export function useStaffNameMap(): {
  nameMap: Map<number, string>;
  staff: Staff[];
  isLoading: boolean;
} {
  const { data, isLoading } = useStaffDirectory();
  const staff = useMemo(() => data ?? [], [data]);
  const nameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of staff) map.set(s.id, staffDisplayName(s));
    return map;
  }, [staff]);
  return { nameMap, staff, isLoading };
}
