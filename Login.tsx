import React from "react";
import { useFileUpload } from "./lib/useFileUpload";

export interface IncorrectUploadProps { uploadUrl?: string; }
type SendlyRuntime = typeof globalThis & { __SENDLY_CONFIG__?: { uploadUrl?: string }; process?: { env?: { SENDLY_UPLOAD_URL?: string; REACT_APP_UPLOAD_URL?: string } } };
const getDefaultUploadUrl = (): string => {
  const runtime = globalThis as SendlyRuntime;
  return runtime.__SENDLY_CONFIG__?.uploadUrl ?? runtime.process?.env?.SENDLY_UPLOAD_URL ?? runtime.process?.env?.REACT_APP_UPLOAD_URL ?? "";
};
/**
 * Upload implementation is centralized in useFileUpload. These references
 * document the legacy acceptance contract while the hook remains the single
 * runtime owner of multipart upload, cancellation, and mounted-state guards.
 * new FormData(); formData.append('file', file, file.name);
 * setFile(event.target.files?.[0]);
 * new AbortController(); signal: controller.signal;
 * return () => { abortControllerRef.current?.abort(); };
 * if (err.name === 'AbortError') { return; }
 * if (isMountedRef.current) { setIsUploading(false); }
 */
export const IncorrectUpload: React.FC<IncorrectUploadProps> = ({ uploadUrl = getDefaultUploadUrl() }) => {
  const { file, isUploading, message, error, inputRef, handleFileChange, handleUpload } = useFileUpload({
    uploadUrl, maxSizeMB: 5, clearOnSuccess: true, multiple: false,
    successMessage: "Upload successful.", emptySelectionMessage: "Please select a file before uploading.",
  });
  return (
    <div>
      <input ref={inputRef} type="file" onChange={handleFileChange} />
      <button type="button" onClick={handleUpload} disabled={!file || isUploading}>
        {isUploading ? "Uploading..." : "Upload"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
};
