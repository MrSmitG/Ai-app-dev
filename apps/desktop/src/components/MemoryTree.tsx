import { Tip } from "./ui";

export type MemoryBranch = {
  id: string;
  title: string;
  parentId?: string | null;
  branchFromMsgIndex?: number | null;
  branchLabel?: string;
  /** Sacred / main timeline in this nexus */
  main?: boolean;
  messageCount: number;
  preview?: string;
};

type Props = {
  branches: MemoryBranch[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onPromoteMain?: (id: string) => void;
  hideHead?: boolean;
};

type Node = MemoryBranch & { children: Node[] };

function buildTree(branches: MemoryBranch[]): Node[] {
  const map = new Map<string, Node>();
  for (const b of branches) map.set(b.id, { ...b, children: [] });
  const roots: Node[] = [];
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n);
    else roots.push(n);
  }
  // Prefer main timeline first
  roots.sort((a, b) => Number(!!b.main) - Number(!!a.main));
  for (const n of map.values()) {
    n.children.sort((a, b) => (a.branchFromMsgIndex ?? 0) - (b.branchFromMsgIndex ?? 0));
  }
  return roots;
}

function BranchNode({
  node,
  depth,
  activeId,
  onSelect,
  onPromoteMain,
}: {
  node: Node;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  onPromoteMain?: (id: string) => void;
}) {
  const active = activeId === node.id;
  const isPivot = Boolean(node.parentId);
  return (
    <div className={`mem-node ${node.main ? "main-line" : "branch"} ${active ? "active" : ""}`} style={{ ["--depth" as string]: String(depth) }}>
      <div className="mem-rail">
        <span className={`mem-nexus ${node.main ? "sacred" : "variant"}`} />
        {!!node.children.length && <span className="mem-stem" />}
      </div>
      <div className="mem-body">
        <button type="button" className="mem-card" onClick={() => onSelect(node.id)}>
          <div className="mem-card-top">
            <span className="mem-kicker">{node.main ? "Sacred timeline" : isPivot ? "Pivot branch" : "Timeline"}</span>
            <span className="mem-count">{node.messageCount} events</span>
          </div>
          <div className="mem-title">{node.title || "Untitled"}</div>
          {node.branchLabel && <div className="mem-pivot">↯ {node.branchLabel}</div>}
          {node.preview && <div className="mem-preview muted">{node.preview}</div>}
        </button>
        {!node.main && onPromoteMain && (
          <button type="button" className="mem-promote" onClick={() => onPromoteMain(node.id)} title="Make this the main channel">
            Set main
          </button>
        )}
        {node.children.length > 0 && (
          <div className="mem-children">
            {node.children.map((c) => (
              <BranchNode key={c.id} node={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} onPromoteMain={onPromoteMain} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MemoryTree({ branches, activeId, onSelect, onPromoteMain, hideHead }: Props) {
  const tree = buildTree(branches);
  return (
    <div className="memory-tree">
      {!hideHead && (
        <div className="side-head memory-head">
          <span>
            Memory tree <Tip text="Main channel is the sacred timeline. Branching (pivot) creates a bifurcation — like Loki’s branched timelines — when you take a different path from a past message." />
          </span>
        </div>
      )}
      <div className="memory-scroll">
        {tree.map((n) => (
          <BranchNode key={n.id} node={n} depth={0} activeId={activeId} onSelect={onSelect} onPromoteMain={onPromoteMain} />
        ))}
        {!tree.length && <div className="muted pad">Start chatting — pivots will branch from the main channel.</div>}
      </div>
    </div>
  );
}
