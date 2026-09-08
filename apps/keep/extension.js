const vscode = require("vscode");

const ENGINE = process.env.LOCALMOD_ENGINE || "http://127.0.0.1:4781";

async function post(path, body) {
  const res = await fetch(`${ENGINE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function chat() {
  const prompt = await vscode.window.showInputBox({ prompt: "Ask Localmod Editor (local engine)" });
  if (!prompt) return;
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Editor…" }, async () => {
    const r = await fetch(`${ENGINE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }], stream: false }),
    });
    const text = await r.text();
    const doc = await vscode.workspace.openTextDocument({ content: text.slice(0, 8000), language: "markdown" });
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

async function inlineEdit() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("Open a file first.");
    return;
  }
  const instruction = await vscode.window.showInputBox({ prompt: "Inline edit instruction" });
  if (!instruction) return;
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const rel = folder ? vscode.workspace.asRelativePath(editor.document.uri) : editor.document.fileName;
  const out = await post("/keep/inline", {
    cwd: folder,
    path: rel,
    instruction,
    apply: false,
  });
  const doc = await vscode.workspace.openTextDocument({ content: out.proposed || "", language: editor.document.languageId });
  await vscode.window.showTextDocument(doc, { preview: true });
}

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand("localmod.keep.chat", () => chat().catch((e) => vscode.window.showErrorMessage(String(e.message || e)))));
  context.subscriptions.push(vscode.commands.registerCommand("localmod.keep.edit", () => inlineEdit().catch((e) => vscode.window.showErrorMessage(String(e.message || e)))));
}

function deactivate() {}

module.exports = { activate, deactivate };
