"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createQuiz, updateQuiz } from "@/lib/quiz";
import { getChapterType, isBlackjackChapter, isJeopardyChapter, isJeopardyQuestion, isRankingChapter, isRankingQuestion } from "@/lib/chapter-utils";
import type { ChapterType, JeopardyQuestionMeta, QuestionOption, QuestionType, QuizFormData } from "@/lib/types";
import { ImageUpload } from "@/components/image-upload";
import { JeopardyBoardEditor } from "@/components/jeopardy/jeopardy-board-editor";

interface QuizFormProps {
  mode: "create" | "edit";
  quizId?: string;
  initialData?: QuizFormData;
}

function createChapterId() {
  return crypto.randomUUID();
}

function createEmptyMcQuestion() {
  return {
    type: "multipleChoice" as QuestionType,
    text: "",
    imageFileId: undefined as string | undefined,
    chapterId: undefined as string | undefined,
    scaleMin: undefined as number | undefined,
    scaleMax: undefined as number | undefined,
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ] as QuestionOption[],
  };
}

function createEmptyRankingItem() {
  return {
    type: "scale1to10" as QuestionType,
    text: "",
    imageFileId: undefined as string | undefined,
    chapterId: undefined as string | undefined,
    scaleMin: 1 as number,
    scaleMax: 10 as number,
    options: [] as QuestionOption[],
  };
}

function createEmptyJeopardyQuestion(
  chapterId: string,
  meta?: Partial<JeopardyQuestionMeta>,
) {
  return {
    type: "jeopardy" as QuestionType,
    text: "",
    imageFileId: undefined as string | undefined,
    chapterId,
    options: [] as QuestionOption[],
    jeopardyMeta: {
      category: meta?.category ?? "",
      pointValue: meta?.pointValue ?? 200,
      answer: meta?.answer ?? "",
      isPlayed: false,
    },
  };
}

export function QuizForm({ mode, quizId, initialData }: QuizFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [chapters, setChapters] = useState(() => {
    const base =
      initialData?.chapters?.length
        ? initialData.chapters
        : [{ id: createChapterId(), title: "Chapter 1", order: 0, type: "multipleChoice" as ChapterType }];

    return base.map((chapter, index) => ({
      ...chapter,
      type: chapter.type ?? "multipleChoice",
      order: index,
    }));
  });
  const [questions, setQuestions] = useState(
    initialData?.questions.length ? initialData.questions : [],
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    return (
      initialData?.chapters?.[0]?.id ??
      (initialData?.chapters?.length ? initialData.chapters[0].id : undefined) ??
      chapters[0]?.id
    );
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );

  const effectiveSelectedChapterId = useMemo(() => {
    const exists = chapters.some((chapter) => chapter.id === selectedChapterId);
    return exists ? selectedChapterId : chapters[0]?.id;
  }, [chapters, selectedChapterId]);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === effectiveSelectedChapterId) ?? null,
    [chapters, effectiveSelectedChapterId],
  );

  const selectedChapterQuestionsForType = useMemo(
    () => questions.filter((question) => question.chapterId === effectiveSelectedChapterId),
    [questions, effectiveSelectedChapterId],
  );

  const isRankingChapterSelected = isRankingChapter(
    selectedChapter as { type?: ChapterType } | null,
    selectedChapterQuestionsForType as { type: QuestionType }[],
  );

  const isJeopardyChapterSelected = isJeopardyChapter(
    selectedChapter as { type?: ChapterType } | null,
    selectedChapterQuestionsForType as { type: QuestionType }[],
  );

  const isBlackjackChapterSelected = isBlackjackChapter(
    selectedChapter as { type?: ChapterType } | null,
  );

  function createQuestionForChapter(
    chapterId: string,
    chapterType: ChapterType,
  ): QuizFormData["questions"][number] {
    if (chapterType === "blackjack") {
      return createEmptyMcQuestion();
    }
    if (chapterType === "ranking") {
      return createEmptyRankingItem();
    }
    if (chapterType === "jeopardy") {
      return createEmptyJeopardyQuestion(chapterId);
    }
    return createEmptyMcQuestion();
  }

  function updateChapterType(chapterId: string, type: ChapterType) {
    setChapters((current) =>
      current.map((chapter) => (chapter.id === chapterId ? { ...chapter, type } : chapter)),
    );

    setQuestions((current) => {
      const chapterQuestions = current.filter((question) => question.chapterId === chapterId);
      const otherQuestions = current.filter((question) => question.chapterId !== chapterId);

      if (type === "ranking") {
        const converted =
          chapterQuestions.length > 0
            ? chapterQuestions.map((question) => ({
                ...question,
                type: "scale1to10" as QuestionType,
                scaleMin: 1,
                scaleMax: 10,
                options: [] as QuestionOption[],
                jeopardyMeta: undefined,
              }))
            : [{ ...createQuestionForChapter(chapterId, type), chapterId }];

        return [...otherQuestions, ...converted];
      }

      if (type === "jeopardy") {
        const converted =
          chapterQuestions.length > 0
            ? chapterQuestions.map((question) => ({
                ...createEmptyJeopardyQuestion(chapterId),
                text: question.text,
                imageFileId: question.imageFileId,
              }))
            : [];

        return [...otherQuestions, ...converted];
      }

      if (type === "blackjack") {
        return otherQuestions;
      }

      const converted =
        chapterQuestions.length > 0
          ? chapterQuestions.map((question) => ({
              ...createEmptyMcQuestion(),
              chapterId,
              text: question.text,
              imageFileId: question.imageFileId,
            }))
          : [{ ...createQuestionForChapter(chapterId, type), chapterId }];

      return [...otherQuestions, ...converted];
    });
  }

  const chapterQuestions = useMemo(() => {
    if (!effectiveSelectedChapterId) return [];
    return questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => question.chapterId === effectiveSelectedChapterId);
  }, [effectiveSelectedChapterId, questions]);

  function updateQuestionText(index: number, text: string) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, text } : question,
      ),
    );
  }

  function updateQuestionImage(index: number, imageFileId: string | undefined) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, imageFileId } : question,
      ),
    );
  }

  function updateOptionImage(
    questionIndex: number,
    optionIndex: number,
    imageFileId: string | undefined,
  ) {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex
              ? { ...option, imageFileId }
              : option,
          ),
        };
      }),
    );
  }

  function updateOptionText(
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? { ...option, text } : option,
          ),
        };
      }),
    );
  }

  function setCorrectOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option, currentOptionIndex) => ({
            ...option,
            isCorrect: currentOptionIndex === optionIndex,
          })),
        };
      }),
    );
  }

  function addQuestionToSelectedChapter() {
    if (!effectiveSelectedChapterId) return;

    const chapterType = getChapterType(effectiveSelectedChapterId, chapters);
    if (chapterType === "blackjack") {
      return;
    }

    setQuestions((current) => [
      ...current,
      {
        ...createQuestionForChapter(effectiveSelectedChapterId, chapterType),
        chapterId: effectiveSelectedChapterId,
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((current) =>
      current.length === 1
        ? current
        : current.filter((_, questionIndex) => questionIndex !== index),
    );
  }

  function addChapter() {
    const id = createChapterId();
    setChapters((current) => [
      ...current,
      {
        id,
        title: `Chapter ${current.length + 1}`,
        order: current.length,
        type: "multipleChoice" as ChapterType,
      },
    ]);
    setSelectedChapterId(id);
  }

  function removeChapter(chapterId: string) {
    setChapters((current) => {
      const next = current.filter((chapter) => chapter.id !== chapterId);
      return next.map((chapter, index) => ({ ...chapter, order: index }));
    });

    setQuestions((current) =>
      current.filter((question) => question.chapterId !== chapterId),
    );
  }

  function addOption(questionIndex: number) {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex || question.options.length >= 4) {
          return question;
        }

        return {
          ...question,
          options: [...question.options, { text: "", isCorrect: false }],
        };
      }),
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((current) =>
      current.map((question, currentQuestionIndex) => {
        if (currentQuestionIndex !== questionIndex) {
          return question;
        }

        if (question.options.length <= 2) {
          return question;
        }

        const nextOptions = question.options.filter(
          (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
        );

        if (!nextOptions.some((option) => option.isCorrect)) {
          nextOptions[0] = { ...nextOptions[0], isCorrect: true };
        }

        return { ...question, options: nextOptions };
      }),
    );
  }

  function replaceJeopardyChapterQuestions(
    chapterId: string,
    jeopardyQuestions: QuizFormData["questions"],
  ) {
    setQuestions((current) => [
      ...current.filter((question) => question.chapterId !== chapterId),
      ...jeopardyQuestions.map((question) => ({ ...question, chapterId })),
    ]);
  }

  function validateForm(): string | null {
    if (!title.trim()) {
      return "Quiz title is required.";
    }

    if (chapters.length === 0 || chapters.some((chapter) => !chapter.title.trim())) {
      return "Chapters need titles.";
    }

    const assignedQuestions = questions.filter((question) => question.chapterId);
    const hasNonBlackjackChapter = chapters.some((chapter) => chapter.type !== "blackjack");

    if (assignedQuestions.length === 0 && hasNonBlackjackChapter) {
      return "Add at least one question, ranking item, or Jeopardy clue.";
    }

    for (const chapter of chapters) {
      const chapterAssigned = assignedQuestions.filter(
        (question) => question.chapterId === chapter.id,
      );

      if (chapter.type === "blackjack") {
        continue;
      }

      if (chapter.type === "jeopardy") {
        if (chapterAssigned.length === 0) {
          return `${chapter.title.trim() || "Jeopardy chapter"} needs at least one clue on the board.`;
        }

        for (const question of chapterAssigned) {
          const meta = question.jeopardyMeta;
          const label = `${chapter.title.trim() || "Jeopardy"} · ${meta?.category ?? "?"} · ${meta?.pointValue ?? "?"}`;

          if (!meta?.category?.trim()) {
            return `${label} needs a category.`;
          }

          if (!question.text.trim() && !question.imageFileId) {
            return `${label} needs clue text or an image.`;
          }

          if (!meta.answer?.trim()) {
            return `${label} needs an answer for the host.`;
          }
        }
      }
    }

    for (const question of assignedQuestions) {
      const chapter = chapters.find((item) => item.id === question.chapterId);
      const chapterQuestions = assignedQuestions.filter(
        (item) => item.chapterId === question.chapterId,
      );
      const itemIndex = chapterQuestions.indexOf(question) + 1;
      const chapterLabel = chapter?.title?.trim() || "Chapter";
      const rankingItem = isRankingQuestion(question, chapters);

      if (isJeopardyQuestion(question, chapters)) {
        continue;
      }

      if (chapter?.type === "blackjack") {
        continue;
      }

      if (rankingItem) {
        if (!question.imageFileId) {
          return `${chapterLabel} · Item ${itemIndex} needs an image.`;
        }
        continue;
      }

      if (!question.text.trim() && !question.imageFileId) {
        return `${chapterLabel} · Question ${itemIndex} needs text or an image.`;
      }

      const filledOptions = question.options.filter(
        (option) => option.text.trim() || option.imageFileId,
      );

      if (filledOptions.length < 2) {
        return `${chapterLabel} · Question ${itemIndex} needs at least 2 options.`;
      }

      if (
        !question.options.some(
          (option) =>
            option.isCorrect && (option.text.trim() || option.imageFileId),
        )
      ) {
        return `${chapterLabel} · Question ${itemIndex} needs a correct answer.`;
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload: QuizFormData = {
        title,
        description,
        chapters: chapters.map((chapter, index) => ({
          id: chapter.id,
          title: chapter.title.trim(),
          order: index,
          type: chapter.type ?? "multipleChoice",
        })),
        questions: questions
          .filter(
            (question) =>
              question.chapterId &&
              getChapterType(question.chapterId, chapters) !== "blackjack",
          )
          .map((question) => {
            const chapterType = getChapterType(question.chapterId, chapters);
            let questionType: QuestionType = "multipleChoice";

            if (chapterType === "ranking" || question.type === "scale1to10") {
              questionType = "scale1to10";
            } else if (chapterType === "jeopardy" || question.type === "jeopardy") {
              questionType = "jeopardy";
            }

            return {
              type: questionType,
              text: question.text,
              imageFileId: question.imageFileId,
              chapterId: question.chapterId,
              scaleMin: questionType === "scale1to10" ? 1 : undefined,
              scaleMax: questionType === "scale1to10" ? 10 : undefined,
              options:
                questionType === "multipleChoice"
                  ? question.options
                      .filter((option) => option.text.trim() || option.imageFileId)
                      .map((option) => ({
                        text: option.text.trim(),
                        isCorrect: option.isCorrect,
                        imageFileId: option.imageFileId,
                      }))
                  : [],
              jeopardyMeta:
                questionType === "jeopardy" ? question.jeopardyMeta : undefined,
            };
          }),
      };

      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (mode === "create") {
        await createQuiz(user.$id, payload);
      } else if (quizId) {
        await updateQuiz(quizId, payload);
      }

      router.push("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Could not save quiz.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <h2 className="text-lg font-semibold">Quiz details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Friday night trivia"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short description for your friends"
              rows={3}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Chapters</h2>
            <Button type="button" variant="secondary" onClick={addChapter}>
              Add
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {sortedChapters.map((chapter, index) => {
              const isSelected = chapter.id === effectiveSelectedChapterId;

              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => setSelectedChapterId(chapter.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-primary bg-indigo-50"
                      : "border-border bg-white hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        Chapter {index + 1}
                      </p>
                      <Input
                        value={chapter.title}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const value = event.target.value;
                          setChapters((current) =>
                            current.map((item) =>
                              item.id === chapter.id
                                ? { ...item, title: value }
                                : item,
                            ),
                          );
                        }}
                        className="mt-2"
                      />
                      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                        <Label>Chapter type</Label>
                        <select
                          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none ring-primary/30 transition focus:ring-2"
                          value={chapter.type ?? "multipleChoice"}
                          onChange={(event) =>
                            updateChapterType(
                              chapter.id,
                              event.target.value as ChapterType,
                            )
                          }
                        >
                          <option value="multipleChoice">Multiple choice</option>
                          <option value="ranking">Ranking</option>
                          <option value="jeopardy">Jeopardy</option>
                          <option value="blackjack">Blackjack</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={sortedChapters.length <= 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeChapter(chapter.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {isBlackjackChapterSelected
                    ? "Blackjack"
                    : isJeopardyChapterSelected
                      ? "Jeopardy-bord"
                      : isRankingChapterSelected
                        ? "Items to rank"
                        : "Questions"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {isBlackjackChapterSelected
                    ? "Geen instellingen nodig. Spelers spelen blackjack tegen de host als dealer."
                    : isJeopardyChapterSelected
                      ? "Stel categorieën, puntwaarden en clues in voor je Jeopardy-bord."
                      : isRankingChapterSelected
                        ? "Add images for players to rate from 1 to 10."
                        : "Click a chapter on the left to add questions inside it."}
                </p>
              </div>
              {!isJeopardyChapterSelected && !isBlackjackChapterSelected ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!effectiveSelectedChapterId}
                  onClick={addQuestionToSelectedChapter}
                >
                  {isRankingChapterSelected ? "Add item" : "Add question"}
                </Button>
              ) : null}
            </div>
          </Card>

          {isBlackjackChapterSelected ? (
            <Card className="text-center">
              <p className="text-sm text-muted">
                Dit chapter start een live blackjack-tafel. Spelers kiezen een stoel, zetten
                quiz-punten in en spelen tegen de dealer.
              </p>
            </Card>
          ) : isJeopardyChapterSelected && effectiveSelectedChapterId ? (
            <Card>
              <JeopardyBoardEditor
                chapterId={effectiveSelectedChapterId}
                questions={chapterQuestions.map(({ question }) => ({
                  type: "jeopardy" as QuestionType,
                  text: question.text,
                  imageFileId: question.imageFileId,
                  chapterId: question.chapterId,
                  options: [] as [],
                  jeopardyMeta: question.jeopardyMeta ?? {
                    category: "",
                    pointValue: 200,
                    answer: "",
                    isPlayed: false,
                  },
                }))}
                onChange={(jeopardyQuestions) =>
                  replaceJeopardyChapterQuestions(
                    effectiveSelectedChapterId,
                    jeopardyQuestions,
                  )
                }
              />
            </Card>
          ) : chapterQuestions.length === 0 ? (
            <Card className="text-center">
              <p className="text-muted">
                {isRankingChapterSelected
                  ? "No items in this chapter yet."
                  : "No questions in this chapter yet."}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!effectiveSelectedChapterId}
                  onClick={addQuestionToSelectedChapter}
                >
                  {isRankingChapterSelected ? "Add your first item" : "Add your first question"}
                </Button>
              </div>
            </Card>
          ) : (
            chapterQuestions.map(({ question, index: questionIndex }, localIndex) => (
              <Card key={questionIndex}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">
                    {isRankingChapterSelected ? `Item ${localIndex + 1}` : `Question ${localIndex + 1}`}
                  </h2>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeQuestion(questionIndex)}
                  >
                    Remove
                  </Button>
                </div>

                {isRankingChapterSelected ? (
                  <>
                    <div className="mt-4">
                      <Label htmlFor={`question-${questionIndex}`}>Label (optional)</Label>
                      <Input
                        id={`question-${questionIndex}`}
                        value={question.text}
                        onChange={(event) =>
                          updateQuestionText(questionIndex, event.target.value)
                        }
                        placeholder="e.g. Summer vibes"
                      />
                    </div>

                    <div className="mt-4">
                      <ImageUpload
                        label="Image"
                        fileId={question.imageFileId}
                        onChange={(fileId) => updateQuestionImage(questionIndex, fileId)}
                        aspect="question"
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
                      <p className="text-sm font-medium">Players will rate this image from 1 to 10.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4">
                      <Label htmlFor={`question-${questionIndex}`}>Question</Label>
                      <Input
                        id={`question-${questionIndex}`}
                        value={question.text}
                        onChange={(event) =>
                          updateQuestionText(questionIndex, event.target.value)
                        }
                        placeholder="What is the capital of France?"
                      />
                    </div>

                    <div className="mt-4">
                      <ImageUpload
                        label="Question image (optional)"
                        fileId={question.imageFileId}
                        onChange={(fileId) => updateQuestionImage(questionIndex, fileId)}
                        aspect="question"
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      <Label>Answer options</Label>
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={option.text}
                              onChange={(event) =>
                                updateOptionText(
                                  questionIndex,
                                  optionIndex,
                                  event.target.value,
                                )
                              }
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={option.isCorrect ? "primary" : "secondary"}
                                onClick={() =>
                                  setCorrectOption(questionIndex, optionIndex)
                                }
                              >
                                {option.isCorrect ? "Correct" : "Mark correct"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => removeOption(questionIndex, optionIndex)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <ImageUpload
                              label="Answer image (optional)"
                              fileId={option.imageFileId}
                              onChange={(fileId) =>
                                updateOptionImage(questionIndex, optionIndex, fileId)
                              }
                              aspect="option"
                            />
                          </div>
                        </div>
                      ))}
                      {question.options.length < 4 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => addOption(questionIndex)}
                        >
                          Add option
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Create quiz"
              : "Save changes"}
        </Button>
      </div>

      <ErrorMessage message={error} />
    </form>
  );
}
