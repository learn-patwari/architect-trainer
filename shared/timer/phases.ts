/**
 * The seven phases of a system design round. Fixed across every HLD problem, so
 * the timer and its post-attempt analysis don't need to know which problem it is.
 */

export const PHASE_IDS = [
  'requirements',
  'estimation',
  'api',
  'data-model',
  'high-level',
  'deep-dive',
  'trade-offs',
] as const;

export type Phase = (typeof PHASE_IDS)[number];

export interface PhaseInfo {
  id: Phase;
  label: string;
  /** Recommended share of a 45-minute round, used to flag where time actually went vs. where it should have gone. */
  budgetShare: number;
  /** 'text' phases get a written field of their own; 'canvas' phases show the drawing surface instead. */
  kind: 'text' | 'canvas';
  /** Placeholder copy for a 'text' phase's field. */
  placeholder?: string;
}

export const PHASES: PhaseInfo[] = [
  {
    id: 'requirements',
    label: 'Requirements',
    budgetShare: 0.1,
    kind: 'text',
    placeholder:
      "Functional requirements (what the system must do), non-functional requirements (scale, latency, availability targets), and any assumptions you're making or explicitly asking the interviewer about.",
  },
  {
    id: 'estimation',
    label: 'Estimation',
    budgetShare: 0.1,
    kind: 'text',
    placeholder:
      'Back-of-envelope math: QPS (average and peak), storage growth, bandwidth, a rough server count. Use the Capacity estimation page for the arithmetic, then paste your numbers here.',
  },
  {
    id: 'api',
    label: 'API design',
    budgetShare: 0.1,
    kind: 'text',
    placeholder: 'The API surface — endpoints/methods with request and response shapes (or, for LLD, the public interface and method signatures your classes expose).',
  },
  {
    id: 'data-model',
    label: 'Data model',
    budgetShare: 0.15,
    kind: 'text',
    placeholder: 'Entities, fields, and relationships, and which store owns each one (or, for LLD, your class fields and how they relate to each other).',
  },
  { id: 'high-level', label: 'High-level design', budgetShare: 0.3, kind: 'canvas' },
  { id: 'deep-dive', label: 'Deep dive', budgetShare: 0.2, kind: 'canvas' },
  {
    id: 'trade-offs',
    label: 'Trade-offs',
    budgetShare: 0.05,
    kind: 'text',
    placeholder: "Alternatives you considered and why you didn't pick them, and the weaknesses of the design you did pick.",
  },
];

export function phaseLabel(id: Phase): string {
  return PHASES.find((p) => p.id === id)?.label ?? id;
}

export function isPhase(v: unknown): v is Phase {
  return typeof v === 'string' && (PHASE_IDS as readonly string[]).includes(v);
}
