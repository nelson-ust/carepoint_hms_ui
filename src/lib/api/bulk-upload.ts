import { apiClient } from "./api-client";

export type BulkUploadRowError = { row?: number | null; message: string };

export type BulkUploadResult = {
  success: boolean;
  message: string;
  total_rows: number;
  created: number;
  failed: number;
  errors: BulkUploadRowError[];
};

async function hydrateBlobError(err: any): Promise<any> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await data.text());
    } catch {
      /* ignore */
    }
  }
  return err;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download an .xlsx template from `url` and save it as `filename`. */
export async function downloadTemplate(url: string, filename: string): Promise<void> {
  let response;
  try {
    response = await apiClient.get(url, { responseType: "blob" });
  } catch (err) {
    throw await hydrateBlobError(err);
  }
  const blob = response.data as Blob;
  if (blob.type && blob.type.includes("application/json")) {
    let parsed: any;
    try {
      parsed = JSON.parse(await blob.text());
    } catch {
      /* ignore */
    }
    throw { response: { data: parsed } };
  }
  triggerBrowserDownload(blob, filename);
}

/** Upload a filled template file to `url`. */
export async function uploadTemplate(url: string, file: File): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<BulkUploadResult>(url, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
