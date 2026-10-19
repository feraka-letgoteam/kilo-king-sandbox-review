/** Presentation-only gate. Keeps the board model intact for exit/Skip while
 * excluding every symbol and reel interior from rendering in Max mode. */
export function setMaxStageVisibility(nodes: readonly { visible: boolean }[], active: boolean) {
  for (const node of nodes) node.visible = !active;
}
