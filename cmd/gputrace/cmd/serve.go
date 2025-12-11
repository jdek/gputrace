package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/tmc/gputrace"
	"github.com/tmc/gputrace/cmd/gputrace/cmd/serve"
)

var servePort int

var serveCmd = &cobra.Command{
	Use:   "serve <trace.gputrace>",
	Short: "Start a web server to browse the trace",
	Args:  cobra.ExactArgs(1),
	RunE:  runServe,
}

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().IntVarP(&servePort, "port", "p", 8080, "Port to serve on")
}

func runServe(cmd *cobra.Command, args []string) error {
	tracePath := args[0]

	// Verify trace file exists
	// Open trace
	trace, err := gputrace.Open(tracePath)
	if err != nil {
		return fmt.Errorf("failed to open trace: %w", err)
	}

	server := serve.NewServer(trace, servePort)
	return server.Start()
}
