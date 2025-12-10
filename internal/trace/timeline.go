package trace

import (
	"fmt"
	"sort"
)

// KernelExecution represents a single execution of a kernel in the timeline.
type KernelExecution struct {
	Name            string
	EncoderIndex    int
	CommandBufferID int
	Timestamp       uint64 // Estimated or real timestamp
	Duration        uint64 // Estimated or real duration
	DebugGroup      string // Hierarchical debug group
}

// ExtractKernelTimeline extracts the sequence of kernel executions from the trace.
func (t *Trace) ExtractKernelTimeline() ([]KernelExecution, error) {
	// 1. Get Command Buffers
	cbs, err := t.ParseCommandBuffers()
	if err != nil {
		return nil, fmt.Errorf("parse command buffers: %w", err)
	}

	// 2. Get Encoders
	encoders, err := t.ParseComputeEncoders()
	if err != nil {
		return nil, fmt.Errorf("parse encoders: %w", err)
	}

	// 3. Get Dispatches
	// We need to associate dispatches with encoders.
	// Since ParseDispatchCalls returns a flat list with offsets, and Encoders also have offsets,
	// we can map them by offset ranges.
	dispatches, err := t.ParseDispatchCalls()
	if err != nil {
		return nil, fmt.Errorf("parse dispatches: %w", err)
	}

	// Sort everything by offset to be safe
	sort.Slice(cbs, func(i, j int) bool { return cbs[i].Offset < cbs[j].Offset })
	sort.Slice(encoders, func(i, j int) bool { return encoders[i].Offset < encoders[j].Offset })
	sort.Slice(dispatches, func(i, j int) bool { return dispatches[i].Offset < dispatches[j].Offset })

	var timeline []KernelExecution

	// Iterate through dispatches and find their parent encoder and CB
	for _, d := range dispatches {
		// Find parent encoder (the last encoder with offset < dispatch offset)
		var parentEncoder *ComputeEncoder
		var parentEncoderIdx int = -1
		for i, e := range encoders {
			if e.Offset < d.Offset {
				parentEncoder = e
				parentEncoderIdx = i
			} else {
				break
			}
		}

		if parentEncoder == nil {
			// Dispatch without encoder? Should not happen in valid trace
			continue
		}

		// Find parent CB
		var parentCBIdx int = -1
		for i, cb := range cbs {
			if cb.Offset < d.Offset {
				parentCBIdx = i
			} else {
				break
			}
		}

		// Determine kernel name
		// If the encoder has a label that looks like a kernel name, use it.
		// Otherwise, we might need pipeline state mapping (which requires parsing more events).
		// For now, use encoder label as a proxy if it looks like a function name.
		name := parentEncoder.Label

		// If the label is just "Encoder X", try to see if we have pipeline info.
		// But ParseComputeEncoders already tries to filter for actual function names.
		// If ParseComputeEncoders returned it, it's likely the kernel name (for simple traces).
		// For complex traces with multiple kernels per encoder, this is an approximation:
		// all kernels in the encoder will get the encoder's label.
		// Ideally we need the pipeline state at the time of dispatch.
		// But let's start with this.

		timeline = append(timeline, KernelExecution{
			Name:            name,
			EncoderIndex:    parentEncoderIdx,
			CommandBufferID: parentCBIdx,
			// Timestamp and Duration will be filled later by correlation
			DebugGroup:      "", // We could extract this if we parsed debug groups
		})
	}

	// If no dispatches found (e.g. only encoders parsed), creating entries for encoders
	if len(timeline) == 0 && len(encoders) > 0 {
		for i, e := range encoders {
			// Find parent CB
			var parentCBIdx int = -1
			for j, cb := range cbs {
				if cb.Offset < e.Offset {
					parentCBIdx = j
				} else {
					break
				}
			}

			timeline = append(timeline, KernelExecution{
				Name:            e.Label,
				EncoderIndex:    i,
				CommandBufferID: parentCBIdx,
			})
		}
	}

	return timeline, nil
}

// CorrelateTimings correlates kernel executions with timing data.
func CorrelateTimings(executions []KernelExecution, encoderTimings []EncoderTiming) []KernelExecution {
	// Group timings by label for sequential consumption
	timingsByLabel := make(map[string][]*EncoderTiming)
	for i := range encoderTimings {
		t := &encoderTimings[i]
		timingsByLabel[t.Label] = append(timingsByLabel[t.Label], t)
	}

	// Sort timings by timestamp for each label
	for _, ts := range timingsByLabel {
		sort.Slice(ts, func(i, j int) bool {
			return ts[i].StartTimestamp < ts[j].StartTimestamp
		})
	}

	// Helper to consume the next available timing for a label
	consumeTiming := func(label string) *EncoderTiming {
		ts, ok := timingsByLabel[label]
		if !ok || len(ts) == 0 {
			return nil
		}
		t := ts[0]
		timingsByLabel[label] = ts[1:] // Pop the first
		return t
	}

	// Group executions by encoder
	// Note: executions are already sorted by offset, which roughly corresponds to time/order.
	// We want to process encoders in order of appearance to match sequential timings.

	// Create a list of unique encoder indices in order of appearance
	var encoderOrder []int
	seenEncoders := make(map[int]bool)

	// Map encoder index to its executions
	encExecs := make(map[int][]*KernelExecution)

	for i := range executions {
		idx := executions[i].EncoderIndex
		if !seenEncoders[idx] {
			encoderOrder = append(encoderOrder, idx)
			seenEncoders[idx] = true
		}
		encExecs[idx] = append(encExecs[idx], &executions[i])
	}

	// Assign timings
	for _, idx := range encoderOrder {
		group := encExecs[idx]
		if len(group) == 0 {
			continue
		}

		// Use label from first execution in group (which comes from encoder label)
		label := group[0].Name

		timing := consumeTiming(label)

		if timing != nil {
			// Distribute encoder duration among its kernels
			count := len(group)
			durationPerKernel := timing.DurationNs / uint64(count)
			startTime := timing.StartTimestamp

			for i, exec := range group {
				exec.Timestamp = startTime + uint64(i)*durationPerKernel
				exec.Duration = durationPerKernel
			}
		}
	}

	return executions
}
