import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    ReactFlowProvider,
    useReactFlow
} from 'reactflow';
import { html } from '../../utils.js';
import { Cpu, Play, ArrowRightLeft, Clock, Layers, ChevronDown, Lock, Unlock, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { NodeType } from '../../constants.js';

// --- Custom Nodes ---

const DispatchNode = ({ data, selected }) => {
    return html`
        <div className=${`flex flex-col rounded-md shadow-xl min-w-[150px] bg-[#1a1a1a] border transition-all overflow-hidden ${selected ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-900/20' : 'border-gray-700'}`}>
            <${Handle} type="target" position=${Position.Top} className="!bg-gray-500 !w-3 !h-1.5 !rounded-b-sm !top-0" />

            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800/50 border-b border-gray-700/50">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <span className="text-[9px] text-blue-200 font-bold uppercase tracking-wider opacity-80">Dispatch</span>
                <div className="flex-1" />
                ${data.duration && html`
                    <div className="flex items-center gap-1 bg-gray-900/50 px-1.5 rounded">
                        <${Clock} size=${8} className="text-gray-500"/>
                        <span className="text-[9px] text-gray-400 font-mono">${data.duration}</span>
                    </div>
                `}
            </div>

            <div className="p-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                     <${Play} size=${10} className="text-gray-500 flex-shrink-0" />
                     <span className="text-[10px] text-gray-200 font-semibold font-mono truncate" title=${data.function}>
                        ${data.function || 'kernel_main'}
                     </span>
                </div>

                ${(data.threads || data.grid) && html`
                    <div className="grid grid-cols-2 gap-1 mt-1">
                        ${data.threads && html`
                            <div className="bg-gray-900/80 rounded px-1.5 py-1 border border-gray-800 flex flex-col">
                                <span className="text-[7px] text-gray-500 uppercase leading-none mb-0.5">Threads</span>
                                <span className="text-[9px] text-gray-300 font-mono leading-none">${data.threads}</span>
                            </div>
                        `}
                        ${data.grid && html`
                            <div className="bg-gray-900/80 rounded px-1.5 py-1 border border-gray-800 flex flex-col">
                                <span className="text-[7px] text-gray-500 uppercase leading-none mb-0.5">Grid</span>
                                <span className="text-[9px] text-gray-300 font-mono leading-none">${data.grid}</span>
                            </div>
                        `}
                    </div>
                `}
            </div>

            <${Handle} type="source" position=${Position.Bottom} className="!bg-blue-500 !w-3 !h-1.5 !rounded-t-sm !bottom-0" />
        </div>
    `;
};

const BarrierNode = ({ data, selected }) => {
     return html`
        <div className=${`px-2 py-1 rounded-full bg-gray-900 border flex items-center gap-2 ${selected ? 'border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'border-gray-700'}`}>
             <${Handle} type="target" position=${Position.Top} className="!bg-gray-500 !w-1 !h-1 !opacity-0" />
             <div className="p-1 rounded-full bg-red-900/30">
                <${ArrowRightLeft} size=${10} className="text-red-400"/>
             </div>
             <div className="flex flex-col pr-1">
                 <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wide">Barrier</span>
             </div>
             <${Handle} type="source" position=${Position.Bottom} className="!bg-gray-500 !w-1 !h-1 !opacity-0" />
        </div>
     `;
};

const EncoderGroupNode = ({ data, selected, id }) => {
    const { label, collapsed, onToggle } = data;

    return html`
        <div
            className="w-full h-full relative group transition-all duration-300 ease-in-out"
        >
            <div
                className=${`absolute inset-x-0 top-0 flex items-center gap-1.5 px-2 py-1.5 rounded-t border backdrop-blur-sm transition-colors cursor-pointer z-10
                    ${selected ? 'bg-red-900/80 border-red-500/50' : 'bg-gray-900/90 border-red-900/30 hover:bg-gray-800'}
                    ${collapsed ? 'rounded-b border-b' : 'border-b-0'}
                `}
                onClick=${(e) => {
                    e.stopPropagation();
                    onToggle && onToggle(id);
                }}
            >
                <div className=${`transition-transform duration-300 ${collapsed ? '-rotate-90' : 'rotate-0'}`}>
                    <${ChevronDown} size=${12} className="text-gray-400" />
                </div>
                <${Cpu} size=${12} className="text-red-500" />
                <span className="text-[11px] text-gray-200 font-medium tracking-wide select-none truncate flex-1">${label}</span>

                ${collapsed && html`
                     <span className="text-[9px] text-gray-500 font-mono bg-black/30 px-1.5 rounded ml-2">
                        ${data.duration || '~'}
                     </span>
                `}
            </div>

             <div className=${`w-full h-full rounded border border-red-900/20 bg-gray-900/20 absolute top-0 left-0 -z-10 transition-all duration-300 ${collapsed ? 'opacity-0' : 'opacity-100'}`} />
        </div>
    `;
};

const nodeTypes = {
  dispatch: DispatchNode,
  barrier: BarrierNode,
  group: EncoderGroupNode,
};

// --- Main Canvas ---

const GraphCanvasInner = ({ traceData, selectedId, onSelect }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    const [isLocked, setIsLocked] = useState(false);

    // We need to transform traceData into nodes/edges
    // This is a simplified transformation for demo purposes
    // In a real app, you'd traverse the tree and layout nodes

    useEffect(() => {
        if (!traceData) return;

        // Simple layout: Stack encoders vertically, place dispatches inside
        // Since we don't have a layout engine like Dagre here, we'll do simple stacking

        const newNodes = [];
        const newEdges = [];
        let yOffset = 0;

        // Helper to process a group (Encoder or CB)
        const processGroup = (item, parentId = null) => {
            const isGroup = item.type === NodeType.ENCODER || item.type === NodeType.GROUP;

            // Only render visual nodes for Groups, Dispatches, Barriers
            // Root is container
            if (item.type === NodeType.ROOT) {
                if (item.children) item.children.forEach(c => processGroup(c));
                return;
            }

            if (isGroup) {
                const height = 200; // Mock height
                newNodes.push({
                    id: item.id,
                    type: 'group',
                    data: {
                        label: item.label,
                        duration: item.stats?.duration,
                        collapsed: collapsedIds.has(item.id),
                        onToggle: (id) => setCollapsedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                        })
                    },
                    position: { x: 0, y: yOffset },
                    style: { width: 300, height: collapsedIds.has(item.id) ? 36 : height }
                });

                // Process children if not collapsed
                // Actually ReactFlow requires children to be added always, but hidden if parent collapsed?
                // Or we can just not add them.
                // For 'group' type in ReactFlow, we use parentNode

                if (!collapsedIds.has(item.id) && item.children) {
                     let childY = 50;
                     item.children.forEach((child, idx) => {
                         const childId = child.id;
                         if (child.type === NodeType.DISPATCH) {
                             newNodes.push({
                                 id: childId,
                                 type: 'dispatch',
                                 data: {
                                     label: child.label,
                                     function: child.properties?.['Function'] || child.label,
                                     duration: child.stats?.duration,
                                     threads: child.stats?.threads,
                                     grid: child.properties?.['Grid Size']
                                 },
                                 position: { x: 20, y: childY },
                                 parentNode: item.id,
                                 extent: 'parent'
                             });

                             // Link to previous sibling
                             if (idx > 0) {
                                 const prevId = item.children[idx-1].id;
                                 newEdges.push({
                                     id: `e-${prevId}-${childId}`,
                                     source: prevId,
                                     target: childId,
                                     type: 'smoothstep',
                                     style: { stroke: '#52525b' }
                                 });
                             }

                             childY += 100;
                         }
                     });
                }

                yOffset += (collapsedIds.has(item.id) ? 36 : height) + 50;
            }
        };

        // Flat list of root children processing
        // Assumes traceData is the root object
        processGroup(traceData);

        setNodes(newNodes);
        setEdges(newEdges);

    }, [traceData, collapsedIds]);

    const reactFlowInstance = useReactFlow();

    return html`
        <div className="flex-1 h-full w-full bg-[#111] relative">
            <${ReactFlow}
                nodes=${nodes}
                edges=${edges}
                onNodesChange=${onNodesChange}
                onEdgesChange=${onEdgesChange}
                onNodeClick=${(_, node) => onSelect(node.id)}
                onPaneClick=${() => onSelect(null)}
                nodeTypes=${nodeTypes}
                fitView
                minZoom=${0.1}
                nodesDraggable=${!isLocked}
                nodesConnectable=${false}
                proOptions=${{ hideAttribution: true }}
            >
                <${Background} color="#333" gap=${20} size=${1} />
                <${MiniMap}
                    nodeColor=${(n) => {
                        if (n.type === 'group') return '#333';
                        if (n.type === 'dispatch') return '#3b82f6';
                        return '#eee';
                    }}
                    className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden !bottom-24 !left-4"
                    maskColor="rgba(0,0,0,0.6)"
                />
            <//>

            <!-- Custom Controls -->
            <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-gray-900/90 rounded-lg p-2 border border-gray-700 z-50">
                 <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick=${() => reactFlowInstance.zoomIn()} title="Zoom In">
                    <${ZoomIn} size=${16} />
                 </button>
                 <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick=${() => reactFlowInstance.zoomOut()} title="Zoom Out">
                    <${ZoomOut} size=${16} />
                 </button>
                 <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" onClick=${() => reactFlowInstance.fitView()} title="Fit View">
                    <${Maximize} size=${16} />
                 </button>
                 <div className="h-[1px] bg-gray-700 my-1" />
                 <button className=${`p-1 rounded hover:text-white ${isLocked ? 'text-red-400 bg-red-900/20' : 'text-gray-400 hover:bg-gray-700'}`} onClick=${() => setIsLocked(!isLocked)} title=${isLocked ? "Unlock Layout" : "Lock Layout"}>
                    ${isLocked ? html`<${Lock} size=${16} />` : html`<${Unlock} size=${16} />`}
                 </button>
            </div>

            <!-- Zoom Hint -->
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 bg-black/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                Scroll to zoom • Click group headers to collapse
            </div>
        </div>
    `;
};

export const GraphCanvas = (props) => html`
    <${ReactFlowProvider}>
        <${GraphCanvasInner} ...${props} />
    <//>
`;
