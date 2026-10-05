/**
 * A drawing tool's scene graph, reduced to what the rubric engine needs: labeled
 * boxes and the arrows between them. Deliberately independent of Excalidraw's own
 * element shape (see excalidraw-graph.ts) so the rubric checks in ../rubric/ never
 * have to know what drawing tool produced the graph.
 */

export type Role =
  // HLD infrastructure roles
  | 'client'
  | 'loadBalancer'
  | 'appServer'
  | 'cache'
  | 'queue'
  | 'datastore'
  | 'cdn'
  // LLD / class-design roles
  | 'interface'
  | 'abstractClass'
  | 'enumType';

export interface SceneNode {
  id: string;
  label: string;
  /** A node can carry more than one role when its label is ambiguous, or none when unrecognized. */
  roles: Role[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  label: string | null;
}

export interface SceneGraph {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** Every distinct piece of text anywhere in the scene — node labels, edge labels, and
   *  free-standing annotations — for keyword checks that don't care which shape it's on
   *  (e.g. "was a sharding key named anywhere on the canvas"). */
  allText: string[];
}
