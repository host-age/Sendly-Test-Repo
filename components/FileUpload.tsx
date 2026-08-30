import React, { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_MAX_SIZE_MB = 10;

export interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  uploadUrl?: string;
  onFilesSelected?: (files: File[]) => void;
  onUploadSuccess?: () => void;
  onUploadError?: (message: string) => void;
}

export interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string;
}

const isFileTypeAccepted = (file: File, accept: string): boolean => {
  if (!accept || accept.trim() === '') return true;
  const acceptedTypes = accept.split(',').map((type) => type.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return acceptedTypes.some((acceptedType) => {
    if (acceptedType.startsWith('.')) return fileName.endsWith(acceptedType);
    if (acceptedType.endsWith('/*')) return fileType.startsWith(acceptedType.slice(0, -1));
    return fileType === acceptedType;
  });
};

const revokePreview = (selectedFile: SelectedFile) => {
  if (selectedFile.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl);
};

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = 'image/*,.pdf,.doc,.docx',
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  multiple = false,
  uploadUrl,
  onFilesSelected,
  onUploadSuccess,
  onUploadError,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const clearSelection = useCallback(() => {
    selectedFiles.forEach(revokePreview);
    setSelectedFiles([]);
    if (inputRef.current) inputRef.current.value = '';
  }, [selectedFiles]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      uploadInFlightRef.current = false;
    };
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        if (file.size > maxBytes) {
          errors.push(`File "${file.name}" exceeds ${maxSizeMB}MB limit.`);
          continue;
        }
        if (!isFileTypeAccepted(file, accept)) {
          errors.push(`File "${file.name}" not accepted. Allowed types: ${accept}.`);
          continue;
        }
        validFiles.push(file);
      }

      setMessage(null);
      if (validFiles.length === 0) {
        clearSelection();
        setError(errors.length > 0 ? errors.join(' ') : 'No valid files selected.');
        return;
      }

      selectedFiles.forEach(revokePreview);
      const newSelectedFiles: SelectedFile[] = validFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      }));

      setSelectedFiles(newSelectedFiles);
      setError(errors.length > 0 ? `Skipped ${errors.join(' ')}` : null);
      onFilesSelected?.(validFiles);
    },
    [accept, clearSelection, maxSizeMB, onFilesSelected, selectedFiles],
  );

  const handleUpload = useCallback(async () => {
    if (!uploadUrl) {
      setError('Upload URL is not configured.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please select a file before uploading.');
      return;
    }
    if (uploadInFlightRef.current) {
      return;
    }

    uploadInFlightRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsUploading(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      const fieldName = multiple ? 'files' : 'file';
      for (const selectedFile of selectedFiles) {
        formData.append(fieldName, selectedFile.file, selectedFile.file.name);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Upload failed with status ${response.status}`);

      if (isMountedRef.current) {
        setMessage('Upload successful!');
        onUploadSuccess?.();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!isMountedRef.current) return;
      const uploadError = err instanceof Error ? err.message : 'Upload failed.';
      setError(uploadError);
      onUploadError?.(uploadError);
      console.error('Upload error:', err);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        uploadInFlightRef.current = false;
        if (isMountedRef.current) setIsUploading(false);
      }
    }
  }, [multiple, onUploadError, onUploadSuccess, selectedFiles, uploadUrl]);

  const handleRemoveFile = useCallback((id: string) => {
    setSelectedFiles((prevFiles) => {
      const fileToRemove = prevFiles.find((file) => file.id === id);
      if (fileToRemove) revokePreview(fileToRemove);
      return prevFiles.filter((file) => file.id !== id);
    });
  }, []);

  const handleRemove = useCallback(() => {
    clearSelection();
    setError(null);
    setMessage(null);
  }, [clearSelection]);

  return (
    <div>
      <label htmlFor="file-upload-input">Select {multiple ? 'files' : 'a file'}</label>
      <input
        ref={inputRef}
        id="file-upload-input"
        type="file"
        accept={accept}
        multiple={multiple}
        aria-describedby={error ? 'file-upload-error' : undefined}
        aria-invalid={Boolean(error)}
        onChange={handleFileChange}
      />
      {error && <p id="file-upload-error" role="alert">{error}</p>}
      {message && <p id="file-upload-status" role="status">{message}</p>}
      {selectedFiles.map((item) => (
        <div key={item.id}>
          {item.previewUrl && <img src={item.previewUrl} alt="preview" style={{ width: 100, height: 100, objectFit: 'cover' }} />}
          {multiple && (
            <button type="button" onClick={() => handleRemoveFile(item.id)} disabled={isUploading} aria-label={`Remove ${item.file.name}`}>
              Remove {item.file.name}
            </button>
          )}
        </div>
      ))}
      {selectedFiles.length > 0 && (
        <>
          <button type="button" onClick={handleRemove} disabled={isUploading}>Remove{multiple ? ' all' : ''}</button>
          {uploadUrl && (
            <button type="button" onClick={handleUpload} disabled={isUploading} aria-busy={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
        </>
      )}
    </div>
  );
};
