import { z } from "zod";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

export const registerN8nTools: ToolRegistrar = (server, _auth) => {
  const getHeaders = () => {
    const n8nUrl = _auth["X-N8N-URL"];
    if (!n8nUrl) throw new Error("n8n URL not configured.");
    return {
      "X-N8N-URL": n8nUrl,
    };
  };


  const n8nFetch = async (path: string, options: RequestInit = {}) => {
    const headers = getHeaders();
    const url = `${headers["X-N8N-URL"]}/api/v1${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error (${response.status}): ${error}`);
    }
    return response.json();
  };

  server.tool("n8n_list_workflows", "List all workflows in n8n", {}, async () => {
    const data = await n8nFetch("/workflows");
    const workflows = (data.data || []).map((w: any) =>
      `${w.id}: ${w.name} (${w.active ? "active" : "inactive"})`
    ).join("\n");
    return textResult(workflows || "No workflows found.");
  });

  server.tool("n8n_get_workflow", "Get workflow details", {
    workflowId: z.string().describe("The workflow ID"),
  }, async ({ workflowId }) => {
    const data = await n8nFetch(`/workflows/${workflowId}`);
    return textResult(JSON.stringify(data, null, 2));
  });

  server.tool("n8n_create_workflow", "Create a new workflow", {
    name: z.string().describe("Workflow name"),
    nodes: z.array(z.any()).describe("Array of node objects"),
    connections: z.record(z.any()).describe("Connection map"),
    settings: z.record(z.any()).optional().describe("Workflow settings"),
  }, async ({ name, nodes, connections, settings }) => {
    const data = await n8nFetch("/workflows", {
      method: "POST",
      body: JSON.stringify({ name, nodes, connections, settings: settings || {} }),
    });
    return textResult(`Created workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_update_workflow", "Update an existing workflow", {
    workflowId: z.string().describe("The workflow ID"),
    name: z.string().optional().describe("New name"),
    nodes: z.array(z.any()).optional().describe("Updated nodes"),
    connections: z.record(z.any()).optional().describe("Updated connections"),
    settings: z.record(z.any()).optional().describe("Updated settings"),
  }, async ({ workflowId, name, nodes, connections, settings }) => {
    const body: any = {};
    if (name) body.name = name;
    if (nodes) body.nodes = nodes;
    if (connections) body.connections = connections;
    if (settings) body.settings = settings;
    const data = await n8nFetch(`/workflows/${workflowId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return textResult(`Updated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_delete_workflow", "Delete a workflow", {
    workflowId: z.string().describe("The workflow ID"),
  }, async ({ workflowId }) => {
    await n8nFetch(`/workflows/${workflowId}`, { method: "DELETE" });
    return textResult(`Deleted workflow ${workflowId}`);
  });

  server.tool("n8n_activate_workflow", "Activate a workflow", {
    workflowId: z.string().describe("The workflow ID"),
  }, async ({ workflowId }) => {
    const data = await n8nFetch(`/workflows/${workflowId}/activate`, { method: "POST" });
    return textResult(`Activated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_deactivate_workflow", "Deactivate a workflow", {
    workflowId: z.string().describe("The workflow ID"),
  }, async ({ workflowId }) => {
    const data = await n8nFetch(`/workflows/${workflowId}/deactivate`, { method: "POST" });
    return textResult(`Deactivated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_trigger_workflow", "Manually execute a workflow", {
    workflowId: z.string().describe("The workflow ID"),
    data: z.record(z.any()).optional().describe("Input data"),
  }, async ({ workflowId, data }) => {
    const result = await n8nFetch(`/workflows/${workflowId}/run`, {
      method: "POST",
      body: JSON.stringify({ data: data || {} }),
    });
    return textResult(`Triggered workflow. Execution ID: ${result.id || "unknown"}`);
  });

  server.tool("n8n_list_executions", "List recent executions", {
    workflowId: z.string().optional().describe("Filter by workflow ID"),
    status: z.string().optional().describe("Filter by status"),
    limit: z.number().optional().describe("Number of results"),
  }, async ({ workflowId, status, limit }) => {
    const params = new URLSearchParams();
    if (workflowId) params.set("workflowId", workflowId);
    if (status) params.set("status", status);
    if (limit) params.set("limit", limit.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await n8nFetch(`/executions${query}`);
    const executions = (data.data || []).map((e: any) =>
      `${e.id}: ${e.workflowId} - ${e.status} (${e.startedAt})`
    ).join("\n");
    return textResult(executions || "No executions found.");
  });

  server.tool("n8n_get_execution", "Get execution details", {
    executionId: z.string().describe("The execution ID"),
  }, async ({ executionId }) => {
    const data = await n8nFetch(`/executions/${executionId}`);
    return textResult(JSON.stringify(data, null, 2));
  });

  server.tool("n8n_retry_execution", "Retry a failed execution", {
    executionId: z.string().describe("The execution ID"),
  }, async ({ executionId }) => {
    const data = await n8nFetch(`/executions/${executionId}/retry`, {
      method: "POST",
      body: JSON.stringify({ retrySuccessfulWorkflow: true }),
    });
    return textResult(`Retried execution ${executionId}. New ID: ${data.id || "unknown"}`);
  });

  server.tool("n8n_list_credentials", "List available credentials", {}, async () => {
    const data = await n8nFetch("/credentials");
    const creds = (data.data || []).map((c: any) =>
      `${c.id}: ${c.name} (${c.type})`
    ).join("\n");
    return textResult(creds || "No credentials found.");
  });
};
