import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Edge, 
  Node,
  Handle,
  Position,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { motion } from 'motion/react';
import { Download, Share2, ArrowLeft, Brain, HelpCircle, XCircle } from 'lucide-react';
import { MindMapData } from '../types';

interface MindMapProps {
  data: MindMapData;
  topic: string;
  onBack: () => void;
}

const nodeWidth = 180;
const nodeHeight = 60;

// Helper to calculate layout
const getLayoutedElements = (nodes: any[], edges: any[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 }); // Left to Right looks better for mindmaps

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// Custom Node for the Mind Map
const CustomNode = ({ data }: { data: any }) => {
  const isRoot = data.type === 'root';
  const isMain = data.type === 'main';
  const isError = data.type === 'error';

  return (
    <div className={`px-4 py-2 rounded-2xl border-2 transition-all shadow-sm
      ${isRoot ? 'bg-primary text-white border-indigo-400 shadow-indigo-200 min-w-[150px] text-center' : ''}
      ${isMain ? 'bg-white text-slate-800 border-primary/30 min-w-[120px]' : ''}
      ${isError ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-rose-100 min-w-[120px]' : ''}
      ${data.type === 'sub' ? 'bg-slate-50 text-slate-600 border-slate-200 text-sm' : ''}
    `}>
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isError && <XCircle size={14} className="text-rose-500" />}
          <span className={`font-bold ${isRoot ? 'text-lg' : 'text-sm'}`}>{data.label}</span>
        </div>
        {data.explanation && (
          <div className="text-[10px] opacity-70 leading-tight border-t border-rose-200 pt-1 mt-1 max-w-[150px]">
             Dica: {data.explanation}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  root: CustomNode,
  main: CustomNode,
  sub: CustomNode,
  error: CustomNode,
};

export default function MindMap({ data, topic, onBack }: MindMapProps) {
  // Convert our data to ReactFlow format
  const { nodes, edges } = useMemo(() => {
    const rawNodes = data.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: { label: n.label, type: n.type, explanation: n.explanation },
      position: { x: 0, y: 0 }, // Position will be calculated
    }));

    const rawEdges = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));

    return getLayoutedElements(rawNodes, rawEdges);
  }, [data]);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 leading-tight">Mapa Mental de Estudos</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{topic}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">
            <Download size={18} />
            <span className="hidden sm:inline">Baixar</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:scale-105 transition-all">
            <Share2 size={18} />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>
        </div>
      </header>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-50"
        >
          <Background />
          <Controls />
          <Panel position="bottom-right" className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 m-4 max-w-[300px]">
             <div className="flex items-center gap-2 mb-2 text-primary">
                <Brain size={20} />
                <span className="font-bold text-sm">Explicação da IA</span>
             </div>
             <p className="text-slate-500 text-xs leading-relaxed">
                Este mapa foca no que você acertou e destaca em <strong className="text-rose-500 underline decoration-rose-200">vermelho</strong> os pontos que merecem atenção dobrada!
             </p>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
