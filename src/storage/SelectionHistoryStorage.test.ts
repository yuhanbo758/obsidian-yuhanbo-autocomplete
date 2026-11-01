import { afterEach, expect, jest, test } from "@jest/globals";
import {
  SelectionHistoryStorage,
  type HitWord,
} from "./SelectionHistoryStorage";

afterEach(() => {
  jest.restoreAllMocks();
});
const word = (value: string): HitWord => ({
  value,
  hit: value,
  type: "customDictionary",
  createdPath: "fixture",
});

test("同一毫秒及系统时间回拨后选词仍标记需要持久化", () => {
  const now = jest.spyOn(Date, "now").mockReturnValue(100);
  const history = new SelectionHistoryStorage({}, 0, 0);
  history.increment(word("提示词"));
  history.syncPersistVersion();
  history.increment(word("提示词"));
  expect(history.shouldPersist).toBe(true);
  history.syncPersistVersion();
  now.mockReturnValue(50);
  history.increment(word("提示词"));
  expect(history.shouldPersist).toBe(true);
  expect(history.getSelectionHistory(word("提示词"))?.count).toBe(3);
});

test("合法的原型同名词条可记录并序列化，不修改全局原型", () => {
  const history = new SelectionHistoryStorage({}, 0, 0);
  history.increment(word("constructor"));
  history.increment(word("__proto__"));
  expect(history.getSelectionHistory(word("constructor"))?.count).toBe(1);
  expect(history.getSelectionHistory(word("__proto__"))?.count).toBe(1);
  const restored = new SelectionHistoryStorage(
    JSON.parse(JSON.stringify(history.data)),
    0,
    0,
  );
  expect(restored.getSelectionHistory(word("__proto__"))?.count).toBe(1);
  expect(Object.prototype).not.toHaveProperty("customDictionary");
});

test("别名使用原词记录历史时，读取与写入使用相同键", () => {
  const history = new SelectionHistoryStorage({}, 0, 0);
  const alias = { ...word("查询别名"), valueForHistory: "原始词条" };
  history.increment(alias);
  expect(history.getSelectionHistory(alias)?.count).toBe(1);
});

test("保留条数对同时间戳的记录同样严格生效，旧数据可直接沿用", () => {
  jest.spyOn(Date, "now").mockReturnValue(100);
  const history = new SelectionHistoryStorage({}, 0, 2);
  ["甲", "乙", "丙"].forEach((value) => history.increment(word(value)));
  history.purge();
  expect(Object.keys(history.data)).toHaveLength(2);
  expect(history.getSelectionHistory(word("甲"))?.count).toBe(1);
});

test("异步保存期间新增选择时，只标记实际写入的版本", () => {
  const history = new SelectionHistoryStorage({}, 0, 0);
  history.increment(word("提示词"));
  const writingVersion = history.version;
  history.increment(word("提示词设计"));
  history.syncPersistVersion(writingVersion);
  expect(history.shouldPersist).toBe(true);
  history.syncPersistVersion();
  history.syncPersistVersion(writingVersion);
  expect(history.shouldPersist).toBe(false);
});
