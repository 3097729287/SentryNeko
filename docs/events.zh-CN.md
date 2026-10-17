# Tauri 事件

[English](events.md) | **简体中文**

命令是前端发起的调用，事件是后端发起的推送。本文档中的每个事件都经 `services/event_bus.rs`
发出：采集器与定时器把载荷交给总线，由总线推送到 webview。

## 前端监听方式

不要直接调用 `listen`。`hooks/useTauriEvent.ts` 负责订阅并在卸载时清理；不在 Tauri 环境
（例如浏览器里直接 `pnpm dev`）时它不订阅任何东西，界面照常运行。

```tsx
import { BACKEND_EVENTS, useTauriEvent } from "../hooks/useTauriEvent";
import type { TestEventPayload } from "../types";

useTauriEvent<TestEventPayload>(BACKEND_EVENTS.testEvent, (payload) => {
  // payload.sequence
});
```

事件名集中在 `BACKEND_EVENTS`（`hooks/useTauriEvent.ts`），载荷类型在 `src/types/`，两者都在
下表中登记。

## 事件名

命名采用扁平 kebab-case。改名会打断所有监听方，因此改名视作新增事件：先加新名、迁移监听
方，再删旧名。

| 事件 | 载荷 | 触发时机 | 任务 |
| --- | --- | --- | --- |
| `test-event` | `TestEvent` —— `{ sequence: u64 }` | `emit_test_event` 按需推送一条，`sequence` 每次递增 | T08 |
| `notification-fallback` | `NotificationFallback` —— `{ kind, reason }` | `send_test_notification` 在系统拒绝 Toast 时推一条，前端改为在应用内显示 | T14 |

## 载荷规则

- 载荷是 `services/event_bus.rs` 中与事件名相邻的 `serde` 结构体，并在 `src/types/index.ts`
  中有对应接口；字段只有在类型声明为可选时才可选。
- 传输时属性名为 camelCase（`#[serde(rename_all = "camelCase")]`），前端读到的是 `startedAt`
  而不是 `started_at`。
- 时间戳一律用 UTC epoch 秒，与 `docs/database.md` 保持一致，展示时在前端格式化；预格式化
  的本地时间字符串不得进入载荷。
- 载荷中不放本地化文案：文案由前端用自己的 `t()` key 渲染。
