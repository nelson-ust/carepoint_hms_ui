import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClaim,
  getClaimsSummary,
  listClaims,
  listPatientInsurance,
  listProviders,
  submitAppeal,
  submitClaim,
  withdrawClaim,
  type ClaimListFilters,
  type CreateClaimPayload,
  type SubmitAppealPayload,
} from "../api/insurance.api";

export const insuranceKeys = {
  all: ["insurance"] as const,
  claims: () => [...insuranceKeys.all, "claims"] as const,
  claimList: (filters: ClaimListFilters) => [...insuranceKeys.claims(), filters] as const,
  claim: (id: number) => [...insuranceKeys.all, "claim", id] as const,
  providers: () => [...insuranceKeys.all, "providers"] as const,
  patientPolicies: (patientId: number) =>
    [...insuranceKeys.all, "patient-policies", patientId] as const,
  summary: () => [...insuranceKeys.all, "summary"] as const,
};

export function useClaims(filters: ClaimListFilters = {}) {
  return useQuery({
    queryKey: insuranceKeys.claimList(filters),
    queryFn: () => listClaims(filters),
  });
}

export function useClaimsSummary() {
  return useQuery({
    queryKey: insuranceKeys.summary(),
    queryFn: getClaimsSummary,
  });
}

export function useInsuranceProviders() {
  return useQuery({
    queryKey: insuranceKeys.providers(),
    queryFn: listProviders,
    staleTime: 5 * 60 * 1000,
  });
}

/** A patient's insurance policies — enabled only once a patient is selected. */
export function usePatientInsurancePolicies(patientId: number | null) {
  return useQuery({
    queryKey: insuranceKeys.patientPolicies(patientId ?? 0),
    queryFn: () => listPatientInsurance(patientId as number),
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClaimPayload) => createClaim(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
    },
  });
}

export function useSubmitClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, notes }: { claimId: number; notes?: string }) =>
      submitClaim(claimId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
    },
  });
}

export function useWithdrawClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, reason }: { claimId: number; reason?: string }) =>
      withdrawClaim(claimId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
    },
  });
}

export function useSubmitAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitAppealPayload) => submitAppeal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.all });
    },
  });
}
