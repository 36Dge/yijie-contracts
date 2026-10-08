package marketconnectors

import (
	"encoding/json"
	"testing"
)

func TestContextEnvelopeAndRevisions(t *testing.T) {
	const valid = `{"schemaVersion":1,"requestId":"00000000-0000-4000-8000-000000000157","contextId":"00000000-0000-4000-8000-000000000158","payload":{"installationId":"00000000-0000-4000-8000-000000000157","operationId":"00000000-0000-4000-8000-000000000158","expectedRevision":1,"desiredEnabled":false}}`
	var got SetEnabledRequest
	if err := json.Unmarshal([]byte(valid), &got); err != nil {
		t.Fatal(err)
	}
	if got.Payload.ExpectedRevision != 1 || got.Payload.DesiredEnabled {
		t.Fatal("intent changed")
	}
	for _, raw := range []string{
		`{"schemaVersion":1,"requestId":"00000000-0000-4000-8000-000000000157","contextId":null,"payload":{}}`,
		`{"schemaVersion":1,"requestId":"00000000-0000-4000-8000-000000000157","contextId":"00000000-0000-4000-8000-000000000158","payload":{},"futureRevision":1}`,
		`{"schemaVersion":2,"requestId":"00000000-0000-4000-8000-000000000157","contextId":"00000000-0000-4000-8000-000000000158","payload":{}}`,
	} {
		var request SnapshotRequest
		if err := json.Unmarshal([]byte(raw), &request); err == nil {
			t.Fatal("invalid request accepted")
		}
	}
}
func TestForwardCompatibleResponseDropsUnknownFields(t *testing.T) {
	raw := []byte(`{"serviceId":"synthetic-service","serverName":"synthetic-service","displayName":"Synthetic","categoryId":"productivity","categoryLabel":"Productivity","description":"","iconAssetId":"synthetic-service","transport":"http","authMode":"unknown","availability":"unverified","blockerCodes":[],"futureBadge":"beta"}`)
	var entry CatalogEntry
	if err := json.Unmarshal(raw, &entry); err != nil {
		t.Fatal(err)
	}
	output, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	var roundtrip map[string]any
	if err := json.Unmarshal(output, &roundtrip); err != nil {
		t.Fatal(err)
	}
	if _, ok := roundtrip["futureBadge"]; ok {
		t.Fatal("unknown response was echoed")
	}
}
func TestStableErrorsAndOptionalNonNull(t *testing.T) {
	for _, raw := range []string{`{"schemaVersion":1,"code":"future_error","retryable":false}`, `{"schemaVersion":1,"code":"execution_unavailable","retryable":false,"requestId":null}`} {
		var value Error
		if err := json.Unmarshal([]byte(raw), &value); err == nil {
			t.Fatal("unknown enum or null accepted")
		}
	}
	var value Error
	if err := json.Unmarshal([]byte(`{"schemaVersion":1,"code":"execution_unavailable","retryable":false}`), &value); err != nil {
		t.Fatal(err)
	}
}
func TestAuthorizationCapabilityDoesNotQualifyCatalogEntry(t *testing.T) {
	const raw = `{"serviceId":"synthetic-service","serverName":"synthetic-service","displayName":"Synthetic","categoryId":"productivity","categoryLabel":"Productivity","description":"","iconAssetId":"synthetic-service","transport":"http","authMode":"oauth","availability":"unverified","blockerCodes":[]}`
	var object map[string]any
	if err := json.Unmarshal([]byte(raw), &object); err != nil {
		t.Fatal(err)
	}
	for _, value := range []any{nil, false, true} {
		delete(object, "authorizationAvailable")
		if value != nil {
			object["authorizationAvailable"] = value
		}
		data, err := json.Marshal(object)
		if err != nil {
			t.Fatal(err)
		}
		var entry CatalogEntry
		if err := json.Unmarshal(data, &entry); err != nil {
			t.Fatal(err)
		}
		available := entry.AuthorizationAvailable != nil && *entry.AuthorizationAvailable
		if available != (value == true) || entry.Availability != AvailabilityUnverified {
			t.Fatal("authorization changed catalog qualification")
		}
		output, err := json.Marshal(entry)
		if err != nil {
			t.Fatal(err)
		}
		var roundtrip map[string]any
		if err := json.Unmarshal(output, &roundtrip); err != nil {
			t.Fatal(err)
		}
		if _, present := roundtrip["authorizationAvailable"]; present != (value != nil) {
			t.Fatal("optional capability presence changed")
		}
	}
	object["authorizationAvailable"] = nil
	data, err := json.Marshal(object)
	if err != nil {
		t.Fatal(err)
	}
	var entry CatalogEntry
	if err := json.Unmarshal(data, &entry); err == nil {
		t.Fatal("null is not an omitted authorization capability")
	}
}
func TestWorkerPolicyRemainsUnqualified(t *testing.T) {
	var policy WorkerLibraryPolicy
	if err := json.Unmarshal([]byte(`{"mcpLibrary":"codex-rmcp-client","oauthStore":"keyring_only","credentialBoundary":"connectors_only","stdioShutdown":"eof_only","externalCallsEnabled":false}`), &policy); err != nil {
		t.Fatal(err)
	}
	policy.ExternalCallsEnabled = true
	if err := policy.Validate(); err == nil {
		t.Fatal("unqualified worker accepted external calls")
	}
}

func TestRequiredArraysCannotMarshalAsNull(t *testing.T) {
	value := SelectionValidatePayload{}
	if err := value.Validate(); err == nil {
		t.Fatal("nil slice must not become wire null")
	}
	value.Selection = []SelectionRef{}
	if err := value.Validate(); err != nil {
		t.Fatal(err)
	}
}
