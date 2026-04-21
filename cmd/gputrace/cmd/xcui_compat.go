// xcui_compat.go -- compatibility shims for AX symbols missing from
// pinned github.com/tmc/apple/x/axuiautomation.
//
// AXUIElementCopyActionNames and AXUIElementGetWindow are referenced
// through xcui.go but not exported by the published axuiautomation
// package, so a straight `go build` fails. We load the matching
// HIServices framework symbols via purego at first use and wrap
// them in local helpers (axCopyActionNames, axGetWindow) that
// xcui.go calls instead. Failures surface as non-zero AXError
// codes, matching xcui.go's existing error-checking pattern.

package cmd

import (
	"sync"

	"github.com/ebitengine/purego"
	"github.com/tmc/apple/x/axuiautomation"
)

const (
	axErrFailure = -25200 // kAXErrorFailure
)

var (
	axCompatOnce        sync.Once
	axCompatErr         error
	axCopyActionNamesFn func(uintptr, *uintptr) int32
	axGetWindowFn       func(uintptr, *uint32) int32
)

func axCompatInit() {
	axCompatOnce.Do(func() {
		handle, err := purego.Dlopen(
			"/System/Library/Frameworks/ApplicationServices.framework/"+
				"Frameworks/HIServices.framework/HIServices",
			purego.RTLD_LAZY|purego.RTLD_GLOBAL)
		if err != nil {
			axCompatErr = err
			return
		}
		purego.RegisterLibFunc(&axCopyActionNamesFn, handle,
			"AXUIElementCopyActionNames")
		purego.RegisterLibFunc(&axGetWindowFn, handle,
			"_AXUIElementGetWindow")
	})
}

// axCopyActionNames : thin wrapper around the ApplicationServices
// AXUIElementCopyActionNames entry point. Mirrors the signature the
// original (missing) axuiautomation.AXUIElementCopyActionNames was
// expected to have.
func axCopyActionNames(elem axuiautomation.AXUIElementRef,
	out *uintptr) int32 {
	axCompatInit()
	if axCompatErr != nil || axCopyActionNamesFn == nil {
		return axErrFailure
	}
	return axCopyActionNamesFn(uintptr(elem), out)
}

// axGetWindow : thin wrapper around the private ApplicationServices
// _AXUIElementGetWindow entry point used by Apple's own UI-scripting
// code to recover a CGWindowID from an AXUIElement. Private symbol;
// may become nil on future macOS versions, in which case callers
// degrade to an error return.
func axGetWindow(elem axuiautomation.AXUIElementRef,
	out *uint32) int32 {
	axCompatInit()
	if axCompatErr != nil || axGetWindowFn == nil {
		return axErrFailure
	}
	return axGetWindowFn(uintptr(elem), out)
}
