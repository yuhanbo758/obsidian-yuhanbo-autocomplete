// Node 测试复用浏览器计时器入口，仍由 Jest 控制虚拟计时。
globalThis.window = globalThis;
