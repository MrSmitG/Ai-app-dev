const vscode = require("vscode");

const ENGINE = process.env.LOCALMOD_ENGINE || "http://127.0.0.1:4781";

async function run() {
  const goal = await vscode.window.showInputBox({
    prompt: "What should Hands do in this workspace?",
    placeHolder: "List files and run git status",
  });
  if (!goal) return;
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) {
    vscode.window.showErrorMessage("Open a folder first.");
    return;
  }
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Hands working…" }, async () => {
    const res = await fetch(`${ENGINE}/hands/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd, goal, maxSteps: 6 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    const text = (data.log || [])
      .map((e) => `### ${e.step} ${e.action?.name}\n${e.thought}\n\n${e.result}`)
      .join("\n\n");
    const doc = await vscode.workspace.openTextDocument({ content: text || JSON.stringify(data, null, 2), language: "markdown" });
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("localmod.hands.run", () => run().catch((e) => vscode.window.showErrorMessage(String(e.message || e))))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
