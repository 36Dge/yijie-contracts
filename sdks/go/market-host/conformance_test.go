package markethost

import (
	"encoding/json"
	provider "github.com/36Dge/yijie-contracts/sdks/go/market-provider"
	"os"
	"testing"
)

func ordinaryFixtures(t *testing.T) map[string]json.RawMessage {
	t.Helper()
	b, e := os.ReadFile("../../../fixtures/market-host/normal-wire.json")
	if e != nil {
		t.Fatal(e)
	}
	var v map[string]json.RawMessage
	if e = json.Unmarshal(b, &v); e != nil {
		t.Fatal(e)
	}
	return v
}
func TestPrivateAndNativeGeneratedFramesConform(t *testing.T) {
	values := ordinaryFixtures(t)
	frames := map[string]any{"HelloRequest": new(HelloRequest), "GrantRegisterRequest": new(GrantRegisterRequest), "RevokeAuthorityRequest": new(RevokeAuthorityRequest), "SubmitRequest": new(SubmitRequest), "NativeObserveRequest": new(NativeObserveRequest), "NativeObserveResponse": new(NativeObserveResponse), "NativeApprovalDecideRequest": new(NativeApprovalDecideRequest), "NativeError": new(NativeError), "AuthBeginRequest": new(AuthBeginRequest), "AuthBeginResponse": new(AuthBeginResponse)}
	for name, target := range frames {
		if e := json.Unmarshal(values[name], target); e != nil {
			t.Fatalf("%s: %v", name, e)
		}
	}
}
func TestSubmissionReusesV2BlocksAndRejectsDifferentServiceRef(t *testing.T) {
	var grant GrantRegisterRequest
	if e := json.Unmarshal(ordinaryFixtures(t)["GrantRegisterRequest"], &grant); e != nil {
		t.Fatal(e)
	}
	grant.Payload.Submission.Services[0].Reference.Revision++
	if grant.Validate() == nil {
		t.Fatal("different current revision accepted as frozen original")
	}
	var raw map[string]any
	if e := json.Unmarshal(ordinaryFixtures(t)["GrantRegisterRequest"], &raw); e != nil {
		t.Fatal(e)
	}
	block := raw["payload"].(map[string]any)["submission"].(map[string]any)["contentBlocks"].([]any)[0].(map[string]any)
	block["futureField"] = true
	b, e := json.Marshal(raw)
	if e != nil {
		t.Fatal(e)
	}
	if json.Unmarshal(b, &grant) == nil {
		t.Fatal("source-closed v2 block accepted future field")
	}
}
func TestNonemptyPermissionModeAndProviderReadinessFailClosed(t *testing.T) {
	var grant GrantRegisterRequest
	if e := json.Unmarshal(ordinaryFixtures(t)["GrantRegisterRequest"], &grant); e != nil {
		t.Fatal(e)
	}
	grant.Payload.Submission.PermissionMode = PermissionModeFull
	if grant.Validate() == nil {
		t.Fatal("nonempty market selection accepted full mode")
	}
	var auth provider.AuthBeginResponse
	if e := json.Unmarshal(ordinaryFixtures(t)["AuthBeginResponse"], &auth); e != nil {
		t.Fatal(e)
	}
	auth.Data.ExecutionAvailable = true
	if auth.Validate() == nil {
		t.Fatal("OAuth operation alone became ready")
	}
}
func TestNativeUICannotInjectAuthority(t *testing.T) {
	var raw map[string]any
	if e := json.Unmarshal(ordinaryFixtures(t)["NativeApprovalDecideRequest"], &raw); e != nil {
		t.Fatal(e)
	}
	raw["payload"].(map[string]any)["scope"] = map[string]any{}
	b, e := json.Marshal(raw)
	if e != nil {
		t.Fatal(e)
	}
	var request NativeApprovalDecideRequest
	if json.Unmarshal(b, &request) == nil {
		t.Fatal("UI supplied authority")
	}
	var safe NativeError
	if e := json.Unmarshal([]byte(`{"schemaVersion":1,"code":"keyring_unavailable","retryable":false}`), &safe); e != nil {
		t.Fatal(e)
	}
}
