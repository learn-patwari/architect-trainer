import { describe, expect, it } from 'vitest';
import { runRubric } from '../shared/rubric/run.ts';
import type { RubricCheckResult } from '../shared/rubric/types.ts';
import type { SceneGraph } from '../shared/scene/types.ts';
import { CHESS_GAME } from '../shared/lld/chess-game.ts';
import { IN_MEMORY_FILE_SYSTEM } from '../shared/lld/in-memory-file-system.ts';
import { MOVIE_TICKET_BOOKING_SYSTEM } from '../shared/lld/movie-ticket-booking-system.ts';

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

describe('chess game LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [
        node('iface', 'Piece', ['interface']),
        node('rook', 'Rook', []),
        node('knight', 'Knight', []),
        node('color', 'Color Enum', ['enumType']),
      ],
      [edge('rook', 'iface', 'implements'), edge('knight', 'iface', 'implements')],
      ['Move validation checks legal moves', 'Detects check and checkmate'],
    );
    const r = runRubric(CHESS_GAME.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'polymorphism-used').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'move-validation-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'check-checkmate-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails check/checkmate detection when nothing is named', () => {
    const g = graph([node('iface', 'Piece', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    expect(checkById(runRubric(CHESS_GAME.rubric, g).breakdown, 'check-checkmate-named').verdict).toBe('fail');
  });
});

describe('in-memory file system LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [node('iface', 'Entry', ['interface']), node('file', 'File', []), node('dir', 'Directory', [])],
      [edge('file', 'iface', 'implements'), edge('dir', 'iface', 'implements')],
      ['Path resolution tokenizes and walks from root', 'Composite tree structure of entries'],
    );
    const r = runRubric(IN_MEMORY_FILE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'path-resolution-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'composite-structure-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails path-resolution and composite checks when neither is named', () => {
    const g = graph([node('iface', 'Entry', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    const r = runRubric(IN_MEMORY_FILE_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'path-resolution-named').verdict).toBe('fail');
    expect(checkById(r.breakdown, 'composite-structure-named').verdict).toBe('fail');
  });
});

describe('movie ticket booking system LLD rubric', () => {
  it('scores a well-formed design highly', () => {
    const g = graph(
      [node('iface', 'PricingStrategy', ['interface']), node('std', 'StandardPricing', []), node('dyn', 'DynamicPricing', []), node('status', 'SeatStatus Enum', ['enumType'])],
      [edge('std', 'iface', 'implements'), edge('dyn', 'iface', 'implements')],
      ['Seat lock with a hold expiry prevents double-booking'],
    );
    const r = runRubric(MOVIE_TICKET_BOOKING_SYSTEM.rubric, g);
    expect(checkById(r.breakdown, 'has-abstraction').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'seat-locking-named').verdict).toBe('pass');
    expect(checkById(r.breakdown, 'pricing-strategy-named').verdict).toBe('pass');
    expect(r.percent).toBeGreaterThan(70);
  });

  it('fails the seat-locking check when no atomic mechanism is named', () => {
    const g = graph([node('iface', 'PricingStrategy', ['interface']), node('a', 'A', [])], [edge('a', 'iface', 'implements')]);
    expect(checkById(runRubric(MOVIE_TICKET_BOOKING_SYSTEM.rubric, g).breakdown, 'seat-locking-named').verdict).toBe('fail');
  });
});
