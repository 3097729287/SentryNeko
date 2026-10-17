# Tauri 命令

[English](commands.md) | **简体中文**

前端与后端之间的每一次调用都通过 `src-tauri/src/commands/` 下的 `#[tauri::command]`
函数完成。处理函数保持轻薄：校验参数、委托给 `services/` 或 `db/`，再把结果映射为
`utils::response` 的结构。业务逻辑不放在命令里。

## 响应信封

命令不直接返回领域类型，而是统一 resolve 成同一种结构，成功与失败一致（定义在
`src-tauri/src/utils/response.rs`，由 `src/types/index.ts` 的 `ApiResponse<T>` 镜像）：

```json
// 成功
{ "code": "OK", "message": "OK", "details": null, "data": { "id": 1, "title": "Write the docs" } }

// 失败
{ "code": "INVALID_INPUT", "message": "title must not be empty", "details": null, "data": null }
```

- `code` —— 契约本身。前端据此分支，并挑选本地化文案。
- `message` —— 后端给出的兜底文案，用于日志以及前端尚未认识的错误码，绝不作为界面文案的唯一来源。
- `details` —— 底层诊断信息（I/O 报错、解析报错）。用于日志与问题反馈，不做本地化，也不要当作界面文案渲染。
- `data` —— 成功时的载荷，失败时为 `null`。

信封是 resolve 而不是 reject：`invoke()` 只在传输层失败（命令未注册、处理函数 panic、
载荷序列化失败）时 reject，因此一次 `code` 判断即可覆盖所有业务结果。

## 错误码

| 错误码 | 含义 | 由谁产生 |
| --- | --- | --- |
| `OK` | 成功，`data` 有值 | — |
| `INVALID_INPUT` | 参数未通过校验 | 任何校验入参的命令 |
| `NOT_FOUND` | 请求的记录不存在 | CRUD 命令（T10、T16、T17） |
| `CONFLICT` | 与已存状态冲突（唯一键重复、版本过期） | CRUD 命令 |
| `DATABASE` | 数据库层失败 | `db/`（T04） |
| `IO` | 文件系统或其他 OS 级 I/O 失败 | `config.rs`、导出导入（T29） |
| `PERMISSION_DENIED` | 系统拒绝该操作 | 采集器（T12）、开机自启（T26） |
| `UNSUPPORTED` | 属于后续里程碑的预留能力 | P3 桩实现（T27–T32） |
| `INTERNAL` | 其他意外情况，`details` 说明原因 | `?` 的兜底 |

`services::i18n`（T06）负责把错误码映射为本地化的 `message`。新增错误码需要同时更新
`ApiCode` 与 `src/types/index.ts` 中的 `ApiCode` 联合类型。

## 编写命令

```rust
// src-tauri/src/commands/todo_commands.rs
use crate::utils::response::{ApiError, ApiResponse, ApiResult};

#[tauri::command]
pub fn toggle_todo(id: i64) -> ApiResponse<Todo> {
    toggle(id).into()
}

fn toggle(id: i64) -> ApiResult<Todo> {
    if id <= 0 {
        return Err(ApiError::invalid_input("id must be a positive integer"));
    }

    repository::toggle_todo(id) // -> ApiResult<Todo>
}
```

规则（`CONTRIBUTING.md` 中同样有约束）：

1. 对外命令返回 `ApiResponse<T>`；可失败的辅助函数返回 `ApiResult<T>`，最后用 `.into()` 一次性转换。
2. 用户可触发的路径上不得使用 `unwrap()` / `expect()`，一律返回 `ApiError`。
3. 需要在信封里返回数值时，用 `?` 传播 `ApiResult`，最后再转换。
4. 在 `lib.rs` 中用 `.invoke_handler(tauri::generate_handler![toggle_todo])` 注册命令。
5. 应用自定义命令不需要在 `capabilities/default.json` 中登记，该文件只授予 core 与插件命令的权限。
6. 在下表中补一行，签名变化时同步更新。

## 命令索引

目前还没有注册任何命令——第一条会随 T04/T05 到来，此后新增的命令都会列在这里。

| 命令 | 模块 | 参数 | 返回 | 任务 |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |
