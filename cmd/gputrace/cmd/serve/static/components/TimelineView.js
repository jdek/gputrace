import React, { useState, useEffect, useRef } from 'react';
import { html } from '../../utils.js';
import { Filter, ChevronDown } from 'lucide-react';

export const TimelineView = ({ onSelect }) => {
    const [data, setData] = useState(null);
    const [zoom, setZoom] = useState(1); // 1 = fit all
    const [offset, setOffset] = useState(0); // Pan offset in %
    const [hoverX, setHoverX] = useState(null);

    const containerRef = useRef(null);

    useEffect(() => {
        fetch('/api/timeline')
            .then(res => res.json())
            .then(setData)
            .catch(console.error);
    }, []);

    if (!data) return html`<div className="flex-1 flex items-center justify-center text-gray-500">Loading timeline...</div>`;

    const totalDuration = data.total_duration_ms || 1000;

    // Zoom/Pan logic
    const handleWheel = (e) => {
        if (e.shiftKey) {
            // Pan
            setOffset(prev => Math.max(0, Math.min(100, prev + (e.deltaY * 0.1))));
        } else {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.max(1, prev * delta));
        }
    };

    // Helper to calculate position styles
    const getLeft = (start) => `${((start / totalDuration) * 100) * zoom - offset}%`;
    const getWidth = (duration) => `${((duration / totalDuration) * 100) * zoom}%`;

    const handleMouseMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setHoverX(x);
    };

    const timeAtCursor = hoverX !== null && containerRef.current
        ? ((hoverX / containerRef.current.offsetWidth) + offset/100) / zoom * totalDuration
        : 0;

    return html`
        <div className="flex-1 flex flex-col bg-[#111] overflow-hidden">
            <!-- Timeline Toolbar -->
            <div className="h-8 bg-[#1e1e1e] border-b border-gray-800 flex items-center px-4 text-xs text-gray-400 gap-4">
                <div className="flex items-center gap-2 bg-[#111] border border-gray-700 rounded px-2 py-0.5">
                    <${Filter} size=${10} />
                    <span className="text-[10px]">Filter Tracks</span>
                </div>
                <div className="flex-1 text-center font-mono text-[10px] text-gray-500">
                    Window: ${totalDuration.toFixed(2)}ms • Zoom: ${zoom.toFixed(1)}x
                </div>
            </div>

            <!-- Timeline Container -->
            <div
                className="flex-1 flex flex-col relative overflow-hidden"
                onWheel=${handleWheel}
                onMouseMove=${handleMouseMove}
                onMouseLeave=${() => setHoverX(null)}
                ref=${containerRef}
            >
                <!-- Ruler -->
                <div className="h-6 bg-[#1a1a1a] border-b border-gray-800 flex flex-shrink-0">
                    <div className="w-48 flex-shrink-0 border-r border-gray-800 bg-[#252526] flex items-center px-2 text-[10px] text-gray-400 font-bold z-10">
                        Tracks
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                         ${[0, 0.25, 0.5, 0.75, 1].map(t => html`
                            <div className="absolute top-0 bottom-0 border-l border-gray-700/50" style=${{ left: (t * 100) + '%' }}>
                                <span className="text-[9px] text-gray-500 pl-1">${(t * totalDuration).toFixed(1)}ms</span>
                            </div>
                         `)}
                    </div>
                </div>

                <!-- Tracks -->
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                    <!-- Global Cursor Line -->
                    ${hoverX !== null && html`
                        <div
                            className="absolute top-0 bottom-0 w-px bg-red-500/50 z-50 pointer-events-none"
                            style=${{ left: hoverX }}
                        />
                        <div
                            className="absolute top-0 bg-red-900/80 text-white text-[9px] px-1 rounded z-50 pointer-events-none"
                            style=${{ left: hoverX + 5 }}
                        >
                            ${timeAtCursor.toFixed(3)}ms
                        </div>
                    `}

                    ${data.tracks.map(track => {
                        const trackEvents = data.events.filter(e => e.track_id === track.id);
                        return html`
                            <div key=${track.id} className="flex border-b border-gray-800/50 h-8 hover:bg-[#1a1a1a] group relative">
                                <div className="w-48 flex-shrink-0 border-r border-gray-800 bg-[#1e1e1e] flex items-center px-2 text-[11px] text-gray-300 gap-2 relative z-20">
                                    <${ChevronDown} size=${10} className="text-gray-500" />
                                    ${track.label}
                                </div>
                                <div className="flex-1 relative bg-[#111]">
                                    ${trackEvents.map(ev => html`
                                        <div
                                            key=${ev.id}
                                            className=${`absolute top-1 bottom-1 rounded-sm border border-black/20 text-[9px] text-white flex items-center px-1 overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 ${ev.color || 'bg-blue-600'}`}
                                            style=${{
                                                left: getLeft(ev.start_ms),
                                                width: getWidth(ev.duration_ms),
                                                minWidth: '2px'
                                            }}
                                            onClick=${() => onSelect(ev.id)}
                                            title=${`${ev.label} (${ev.duration_ms.toFixed(3)}ms)`}
                                        >
                                            <span className="truncate">${ev.label}</span>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `;
                    })}
                </div>
            </div>
        </div>
    `;
};
