import { HostOptionImage } from "@/components/host/host-question-image";
import { getKahootColor } from "@/lib/kahoot-colors";
import type { QuestionOption } from "@/lib/types";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

interface HostMcOptionCardProps {
  option: QuestionOption;
  optionIndex: number;
  imageSize?: "sm" | "md";
  textSize?: "sm" | "md" | "lg";
  highlightCorrect?: boolean;
}

export function HostMcOptionCard({
  option,
  optionIndex,
  imageSize = "sm",
  textSize = "md",
  highlightCorrect = false,
}: HostMcOptionCardProps) {
  const color = getKahootColor(optionIndex);
  const letter = OPTION_LETTERS[optionIndex] ?? String(optionIndex + 1);

  const textSizeClasses = {
    sm: "text-sm sm:text-base",
    md: "text-base sm:text-lg lg:text-xl",
    lg: "text-lg sm:text-xl",
  };

  return (
    <div
      className={`flex overflow-hidden rounded-2xl ${color.bg} text-white shadow-lg ${
        highlightCorrect && option.isCorrect ? "ring-4 ring-emerald-400" : ""
      }`}
    >
      <div className="flex w-10 shrink-0 items-center justify-center self-stretch bg-black/15 text-lg font-bold sm:w-12 sm:text-xl">
        {letter}
      </div>
      <div className="min-w-0 flex-1">
        {option.imageFileId ? (
          <HostOptionImage
            fileId={option.imageFileId}
            alt={option.text || `Optie ${optionIndex + 1}`}
            size={imageSize}
          />
        ) : null}
        <p
          className={`font-semibold ${option.imageFileId ? "px-3 pb-3 pt-2 sm:px-4 sm:pb-4" : "p-4 sm:p-5"} ${textSizeClasses[textSize]}`}
        >
          {option.text || `Optie ${optionIndex + 1}`}
          {highlightCorrect && option.isCorrect ? (
            <span className="ml-2 text-xs font-medium text-emerald-200">Correct</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
