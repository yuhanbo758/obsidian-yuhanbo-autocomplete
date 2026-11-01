import { expect, jest, test } from "@jest/globals";
import { yieldToMainThread } from "./yield-main-thread";

test("让出当前任务且不依赖被后台限速的定时器", async () => {
  const timer = jest.spyOn(globalThis, "setTimeout").mockImplementation(() => {
    throw new Error("不应使用定时器调度索引批次");
  });
  try {
    const order: string[] = [];
    const pending = yieldToMainThread().then(() => order.push("next task"));
    order.push("current task");
    await Promise.resolve();
    expect(order).toEqual(["current task"]);
    await pending;
    expect(order).toEqual(["current task", "next task"]);
    expect(timer).not.toHaveBeenCalled();
  } finally {
    timer.mockRestore();
  }
});
