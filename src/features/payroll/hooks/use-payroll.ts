import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  submitPayrollForApproval,
  calculatePayrollRun,
  createPayrollRun,
  getPayrollConfig,
  listPayrollLines,
  listPayrollRuns,
  lockPayrollRun,
  payPayrollRun,
  listSalaryGrades,
  createSalaryGrade,
  listSalarySteps,
  createSalaryStep,
  createAllowanceType,
  createDeductionType,
  createStatutoryConfig,
  listStaffSalaries,
  setStaffSalary,
  type CreatePayrollRunPayload,
  type CreateSalaryGradePayload,
  type CreateSalaryStepPayload,
  type CreateAllowanceTypePayload,
  type CreateDeductionTypePayload,
  type CreateStatutoryConfigPayload,
  type SetStaffSalaryPayload,
  type PayrollRunStatus,
} from "../api/payroll.api";

export const payrollKeys = {
  all: ["payroll"] as const,
  runs: () => [...payrollKeys.all, "runs"] as const,
  runList: (filters: { run_status?: PayrollRunStatus }) =>
    [...payrollKeys.runs(), filters] as const,
  lines: (runId: number) => [...payrollKeys.all, "lines", runId] as const,
  config: () => [...payrollKeys.all, "config"] as const,
  grades: () => [...payrollKeys.all, "grades"] as const,
  steps: (gradeId?: number) => [...payrollKeys.all, "steps", gradeId ?? "all"] as const,
  salaries: () => [...payrollKeys.all, "salaries"] as const,
};

export function usePayrollRuns(params: { run_status?: PayrollRunStatus } = {}) {
  return useQuery({
    queryKey: payrollKeys.runList(params),
    queryFn: () => listPayrollRuns(params),
  });
}

export function usePayrollLines(runId: number | undefined) {
  return useQuery({
    queryKey: payrollKeys.lines(runId ?? 0),
    queryFn: () => listPayrollLines(runId as number),
    enabled: typeof runId === "number" && runId > 0,
  });
}

export function usePayrollConfig() {
  return useQuery({
    queryKey: payrollKeys.config(),
    queryFn: () => getPayrollConfig(),
  });
}

function useInvalidateRuns() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
  };
}

export function useCreatePayrollRun() {
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (payload: CreatePayrollRunPayload) => createPayrollRun(payload),
    onSuccess: invalidate,
  });
}

export function useCalculatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => calculatePayrollRun(runId),
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
      queryClient.invalidateQueries({ queryKey: payrollKeys.lines(runId) });
    },
  });
}

export function useSubmitPayrollForApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => submitPayrollForApproval(runId),
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
      queryClient.invalidateQueries({ queryKey: payrollKeys.lines(runId) });
    },
  });
}

export function useLockPayrollRun() {
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (runId: number) => lockPayrollRun(runId),
    onSuccess: invalidate,
  });
}


// ---------- Lookups: grades / steps ----------

export function useSalaryGrades() {
  return useQuery({ queryKey: payrollKeys.grades(), queryFn: listSalaryGrades });
}

export function useSalarySteps(gradeId?: number) {
  return useQuery({
    queryKey: payrollKeys.steps(gradeId),
    queryFn: () => listSalarySteps(gradeId),
  });
}

export function useCreateSalaryGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateSalaryGradePayload) => createSalaryGrade(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.grades() }),
  });
}

export function useCreateSalaryStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateSalaryStepPayload) => createSalaryStep(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...payrollKeys.all, "steps"] }),
  });
}

// ---------- Lookups: allowance / deduction / statutory ----------

export function useCreateAllowanceType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateAllowanceTypePayload) => createAllowanceType(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.config() }),
  });
}

export function useCreateDeductionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateDeductionTypePayload) => createDeductionType(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.config() }),
  });
}

export function useCreateStatutoryConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateStatutoryConfigPayload) => createStatutoryConfig(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.config() }),
  });
}

// ---------- Staff salary mapping ----------

export function useStaffSalaries() {
  return useQuery({ queryKey: payrollKeys.salaries(), queryFn: listStaffSalaries, retry: 1 });
}

export function useSetStaffSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SetStaffSalaryPayload) => setStaffSalary(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.salaries() }),
  });
}

// ---------- Run: pay ----------

export function usePayPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => payPayrollRun(runId),
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.runs() });
      queryClient.invalidateQueries({ queryKey: payrollKeys.lines(runId) });
    },
  });
}
