import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Native folder picker for Windows (PowerShell) and macOS (osascript).
 * Returns "" if cancelled or unsupported.
 */
export async function pickFolder(prompt = "Choose a folder") {
  try {
    if (process.platform === "win32") {
      const safe = String(prompt).replace(/'/g, "''");
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
        `$d.Description = '${safe}'`,
        "$d.ShowNewFolderButton = $true",
        "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }",
      ].join("; ");
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        { timeout: 300000, windowsHide: false, encoding: "utf8" }
      );
      return String(stdout || "").trim();
    }
    if (process.platform === "darwin") {
      const safe = String(prompt).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        `POSIX path of (choose folder with prompt "${safe}")`,
      ]);
      return String(stdout || "").trim().replace(/\/$/, "") || String(stdout || "").trim();
    }
  } catch {
    return "";
  }
  return "";
}
