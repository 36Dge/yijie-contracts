package marketselection

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSourceVectors(t *testing.T) {
	data, err := os.ReadFile("../../../fixtures/market-selection/digest-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors []struct {
		Name            string
		TurnOperationID string `json:"turnOperationId"`
		Selection       []SelectionRef
		CanonicalText   string
		SelectionDigest string
	}
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, v := range vectors {
		t.Run(v.Name, func(t *testing.T) {
			b, err := CanonicalSelectionBytes(v.TurnOperationID, v.Selection)
			if err != nil {
				t.Fatal(err)
			}
			if string(b) != v.CanonicalText {
				t.Fatal("canonical encoding differs")
			}
			digest, err := SelectionDigest(v.TurnOperationID, v.Selection)
			if err != nil {
				t.Fatal(err)
			}
			if digest != v.SelectionDigest {
				t.Fatal("digest differs")
			}
		})
	}
}
func TestDuplicateInstallationIsNotAnotherSelection(t *testing.T) {
	var refs []SelectionRef
	if err := json.Unmarshal([]byte(`[{"installationId":"00000000-0000-4000-8000-000000000157","revision":1,"generation":1},{"installationId":"00000000-0000-4000-8000-000000000157","revision":2,"generation":1}]`), &refs); err != nil {
		t.Fatal(err)
	}
	if _, err := SelectionDigest("00000000-0000-4000-8000-000000000158", refs); err == nil {
		t.Fatal("duplicate installation must be rejected")
	}
}
