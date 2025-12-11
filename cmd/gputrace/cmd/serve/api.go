package serve

import (
	"encoding/json"
	"net/http"

	"github.com/tmc/gputrace"
)

func (s *Server) handleAPIStats(w http.ResponseWriter, r *http.Request) {
	stats, err := gputrace.ExtractStatistics(s.trace)
	if err != nil {
		http.Error(w, "Failed to extract statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (s *Server) handleAPIKernels(w http.ResponseWriter, r *http.Request) {
	// For now, we'll return the list of kernel names from the trace.
	// In a real implementation, we would want more details (dispatches, etc.)
	// which might require traversing the trace or using ExtractStatistics if it has that info.

	// Re-using ExtractStatistics for consistency, but we might want a dedicated struct.
	stats, err := gputrace.ExtractStatistics(s.trace)
	if err != nil {
		http.Error(w, "Failed to extract statistics", http.StatusInternalServerError)
		return
	}

    // Create a simpler response for kernels
    type KernelInfo struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }

    kernels := make([]KernelInfo, 0, len(s.trace.KernelNames))
    for i, name := range s.trace.KernelNames {
        kernels = append(kernels, KernelInfo{
            ID:   i,
            Name: name,
        })
    }

	w.Header().Set("Content-Type", "application/json")

    // We can return more info later. For now just the list.
	json.NewEncoder(w).Encode(map[string]interface{}{
        "kernels": kernels,
        "count": len(kernels),
        "unique_count": stats.UniqueKernels,
    })
}
