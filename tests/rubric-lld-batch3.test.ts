import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { ATM_MACHINE } from '../shared/lld/atm-machine.ts';
import { LIBRARY_MANAGEMENT_SYSTEM } from '../shared/lld/library-management-system.ts';

function node(id: string, label: string, roles: SceneGraph['nodes'][number]['roles']): SceneGraph['nodes'][number] {
  return { id, label, roles, x: 0, y: 0, width: 100, height: 60 };
}
function edge(from: string, to: string, label: string | null = null): SceneGraph['edges'][number] {
  return { id: `${from}-${to}`, from, to, label };
}
function graph(nodes: SceneGraph['nodes'], edges: SceneGraph['edges'] = [], extraText: string[] = []): SceneGraph {
  return { nodes, edges, allText: [...nodes.map((n) => n.label), ...edges.map((e) => e.label ?? '').filter(Boolean), ...extraText] };
}
function checkById(breakdown: RubricCheckResult[], id: string): RubricCheckResult {
  return breakdown.find((c) => c.id === id)!;
}

describe('library management system LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'SearchStrategy', ['interface']),
        node('title', 'TitleSearch', []),
        node('author', 'AuthorSearch', []),
        node('status', 'BookStatus Enum', ['enumType']),
        node('library', 'Library', []),
      ],
      [edge('title', 'iface', 'implements'), edge('author', 'iface', 'implements'), edge('library', 'title', 'uses')],
      ['A Loan tracks the due date', 'Overdue fine is a per-day late fee'],
    );
    const r = runRubric(LIBRARY_MANAGEMENT_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'fine-or-due-date-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'orchestrator-present').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the fine/due-date check when neither is named', () => {
    const g = graph([node('iface', 'SearchStrategy', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    expect(checkById(runRubric(LIBRARY_MANAGEMENT_SYSTEM.rubric, g).breakdown, 'fine-or-due-date-named').verdict).toBe('fail');
  });
});

describe('ATM machine LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'ATMState', ['interface']),
        node('idle', 'IdleState', []),
        node('hasCard', 'HasCardState', []),
        node('status', 'TransactionStatus Enum', ['enumType']),
        node('atm', 'ATM', []),
      ],
      [edge('idle', 'iface', 'implements'), edge('hasCard', 'iface', 'implements'), edge('atm', 'idle', 'has-a')],
      ['CashDispenser picks the minimum number of notes per denomination'],
    );
    const r = runRubric(ATM_MACHINE.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'cash-dispensing-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'orchestrator-present').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the cash-dispensing check when no algorithm is named', () => {
    const g = graph([node('iface', 'ATMState', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    expect(checkById(runRubric(ATM_MACHINE.rubric, g).breakdown, 'cash-dispensing-named').verdict).toBe('fail');
  });
});
