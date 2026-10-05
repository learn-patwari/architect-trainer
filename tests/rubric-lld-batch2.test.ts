import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { ELEVATOR_SYSTEM } from '../shared/lld/elevator-system.ts';
import { LRU_CACHE } from '../shared/lld/lru-cache.ts';
import { SPLITWISE } from '../shared/lld/splitwise.ts';
import { TIC_TAC_TOE } from '../shared/lld/tic-tac-toe.ts';
import { VENDING_MACHINE } from '../shared/lld/vending-machine.ts';

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

describe('elevator system LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'SchedulingStrategy', ['interface']),
        node('nearest', 'NearestCarStrategy', []),
        node('scan', 'ScanStrategy', []),
        node('state', 'ElevatorState Enum', ['enumType']),
        node('controller', 'ElevatorController', []),
      ],
      [edge('nearest', 'iface', 'implements'), edge('scan', 'iface', 'implements'), edge('controller', 'nearest', 'uses')],
      ['Each elevator\'s request queue is thread-safe (synchronized)'],
    );
    const r = runRubric(ELEVATOR_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'concurrency-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'multi-elevator-coordination').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails concurrency and coordination checks when neither is named', () => {
    const g = graph([node('iface', 'Strategy', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    const r = runRubric(ELEVATOR_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'concurrency-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'multi-elevator-coordination').verdict).toBe('fail');
  });
});

describe('vending machine LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'VendingMachineState', ['interface']),
        node('idle', 'IdleState', []),
        node('hasMoney', 'HasMoneyState', []),
        node('coin', 'Coin Enum', ['enumType']),
      ],
      [edge('idle', 'iface', 'implements'), edge('hasMoney', 'iface', 'implements')],
      ['Inventory tracks remaining stock', 'Change calculation returns minimal coins'],
    );
    const r = runRubric(VENDING_MACHINE.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'inventory-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'change-calculation').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails inventory and change-calculation checks when neither is named', () => {
    const g = graph([node('iface', 'State', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    const r = runRubric(VENDING_MACHINE.rubric, g);
    expect(checkById(r.breakdown, 'inventory-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'change-calculation').verdict).toBe('fail');
  });
});

describe('LRU cache LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [node('iface', 'Cache', ['interface']), node('lru', 'LRUCache', [])],
      [edge('lru', 'iface', 'implements')],
      ['Backed by a HashMap and a doubly linked list for O(1) get/put', 'Fixed capacity evicts the tail when full', 'Access is thread-safe via a lock'],
    );
    const r = runRubric(LRU_CACHE.rubric, g);
    expect(checkById(r.breakdown, 'o1-data-structure').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'capacity-eviction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'thread-safety').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the O(1) data-structure check when the combination is never named', () => {
    const g = graph([node('iface', 'Cache', ['interface']), node('lru', 'LRUCache', [])], [edge('lru', 'iface', 'implements')]);
    expect(checkById(runRubric(LRU_CACHE.rubric, g).breakdown, 'o1-data-structure').verdict).toBe('fail');
  });
});

describe('tic-tac-toe LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'Player', ['interface']),
        node('human', 'HumanPlayer', []),
        node('ai', 'AIPlayer', []),
        node('cell', 'CellState Enum', ['enumType']),
      ],
      [edge('human', 'iface', 'implements'), edge('ai', 'iface', 'implements')],
      ['WinningStrategy checks rows/columns/diagonals', 'Board size is configurable NxN'],
    );
    const r = runRubric(TIC_TAC_TOE.rubric, g);
    expect(checkById(r.breakdown, 'win-condition-separated').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'extensibility-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails win-condition and extensibility checks when neither is named', () => {
    const g = graph([node('iface', 'Player', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    const r = runRubric(TIC_TAC_TOE.rubric, g);
    expect(checkById(r.breakdown, 'win-condition-separated').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'extensibility-named').verdict).toBe('fail');
  });
});

describe('Splitwise LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'SplitStrategy', ['interface']),
        node('equal', 'EqualSplit', []),
        node('exact', 'ExactSplit', []),
        node('type', 'SplitType Enum', ['enumType']),
      ],
      [edge('equal', 'iface', 'implements'), edge('exact', 'iface', 'implements')],
      ['Balance tracks net amount each user owes', 'Debt simplification minimizes settling transactions'],
    );
    const r = runRubric(SPLITWISE.rubric, g);
    expect(checkById(r.breakdown, 'balance-tracking').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'debt-simplification').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails balance-tracking and debt-simplification checks when neither is named', () => {
    const g = graph([node('iface', 'SplitStrategy', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    const r = runRubric(SPLITWISE.rubric, g);
    expect(checkById(r.breakdown, 'balance-tracking').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'debt-simplification').verdict).toBe('fail');
  });
});
