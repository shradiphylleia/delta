package hf

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// take from env or populate idhar
const defaultURL = "https://router.huggingface.co/v1/chat/completions"

type Client struct {
	token      string
	model      string
	httpClient *http.Client
}

func NewClient(token string, model string) Client {
	return Client{
		token: strings.TrimSpace(token),
		model: strings.TrimSpace(model),
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

func (c Client) Generate(ctx context.Context, prompt string) (string, error) {
	if c.token == "" {
		return "", errors.New("hugging face token is not configured")
	}

	if c.model == "" {
		return "", errors.New("hugging face model is not configured")
	}

	body := map[string]any{
		"model": c.model,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens":  700,
		"temperature": 0.1,
		"stream":      false,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, defaultURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("hugging face request failed: %s", strings.TrimSpace(string(raw)))
	}

	return readGeneratedText(raw)
}

func readGeneratedText(raw []byte) (string, error) {
	var chat struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(raw, &chat); err == nil && len(chat.Choices) > 0 {
		return chat.Choices[0].Message.Content, nil
	}

	var list []struct {
		GeneratedText string `json:"generated_text"`
	}

	if err := json.Unmarshal(raw, &list); err == nil && len(list) > 0 {
		return list[0].GeneratedText, nil
	}

	var item struct {
		GeneratedText string `json:"generated_text"`
	}

	if err := json.Unmarshal(raw, &item); err == nil && item.GeneratedText != "" {
		return item.GeneratedText, nil
	}

	var errBody struct {
		Error string `json:"error"`
	}

	if err := json.Unmarshal(raw, &errBody); err == nil && errBody.Error != "" {
		return "", errors.New(errBody.Error)
	}

	return string(raw), nil
}
