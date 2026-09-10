package nativeconversationv2_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	native "github.com/36Dge/yijie-contracts/sdks/go/openapi/native-conversation-v2"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// This pre-extension mock intentionally implements only the original methods.
type legacyNativeClient struct{}

func (legacyNativeClient) ReadNativeThread(context.Context, openapi_types.UUID, ...native.RequestEditorFn) (*http.Response, error) {
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"schema_version":2,"source":"runtime_read","thread_id":"native-thread","turns":[],"availability":"partial"}`))}, nil
}

func (legacyNativeClient) StreamNativeConversation(context.Context, openapi_types.UUID, *native.StreamNativeConversationParams, ...native.RequestEditorFn) (*http.Response, error) {
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(""))}, nil
}

var _ native.ClientInterface = legacyNativeClient{}

func TestNativeStatusPreservesLegacyClientInitializer(t *testing.T) {
	client := native.ClientWithResponses{ClientInterface: legacyNativeClient{}}
	response, err := client.ReadNativeThreadWithResponse(context.Background(), openapi_types.UUID{})
	if err != nil || response.JSON200 == nil || response.JSON200.ThreadId != "native-thread" {
		t.Fatalf("legacy history response failed: %v", err)
	}
}

type statusTransport struct{ t *testing.T }

func (d statusTransport) Do(req *http.Request) (*http.Response, error) {
	if req.Method != http.MethodGet || req.URL.Path != "/v2/agent-sessions/00000000-0000-0000-0000-000000000000/native-thread-status" || req.URL.RawQuery != "" {
		d.t.Fatal("unexpected status request")
	}
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}, "Cache-Control": {"no-store"}}, Body: io.NopCloser(strings.NewReader(`{"schema_version":2,"source":"runtime_read","thread_id":"native-thread","status":"active"}`))}, nil
}

func TestNativeStatusOptInClientReadsCurrentStatus(t *testing.T) {
	client, err := native.NewClientWithThreadStatusResponses("http://127.0.0.1", native.WithHTTPClient(statusTransport{t}))
	if err != nil {
		t.Fatal(err)
	}
	response, err := client.ReadNativeThreadStatusWithResponse(context.Background(), openapi_types.UUID{})
	if err != nil || response.JSON200 == nil {
		t.Fatalf("current status response failed: %v", err)
	}
	if response.JSON200.Status != native.NativeThreadStatusSnapshotStatusActive || response.JSON200.Source != native.NativeThreadStatusSnapshotSourceRuntimeRead || !response.JSON200.SchemaVersion.Valid() {
		t.Fatal("current native status was not preserved")
	}
}
