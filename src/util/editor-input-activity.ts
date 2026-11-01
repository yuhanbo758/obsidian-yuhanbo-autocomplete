/** 输入时只积累索引任务；组词结束且停止敲键一段时间后再恢复。 */
export class EditorInputActivity {
  private lastInput = -Infinity;
  private compositionTarget: object | null = null;
  private endedCompositionTargets = new WeakSet<object>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private waiters = new Set<(ready: boolean) => void>();
  private disposed = false;

  constructor(
    private quietMilliseconds = 800,
    private now = () => performance.now(),
  ) {}

  get composing(): boolean {
    return this.compositionTarget !== null;
  }

  markInput(): void {
    this.lastInput = this.now();
    this.schedule();
  }

  startComposition(target: object): void {
    this.compositionTarget = target;
    this.endedCompositionTargets.delete(target);
    this.markInput();
  }

  observeComposingInput(target: object): boolean {
    this.markInput();
    // 一次上屏后的尾随 beforeinput 仍可能带 isComposing，不能把已结束会话重新打开。
    if (this.endedCompositionTargets.has(target)) return false;
    this.compositionTarget = target;
    return true;
  }

  hasEndedComposition(target: object): boolean {
    return this.endedCompositionTargets.has(target);
  }

  endComposition(target?: object): boolean {
    if (target) this.endedCompositionTargets.add(target);
    if (target && this.compositionTarget && target !== this.compositionTarget)
      return false;
    if (!this.compositionTarget) return false;
    this.endedCompositionTargets.add(this.compositionTarget);
    this.compositionTarget = null;
    this.markInput();
    return true;
  }

  waitForIdle(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (
      !this.composing &&
      this.now() - this.lastInput >= this.quietMilliseconds
    )
      return Promise.resolve(true);
    return new Promise((resolve) => {
      this.waiters.add(resolve);
      this.schedule();
    });
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.disposed || this.composing || this.waiters.size === 0) return;
    const remaining = this.quietMilliseconds - (this.now() - this.lastInput);
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (this.composing) return;
        const waiters = [...this.waiters];
        this.waiters.clear();
        waiters.forEach((resolve) => resolve(true));
      },
      Math.max(0, remaining),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.compositionTarget = null;
    this.endedCompositionTargets = new WeakSet();
    clearTimeout(this.timer);
    this.timer = undefined;
    this.waiters.forEach((resolve) => resolve(false));
    this.waiters.clear();
  }
}

export function isEditorComposing(editor?: {
  cm?: { composing?: boolean; compositionStarted?: boolean };
}): boolean {
  // CodeMirror 的 composing 在首次文档变化前为 false，不能用于判断组词起点。
  return (
    editor?.cm?.compositionStarted === true || editor?.cm?.composing === true
  );
}
