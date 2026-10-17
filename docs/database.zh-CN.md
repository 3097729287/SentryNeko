# 数据库

[English](database.md) | **简体中文**

SQLite，驱动为 `rusqlite`，连接由 `r2d2` 池管理；表结构一律由版本化迁移创建，不手工建表。

## 分层

| 文件 | 职责 |
| --- | --- |
| `db/connection.rs` | `Db` 句柄、连接池参数、连接 PRAGMA、`ApiError` 映射 |
| `db/migrations.rs` | 由 `PRAGMA user_version` 守卫的版本化 DDL |
| `db/repository.rs` | 所有模型共用的通用 CRUD 助手 |

启动时 `Db` 被托管进 Tauri 状态，命令通过 `State<Db>` 取用：

```rust
let directory = app.path().app_data_dir()?;
let db = Db::open(directory.join(DATABASE_FILE_NAME))?;
migrations::migrate(&db)?;
app.manage(db);
```

## 连接

| 项 | 取值 |
| --- | --- |
| 文件 | `<应用数据目录>/sentryneko.db`（即 `%APPDATA%\com.sentryneko.desktop\sentryneko.db`），除非 `config.json` 另指路径 |
| 连接池 | 4 条连接，取用超时 5 秒 |
| 每条连接 | `foreign_keys = ON`、`journal_mode = WAL`、`synchronous = NORMAL`、`busy_timeout = 5000 ms` |
| 时间戳 | UTC 纪元秒 |
| 失败 | `ApiCode::DATABASE`，SQLite 的报错原文放在 `details` |

## 配置

`config.rs` 在数据库旁边维护一个小 JSON 文件，首次运行自动创建：

```json
{
  "databasePath": "C:\\Users\\you\\AppData\\Roaming\\com.sentryneko.desktop\\sentryneko.db",
  "language": "en-US"
}
```

| 字段 | 含义 | 默认值 |
| --- | --- | --- |
| `databasePath` | 应用打开的 SQLite 文件 | `<应用数据目录>/sentryneko.db` |
| `language` | 语言标签，见 `docs/i18n.md` | `en-US` |

规则：

- `databasePath` 为相对路径时，相对 `config.json` 所在目录解析；字段缺失则用默认值。
- `language` 为未知标签时回落到 `Language::DEFAULT`，文件保持原样。
- 文件无法解析时报 `IO`，解析器原文放进 `details`，且绝不覆盖原文件——手工修好或删除即可恢复。
- 写入先落到 `config.json.tmp` 再改名就位，进程崩溃不会截断配置文件。
- `settings`（下面那张表）存用户偏好；`config.json` 存「打开数据库之前就必须知道」的东西。

## 表结构

版本 1 共五张表：

| 表 | 存放 | 关键列 |
| --- | --- | --- |
| `todos` | 用户维护的任务 | `title`、`completed`、`created_at`、`updated_at` |
| `pomodoro_sessions` | 一次专注或休息区间 | `phase`、`planned_seconds`、`actual_seconds`、`started_at`、`ended_at`、`todo_id` |
| `app_events` | 前台应用活动 | `app_name`、`window_title`、`started_at`、`ended_at` |
| `alarms` | 周期提醒 | `label`、`hour`、`minute`、`repeat_days`、`enabled`、`created_at` |
| `settings` | 键值型设置 | `key`、`value`、`updated_at` |

## 迁移

`MIGRATIONS` 只允许追加：已发布的版本永不修改，变更以新的 `Migration` 与下一个 `version`
到来。每条迁移都在事务里执行，并同时写入 `PRAGMA user_version`，因此崩溃只会停在最后一个
完整版本，重复调用 `migrate` 也是空操作。

## 仓储助手

| 助手 | 返回 |
| --- | --- |
| `insert` | 新行 id |
| `execute` | 受影响行数 |
| `query_one` | 映射后的单行，无匹配则 `NOT_FOUND` |
| `query_optional` | 映射后的单行，无匹配则 `None` |
| `query_all` | 映射后的全部行 |
| `count` | 首行首列，类型 `i64` |
| `exists` | 查询是否至少匹配一行 |
| `transaction` | `work` 的返回值，`work` 失败时回滚 |

行映射器就是 `fn(&Row<'_>) -> ApiResult<T>`（`RowMapper<T>`），因此模型只需把映射函数作为
关联函数暴露出来，各助手保持通用。

## scripts/init_db.ps1

不启动应用也能创建同一套表结构：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/init_db.ps1 [-DatabasePath <file>]
```

脚本需要 `PATH` 上有 `sqlite3`；没有时脚本会直接停止，并提示改用应用本身——应用首次启动也会
迁移。所有语句都带 `IF NOT EXISTS`，重复执行安全。

有一个测试会从脚本里抽出 SQL，在已迁移的库上执行，断言两侧建出的表相同、记录的
`user_version` 相同。

## 新增表或列

1. 在 `db/migrations.rs` 追加下一个 `version` 的 `Migration`；版本 1 保持发布时的样子。
2. 在 `scripts/init_db.ps1` 里同步同样的 DDL（一样的 `IF NOT EXISTS`），并更新其中的
   `PRAGMA user_version`。
3. 跑 `cargo test`——两侧不一致时脚本检查会失败。
