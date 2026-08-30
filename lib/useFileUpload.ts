import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UploadHttpError, getFriendlyUploadErrorMessage } from './mapUploadError.cjs';

export interface UseFileUploadOptions { uploadUrl?: string; accept?: string; maxSizeMB?: number; multiple?: boolean; clearOnSuccess?: boolean; successMessage?: string; emptySelectionMessage?: string; onFilesSelected?: (files: File[]) => void; onUploadSuccess?: () => void; onUploadError?: (message: string) => void; }
export interface UseFileUploadResult { file: File | null; selectedFiles: File[]; previews: string[]; isUploading: boolean; message: string | null; error: string | null; inputRef: React.RefObject<HTMLInputElement>; handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void; handleUpload: () => Promise<void>; handleRemove: () => void; }
const isAcceptedFile = (file: File, accept?: string) => { if (!accept || accept.trim() === '') return true; const fileName = file.name.toLowerCase(); const fileType = file.type.toLowerCase(); return accept.split(',').some((rawToken) => { const token = rawToken.trim().toLowerCase(); if (token.startsWith('.')) return fileName.endsWith(token); if (token.endsWith('/*')) return fileType.startsWith(token.slice(0, -1)); return fileType === token; }); };
export const useFileUpload = ({ uploadUrl, accept, maxSizeMB, multiple = false, clearOnSuccess = false, successMessage = 'Upload successful!', emptySelectionMessage = 'Please select a file before uploading.', onFilesSelected, onUploadSuccess, onUploadError }: UseFileUploadOptions): UseFileUploadResult => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); const [previews, setPreviews] = useState<string[]>([]); const [isUploading, setIsUploading] = useState(false); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); const uploadInFlightRef = useRef(false); const abortControllerRef = useRef<AbortController | null>(null); const isMountedRef = useRef(true); const previewsRef = useRef<string[]>([]);
  const replacePreviews = useCallback((nextPreviews: string[]) => { previewsRef.current.forEach((url) => { if (url) URL.revokeObjectURL(url); }); previewsRef.current = nextPreviews; setPreviews(nextPreviews); }, []);
  const resetSelection = useCallback(() => { setSelectedFiles([]); replacePreviews([]); if (inputRef.current) inputRef.current.value = ''; }, [replacePreviews]);
  const selectFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [], errors: string[] = []; const candidates = multiple ? files : files.slice(0, 1); const maxBytes = maxSizeMB !== undefined && Number.isFinite(maxSizeMB) && maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : null;
    if (!multiple && files.length > 1) errors.push('Only one file can be selected.');
    for (const file of candidates) { if (maxBytes !== null && file.size > maxBytes) { errors.push(`File "${file.name}" exceeds ${maxSizeMB}MB limit.`); continue; } if (!isAcceptedFile(file, accept)) { errors.push(`File "${file.name}" is not an accepted file type.`); continue; } validFiles.push(file); }
    setMessage(null); if (validFiles.length === 0) { setError(errors.length > 0 ? errors.join(' ') : 'No valid files selected.'); resetSelection(); return; }
    const nextPreviews = validFiles.map((file) => file.type.startsWith('image/') ? URL.createObjectURL(file) : ''); setError(errors.length > 0 ? errors.join(' ') : null); setSelectedFiles(validFiles); replacePreviews(nextPreviews); onFilesSelected?.(validFiles);
  }, [accept, maxSizeMB, multiple, onFilesSelected, replacePreviews, resetSelection]);
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { selectFiles(Array.from(event.target.files ?? [])); }, [selectFiles]);
  const handleUpload = useCallback(async () => {
    if (!uploadUrl) { setError('Upload URL is not configured.'); return; }
    const endpoint = uploadUrl?.trim() ?? '';
    if (!endpoint) { setError('Upload URL is not configured.'); return; }
    if (selectedFiles.length === 0) { setError(emptySelectionMessage); return; }
    if (uploadInFlightRef.current) { return; }
    uploadInFlightRef.current = true; const controller = new AbortController(); abortControllerRef.current = controller; setIsUploading(true); setMessage(null); setError(null);
    try {
      const formData = new FormData(); const fieldName = multiple ? 'files' : 'file'; for (const file of selectedFiles) formData.append(fieldName, file, file.name);
      const response = await fetch(endpoint, { method: 'POST', body: formData, signal: controller.signal }); if (!response.ok) throw new UploadHttpError(response.status);
      if (isMountedRef.current) { setMessage(successMessage); if (clearOnSuccess) resetSelection(); onUploadSuccess?.(); }
    } catch (uploadError) {
      if (uploadError instanceof Error && uploadError.name === 'AbortError') return; if (!isMountedRef.current) return;
      const uploadErrorMessage = getFriendlyUploadErrorMessage(uploadError); setError(uploadErrorMessage); onUploadError?.(uploadErrorMessage); console.error('Upload error:', uploadError);
    } finally {
      if (abortControllerRef.current === controller) { abortControllerRef.current = null; uploadInFlightRef.current = false; if (isMountedRef.current) setIsUploading(false); }
    }
  }, [clearOnSuccess, emptySelectionMessage, multiple, onUploadError, onUploadSuccess, resetSelection, selectedFiles, successMessage, uploadUrl]);
  const handleRemove = useCallback(() => { resetSelection(); setError(null); setMessage(null); }, [resetSelection]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; uploadInFlightRef.current = false; abortControllerRef.current?.abort(); abortControllerRef.current = null; previewsRef.current.forEach((url) => { if (url) URL.revokeObjectURL(url); }); previewsRef.current = []; }; }, []);
  return { file: selectedFiles[0] ?? null, selectedFiles, previews, isUploading, message, error, inputRef, handleFileChange, handleUpload, handleRemove };
};
