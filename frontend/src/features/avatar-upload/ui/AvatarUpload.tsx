import { useState, useRef, useCallback, useEffect } from "react";
import { Loader } from "@/shared";
import { resizeImage, createPreviewUrl, revokePreviewUrl } from "../lib/resizeImage";
import "./AvatarUpload.scss";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onUpload: (file: File) => Promise<{ avatar_url: string }>;
  size?: number;
  name?: string;
  showHint?: boolean;
}

export function AvatarUpload({
  currentAvatarUrl,
  onUpload,
  size = 120,
  name = "",
  showHint = true,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        revokePreviewUrl(preview);
      }
    };
  }, [preview]);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Выберите изображение");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError("Максимальный размер файла: 5MB");
        return;
      }

      setError(null);

      // Create preview
      const previewUrl = createPreviewUrl(file);
      setPreview(previewUrl);

      try {
        setIsUploading(true);

        // Resize image before upload
        const resizedBlob = await resizeImage(file, 400, 0.85);
        const resizedFile = new File([resizedBlob], file.name, {
          type: "image/jpeg",
        });

        // Upload
        await onUpload(resizedFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        setPreview(null);
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset input
      e.target.value = "";
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const getInitials = (name: string): string => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "?";
  };

  const displayUrl = preview || currentAvatarUrl;

  return (
    <div className="avatar-upload">
      <div
        className={`avatar-upload__container ${isDragging ? "avatar-upload__container--dragging" : ""}`}
        style={{ width: size, height: size }}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name || "Avatar"}
            className="avatar-upload__image"
          />
        ) : (
          <div className="avatar-upload__placeholder">
            {getInitials(name)}
          </div>
        )}

        <div className="avatar-upload__overlay">
          {isUploading ? (
            <Loader />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="avatar-upload__input"
        />
      </div>

      {error && (
        <div className="avatar-upload__error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {showHint && (
        <span className="avatar-upload__hint">
          Нажмите или перетащите изображение
        </span>
      )}
    </div>
  );
}
