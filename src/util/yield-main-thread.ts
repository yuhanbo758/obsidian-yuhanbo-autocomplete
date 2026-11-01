/** 用独立任务让出线程，避免隐藏窗口的链式 setTimeout 被 Chromium 大幅限速。 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}
