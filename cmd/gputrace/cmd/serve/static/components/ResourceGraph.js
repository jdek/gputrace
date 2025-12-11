import React, { useState, useEffect } from 'react';
import { html } from '../../utils.js';
import { Database } from 'lucide-react';

export const ResourceGraph = () => {
    const [data, setData] = useState(null);

    useEffect(() => {
        fetch('/api/resources')
            .then(res => res.json())
            .then(setData)
            .catch(console.error);
    }, []);

    if (!data) return html`<div className="flex-1 flex items-center justify-center text-gray-500">Loading resources...</div>`;

    // Simple SVG Area Chart
    const height = 300;
    const width = 800; // ViewBox width
    const padding = 40;

    const maxVal = Math.max(...data.shared) || 1;
    const pts = data.shared.map((val, i) => {
        const x = (i / (data.shared.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((val / maxVal) * (height - 2 * padding));
        return `${x},${y}`;
    });

    const pathD = `M ${padding},${height - padding} ${pts.map(p => `L ${p}`).join(' ')} L ${width - padding},${height - padding} Z`;

    return html`
        <div className="flex-1 flex flex-col bg-[#111] overflow-hidden p-6">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                    <${Database} size=${20} className="text-blue-500"/>
                    Buffer Memory Usage
                </h2>
                <div className="flex gap-6 mt-4">
                    <div className="bg-[#1e1e1e] p-4 rounded border border-gray-800">
                        <div className="text-gray-500 text-xs uppercase font-bold">Peak Memory</div>
                        <div className="text-2xl text-white font-mono mt-1">${(data.stats.peak_memory_bytes / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <div className="bg-[#1e1e1e] p-4 rounded border border-gray-800">
                        <div className="text-gray-500 text-xs uppercase font-bold">Total Buffers</div>
                        <div className="text-2xl text-white font-mono mt-1">${data.stats.total_buffers}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-[#1a1a1a] rounded border border-gray-800 p-4 relative">
                <svg viewBox=${`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                    <!-- Grid -->
                    <line x1=${padding} y1=${height-padding} x2=${width-padding} y2=${height-padding} stroke="#333" />
                    <line x1=${padding} y1=${padding} x2=${padding} y2=${height-padding} stroke="#333" />

                    <!-- Area -->
                    <path d=${pathD} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />

                    <!-- Labels (Simplified) -->
                    <text x=${10} y=${padding} fill="#666" fontSize="10">${(maxVal/1024/1024).toFixed(0)} MB</text>
                    <text x=${10} y=${height-padding} fill="#666" fontSize="10">0 MB</text>
                </svg>
            </div>
        </div>
    `;
};
