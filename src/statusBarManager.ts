import * as vscode from "vscode";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isActive: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "x9.togglePanel";
    this.updateStatusBar();

    const config = vscode.workspace.getConfiguration("x9");
    if (config.get("showInStatusBar", true)) {
      this.statusBarItem.show();
    }
  }

  /**
   * Atualiza o texto do botão na status bar
   */
  updateStatusBar(sessionCount?: number) {
    const icon = this.isActive ? "$(eye)" : "$(dashboard)";
    const text =
      sessionCount !== undefined && sessionCount > 0
        ? `${icon} X9 (${sessionCount})`
        : `${icon} X9`;

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip =
      "X9 AI Agent Monitor - Clique para abrir/fechar";
  }

  /**
   * Define o estado ativo/inativo
   */
  setActive(active: boolean) {
    this.isActive = active;
    this.updateStatusBar();
  }

  /**
   * Mostra o botão na status bar
   */
  show() {
    this.statusBarItem.show();
  }

  /**
   * Esconde o botão na status bar
   */
  hide() {
    this.statusBarItem.hide();
  }

  /**
   * Limpa recursos
   */
  dispose() {
    this.statusBarItem.dispose();
  }
}
