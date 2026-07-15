import { getImagePreviewUrl } from "@/lib/storage";

interface HostQuestionImageProps {
  fileId: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
}

export function HostQuestionImage({
  fileId,
  alt,
  width = 1920,
  height = 1080,
  className = "",
  fill = true,
}: HostQuestionImageProps) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-black/20 ${
        fill ? "min-h-0 flex-1 p-2 sm:p-3" : "rounded-2xl border border-white/10 p-2"
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImagePreviewUrl(fileId, width, height)}
        alt={alt}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

interface HostOptionImageProps {
  fileId: string;
  alt: string;
  size?: "sm" | "md" | "lg";
}

const optionImageHeights = {
  sm: "min-h-[80px] max-h-24",
  md: "min-h-[120px] max-h-40",
  lg: "min-h-[160px] max-h-52",
};

export function HostOptionImage({ fileId, alt, size = "md" }: HostOptionImageProps) {
  return (
    <div
      className={`flex items-center justify-center bg-black/30 p-2 ${optionImageHeights[size]}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImagePreviewUrl(fileId, 480, 320)}
        alt={alt}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

interface HostRankingItemImageProps {
  fileId: string;
  alt: string;
}

export function HostRankingItemImage({ fileId, alt }: HostRankingItemImageProps) {
  return (
    <div className="flex h-48 items-center justify-center bg-black/20 p-3 lg:h-56">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImagePreviewUrl(fileId, 640, 480)}
        alt={alt}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
