import React, { useState, useEffect } from 'react';
import { html } from '../utils.js';
import { Sidebar } from './components/Sidebar.js';
import { GraphCanvas } from './components/GraphCanvas.js';
import { Inspector } from './components/Inspector.js';
import { TimelineView } from './components/TimelineView.js';
import { ResourceGraph } from './components/ResourceGraph.js';
import { Command, Maximize2, MoreHorizontal, Play, Save, Activity, Clock, BarChart2, Database } from 'lucide-react';

const ViewMode = {
    OVERVIEW: 'overview',
    TIMELINE: 'timeline',
    COST: 'cost',
    RESOURCES: 'resources'
};

export default function App() {
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedGraphId, setSelectedGraphId] = useState(null);
    const [viewMode, setViewMode] = useState(ViewMode.OVERVIEW);
    const [traceData, setTraceData] = useState(null);

    // Fetch Trace Data on Load
    useEffect(() => {
        fetch('/api/trace')
            .then(res => res.json())
            .then(data => {
                setTraceData(data);
                // Pre-select root
                setSelectedItem(data);
            })
            .catch(err => console.error("Failed to load trace", err));
    }, []);

    // Helper to find item by ID in hierarchical tree
    const findTraceItem = (items, id) => {
        if (!items) return null;
        // Check if items is an array or single object (root)
        const list = Array.isArray(items) ? items : [items];

        for (const item of list) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findTraceItem(item.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const handleSelect = (id) => {
        setSelectedGraphId(id);

        if (!id) {
            setSelectedItem(null);
            return;
        }

        const item = findTraceItem(traceData, id);
        if (item) {
            setSelectedItem(item);
        } else {
            // Visual node only
            setSelectedItem({ id, label: id, type: 'buffer', description: 'Visual Node' });
        }
    };

    return html`
    <div className="flex flex-col h-screen w-screen bg-[#000] text-gray-200 font-sans overflow-hidden">

      <!-- Top Application Bar -->
      <div className="h-10 bg-[#2d2d2d] border-b border-black flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-4">
             <div className="flex gap-2 group">
                 <div className="w-3 h-3 rounded-full bg-red-500 group-hover:bg-red-600 transition-colors" />
                 <div className="w-3 h-3 rounded-full bg-yellow-500 group-hover:bg-yellow-600 transition-colors" />
                 <div className="w-3 h-3 rounded-full bg-green-500 group-hover:bg-green-600 transition-colors" />
             </div>
             <div className="h-6 w-[1px] bg-gray-700 mx-2" />
             <div className="flex gap-4 text-gray-400">
                <button className="hover:text-white transition-colors"><${Command} size=${16} /></button>
                <button className="hover:text-white transition-colors"><${Save} size=${16} /></button>
             </div>
        </div>

        <!-- View Switcher -->
        <div className="flex bg-[#1e1e1e] rounded-md p-0.5 border border-gray-700">
             <button
                className=${`px-3 py-0.5 text-xs rounded-sm flex items-center gap-1.5 transition-colors ${viewMode === ViewMode.OVERVIEW ? 'bg-[#3b3b3b] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                onClick=${() => setViewMode(ViewMode.OVERVIEW)}
             >
                <${Activity} size=${12} /> Overview
             </button>
             <button
                className=${`px-3 py-0.5 text-xs rounded-sm flex items-center gap-1.5 transition-colors ${viewMode === ViewMode.TIMELINE ? 'bg-[#3b3b3b] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                onClick=${() => setViewMode(ViewMode.TIMELINE)}
             >
                <${Clock} size=${12} /> Timeline
             </button>
             <button
                className=${`px-3 py-0.5 text-xs rounded-sm flex items-center gap-1.5 transition-colors ${viewMode === ViewMode.RESOURCES ? 'bg-[#3b3b3b] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                onClick=${() => setViewMode(ViewMode.RESOURCES)}
             >
                <${Database} size=${12} /> Resources
             </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1 hover:text-white cursor-pointer px-2 py-1 hover:bg-gray-700 rounded transition-colors">
                <${Play} size=${12} className="fill-current" /> Start Page
            </span>
            <${MoreHorizontal} size=${16} />
        </div>
      </div>

      <!-- Main Content Area -->
      <div className="flex-1 flex overflow-hidden">

        <!-- Left Sidebar: Command List (Visible in Overview and Cost) -->
        ${viewMode !== ViewMode.TIMELINE && viewMode !== ViewMode.RESOURCES && html`
            <${Sidebar}
                traceData=${traceData}
                selectedId=${selectedItem?.id || null}
                onSelect=${(item) => handleSelect(item.id)}
            />
        `}

        <!-- Center: Viewport -->
        <div className="flex-1 relative flex flex-col bg-[#111]">

            ${viewMode === ViewMode.OVERVIEW && html`
                <!-- Toolbar for Graph -->
                <div className="h-8 bg-[#1e1e1e] border-b border-gray-800 flex items-center px-2 justify-between">
                    <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><${Maximize2} size=${14} /></button>
                        <div className="h-4 w-[1px] bg-gray-700" />
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold ml-2">Dependency Graph</span>
                    </div>
                </div>
                <${GraphCanvas}
                    traceData=${traceData}
                    selectedId=${selectedGraphId}
                    onSelect=${handleSelect}
                />
            `}

            ${viewMode === ViewMode.TIMELINE && html`<${TimelineView} onSelect=${handleSelect} />`}

            ${viewMode === ViewMode.RESOURCES && html`<${ResourceGraph} onSelect=${handleSelect} />`}

        </div>

        <!-- Right Sidebar: Inspector (Only in Overview) -->
        ${viewMode === ViewMode.OVERVIEW && html`
            <${Inspector}
                item=${selectedItem}
                onSelect=${handleSelect}
            />
        `}

      </div>

      <!-- Status Bar -->
      <div className="h-6 bg-[#007acc] text-white flex items-center px-3 text-[10px] justify-between">
        <div className="flex gap-4">
            <span>Auto</span>
            <span>Ready</span>
        </div>
        <div>
             UTF-8
        </div>
      </div>
    </div>
    `;
}
