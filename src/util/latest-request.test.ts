import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { LatestRequest } from "./latest-request";

describe("延迟补全请求的生命周期", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("连续输入时旧请求会完成为空，只有最新查询执行", async () => {
    const work = jest.fn((query: string) => [query]);
    const request = new LatestRequest(work, 100, () => []);
    const first = request.run("中");
    const latest = request.run("中文");
    await expect(first).resolves.toEqual([]);
    jest.advanceTimersByTime(100);
    await expect(latest).resolves.toEqual(["中文"]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  test("关闭或卸载后不执行延迟任务，等待中的请求也会结束", async () => {
    const work = jest.fn(() => ["中文"]);
    const request = new LatestRequest(work, 100, () => []);
    const pending = request.run("中");
    request.cancel();
    jest.runAllTimers();
    await expect(pending).resolves.toEqual([]);
    expect(work).not.toHaveBeenCalled();
  });

  test("查询异常会拒绝 Promise，不留下悬挂请求", async () => {
    const request = new LatestRequest(
      () => {
        throw new Error("fixture");
      },
      0,
      () => [],
    );
    const pending = request.run("中");
    const check = expect(pending).rejects.toThrow("fixture");
    jest.runAllTimers();
    await check;
  });
});
