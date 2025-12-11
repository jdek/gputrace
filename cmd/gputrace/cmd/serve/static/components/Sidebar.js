import React, { useState, useMemo } from 'react';
import { html } from '../../utils.js';
import { ChevronRight, ChevronDown, Layers, Calculator, Play, Ban, FileText, Search, Filter, Sidebar as SidebarIcon } from 'lucide-react';
import { NodeType } from '../../constants.js';

const TraceNodeItem = ({ item, depth, onSelect, selectedId, filterTerm }) => {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedId === item.id;

  // Search/Filter logic: Check if this node or any children match
  const matchesFilter = useMemo(() => {
    if (!filterTerm) return true;
    const term = filterTerm.toLowerCase();

    // Check self
    if (item.label.toLowerCase().includes(term) || item.type.toLowerCase().includes(term)) return true;

    // Check properties
    if (item.properties) {
        for (const val of Object.values(item.properties)) {
            if (String(val).toLowerCase().includes(term)) return true;
        }
    }

    // Check children (recursive check done by parent logic usually, but here needed for visibility)
    // Actually, we usually want to hide nodes that don't match AND don't have matching children.
    // For simplicity in this recursive component, we'll let the parent decide or just render if 'visible'.
    return false;
  }, [item, filterTerm]);

  // If we have a filter, auto-expand if we match or children match
  // This requires a pre-pass or top-down control.
  // For this component-local approach, we can force expand if we detect children match.
  // But checking all children deep is expensive here.
  // Let's implement a simpler filter: if !matches and !hasMatchingChildren, return null.

  const hasMatchingChildren = useMemo(() => {
      if (!filterTerm || !item.children) return false;
      const term = filterTerm.toLowerCase();
      const check = (nodes) => {
          for(const n of nodes) {
              if(n.label.toLowerCase().includes(term)) return true;
              if(n.children && check(n.children)) return true;
          }
          return false;
      }
      return check(item.children);
  }, [item, filterTerm]);

  if (filterTerm && !matchesFilter && !hasMatchingChildren) {
      return null;
  }

  // Force expand if children match
  if (filterTerm && hasMatchingChildren && !expanded) {
      setExpanded(true);
  }

  const getIcon = (type) => {
    switch (type) {
      case NodeType.ROOT: return html`<${FileText} size=${14} className="text-gray-400" />`;
      case NodeType.ENCODER: return html`<${Calculator} size=${14} className="text-orange-500" />`;
      case NodeType.DISPATCH: return html`<${Play} size=${14} className="text-blue-500" />`;
      case NodeType.BARRIER: return html`<${Ban} size=${14} className="text-red-400" />`;
      case NodeType.GROUP: return html`<${Layers} size=${14} className="text-gray-500" />`;
      default: return html`<${Layers} size=${14} className="text-gray-400" />`;
    }
  };

  // Highlight logic
  const renderLabel = () => {
      if (!filterTerm) return item.label;
      const idx = item.label.toLowerCase().indexOf(filterTerm.toLowerCase());
      if (idx === -1) return item.label;
      return html`
        <span>
            ${item.label.substring(0, idx)}
            <span className="bg-yellow-900 text-yellow-100">${item.label.substring(idx, idx + filterTerm.length)}</span>
            ${item.label.substring(idx + filterTerm.length)}
        </span>
      `;
  }

  return html`
    <div>
      <div
        className=${`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-800 text-xs select-none ${isSelected ? 'bg-blue-900/40 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
        style=${{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick=${() => {
          onSelect(item);
        }}
      >
        <span
          className="mr-1 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-white"
          onClick=${(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          ${item.children && item.children.length > 0 && (
            expanded ? html`<${ChevronDown} size=${12} />` : html`<${ChevronRight} size=${12} />`
          )}
        </span>
        <span className="mr-2">${getIcon(item.type)}</span>
        <span className=${`truncate flex-1 ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
          ${renderLabel()}
        </span>
        ${item.stats?.duration && html`
            <span className="text-gray-500 ml-2 text-[10px] font-mono">${item.stats.duration}</span>
        `}
      </div>
      ${expanded && item.children && html`
        <div>
          ${item.children.map((child) => html`
            <${TraceNodeItem} key=${child.id} item=${child} depth=${depth + 1} onSelect=${onSelect} selectedId=${selectedId} filterTerm=${filterTerm} />
          `)}
        </div>
      `}
    </div>
  `;
};

export const Sidebar = ({ traceData, onSelect, selectedId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Handle advanced search modifiers later if needed (e.g. type:dispatch)
  // For now simple text match

  return html`
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-gray-800 text-gray-200 w-80 min-w-[300px] flex-shrink-0">
      <!-- Header / Toolbar -->
      <div className="h-10 flex items-center px-3 border-b border-gray-800 bg-[#252526] gap-2">
        <${SidebarIcon} size=${16} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-300">GPU Trace</span>
        <div className="flex-1" />
        <button className="p-1 hover:bg-gray-700 rounded"><${Filter} size=${14} className="text-gray-400" /></button>
      </div>

      <!-- Search -->
      <div className="p-2 border-b border-gray-800 bg-[#1e1e1e]">
        <div className="relative">
            <${Search} className="absolute left-2 top-1.5 text-gray-500" size=${14} />
            <input
                type="text"
                placeholder="Filter (e.g. matmul, type:dispatch)"
                className="w-full bg-[#2d2d2d] text-gray-200 text-xs rounded border border-gray-700 pl-8 pr-2 py-1 focus:outline-none focus:border-blue-500"
                value=${searchTerm}
                onInput=${(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <!-- Tree Content -->
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
        ${!traceData ? html`
            <div className="p-4 text-center text-gray-500 text-xs">Loading trace data...</div>
        ` : html`
            <!-- We treat traceData as root or list of roots -->
            ${Array.isArray(traceData) ? traceData.map(item => html`
                 <${TraceNodeItem} key=${item.id} item=${item} depth=${0} onSelect=${onSelect} selectedId=${selectedId} filterTerm=${searchTerm} />
            `) : html`
                 <${TraceNodeItem} key=${traceData.id} item=${traceData} depth=${0} onSelect=${onSelect} selectedId=${selectedId} filterTerm=${searchTerm} />
            `}
        `}
      </div>

      <!-- Summary Footer -->
      <div className="h-7 border-t border-gray-800 bg-[#252526] flex items-center px-3 text-[10px] text-gray-400 gap-4">
        <span>${traceData?.stats?.memory || '-'}</span>
        <span>${traceData?.stats?.duration || '-'}</span>
      </div>
    </div>
  `;
};
