package agenthost_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"image/png"
	"os"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestAgentHostOpenAPIIsGoValidatorCompatible(t *testing.T) {
	document, err := openapi3.NewLoader().LoadFromFile("agent-host.yaml")
	if err != nil {
		t.Fatalf("load Agent Host OpenAPI: %v", err)
	}
	if err := document.Validate(context.Background()); err != nil {
		t.Fatalf("validate Agent Host OpenAPI: %v", err)
	}
}

func TestCanonicalTurnImageIsDecodableAndMatchesMetadata(t *testing.T) {
	contents, err := os.ReadFile("../../tests/fixtures/agent/host-v2/turn-request.json")
	if err != nil {
		t.Fatalf("read canonical turn fixture: %v", err)
	}
	var fixture struct {
		ContentBlocks []struct {
			Type      string `json:"type"`
			MediaType string `json:"media_type"`
			SizeBytes int    `json:"size_bytes"`
			SHA256    string `json:"sha256"`
			DataURL   string `json:"data_url"`
		} `json:"content_blocks"`
	}
	if err := json.Unmarshal(contents, &fixture); err != nil {
		t.Fatalf("decode canonical turn fixture: %v", err)
	}
	for _, block := range fixture.ContentBlocks {
		if block.Type != "image" {
			continue
		}
		const prefix = "data:image/png;base64,"
		if block.MediaType != "image/png" || !strings.HasPrefix(block.DataURL, prefix) {
			t.Fatal("canonical image media type and data URL disagree")
		}
		decoded, err := base64.StdEncoding.Strict().DecodeString(strings.TrimPrefix(block.DataURL, prefix))
		if err != nil {
			t.Fatalf("decode canonical PNG data URL: %v", err)
		}
		if len(decoded) != block.SizeBytes {
			t.Fatalf("canonical PNG size is %d, expected %d", len(decoded), block.SizeBytes)
		}
		digest := sha256.Sum256(decoded)
		if hex.EncodeToString(digest[:]) != block.SHA256 {
			t.Fatal("canonical PNG digest does not match its metadata")
		}
		if _, err := png.Decode(bytes.NewReader(decoded)); err != nil {
			t.Fatalf("canonical PNG is not decodable: %v", err)
		}
		return
	}
	t.Fatal("canonical turn fixture has no image block")
}
