# Reference: базовый процесс на Go

Сквозной пример через шлюз `bcd-to-hrtek`. Базовые/популярные средства: `net/http`, `golang.org/x/oauth2/clientcredentials` (кэширует токен сам). Секреты — из env; хосты — плейсхолдеры. Детали токена — [reference.auth.md](reference.auth.md); процессы — [reference.flows.md](reference.flows.md).

## Клиент с авто-токеном Service-Guard

```go
package hrtek

import (
	"context"
	"net/http"
	"golang.org/x/oauth2/clientcredentials"
)

type Config struct {
	GatewayBaseURL string // https://<esb-krakend-host>/bcd-to-hrtek/api/v1.0
	TokenURL       string // https://<service-guard-host>/realms/<service-guard-env-realm>/protocol/openid-connect/token
	ClientID       string // <consumer-client-id>
	ClientSecret   string // из env, не хардкодить
	Side           string // "company" | "employee"
}

type Client struct {
	cfg  Config
	http *http.Client // с авто-Bearer из clientcredentials (токен кэшируется и обновляется)
}

func New(ctx context.Context, cfg Config) *Client {
	cc := clientcredentials.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		TokenURL:     cfg.TokenURL,
	}
	return &Client{cfg: cfg, http: cc.Client(ctx)} // x/oauth2 сам ставит Authorization: Bearer
}

func (c *Client) newReq(ctx context.Context, method, path, userID string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.cfg.GatewayBaseURL+path, body)
	if err != nil {
		return nil, err
	}
	if userID != "" {
		req.Header.Set("X-User-Id", userID)
	}
	req.Header.Set("X-Side", c.cfg.Side)
	return req, nil
}
```

## Шаги базового процесса

```go
type idResp struct{ ID string `json:"id"` }
type eventIDResp struct{ EventID string `json:"event_id"` }
type eventState struct {
	ActiveNodes []struct {
		Action struct{ Type string `json:"type"` } `json:"action"`
		NodeID string `json:"node_id"`
	} `json:"active_nodes"`
	Documents   []struct{ ID string `json:"id"` } `json:"documents"`
	Permissions struct{ Cancel bool `json:"cancel"` } `json:"permissions"`
}

func (c *Client) ResolveUserBySnils(ctx context.Context, snils string) (string, error) {
	req, _ := c.newReq(ctx, http.MethodGet, "/user/by_snils?snils="+url.QueryEscape(snils), "", nil)
	var out idResp
	return out.ID, c.do(req, &out)
}

func (c *Client) CreateEvent(ctx context.Context, userID, eventTypeID, employeeID string) (string, error) {
	body, _ := json.Marshal(map[string]string{"event_type_id": eventTypeID, "employee_id": employeeID})
	req, _ := c.newReq(ctx, http.MethodPost, "/event", userID, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	var out eventIDResp
	return out.EventID, c.do(req, &out)
}

func (c *Client) GetEvent(ctx context.Context, userID, eventID string) (eventState, error) {
	req, _ := c.newReq(ctx, http.MethodGet, "/event/"+eventID, userID, nil)
	var out eventState
	return out, c.do(req, &out)
}

// CancelEvent: (true,nil) — отменена; (false,nil) — завершённая (403 forbidden).
func (c *Client) CancelEvent(ctx context.Context, userID, eventID string, reasonID int) (bool, error) {
	body, _ := json.Marshal(map[string]int{"reason_id": reasonID})
	req, _ := c.newReq(ctx, http.MethodPost, "/event/"+eventID+"/cancel", userID, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusForbidden {
		return false, nil
	}
	if resp.StatusCode/100 != 2 {
		return false, fmt.Errorf("hrtek cancel: %d", resp.StatusCode)
	}
	return true, nil
}

func (c *Client) do(req *http.Request, out any) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("hrtek %d: %s", resp.StatusCode, string(b))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
```

## Поллинг до completed + загрузка/скачивание

```go
// UploadDocument — multipart с полями document и attributes.
func (c *Client) UploadDocument(ctx context.Context, userID, eventID, nodeID string, doc io.Reader) error {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	fw, _ := w.CreateFormFile("document", "document.pdf")
	io.Copy(fw, doc)
	// Атрибуты этапа (по form_attributes) — отдельными полями attributes[<uuid>]:
	//   w.WriteField("attributes["+attrUUID+"]", "текстовое значение")    // type=text
	//   af, _ := w.CreateFormFile("attributes["+attrUUID+"]", "attr.pdf")  // type=file
	// Если этап атрибутов не требует — ничего не добавляем.
	w.Close()
	req, _ := c.newReq(ctx, http.MethodPost, "/event/"+eventID+"/"+nodeID+"/upload", userID, &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return c.do(req, nil)
}

// WaitCompleted — поллинг (нет webhooks); возвращает documentID.
func (c *Client) WaitCompleted(ctx context.Context, userID, eventID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	for {
		st, err := c.GetEvent(ctx, userID, eventID)
		if err != nil {
			return "", err
		}
		for _, n := range st.ActiveNodes {
			if n.Action.Type == "completed" && len(st.Documents) > 0 {
				return st.Documents[0].ID, nil
			}
		}
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(15 * time.Second):
		}
	}
}

func (c *Client) DownloadSignedPDF(ctx context.Context, userID, eventID, documentID, out string) error {
	req, _ := c.newReq(ctx, http.MethodGet, "/event/"+eventID+"/document/"+documentID+"/file_with_stamp", userID, nil)
	req.Header.Set("Accept", "application/pdf")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("hrtek download: %d", resp.StatusCode)
	}
	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}
```

> Импорты опущены для краткости (`bytes`, `encoding/json`, `fmt`, `io`, `mime/multipart`, `net/url`, `os`, `time`). `clientcredentials.Client` кэширует и обновляет токен; ручной повтор при 401 не требуется. Секреты — из env. Подписание — `reference.signing-*.md`.
