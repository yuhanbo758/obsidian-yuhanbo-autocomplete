import type { Word } from "../model/Word";
import type { PartialRequired } from "../types";

export type HitWord = PartialRequired<Word, "hit">;
export type SelectionHistory = {
  count: number;
  lastUpdated: number;
};

export type SelectionHistoryTree = {
  [hit: string]: {
    [value: string]: {
      [type: string]: SelectionHistory;
    };
  };
};

const SEC = 1000;
const MIN = SEC * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

function calcScore(
  history: SelectionHistory | undefined,
  latestUpdated: number,
): number {
  if (!history) {
    return 0;
  }

  if (history.lastUpdated === latestUpdated) {
    return Number.MAX_SAFE_INTEGER;
  }

  const behind = Date.now() - history.lastUpdated;

  // noinspection IfStatementWithTooManyBranchesJS
  if (behind < MIN) {
    return 8 * history.count;
  } else if (behind < HOUR) {
    return 4 * history.count;
  } else if (behind < DAY) {
    return 2 * history.count;
  } else if (behind < WEEK) {
    return 0.5 * history.count;
  } else {
    return 0.25 * history.count;
  }
}

export class SelectionHistoryStorage {
  data: SelectionHistoryTree;
  version: number;
  persistedVersion: number;
  // 0 means not defined
  maxDaysToKeepHistory: number;
  // 0 means not defined
  maxNumberOfHistoryToKeep: number;

  constructor(
    data: SelectionHistoryTree = {},
    maxDaysToKeepHistory: number,
    maxNumberOfHistoryToKeep: number,
  ) {
    this.data = data;

    this.version = 0;
    this.persistedVersion = 0;

    this.maxDaysToKeepHistory = maxDaysToKeepHistory;
    this.maxNumberOfHistoryToKeep = maxNumberOfHistoryToKeep;
  }

  purge() {
    const now = Date.now();
    const entries: {
      hit: string;
      value: string;
      kind: string;
      updated: number;
    }[] = [];
    for (const hit of Object.keys(this.data)) {
      for (const value of Object.keys(this.data[hit])) {
        for (const kind of Object.keys(this.data[hit][value])) {
          const history = this.data[hit][value][kind];
          if (
            this.maxDaysToKeepHistory &&
            now - history.lastUpdated > this.maxDaysToKeepHistory * DAY
          )
            delete this.data[hit][value][kind];
          else entries.push({ hit, value, kind, updated: history.lastUpdated });
        }
      }
    }
    if (this.maxNumberOfHistoryToKeep > 0) {
      // 时间戳相同也按条数严格截断，稳定保留原记录顺序。
      entries.sort((a, b) => b.updated - a.updated);
      for (const { hit, value, kind } of entries.slice(
        this.maxNumberOfHistoryToKeep,
      ))
        delete this.data[hit][value][kind];
    }
    for (const hit of Object.keys(this.data)) {
      for (const value of Object.keys(this.data[hit])) {
        if (Object.keys(this.data[hit][value]).length === 0)
          delete this.data[hit][value];
      }
      if (Object.keys(this.data[hit]).length === 0) delete this.data[hit];
    }
  }

  getSelectionHistory(word: HitWord): SelectionHistory | undefined {
    const value = word.valueForHistory ?? word.value;
    if (!Object.prototype.hasOwnProperty.call(this.data, word.hit))
      return undefined;
    const values = this.data[word.hit];
    if (!Object.prototype.hasOwnProperty.call(values, value)) return undefined;
    return Object.prototype.hasOwnProperty.call(values[value], word.type)
      ? values[value][word.type]
      : undefined;
  }

  increment(word: HitWord): void {
    // 用户词条可以是 constructor 或 __proto__，必须创建自有属性，不能修改原型。
    if (!Object.prototype.hasOwnProperty.call(this.data, word.hit))
      Object.defineProperty(this.data, word.hit, {
        value: Object.create(null),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    const values = this.data[word.hit];
    const value = word.valueForHistory ?? word.value;
    if (!Object.prototype.hasOwnProperty.call(values, value))
      Object.defineProperty(values, value, {
        value: Object.create(null),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    const previous = this.getSelectionHistory(word);
    values[value][word.type] = {
      count: (previous?.count ?? 0) + 1,
      lastUpdated: Date.now(),
    };
    // 持久化版本单调递增，避免同一毫秒选中两次或系统时间回拨时漏保存。
    ++this.version;
  }

  compare(w1: HitWord, w2: HitWord, latestUpdated: number): -1 | 0 | 1 {
    const score1 = calcScore(this.getSelectionHistory(w1), latestUpdated);
    const score2 = calcScore(this.getSelectionHistory(w2), latestUpdated);

    if (score1 === score2) {
      return 0;
    }

    return score1 > score2 ? -1 : 1;
  }

  get shouldPersist(): boolean {
    return this.version > this.persistedVersion;
  }

  syncPersistVersion(version = this.version): void {
    this.persistedVersion = Math.max(
      this.persistedVersion,
      Math.min(version, this.version),
    );
  }
}
