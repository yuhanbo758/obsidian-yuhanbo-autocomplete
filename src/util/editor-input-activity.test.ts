import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import {
  EditorInputActivity,
  isEditorComposing,
} from "./editor-input-activity";

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test("首次组词尚未改变文档时也能识别输入法状态", () => {
  expect(
    isEditorComposing({ cm: { composing: false, compositionStarted: true } }),
  ).toBe(true);
  expect(isEditorComposing({ cm: { composing: true } })).toBe(true);
  expect(
    isEditorComposing({ cm: { composing: false, compositionStarted: false } }),
  ).toBe(false);
  expect(isEditorComposing()).toBe(false);
});

test("组词中即使停顿很久也不启动后台工作，上屏并空闲后恢复", async () => {
  const activity = new EditorInputActivity(800, () => Date.now());
  const target = {};
  activity.startComposition(target);
  let ready = false;
  const pending = activity.waitForIdle().then((result) => {
    ready = result;
  });
  jest.advanceTimersByTime(5000);
  await Promise.resolve();
  expect(ready).toBe(false);
  activity.endComposition(target);
  jest.advanceTimersByTime(799);
  await Promise.resolve();
  expect(ready).toBe(false);
  jest.advanceTimersByTime(1);
  await pending;
  expect(ready).toBe(true);
});

test("连续敲键重置空闲期，所有等待任务共用定时器", async () => {
  const activity = new EditorInputActivity(800, () => Date.now());
  activity.markInput();
  const first = activity.waitForIdle();
  const second = activity.waitForIdle();
  jest.advanceTimersByTime(700);
  activity.markInput();
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(800);
  await expect(first).resolves.toBe(true);
  await expect(second).resolves.toBe(true);
});

test("其他窗口的结束事件不会解除当前组词，失焦可解除等待", async () => {
  const activity = new EditorInputActivity(800, () => Date.now());
  activity.startComposition({});
  activity.endComposition({});
  expect(activity.composing).toBe(true);
  const pending = activity.waitForIdle();
  activity.endComposition();
  jest.advanceTimersByTime(800);
  await expect(pending).resolves.toBe(true);
});

test("卸载释放所有等待任务，不留下索引任务或定时器", async () => {
  const activity = new EditorInputActivity();
  activity.markInput();
  const pending = activity.waitForIdle();
  activity.dispose();
  await expect(pending).resolves.toBe(false);
  await expect(activity.waitForIdle()).resolves.toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test("整词结束后的尾随组词输入不会重开会话，下一轮真正组词仍可开始", () => {
  const activity = new EditorInputActivity();
  const target = {};
  activity.startComposition(target);
  activity.endComposition(target);
  expect(activity.observeComposingInput(target)).toBe(false);
  expect(activity.composing).toBe(false);
  expect(activity.hasEndedComposition(target)).toBe(true);
  activity.startComposition(target);
  expect(activity.observeComposingInput(target)).toBe(true);
  expect(activity.composing).toBe(true);
});

test("缺少 start 时可由输入事件跟踪组词，未知会话的 end 也能阻止尾随事件重开", () => {
  const activity = new EditorInputActivity();
  const target = {};
  expect(activity.observeComposingInput(target)).toBe(true);
  expect(activity.endComposition(target)).toBe(true);
  const other = {};
  activity.endComposition(other);
  expect(activity.observeComposingInput(other)).toBe(false);
});

test("旧窗口的尾随事件不会覆盖新窗口中的组词会话", () => {
  const activity = new EditorInputActivity();
  const first = {},
    second = {};
  activity.startComposition(first);
  activity.endComposition(first);
  activity.startComposition(second);
  expect(activity.observeComposingInput(first)).toBe(false);
  activity.endComposition(first);
  expect(activity.composing).toBe(true);
  activity.endComposition(second);
  expect(activity.composing).toBe(false);
});
