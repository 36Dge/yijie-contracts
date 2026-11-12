package videogeneration

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSourceExamples(t *testing.T) {
	data, err := os.ReadFile("../../../compatibility/video-generation/examples.json")
	if err != nil {
		t.Fatal(err)
	}
	var examples []struct {
		Name  string          `json:"name"`
		Type  string          `json:"type"`
		Valid bool            `json:"valid"`
		Value json.RawMessage `json:"value"`
	}
	if json.Unmarshal(data, &examples) != nil {
		t.Fatal("invalid source examples")
	}
	for _, e := range examples {
		t.Run(e.Name, func(t *testing.T) {
			var target any
			switch e.Type {
			case "GenerateInput":
				target = &GenerateInput{}
			case "GetInput":
				target = &GetInput{}
			case "VideoResult":
				target = &VideoResult{}
			default:
				t.Fatal("uncovered source type")
			}
			if (json.Unmarshal(e.Value, target) == nil) != e.Valid {
				t.Fatal("consumer differs from source schema")
			}
		})
	}
}
