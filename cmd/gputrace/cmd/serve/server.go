package serve

import (
	"embed"
	"fmt"
	"net/http"

	"github.com/tmc/gputrace"
)

//go:embed static/*
var staticFiles embed.FS

type Server struct {
	trace *gputrace.Trace
	port  int
}

func NewServer(trace *gputrace.Trace, port int) *Server {
	return &Server{
		trace: trace,
		port:  port,
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	s.setupRoutes(mux)

	addr := fmt.Sprintf(":%d", s.port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	fmt.Printf("🚀 Serving GPU trace at http://localhost:%d\n", s.port)
	fmt.Println("Press Ctrl+C to stop")

	return server.ListenAndServe()
}

func (s *Server) setupRoutes(mux *http.ServeMux) {
	// Static files
	mux.Handle("/static/", http.FileServer(http.FS(staticFiles)))

	// Pages
	mux.HandleFunc("/", s.handleDashboard)
	mux.HandleFunc("/kernels", s.handleKernels)

	// API
	mux.HandleFunc("/api/stats", s.handleAPIStats)
	mux.HandleFunc("/api/kernels", s.handleAPIKernels)
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	content, err := staticFiles.ReadFile("static/index.html")
	if err != nil {
		http.Error(w, "Dashboard not found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Write(content)
}

func (s *Server) handleKernels(w http.ResponseWriter, r *http.Request) {
	content, err := staticFiles.ReadFile("static/kernels.html")
	if err != nil {
		http.Error(w, "Kernels page not found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Write(content)
}
