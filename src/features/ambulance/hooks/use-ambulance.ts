import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ambulanceApi } from "../api/ambulance.api";
import type { 
  CreateAmbulancePayload, 
  UpdateAmbulancePayload, 
  CreateDriverPayload,
  UpdateDriverPayload
} from "../api/ambulance.api";

export const ambulanceKeys = {
  all: ["ambulances"] as const,
  lists: () => [...ambulanceKeys.all, "list"] as const,
  list: (filters: any) => [...ambulanceKeys.lists(), filters] as const,
  details: () => [...ambulanceKeys.all, "detail"] as const,
  detail: (id: number) => [...ambulanceKeys.details(), id] as const,
  readiness: (id: number) => [...ambulanceKeys.detail(id), "readiness"] as const,
  drivers: () => [...ambulanceKeys.all, "drivers"] as const,
  equipment: (ambulanceId: number) => [...ambulanceKeys.detail(ambulanceId), "equipment"] as const,
  maintenance: (ambulanceId: number) => [...ambulanceKeys.detail(ambulanceId), "maintenance"] as const,
};

export function useAmbulances(params: { skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ambulanceKeys.list(params),
    queryFn: () => ambulanceApi.list(params),
  });
}

export function useAmbulance(id: number) {
  return useQuery({
    queryKey: ambulanceKeys.detail(id),
    queryFn: () => ambulanceApi.get(id),
    enabled: !!id,
  });
}

export function useAmbulanceReadiness(id: number) {
  return useQuery({
    queryKey: ambulanceKeys.readiness(id),
    queryFn: () => ambulanceApi.getReadiness(id),
    enabled: !!id,
  });
}

export function useCreateAmbulance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAmbulancePayload) => ambulanceApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.lists() });
    },
  });
}

export function useUpdateAmbulance(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAmbulancePayload) => ambulanceApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.detail(id) });
    },
  });
}

export function useAmbulanceDrivers() {
  return useQuery({
    queryKey: ambulanceKeys.drivers(),
    queryFn: () => ambulanceApi.listDrivers(),
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDriverPayload) => ambulanceApi.createDriver(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.drivers() });
    },
  });
}

export function useUpdateDriver(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDriverPayload) => ambulanceApi.updateDriver(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ambulanceKeys.drivers() });
    },
  });
}
