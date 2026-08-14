# Multimate MCP Server

A comprehensive **Model Context Protocol (MCP)** server deployed on Vercel that provides AI assistants with tools to interact with:

- **Telegram** — Send & read messages, list chat participants
- **Slack** — Read history, send messages, list channels & users
- **Notion** — Read/write pages, databases, blocks
- **Google Sheets** — Read, edit, create, append, delete sheets
- **Google Docs** — Create, read, edit, delete documents
- **Google Calendar** — List, create, update, delete events
- **Gmail** — List, read, send messages
- **Web Search & Scrape** — Search Google, scrape web pages (via Firecrawl)
- **n8n** — List, create, update, delete, trigger workflows & executions
- **GitHub** — List repos/issues/PRs, create issues, comment, commit files, check profile & notifications
- **Discord** — List channels, send messages, read message history
- **Vercel** — List/inspect projects & deployments, read logs, redeploy/cancel/promote, manage env vars, delete deployments/projects

---

## 🔌 Connecting AI Assistants to This MCP Server

### Prerequisites

1. Deploy this repo to Vercel (or use an existing deployment URL)
2. (Optional) Set `MCP_API_KEY` environment variable in Vercel for auth

### Connection URL

```
https://narihito-mcp-servers.vercel.app/api/mcp
```

### Configuring AI Clients

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "multimate": {
      "url": "https://narihito-mcp-servers.vercel.app/api/mcp",
      "headers": {
        "x-api-key": "your-api-key-if-configured",
        "x-slack-token": "xoxb-...",
        "x-notion-token": "ntn_...",
        "x-telegram-session": "...",
        "x-google-access-token": "ya29...",
        "x-n8n-url": "https://...",
        "x-n8n-api-key": "...",
        "x-github-token": "ghp_...",
        "x-discord-bot-token": "...",
        "x-vercel-token": "...",
        "x-vercel-team-id": "team_... (optional, only for team-scoped accounts)"
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
      "url": "https://narihito-mcp-servers.vercel.app/api/mcp",
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
- **URL:** `https://narihito-mcp-servers.vercel.app/api/mcp`
- **Headers:** (as JSON)
</details>

<details>
<summary><b>Claude Code (CLI)</b></summary>

```bash
claude mcp add multimate --url https://narihito-mcp-servers.vercel.app/api/mcp \
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
| `list_chats` | List all dialogs (users, groups, channels) with their ID, name, and type |
| `resolve_chat` | Look up a chat by @username to get its numeric ID |

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

### Google Calendar
| Tool | Description |
|------|-------------|
| `google_calendar_list_events` | List upcoming events in a time range |
| `google_calendar_create_event` | Create a new calendar event |
| `google_calendar_update_event` | Update an existing calendar event |
| `google_calendar_delete_event` | Permanently delete a calendar event |

### Gmail
| Tool | Description |
|------|-------------|
| `gmail_list_messages` | List messages matching a search query |
| `gmail_read_message` | Read the full content of a message by ID |
| `gmail_send_message` | Send a message with an AI-designed HTML layout |
| `gmail_reply_message` | Reply to an existing message thread |

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
| `n8n_trigger_webhook` | Trigger an n8n webhook URL directly with a JSON payload (works even without REST API access, e.g. Cloud Free) |

### GitHub
| Tool | Description |
|------|-------------|
| `list_repos` | List the authenticated user's repositories |
| `list_issues` | List issues in a repository, filtered by state |
| `create_issue` | Create a new issue |
| `comment_issue` | Add a comment to an existing issue |
| `list_pull_requests` | List pull requests in a repository, filtered by state |
| `get_profile` | Get the authenticated user's GitHub profile |
| `list_notifications` | List unread (or all) notifications |
| `commit_file` | Create or update a file and commit it directly to a branch |

### Discord
| Tool | Description |
|------|-------------|
| `discord_list_channels` | List channels in a guild |
| `discord_send_message` | Send a message to a channel |
| `discord_read_messages` | Read recent messages from a channel |

### Vercel
| Tool | Description |
|------|-------------|
| `vercel_list_projects` | List all projects in the account/team |
| `vercel_get_project` | Get full details of a project |
| `vercel_list_deployments` | List recent deployments, optionally filtered by project |
| `vercel_get_deployment` | Get full details of a deployment |
| `vercel_get_deployment_logs` | Get the build/runtime event log for a deployment |
| `vercel_list_domains` | List domains configured across the account/team |
| `vercel_redeploy` | Redeploy an existing deployment |
| `vercel_cancel_deployment` | Cancel a deployment that is currently building |
| `vercel_promote_deployment` | Point production traffic at a specific deployment |
| `vercel_list_env` | List a project's environment variable names/targets/types (values are never returned) |
| `vercel_add_env` | Add a new environment variable to a project |
| `vercel_update_env` | Update an existing environment variable |
| `vercel_remove_env` | Remove an environment variable |
| `vercel_delete_deployment` | Permanently delete a deployment |
| `vercel_delete_project` | Permanently delete a project and all its deployments |

---

## 📦 Authentication Headers

Each service requires specific headers. Pass them when connecting your AI client:

| Header | Service | How to Get |
|--------|---------|------------|
| `x-slack-token` | Slack | Slack App → OAuth & Permissions → User OAuth Token |
| `x-notion-token` | Notion | Notion Integrations page → Internal Integration Secret |
| `x-telegram-session` | Telegram | Telegram API session string (from MTProto login) |
| `x-google-access-token` | Google APIs | OAuth 2.0 access token (short-lived, scoped to spreadsheets/drive/documents/calendar/gmail) |
| `x-n8n-url` | n8n | Your n8n instance base URL (e.g. `https://n8n.example.com`) |
| `x-n8n-api-key` | n8n | n8n API key (alternative to cookie auth) |
| `x-n8n-cookie` | n8n | n8n session cookie (alternative to API key) |
| `x-github-token` | GitHub | GitHub personal access token or OAuth token |
| `x-discord-bot-token` | Discord | Discord bot token |
| `x-vercel-token` | Vercel | Vercel OAuth access token (from the Integration token exchange) |
| `x-vercel-team-id` | Vercel | Team ID, required only when the connection is team-scoped (personal accounts omit it) |
| `x-api-key` | (optional auth) | Set via `MCP_API_KEY` env variable on Vercel |

---

## Environment Variables

Set these in the Vercel project (or a local `.env` for `vercel dev`):

| Variable | Purpose |
|---|---|
| `MCP_API_KEY` | Optional shared key gating this server itself (checked against the `x-api-key` header). If unset, the server is open to anyone with the URL. |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | Telegram MTProto app credentials, required for every Telegram tool call |
| `FIRECRAWL_API_KEY` | Picked up implicitly by the Firecrawl SDK (`new Firecrawl()`) for `web_search`/`web_scrape` — not referenced directly in code, but required for those tools to work |

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
│       ├── index.ts         # All tool registrations (Telegram, Slack, Notion,
│       │                    #  Google, n8n, GitHub, Discord, Vercel, web)
│       └── helpers.ts       # Shared utilities (Google auth, Notion blocks, etc.)
├── vercel.json              # Vercel deployment config
├── package.json
└── tsconfig.json
```
