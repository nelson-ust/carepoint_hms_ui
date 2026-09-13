import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/surgery.api";

export const surgeryKeys = {
  all: ["surgery"] as const,
  worklist: (f: Record<string, unknown>) => [...surgeryKeys.all, "worklist", f] as const,
  case: (id: number) => [...surgeryKeys.all, "case", id] as const,
  theatres: (f: Record<string, unknown>) => [...surgeryKeys.all, "theatres", f] as const,
  procedures: (f: Record<string, unknown>) => [...surgeryKeys.all, "procedures", f] as const,
  instruments: (f: Record<string, unknown>) => [...surgeryKeys.all, "instruments", f] as const,
  team: (id: number) => [...surgeryKeys.all, "team", id] as const,
  consents: (id: number) => [...surgeryKeys.all, "consents", id] as const,
  checklists: (id: number) => [...surgeryKeys.all, "checklists", id] as const,
  anaesthesia: (id: number) => [...surgeryKeys.all, "anaesthesia", id] as const,
  notes: (id: number) => [...surgeryKeys.all, "notes", id] as const,
};

// ── Worklist / cases ──────────────────────────────────────
export function useSurgicalWorklist(
  params: { statuses?: string[]; operating_theatre_id?: number; emergency_only?: boolean } = {},
) {
  return useQuery({
    queryKey: surgeryKeys.worklist(params),
    queryFn: () => api.getSurgicalWorklist({ ...params, limit: 300 }),
  });
}

export function useSurgicalCase(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.case(caseId ?? 0),
    queryFn: () => api.getCase(caseId as number),
    enabled: !!caseId,
  });
}

// ── Reference data ────────────────────────────────────────
export function useTheatres(params: { status?: string; emergency_only?: boolean; search?: string } = {}) {
  return useQuery({
    queryKey: surgeryKeys.theatres(params),
    queryFn: () => api.listTheatres({ ...params, limit: 200 }),
    staleTime: 60 * 1000,
  });
}

export function useProcedures(params: { search?: string } = {}) {
  return useQuery({
    queryKey: surgeryKeys.procedures(params),
    queryFn: () => api.listProcedures({ ...params, limit: 300 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInstrumentSets(params: { sterilization_status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: surgeryKeys.instruments(params),
    queryFn: () => api.listInstrumentSets({ ...params, limit: 300 }),
  });
}

// ── Per-case sub-resources ────────────────────────────────
export function useCaseTeam(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.team(caseId ?? 0),
    queryFn: () => api.listTeam(caseId as number),
    enabled: !!caseId,
  });
}
export function useCaseConsents(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.consents(caseId ?? 0),
    queryFn: () => api.listConsents(caseId as number),
    enabled: !!caseId,
  });
}
export function useCaseChecklists(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.checklists(caseId ?? 0),
    queryFn: () => api.listChecklists(caseId as number),
    enabled: !!caseId,
  });
}
export function useCaseAnaesthesia(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.anaesthesia(caseId ?? 0),
    queryFn: () => api.listAnaesthesia(caseId as number),
    enabled: !!caseId,
  });
}
export function useCaseNotes(caseId: number | null) {
  return useQuery({
    queryKey: surgeryKeys.notes(caseId ?? 0),
    queryFn: () => api.listNotes(caseId as number),
    enabled: !!caseId,
  });
}

// ── Invalidation helper ───────────────────────────────────
export function useInvalidateSurgery() {
  const qc = useQueryClient();
  return (caseId?: number) => {
    qc.invalidateQueries({ queryKey: [...surgeryKeys.all, "worklist"] });
    if (caseId) {
      qc.invalidateQueries({ queryKey: surgeryKeys.case(caseId) });
      qc.invalidateQueries({ queryKey: surgeryKeys.team(caseId) });
      qc.invalidateQueries({ queryKey: surgeryKeys.consents(caseId) });
      qc.invalidateQueries({ queryKey: surgeryKeys.checklists(caseId) });
      qc.invalidateQueries({ queryKey: surgeryKeys.anaesthesia(caseId) });
      qc.invalidateQueries({ queryKey: surgeryKeys.notes(caseId) });
    }
  };
}
