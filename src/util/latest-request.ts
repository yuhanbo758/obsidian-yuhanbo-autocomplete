/** 后续输入替换查询时，旧 Promise 也必须结束，避免积压悬挂的补全请求。 */
export class LatestRequest<T, R> {
  private timer?: ReturnType<typeof setTimeout>;
  private resolve?: (result: R) => void;

  constructor(
    private work: (arg: T) => R,
    private delay: number,
    private empty: () => R,
  ) {}

  run(arg: T): Promise<R> {
    this.cancel();
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.resolve = undefined;
        try {
          resolve(this.work(arg));
        } catch (error) {
          reject(error);
        }
      }, this.delay);
    });
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.resolve?.(this.empty());
    this.resolve = undefined;
  }
}
