"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui";
import { getImagePreviewUrl, uploadQuizImage } from "@/lib/storage";

interface ImageUploadProps {
  label: string;
  fileId?: string;
  onChange: (fileId: string | undefined) => void;
  aspect?: "question" | "option";
}

export function ImageUpload({
  label,
  fileId,
  onChange,
  aspect = "question",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setUploading(true);

    try {
      const uploadedId = await uploadQuizImage(file);
      onChange(uploadedId);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload image.";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  const previewClass =
    aspect === "question"
      ? "aspect-video w-full max-w-xl"
      : "aspect-square h-24 w-24";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>

      {fileId ? (
        <div className="space-y-2">
          <div
            className={`overflow-hidden rounded-xl border border-border bg-slate-100 ${previewClass}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImagePreviewUrl(
                fileId,
                aspect === "question" ? 960 : 256,
                aspect === "question" ? 540 : 256,
              )}
              alt="Uploaded preview"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              Replace image
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(undefined)}
              disabled={uploading}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-slate-50 text-sm text-muted transition hover:border-primary hover:text-foreground disabled:opacity-50 ${previewClass}`}
        >
          {uploading ? "Uploading..." : "+ Add image"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
