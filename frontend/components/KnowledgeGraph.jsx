import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import dagre from "dagre";

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 60;

function layoutElements(nodes, edges) {
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const position = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: position.x - nodeWidth / 2,
          y: position.y - nodeHeight / 2,
        },
      };
    }),
    edges,
  };
}

function InnerKnowledgeGraph({ novaResult }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!novaResult) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];

    nodes.push({
      id: "verdict",
      data: { label: novaResult.verdict || "VERDICT" },
      position: { x: 0, y: 0 },
      style: {
        background: "#000",
        border: "2px solid #e8e8e8",
        color: "#e8e8e8",
        fontFamily: "var(--mono)",
        fontSize: 14,
        padding: "8px 16px",
        boxShadow: "0 0 20px rgba(232,232,232,0.2)",
        borderRadius: 4,
      },
    });

    (novaResult.key_assets || []).forEach((asset, index) => {
      const id = `asset_${index}`;
      nodes.push({
        id,
        data: { label: asset },
        position: { x: 0, y: 0 },
        style: {
          background: "#000",
          border: "1px solid #00ff9d",
          color: "#00ff9d",
          fontFamily: "var(--mono)",
          fontSize: 11,
          padding: "6px 12px",
          boxShadow: "0 0 8px rgba(0,255,157,0.3)",
          maxWidth: 180,
          borderRadius: 4,
        },
      });
      edges.push({
        id: `e-verdict-${id}`,
        source: "verdict",
        target: id,
        style: { stroke: "#2a2a2a", strokeWidth: 1 },
      });
    });

    (novaResult.key_risks || []).forEach((risk, index) => {
      const id = `risk_${index}`;
      nodes.push({
        id,
        data: { label: risk },
        position: { x: 0, y: 0 },
        style: {
          background: "#000",
          border: "1px solid #ff003c",
          color: "#ff003c",
          fontFamily: "var(--mono)",
          fontSize: 11,
          padding: "6px 12px",
          boxShadow: "0 0 8px rgba(255,0,60,0.3)",
          maxWidth: 180,
          borderRadius: 4,
        },
      });
      edges.push({
        id: `e-verdict-${id}`,
        source: "verdict",
        target: id,
        style: { stroke: "#2a2a2a", strokeWidth: 1 },
      });
    });

    return layoutElements(nodes, edges);
  }, [novaResult]);

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
      >
        <Background variant="dots" gap={24} size={1} color="#1a1a1a" />
      </ReactFlow>
    </div>
  );
}

export default function KnowledgeGraph({ novaResult }) {
  return (
    <ReactFlowProvider>
      <InnerKnowledgeGraph novaResult={novaResult} />
    </ReactFlowProvider>
  );
}

