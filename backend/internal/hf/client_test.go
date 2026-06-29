package hf

import "testing"

func TestReadGeneratedTextFromChatResponse(t *testing.T) {
	text, err := readGeneratedText([]byte(`{
		"choices": [
			{
				"message": {
					"content": "{\"root\":\"Dashboard API\"}"
				}
			}
		]
	}`))

	if err != nil {
		t.Fatalf("read generated text: %v", err)
	}

	if text != `{"root":"Dashboard API"}` {
		t.Fatalf("unexpected text: %s", text)
	}
}
