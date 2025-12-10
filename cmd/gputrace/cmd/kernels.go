package cmd

import (
	"fmt"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/tmc/gputrace"
)

var (
	kernelsFilter  string
	kernelsVerbose bool
	kernelsStats   bool
)

var kernelsCmd = &cobra.Command{
	Use:   "kernels <trace.gputrace>",
	Short: "List kernel functions and their pipeline state mappings",
	Long: `List all kernel functions found in a GPU trace with their pipeline state addresses.

This command extracts the mapping between pipeline state objects and their
associated kernel functions, making it easy to understand which Metal functions
are being executed.

It can also display dispatch counts and associated debug groups/encoder labels.

Examples:
  # List all kernels with dispatch counts
  gputrace kernels trace.gputrace

  # Filter by kernel name (case-insensitive substring match)
  gputrace kernels trace.gputrace --filter copy
  gputrace kernels trace.gputrace --filter steel_gemm

  # Verbose output with detailed stats (debug groups, encoder labels)
  gputrace kernels trace.gputrace -v
  gputrace kernels trace.gputrace --stats`,
	Args: cobra.ExactArgs(1),
	RunE: runKernels,
}

func init() {
	rootCmd.AddCommand(kernelsCmd)

	kernelsCmd.Flags().StringVarP(&kernelsFilter, "filter", "f", "", "Filter kernels by name (case-insensitive substring match)")
	kernelsCmd.Flags().BoolVarP(&kernelsVerbose, "verbose", "v", false, "Show verbose output with additional details")
	kernelsCmd.Flags().BoolVar(&kernelsStats, "stats", false, "Show detailed statistics (debug groups, encoder labels)")
}

func runKernels(cmd *cobra.Command, args []string) error {
	tracePath := args[0]

	if err := checkTraceFile(tracePath); err != nil {
		return err
	}

	trace, err := gputrace.Open(tracePath)
	if err != nil {
		return fmt.Errorf("failed to open trace: %w", err)
	}

	// Analyze kernels to get stats
	stats, err := trace.AnalyzeKernels()
	if err != nil {
		return fmt.Errorf("analyze kernels: %w", err)
	}

	// Filter and sort
	var kernels []*gputrace.KernelStat
	filterLower := strings.ToLower(kernelsFilter)

	for _, k := range stats {
		if kernelsFilter != "" && !strings.Contains(strings.ToLower(k.Name), filterLower) {
			continue
		}
		kernels = append(kernels, k)
	}

	// Sort by dispatch count (descending), then name
	sort.Slice(kernels, func(i, j int) bool {
		if kernels[i].DispatchCount != kernels[j].DispatchCount {
			return kernels[i].DispatchCount > kernels[j].DispatchCount
		}
		return kernels[i].Name < kernels[j].Name
	})

	// Count unique kernels
	uniqueKernels := len(kernels)

	// Output header
	if kernelsFilter != "" {
		fmt.Printf("=== Kernels matching %q (%d unique) ===\n", kernelsFilter, uniqueKernels)
	} else {
		fmt.Printf("=== Kernel Functions (%d unique) ===\n", uniqueKernels)
	}
	fmt.Println()

	if uniqueKernels == 0 {
		fmt.Println("No kernels found.")
		return nil
	}

	// Determine column widths
	maxNameLen := 30
	for _, k := range kernels {
		if len(k.Name) > maxNameLen {
			maxNameLen = len(k.Name)
		}
	}
	// Cap max length to reasonable value to prevent wrapping issues
	if maxNameLen > 80 {
		maxNameLen = 80
	}

	// Print table header
	nameFmt := fmt.Sprintf("%%-%ds", maxNameLen)
	fmt.Printf(nameFmt+"  %-18s  %-10s", "Name", "Pipeline State", "Dispatches")
	if kernelsVerbose || kernelsStats {
		fmt.Printf("  %s", "Debug Groups / Labels")
	}
	fmt.Println()
	fmt.Printf(strings.Repeat("-", maxNameLen)+"  %-18s  %-10s", strings.Repeat("-", 18), strings.Repeat("-", 10))
	if kernelsVerbose || kernelsStats {
		fmt.Printf("  %s", strings.Repeat("-", 30))
	}
	fmt.Println()

	// Print rows
	for _, k := range kernels {
		name := k.Name
		if len(name) > maxNameLen {
			name = name[:maxNameLen-3] + "..."
		}

		fmt.Printf(nameFmt+"  0x%-16x  %-10d", name, k.PipelineAddr, k.DispatchCount)

		if kernelsVerbose || kernelsStats {
			var details []string

			// Add debug groups
			for group, count := range k.DebugGroups {
				details = append(details, fmt.Sprintf("%s (%d)", group, count))
			}

			// If no debug groups, show encoder labels (if different from kernel name)
			if len(details) == 0 {
				for label, count := range k.EncoderLabels {
					if label != k.Name && label != "" {
						details = append(details, fmt.Sprintf("%s (%d)", label, count))
					}
				}
			}

			// If we have details, print them
			if len(details) > 0 {
				// Sort details for consistency
				sort.Strings(details)

				// Print first few inline
				str := strings.Join(details, ", ")
				if len(str) > 60 {
					str = str[:57] + "..."
				}
				fmt.Printf("  %s", str)
			}
		}
		fmt.Println()

		// If very verbose/stats and there are many details, print them on subsequent lines
		if (kernelsVerbose || kernelsStats) && (len(k.DebugGroups) > 0 || len(k.EncoderLabels) > 0) {
			// Print full list of debug groups if requested
			if kernelsStats && len(k.DebugGroups) > 0 {
				// Group by common prefixes? For now just list them
				var groups []string
				for g := range k.DebugGroups {
					groups = append(groups, g)
				}
				sort.Strings(groups)

				// Limit to top 5 if not using --stats explicitly (handled above by simple logic,
				// but here we can be more verbose)
				// Actually, let's just leave it simple for now.
				// If user wants full breakdown, maybe we need a dedicated view.
			}
		}
	}

	// Print summary of unknown pipelines if any
	// (AnalyzeKernels handles this by creating an "unknown" entry if needed)
	if k, ok := stats["unknown"]; ok && k.DispatchCount > 0 {
		fmt.Printf("\nUnknown Pipelines: %d dispatches (encoder: %v)\n", k.DispatchCount, k.EncoderLabels)
	}

	return nil
}
