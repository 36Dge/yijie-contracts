package marketbrokercontrol

import (
	"encoding/json"
	"os"
	"testing"
)

func fixtures(t *testing.T) map[string]json.RawMessage {
	t.Helper()
	b, err := os.ReadFile("../../../fixtures/market-broker-control/normal-wire.json")
	if err != nil {
		t.Fatal(err)
	}
	var values map[string]json.RawMessage
	if err := json.Unmarshal(b, &values); err != nil {
		t.Fatal(err)
	}
	return values
}

func TestNormalRequestsUseClosedGeneratedDecoders(t *testing.T) {
	for name, value := range fixtures(t) {
		if len(name) < 7 || name[len(name)-7:] != "Request" {
			continue
		}
		if _, err := DecodeRequest(value); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		var object map[string]any
		if err := json.Unmarshal(value, &object); err != nil {
			t.Fatal(err)
		}
		object["payload"].(map[string]any)["futureField"] = true
		b, err := json.Marshal(object)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := DecodeRequest(b); err == nil {
			t.Fatalf("%s accepted unknown request field", name)
		}
	}
}

func TestResponsesAndPortableSnapshotConform(t *testing.T) {
	v := fixtures(t)
	decoders := map[string]any{
		"InitializeResponse": new(InitializeResponse), "PrepareResponse": new(PrepareResponse),
		"BindTurnResponse": new(BindTurnResponse), "RevokeResponse": new(RevokeResponse),
		"StatusResponse": new(StatusResponse), "PendingCallResponse": new(PendingCallResponse),
		"DecideCallResponse": new(DecideCallResponse), "ShutdownResponse": new(ShutdownResponse),
		"Error": new(Error), "ElicitationMetadata": new(ElicitationMetadata),
	}
	for name, target := range decoders {
		if err := json.Unmarshal(v[name], target); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	var prepared PrepareResponse
	if err := json.Unmarshal(v["PrepareResponse"], &prepared); err != nil {
		t.Fatal(err)
	}
	prepared.Data.Snapshot.SelectionDigest = "0000000000000000000000000000000000000000000000000000000000000000"
	if err := prepared.Validate(); err == nil {
		t.Fatal("accepted changed frozen snapshot digest")
	}
}

func TestOptionalNullAndRuntimeExecutionClaimsRemainInvalid(t *testing.T) {
	var lease Lease
	var prepared PrepareResponse
	if err := json.Unmarshal(fixtures(t)["PrepareResponse"], &prepared); err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(prepared.Data)
	if err != nil {
		t.Fatal(err)
	}
	var object map[string]any
	if err := json.Unmarshal(b, &object); err != nil {
		t.Fatal(err)
	}
	object["nativeTurnId"] = nil
	b, err = json.Marshal(object)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &lease); err == nil {
		t.Fatal("accepted explicit null native Turn identity")
	}
	for _, value := range []GatewayUrl{"http://127.0.0.1:0/mcp", "http://127.0.0.1:65536/mcp", "http://127.0.0.1:00080/mcp"} {
		if value.Validate() == nil {
			t.Fatal("accepted noncanonical gateway port")
		}
	}
}

func TestResponseUnknownFieldsAreDiscarded(t *testing.T) {
	var raw map[string]any
	if err := json.Unmarshal(fixtures(t)["InitializeResponse"], &raw); err != nil {
		t.Fatal(err)
	}
	raw["futureField"] = "ignored"
	b, err := json.Marshal(raw)
	if err != nil {
		t.Fatal(err)
	}
	var response InitializeResponse
	if err := json.Unmarshal(b, &response); err != nil {
		t.Fatal(err)
	}
	b, err = json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	var clean map[string]any
	if err := json.Unmarshal(b, &clean); err != nil {
		t.Fatal(err)
	}
	if _, ok := clean["futureField"]; ok {
		t.Fatal("unknown field survived projection")
	}
}

func TestNewThreadNullIsRequiredAndBoundIdentitiesAreAtomic(t *testing.T) {
	var request PrepareRequest
	if err := json.Unmarshal(fixtures(t)["PrepareRequest"], &request); err != nil {
		t.Fatal(err)
	}
	request.Payload.Context.NativeThreadId = nil
	b, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}
	var fresh PrepareRequest
	if err := json.Unmarshal(b, &fresh); err != nil {
		t.Fatal(err)
	}
	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatal(err)
	}
	context := raw["payload"].(map[string]any)["context"].(map[string]any)
	if v, ok := context["nativeThreadId"]; !ok || v != nil {
		t.Fatal("new thread intent did not serialize as explicit null")
	}
	delete(context, "nativeThreadId")
	b, err = json.Marshal(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &fresh); err == nil {
		t.Fatal("missing nativeThreadId accepted as null")
	}
	var bound BindTurnResponse
	if err := json.Unmarshal(fixtures(t)["BindTurnResponse"], &bound); err != nil {
		t.Fatal(err)
	}
	bound.Data.BoundNativeThreadId = nil
	if bound.Validate() == nil {
		t.Fatal("accepted bound Turn without bound thread")
	}
	thread := NativeId("different-ordinary-thread")
	bound.Data.BoundNativeThreadId = &thread
	if bound.Validate() == nil {
		t.Fatal("existing-thread intent changed its actual binding")
	}
}
