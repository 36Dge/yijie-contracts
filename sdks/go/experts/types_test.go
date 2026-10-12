package experts

import (
	"encoding/json"
	"os"
	"testing"
)

func normalWire(t *testing.T) map[string]json.RawMessage {
	t.Helper()
	b, err := os.ReadFile("../../../fixtures/experts/normal-wire.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture map[string]json.RawMessage
	if err = json.Unmarshal(b, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestPrivateWrappersKeepFullOriginalIntentAndReadReceipts(t *testing.T) {
	f := normalWire(t)
	for name, target := range map[string]any{"ApplyRequest": &ApplyRequest{}, "ApplyResponse": &ApplyResponse{}, "PrivateGrantRequest": &PrivateGrantRequest{}, "PrivateSubmitRequest": &PrivateSubmitRequest{}, "PrivateOperationReadRequest": &PrivateOperationReadRequest{}, "SubmissionReadRequest": &SubmissionReadRequest{}, "SubmissionReadResponse": &SubmissionReadResponse{}, "Error": &Error{}} {
		if err := json.Unmarshal(f[name], target); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	var request PrivateGrantRequest
	if err := json.Unmarshal(f["PrivateGrantRequest"], &request); err != nil {
		t.Fatal(err)
	}
	if request.Payload.Submission.Submission.Snapshot.TurnOperationId != request.Payload.Submission.ExpertSnapshot.TurnOperationId {
		t.Fatal("turn identity lost")
	}
	request.Payload.Submission.ExpertSnapshot.BindingRevision++
	if request.Validate() == nil {
		t.Fatal("changed revision must invalidate original snapshot")
	}
}

func TestSnapshotDigestMatchesSharedOrdinaryAndExpertVectors(t *testing.T) {
	b, err := os.ReadFile("../../../fixtures/experts/digest-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors []struct {
		TurnOperationId CanonicalId
		BindingRevision Revision
		Expert          *ExpertRef
		CanonicalText   string
		SnapshotDigest  string
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		bytes, err := CanonicalSnapshotBytes(v.TurnOperationId, v.BindingRevision, v.Expert)
		if err != nil {
			t.Fatal(err)
		}
		if string(bytes) != v.CanonicalText {
			t.Fatal("canonical byte mismatch")
		}
		snapshot, err := FreezeSnapshot(v.TurnOperationId, v.BindingRevision, v.Expert)
		if err != nil {
			t.Fatal(err)
		}
		if string(snapshot.SnapshotDigest) != v.SnapshotDigest {
			t.Fatal("digest mismatch")
		}
		if err = snapshot.Validate(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestUnknownBindingReceiptPreservesEffectiveRevision(t *testing.T) {
	f := normalWire(t)
	var response ApplyResponse
	if err := json.Unmarshal(f["ApplyResponse"], &response); err != nil {
		t.Fatal(err)
	}
	response.Data.State = OperationStateUnknown
	if response.Validate() == nil {
		t.Fatal("unknown cannot advance effective revision")
	}
	response.Data.BindingRevision = response.Data.ExpectedBindingRevision
	if err := response.Validate(); err != nil {
		t.Fatal(err)
	}
	if response.Data.Expert == nil {
		t.Fatal("requested expert identity must remain for recovery")
	}
}

func TestKnowledgeDigestMatchesUTF8VectorAndOrder(t *testing.T) {
	b, err := os.ReadFile("../../../fixtures/experts/knowledge-digest-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors []struct {
		Resources     []KnowledgeResource
		CanonicalText string
		Digest        string
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		bytes, err := CanonicalKnowledgeManifestBytes(v.Resources)
		if err != nil {
			t.Fatal(err)
		}
		if string(bytes) != v.CanonicalText {
			t.Fatal("canonical knowledge bytes")
		}
		d, err := KnowledgeManifestDigest(v.Resources)
		if err != nil {
			t.Fatal(err)
		}
		if d != v.Digest {
			t.Fatal("knowledge digest")
		}
		v.Resources[0], v.Resources[1] = v.Resources[1], v.Resources[0]
		d, err = KnowledgeManifestDigest(v.Resources)
		if err != nil || d != v.Digest {
			t.Fatal("stable identity order")
		}
	}
}

func TestExpertBundleMetadataAndTimeoutsAreSourceDerived(t *testing.T) {
	b, err := os.ReadFile("../../../fixtures/experts/bundle-v3-local.json")
	if err != nil {
		t.Fatal(err)
	}
	var v struct {
		Skills []struct{ Expert ExpertMetadata }
	}
	if err = json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}
	if err = v.Skills[0].Expert.Validate(); err != nil {
		t.Fatal(err)
	}
	if v.Skills[0].Expert.LocalUseAuthorization.Status != "local-use-authorized" {
		t.Fatal("local evidence missing")
	}
	if MethodTimeoutMs["expert_submit"] >= NativeResponseTimeoutMs {
		t.Fatal("response deadline must exceed method budget")
	}
}
