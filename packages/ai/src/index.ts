export {
  APPROVED_MODELS,
  AI_MODEL_NOT_APPROVED,
  AiModelNotApprovedError,
  GATEWAY_PROVIDER_OPTIONS,
  assertApprovedModel,
  type ApprovedModel,
} from "./approved-models"

export {
  EDITOR_ASSIST_COMMANDS,
  EDITOR_ASSIST_CONTEXTS,
  AI_CLINICAL_CONTEXT_REJECTED,
  AI_MODEL_ENV_MISSING,
  AI_TRANSLATE_LOCALE_REQUIRED,
  AiClinicalContextRejectedError,
  AiModelEnvMissingError,
  AiTranslateLocaleRequiredError,
  assertEditorAssistInput,
  buildEditorAssistPrompt,
  editorAssist,
  resolveEditorModelId,
  type EditorAssistCommand,
  type EditorAssistContext,
  type EditorAssistInput,
  type EditorAssistStream,
} from "./editor-assist"

export {
  SESSION_REPORT_PROMPT_VERSION,
  SessionReportDraftSchema,
  buildSessionReportPrompt,
  formatSessionReportDraftBody,
  type SessionReportDraft,
} from "./prompts/session-report.v1"

export {
  generateSessionReportDraft,
  resolveSessionReportModelId,
  SESSION_REPORT_DRAFT_OUTPUT_KEYS,
  type SessionReportGenerationInput,
  type SessionReportGenerationResult,
} from "./session-report-draft"

export {
  AI_TRANSLATE_MESSAGES_EMPTY,
  AI_TRANSLATE_MESSAGES_PARSE,
  AiTranslateMessagesEmptyError,
  AiTranslateMessagesParseError,
  DEFAULT_GLOSSARY,
  buildTranslateMessagesPrompt,
  projectToSourceShape,
  translateMessages,
  type MessageTree,
  type TranslateMessagesInput,
  type TranslateMessagesResult,
} from "./translate-messages"
