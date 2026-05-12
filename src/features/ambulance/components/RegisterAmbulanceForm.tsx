import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Truck, Shield, AlertTriangle } from "lucide-react";
import { useCreateAmbulance } from "../hooks/use-ambulance";

const ambulanceSchema = z.object({
  code: z.string().min(3, "Code is required"),
  plate_number: z.string().min(5, "Plate number is required"),
  manufacturer: z.string().min(2, "Manufacturer is required"),
  model: z.string().min(2, "Model is required"),
  year: z.preprocess((val) => Number(val), z.number().min(1900).max(new Date().getFullYear())),
  current_mileage: z.preprocess((val) => Number(val), z.number().min(0)),
});

type AmbulanceFormValues = z.infer<typeof ambulanceSchema>;

interface RegisterAmbulanceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function RegisterAmbulanceForm({ onSuccess, onCancel }: RegisterAmbulanceFormProps) {
  const { mutate, isPending } = useCreateAmbulance();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AmbulanceFormValues>({
    resolver: zodResolver(ambulanceSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      current_mileage: 0,
    }
  });

  const onSubmit = (data: AmbulanceFormValues) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Vehicle Code</label>
          <input
            {...register("code")}
            className={`w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium ${errors.code ? 'ring-2 ring-rose-500/50' : ''}`}
            placeholder="e.g. AMB-001"
          />
          {errors.code && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.code.message}</p>}
        </div>
        
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Plate Number</label>
          <input
            {...register("plate_number")}
            className={`w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium ${errors.plate_number ? 'ring-2 ring-rose-500/50' : ''}`}
            placeholder="e.g. ABC-123-XY"
          />
          {errors.plate_number && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.plate_number.message}</p>}
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Manufacturer</label>
          <input
            {...register("manufacturer")}
            className={`w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium ${errors.manufacturer ? 'ring-2 ring-rose-500/50' : ''}`}
            placeholder="e.g. Toyota"
          />
          {errors.manufacturer && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.manufacturer.message}</p>}
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Model</label>
          <input
            {...register("model")}
            className={`w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium ${errors.model ? 'ring-2 ring-rose-500/50' : ''}`}
            placeholder="e.g. Hiace"
          />
          {errors.model && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.model.message}</p>}
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Year</label>
          <input
            type="number"
            {...register("year")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-xs font-bold text-secondary-500 uppercase tracking-widest ml-1">Initial Mileage (KM)</label>
          <input
            type="number"
            {...register("current_mileage")}
            className="w-full bg-secondary-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-primary-500/50 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-6 border-t border-secondary-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-8 py-4 rounded-2xl bg-secondary-100 text-secondary-600 text-sm font-bold hover:bg-secondary-200 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-3 px-8 py-4 rounded-2xl bg-primary-500 text-white text-sm font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
          <span>{isPending ? 'Registering...' : 'Register Ambulance'}</span>
        </button>
      </div>
    </form>
  );
}
