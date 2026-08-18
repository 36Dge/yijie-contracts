package agenthost_test

import (
	"context"
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
