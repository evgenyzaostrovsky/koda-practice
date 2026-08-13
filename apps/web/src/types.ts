export type Exercise = {
  id: string;
  difficulty: number;
  title: string;
  instructions: string;
  learning_objective: string;
  completion_summary: string;
  setup_code: string;
  starter_code: string;
  theory_article_id: string;
  knowledge_unit_id: string;
  dataset: Record<string, unknown>;
  hints: Array<{ level: number; text: string }>;
  is_control: boolean;
  xp: number;
};
export type CheatSheetEntry = {
  id: string;
  group: string;
  name: string;
  kind: "method" | "function" | "attribute" | "operator" | "pattern";
  description: string;
  example: string;
  documentationUrl?: string;
};
export type KnowledgeUnit = {
  id: string;
  slug: string;
  topicId: string;
  title: string;
  description: string;
  category: string;
  concepts: string[];
  methods: string[];
  functions: string[];
  attributes: string[];
  operators: string[];
  keywords: string[];
  cheatSheet: { entries: CheatSheetEntry[] };
  article: {
    lead: string;
    sections: Array<{
      id: string;
      title: string;
      paragraphs: string[];
      covers: string[];
      syntax: string | null;
      examples: Array<{ code: string; result: string; explanation: string }>;
      errors: Array<{ wrongCode: string; why: string; correctCode: string }>;
      nuances: string[];
    }>;
    summary: string;
  };
  documentationLinks: Array<{ label: string; url: string }>;
  relatedTaskIds: string[];
  version: number;
};
export type TheoryMethod = {
  name: string;
  description: string;
  syntax: string;
  keyParameters: Array<{ name: string; description: string }>;
  parameterGuide: string;
  example: string;
  notes: string[];
  documentationUrl: string;
  documentationLabel: string;
};
export type TheoryArticle = {
  id: string;
  title: string;
  introduction: string;
  methods: TheoryMethod[];
};
export type Topic = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  theory: string;
  syntax: string;
  example: string;
  mistakes: string[];
  methods: string[];
  exercises: Exercise[];
};
export type Module = {
  id: number;
  slug: string;
  title: string;
  description: string;
  order: number;
  topics: Topic[];
};
export type Progress = {
  solved: number;
  solved_ids: string[];
  total: number;
  attempts: number;
  first_try_accuracy: number;
  independent_rate: number;
  hints_used: number;
  xp: number;
  due: number;
  modules: Array<{
    slug: string;
    title: string;
    solved: number;
    solved_ids: string[];
    total: number;
    mastery: number;
    status: string;
  }>;
  activity: Array<{ day: string; attempts: number; solved: number }>;
  recent_errors: Array<{
    id: number;
    exercise_id: string;
    error_type: string;
    created_at: string;
  }>;
};
export type RunResult = {
  ok: boolean;
  passed?: boolean;
  stdout?: string;
  result?: {
    kind: string;
    columns?: string[];
    index?: string[];
    data?: unknown;
    dtype?: string;
    name?: string | null;
  };
  error?: string;
  execution_ms: number;
  tests_passed?: number;
  tests_total?: number;
  attempt_number?: number;
  hints_used?: number;
  xp_earned?: number;
  approach?: string;
  achievement_evidence?: {
    methods: string[];
    hasLoop: boolean;
    chainDepth: number;
    referenceChainDepth: number;
    alternativeStrategy: boolean;
  };
  completion_summary?: string;
  explanation?: {
    kind: string;
    title: string;
    what: string;
    where?: string | null;
    python_error?: string | null;
    line?: number | null;
    code_line?: string | null;
    difference?: string | null;
    expected?: string | null;
    actual?: string | null;
    check: string;
    nudge: string;
    hint?: string;
  } | null;
};
