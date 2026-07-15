"use client";

import { useEffect, useMemo, useState } from "react";

import { ImageUpload } from "@/components/image-upload";
import { Button, Input, Label } from "@/components/ui";
import {
  DEFAULT_JEOPARDY_POINT_VALUES,
  jeopardyCellKey,
} from "@/lib/jeopardy-utils";
import type { JeopardyQuestionMeta, QuestionType } from "@/lib/types";

interface JeopardyCellData {
  text: string;
  answer: string;
  imageFileId?: string;
}

interface JeopardyQuestionDraft {
  type: QuestionType;
  text: string;
  imageFileId?: string;
  chapterId?: string;
  options: [];
  jeopardyMeta: JeopardyQuestionMeta;
}

interface JeopardyBoardEditorProps {
  chapterId: string;
  questions: JeopardyQuestionDraft[];
  onChange: (questions: JeopardyQuestionDraft[]) => void;
}

function buildCellsFromQuestions(questions: JeopardyQuestionDraft[]) {
  const cells = new Map<string, JeopardyCellData>();

  for (const question of questions) {
    const meta = question.jeopardyMeta;
    if (!meta?.category || !meta.pointValue) {
      continue;
    }

    cells.set(jeopardyCellKey(meta.category, meta.pointValue), {
      text: question.text,
      answer: meta.answer,
      imageFileId: question.imageFileId,
    });
  }

  return cells;
}

function deriveCategoriesAndPoints(questions: JeopardyQuestionDraft[]) {
  const categorySet: string[] = [];
  const pointSet = new Set<number>();

  for (const question of questions) {
    const meta = question.jeopardyMeta;
    if (!meta?.category) {
      continue;
    }

    if (!categorySet.includes(meta.category)) {
      categorySet.push(meta.category);
    }

    if (meta.pointValue) {
      pointSet.add(meta.pointValue);
    }
  }

  return {
    categories:
      categorySet.length > 0 ? categorySet : ["Categorie 1", "Categorie 2", "Categorie 3"],
    pointValues:
      pointSet.size > 0
        ? [...pointSet].sort((a, b) => a - b)
        : [...DEFAULT_JEOPARDY_POINT_VALUES],
  };
}

function buildQuestionsFromGrid(
  chapterId: string,
  categories: string[],
  pointValues: number[],
  cells: Map<string, JeopardyCellData>,
): JeopardyQuestionDraft[] {
  const result: JeopardyQuestionDraft[] = [];

  for (const pointValue of pointValues) {
    for (const category of categories) {
      const cell = cells.get(jeopardyCellKey(category, pointValue));
      if (!cell) {
        continue;
      }

      if (!cell.text.trim() && !cell.answer.trim() && !cell.imageFileId) {
        continue;
      }

      result.push({
        type: "jeopardy",
        text: cell.text,
        imageFileId: cell.imageFileId,
        chapterId,
        options: [],
        jeopardyMeta: {
          category,
          pointValue,
          answer: cell.answer,
          isPlayed: false,
        },
      });
    }
  }

  return result;
}

export function JeopardyBoardEditor({
  chapterId,
  questions,
  onChange,
}: JeopardyBoardEditorProps) {
  const initial = useMemo(
    () => ({
      ...deriveCategoriesAndPoints(questions),
      cells: buildCellsFromQuestions(questions),
    }),
    // Only derive from props on chapter switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterId],
  );

  const [categories, setCategories] = useState(initial.categories);
  const [pointValues, setPointValues] = useState(initial.pointValues);
  const [cells, setCells] = useState(initial.cells);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  useEffect(() => {
    setCategories(initial.categories);
    setPointValues(initial.pointValues);
    setCells(initial.cells);
    setExpandedCell(null);
  }, [initial]);

  function syncQuestions(
    nextCategories: string[],
    nextPointValues: number[],
    nextCells: Map<string, JeopardyCellData>,
  ) {
    onChange(buildQuestionsFromGrid(chapterId, nextCategories, nextPointValues, nextCells));
  }

  function updateCell(key: string, patch: Partial<JeopardyCellData>) {
    setCells((current) => {
      const next = new Map(current);
      const existing = next.get(key) ?? { text: "", answer: "" };
      next.set(key, { ...existing, ...patch });
      syncQuestions(categories, pointValues, next);
      return next;
    });
  }

  function addCategory() {
    if (categories.length >= 6) {
      return;
    }

    const nextCategories = [...categories, `Categorie ${categories.length + 1}`];
    setCategories(nextCategories);
    syncQuestions(nextCategories, pointValues, cells);
  }

  function removeCategory(index: number) {
    if (categories.length <= 1) {
      return;
    }

    const removed = categories[index];
    const nextCategories = categories.filter((_, i) => i !== index);
    const nextCells = new Map(cells);

    for (const pointValue of pointValues) {
      nextCells.delete(jeopardyCellKey(removed, pointValue));
    }

    setCategories(nextCategories);
    setCells(nextCells);
    syncQuestions(nextCategories, pointValues, nextCells);
  }

  function updateCategory(index: number, value: string) {
    const oldName = categories[index];
    const nextCategories = categories.map((category, i) =>
      i === index ? value : category,
    );
    const nextCells = new Map<string, JeopardyCellData>();

    for (const [key, cell] of cells.entries()) {
      const [category, pointValueRaw] = key.split("|");
      const pointValue = Number(pointValueRaw);

      if (category === oldName) {
        nextCells.set(jeopardyCellKey(value, pointValue), cell);
      } else {
        nextCells.set(key, cell);
      }
    }

    setCategories(nextCategories);
    setCells(nextCells);
    syncQuestions(nextCategories, pointValues, nextCells);
  }

  function addPointValue() {
    const max = pointValues.length > 0 ? Math.max(...pointValues) : 0;
    const nextPointValues = [...pointValues, max + 200].sort((a, b) => a - b);
    setPointValues(nextPointValues);
    syncQuestions(categories, nextPointValues, cells);
  }

  function removePointValue(index: number) {
    if (pointValues.length <= 1) {
      return;
    }

    const removed = pointValues[index];
    const nextPointValues = pointValues.filter((_, i) => i !== index);
    const nextCells = new Map(cells);

    for (const category of categories) {
      nextCells.delete(jeopardyCellKey(category, removed));
    }

    setPointValues(nextPointValues);
    setCells(nextCells);
    syncQuestions(categories, nextPointValues, nextCells);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Label>Categorieën</Label>
          <Button type="button" variant="secondary" onClick={addCategory}>
            Categorie toevoegen
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {categories.map((category, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={category}
                onChange={(event) => updateCategory(index, event.target.value)}
                placeholder={`Categorie ${index + 1}`}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={categories.length <= 1}
                onClick={() => removeCategory(index)}
              >
                Verwijder
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label>Puntwaarden</Label>
          <Button type="button" variant="secondary" onClick={addPointValue}>
            Rij toevoegen
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Standaard Jeopardy-punten. Pas aan indien nodig.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pointValues.map((pointValue, index) => (
            <div
              key={pointValue}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span className="font-semibold">{pointValue}</span>
              <Button
                type="button"
                variant="secondary"
                disabled={pointValues.length <= 1}
                onClick={() => removePointValue(index)}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Jeopardy-bord</Label>
        <p className="mt-1 text-sm text-muted">
          Klik op een cel om clue en antwoord in te vullen. Lege cellen worden niet opgeslagen.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="w-20 border border-border bg-slate-100 p-2" />
                {categories.map((category, index) => (
                  <th
                    key={index}
                    className="min-w-[140px] border border-border bg-indigo-600 p-3 text-center text-sm font-bold uppercase text-white"
                  >
                    {category || `Cat ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pointValues.map((pointValue) => (
                <tr key={pointValue}>
                  <td className="border border-border bg-slate-100 p-2 text-center font-bold text-indigo-700">
                    {pointValue}
                  </td>
                  {categories.map((category, categoryIndex) => {
                    const key = jeopardyCellKey(category, pointValue);
                    const cell = cells.get(key);
                    const hasContent = Boolean(
                      cell?.text.trim() || cell?.answer.trim() || cell?.imageFileId,
                    );
                    const isExpanded = expandedCell === key;

                    return (
                      <td key={categoryIndex} className="border border-border p-1 align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedCell(isExpanded ? null : key)}
                          className={`flex h-16 w-full items-center justify-center rounded-lg text-lg font-bold transition ${
                            hasContent
                              ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                              : "bg-indigo-900 text-amber-300 hover:bg-indigo-800"
                          }`}
                        >
                          {hasContent ? "✓" : pointValue}
                        </button>

                        {isExpanded ? (
                          <div className="mt-2 space-y-3 rounded-lg border border-border bg-slate-50 p-3">
                            <div>
                              <Label>Clue</Label>
                              <Input
                                value={cell?.text ?? ""}
                                onChange={(event) =>
                                  updateCell(key, { text: event.target.value })
                                }
                                placeholder="Clue voor spelers"
                              />
                            </div>
                            <div>
                              <Label>Antwoord (alleen host)</Label>
                              <Input
                                value={cell?.answer ?? ""}
                                onChange={(event) =>
                                  updateCell(key, { answer: event.target.value })
                                }
                                placeholder="Correct antwoord"
                              />
                            </div>
                            <ImageUpload
                              label="Afbeelding (optioneel)"
                              fileId={cell?.imageFileId}
                              onChange={(fileId) => updateCell(key, { imageFileId: fileId })}
                              aspect="question"
                            />
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
