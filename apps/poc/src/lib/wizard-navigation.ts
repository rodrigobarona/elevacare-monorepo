import type { WizardChapter, WizardStep } from "@/lib/wizard-types"

export type WizardPhase = "pre-wizard" | "chapter-cover" | "question" | "flow"

export interface StepNavigationContext {
  phase: WizardPhase
  chapterName?: string
  chapterIndex?: number
  chapterTotal: number
  /** Human label e.g. "Question 3 of 6" */
  progressLabel?: string
  questionIndex?: number
  questionTotal?: number
  isChapterCover: boolean
}

const PRE_WIZARD_STEP_IDS = new Set([
  "p1-specialty",
  "p2-sub",
  "p3-country",
  "p4-city",
  "p5-intro",
  "p6-name",
])

export function getStepNavigationContext(
  step: WizardStep,
  chapters: WizardChapter[],
  steps: WizardStep[]
): StepNavigationContext {
  const chapterTotal = chapters.length

  if (step.kind === "interstitial") {
    if (step.chapterId) {
      const chapterIndex =
        chapters.findIndex((c) => c.id === step.chapterId) + 1
      const chapter = chapters.find((c) => c.id === step.chapterId)
      return {
        phase: "chapter-cover",
        chapterName: chapter?.label,
        chapterIndex,
        chapterTotal,
        isChapterCover: true,
        progressLabel: chapter
          ? `Chapter ${chapterIndex} · ${chapter.label}`
          : undefined,
      }
    }
    return {
      phase: "chapter-cover",
      chapterTotal,
      isChapterCover: true,
      progressLabel: step.chapterLabel ?? "Before we begin",
    }
  }

  if (step.chapterId && step.showSidebar) {
    const chapterIndex = chapters.findIndex((c) => c.id === step.chapterId) + 1
    const chapter = chapters.find((c) => c.id === step.chapterId)
    const questionsInChapter = steps.filter(
      (s) => s.chapterId === step.chapterId && s.kind !== "interstitial"
    )
    const questionIndex = Math.max(
      1,
      questionsInChapter.findIndex((s) => s.id === step.id) + 1
    )
    const questionTotal = questionsInChapter.length

    return {
      phase: "question",
      chapterName: chapter?.label,
      chapterIndex,
      chapterTotal,
      questionIndex,
      questionTotal,
      isChapterCover: false,
      progressLabel: `Question ${questionIndex} of ${questionTotal}`,
    }
  }

  if (PRE_WIZARD_STEP_IDS.has(step.id)) {
    const preSteps = steps.filter((s) => PRE_WIZARD_STEP_IDS.has(s.id))
    const idx = preSteps.findIndex((s) => s.id === step.id) + 1
    return {
      phase: "pre-wizard",
      chapterTotal,
      isChapterCover: false,
      progressLabel: `Getting started · ${idx} of ${preSteps.length}`,
      questionIndex: idx,
      questionTotal: preSteps.length,
    }
  }

  return {
    phase: "flow",
    chapterTotal,
    isChapterCover: false,
  }
}

export interface ChapterSidebarState {
  id: string
  label: string
  index: number
  status: "upcoming" | "active" | "complete"
  questionTotal: number
  questionCurrent: number
}

export function getChapterSidebarStates(
  chapters: WizardChapter[],
  steps: WizardStep[],
  currentStep: WizardStep,
  currentStepIndex: number
): ChapterSidebarState[] {
  return chapters.map((chapter, i) => {
    const chapterSteps = steps.filter((s) => s.chapterId === chapter.id)
    const firstIndex = steps.findIndex((s) => s.chapterId === chapter.id)
    const lastIndex = steps.reduce(
      (max, s, idx) => (s.chapterId === chapter.id ? idx : max),
      -1
    )
    const questions = chapterSteps.filter((s) => s.kind !== "interstitial")

    let status: ChapterSidebarState["status"] = "upcoming"
    if (currentStep.chapterId === chapter.id) {
      status = "active"
    } else if (lastIndex >= 0 && currentStepIndex > lastIndex) {
      status = "complete"
    } else if (firstIndex >= 0 && currentStepIndex < firstIndex) {
      status = "upcoming"
    }

    let questionCurrent = 0
    if (status === "active" && currentStep.kind !== "interstitial") {
      questionCurrent = questions.findIndex((s) => s.id === currentStep.id) + 1
    } else if (status === "complete") {
      questionCurrent = questions.length
    }

    return {
      id: chapter.id,
      label: chapter.label,
      index: i + 1,
      status,
      questionTotal: questions.length,
      questionCurrent,
    }
  })
}
