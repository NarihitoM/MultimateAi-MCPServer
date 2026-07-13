# Multimate MCP Server

A comprehensive **Model Context Protocol (MCP)** server deployed on Vercel that provides AI assistants with tools to interact with:

- **Telegram** — Send & read messages, list chat participants
- **Slack** — Read history, send messages, list channels & users
- **Notion** — Read/write pages, databases, blocks
- **Google Sheets** — Read, edit, create, append, delete sheets
- **Google Docs** — Create, read, edit, delete documents
- **Web Search & Scrape** — Search Google, scrape web pages (via Firecrawl)
- **n8n** — List, create, update, delete, trigger workflows & executions

---

## 🔌 Connecting AI Assistants to This MCP Server

### Prerequisites

1. Deploy this repo to Vercel (or use an existing deployment URL)
2. (Optional) Set `MCP_API_KEY` environment variable in Vercel for auth

### Connection URL

```
https://https://narihito-mcp-server.vercel.app/api/mcp
```

### Configuring AI Clients

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "multimate": {
      "url": "https://narihito-mcp-server.vercel.app/api/mcp",
      "headers": {
        "x-api-key": "your-api-key-if-configured(Ask Me If You Wanna Try)",
        "x-slack-token": "xoxb-...",
        "x-notion-token": "ntn_...",
        "x-telegram-session": "...",
        "x-google-email": "...@...iam.gserviceaccount.com",
        "x-google-key": "-----BEGIN PRIVATE KEY-----\n...",
        "x-n8n-url": "https://...",
        "x-n8n-api-key": "..."
      }
    }
  }
}
```
</details>

<details>
<summary><b>VS Code (GitHub Copilot / Cline / Continue)</b></summary>

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "servers": {
    "multimate": {
      "type": "url",
      "url": "https://narihito-mcp-server.vercel.app/api/mcp",
      "headers": {
        "x-api-key": "your-api-key-if-configured",
        "x-slack-token": "xoxb-...",
        "x-notion-token": "ntn_..."
      }
    }
  }
}
```
</details>

<details>
<summary><b>Cursor</b></summary>

In Cursor settings → MCP Servers → Add new:

- **Name:** `multimate`
- **Type:** `url`
- **URL:** `https://narihito-mcp-server.vercel.app/api/mcp`
- **Headers:** (as JSON)
</details>

<details>
<summary><b>Claude Code (CLI)</b></summary>

```bash
claude mcp add multimate --url https://narihito-mcp-server.vercel.app/api/mcp
 \
  --header "x-api-key=..." \
  --header "x-slack-token=..."
```
</details>

---

## 🛠 Available Tools

### Telegram
| Tool | Description |
|------|-------------|
| `send_message` | Send a Telegram message to a user/group |
| `fetch_message` | Fetch recent messages from a Telegram chat |
| `fetch_chat_user` | List participants in a Telegram chat |
| `get_info` | Get info about a Telegram entity |

### Slack
| Tool | Description |
|------|-------------|
| `read_slack_history` | Read messages from a Slack channel |
| `send_slack_message` | Post a message to a Slack channel |
| `list_conversations` | List accessible Slack conversations |
| `get_user_info` | Get details about a Slack user |
| `get_team_info` | Get Slack workspace/team info |

### Notion
| Tool | Description |
|------|-------------|
| `read_notion_page` | Read a Notion page's title and content blocks |
| `update_notion_page` | Update a Notion page title or archive it |
| `append_notion_blocks` | Append content blocks to a Notion page |
| `create_new_page` | Create a new Notion page under a parent |
| `create_notion_database` | Create a Notion database with custom properties |
| `query_notion_database` | Query a Notion database with filters & sorting |
| `add_notion_database_row` | Add a row/entry to a Notion database |

### Google Sheets
| Tool | Description |
|------|-------------|
| `google_sheets_read` | Read data from a Google Sheet range |
| `google_sheets_edit` | Edit cells in a Google Sheet |
| `google_sheets_delete` | Clear data from a Sheet range |
| `google_sheets_create` | Create a new Google Spreadsheet |
| `google_sheets_add_sheet` | Add a new sheet tab to a spreadsheet |
| `google_sheets_append` | Append rows to a Google Sheet |

### Google Docs
| Tool | Description |
|------|-------------|
| `google_docs_create` | Create a new Google Doc with optional content |
| `google_docs_read` | Read a Google Doc's content as structured blocks |
| `google_docs_delete_file` | Permanently delete a Google Doc |
| `google_docs_edit` | Edit a Google Doc with content blocks & formatting |

### Web
| Tool | Description |
|------|-------------|
| `web_search` | Search the web using Google |
| `web_scrape` | Scrape a URL and return full content as markdown |

### n8n (Workflow Automation)
| Tool | Description |
|------|-------------|
| `n8n_list_workflows` | List all workflows in n8n |
| `n8n_get_workflow` | Get detailed workflow info |
| `n8n_create_workflow` | Create a new workflow |
| `n8n_update_workflow` | Update an existing workflow |
| `n8n_delete_workflow` | Delete a workflow |
| `n8n_activate_workflow` | Activate/enable a workflow |
| `n8n_deactivate_workflow` | Deactivate/disable a workflow |
| `n8n_trigger_workflow` | Manually execute/trigger a workflow |
| `n8n_list_executions` | List recent workflow executions |
| `n8n_get_execution` | Get detailed execution info |
| `n8n_retry_execution` | Retry a failed execution |
| `n8n_list_credentials` | List available n8n credentials |

---

## 📦 Authentication Headers

Each service requires specific headers. Pass them when connecting your AI client:

| Header | Service | How to Get |
|--------|---------|------------|
| `x-slack-token` | Slack | Slack App → OAuth & Permissions → Bot User OAuth Token |
| `x-notion-token` | Notion | Notion Integrations page → Internal Integration Secret |
| `x-telegram-session` | Telegram | Telegram API session string (from MTProto login) |
| `x-google-email` | Google APIs | Google Cloud Service Account email |
| `x-google-key` | Google APIs | Google Cloud Service Account private key |
| `x-n8n-url` | n8n | Your n8n instance base URL (e.g. `https://n8n.example.com`) |
| `x-n8n-api-key` | n8n | n8n API key (alternative to cookie auth) |
| `x-n8n-cookie` | n8n | n8n session cookie (alternative to API key) |
| `x-api-key` | (optional auth) | Set via `MCP_API_KEY` env variable on Vercel |

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Run with Vercel dev server
npm run dev
```

The MCP endpoint will be available at `http://localhost:3000/api/mcp`.

---

## 📁 Project Structure

```
├── api/
│   ├── mcp.ts              # Main MCP server handler (Vercel serverless)
│   ├── middleware.ts        # Auth & rate limiting middleware
│   ├── types.d.ts           # TypeScript declarations
│   ├── lib/
│   │   └── firecrawl.ts     # Firecrawl (web scraping) client
│   └── tools/
│       ├── index.ts         # All tool registrations
│       └── helpers.ts       # Shared utilities (Google auth, Notion blocks, etc.)
├── vercel.json              # Vercel deployment config
├── package.json
└── tsconfig.json
```
