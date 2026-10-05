import { describe, expect, it } from 'vitest';
import { buildReviewPrompt } from '../shared/ai-prompt.ts';

describe('buildReviewPrompt', () => {
  it('includes the requirements, notes and scene description, and omits empty sections', () => {
    const prompt = buildReviewPrompt({
      title: 'Design a URL Shortener',
      difficulty: 'Medium',
      statement: 'Shorten URLs.',
      notes: 'Assuming 100:1 read/write.',
      sceneDescription: 'Nodes:\n- Load Balancer [loadBalancer]',
      attempt: null,
      hasImage: false,
    });
    expect(prompt).toContain('Shorten URLs.');
    expect(prompt).toContain('Assuming 100:1 read/write.');
    expect(prompt).toContain('Load Balancer');
    expect(prompt).toContain('Verdict');
    expect(prompt).not.toContain('null');
  });

  it('includes the rubric breakdown and notes the attached image when an attempt is present', () => {
    const prompt = buildReviewPrompt({
      title: 'Design a URL Shortener',
      difficulty: 'Medium',
      statement: 'Shorten URLs.',
      notes: null,
      sceneDescription: '(Nothing drawn.)',
      hasImage: true,
      attempt: {
        slug: 'design-a-url-shortener',
        track: 'hld',
        title: 'Design a URL Shortener',
        score: 10,
        maxScore: 18,
        percent: 56,
        breakdown: [{ id: 'load-balancer', label: 'Load balancer', points: 3, max: 3, verdict: 'pass', detail: 'Good.' }],
        rated: true,
        ratingBefore: 1200,
        ratingAfter: 1230,
        referenceApproach: 'Reference text.',
        at: new Date().toISOString(),
        elapsedSec: 100,
        activeSec: 90,
        phaseTimes: {},
      },
    });
    expect(prompt).toContain('10/18');
    expect(prompt).toContain('Load balancer: pass');
    expect(prompt).toContain('screenshot of the diagram is attached');
  });

  it('combines every text phase\'s written answer into one design write-up, skipping blank phases', () => {
    const prompt = buildReviewPrompt({
      title: 'Design a URL Shortener',
      difficulty: 'Medium',
      statement: 'Shorten URLs.',
      notes: null,
      phaseAnswers: { requirements: '100M DAU.', estimation: '', 'trade-offs': 'Chose SQL over NoSQL.' },
      sceneDescription: '(Nothing drawn.)',
      attempt: null,
      hasImage: false,
    });
    expect(prompt).toContain('design write-up');
    expect(prompt).toContain('100M DAU.');
    expect(prompt).toContain('Chose SQL over NoSQL.');
  });

  it('omits the design write-up section entirely when no phase has an answer', () => {
    const prompt = buildReviewPrompt({
      title: 'Design a URL Shortener',
      difficulty: 'Medium',
      statement: 'Shorten URLs.',
      notes: null,
      phaseAnswers: null,
      sceneDescription: '(Nothing drawn.)',
      attempt: null,
      hasImage: false,
    });
    expect(prompt).not.toContain('design write-up');
  });
});
