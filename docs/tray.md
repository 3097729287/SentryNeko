# System tray

The window is the face of the app, not the app itself: foreground tracking, the Pomodoro timer and
the alarms keep running while it is hidden. The tray and launching the app again both bring the
existing window back.

## Closing is not quitting

`services/tray.rs::hide_on_close` intercepts `CloseRequested` on the main window, cancels the close
and hides the window. The process stays alive, so `RunningCollector`, `RunningScheduler` and the
frontend timer keep their course. The tray's `Quit SentryNeko` entry is the only way out: it calls
`app.exit(0)`, and `RunEvent::Exit` then stops the background threads and closes the collector's open
row.

## Launching again

`lib.rs` registers the official `tauri-plugin-single-instance` before the notification plugin and
application setup. A subsequent launch forwards to the resident instance and exits before creating
another window, tray icon, database pool, collector or scheduler. The OS briefly starts a process
for that launch; only the original process remains running.

The dependency is pinned to the upstream [Windows startup race fix](https://github.com/tauri-apps/plugins-workspace/pull/3704).
Released version 2.5.4 can let a second process finish setup if it sees the first process's mutex
before its IPC window exists. The pinned fix waits for that window and always exits the secondary
process, including when forwarding times out.

The callback calls `services/tray.rs::show_window`, also used by the tray menu. It unminimizes,
shows and focuses the existing main window, including when a login start left it hidden in the
tray. It always shows the window rather than toggling visibility, so launching again while the
window is visible keeps it visible. The existing tray icon and menu remain installed. The plugin
releases its instance lock when the app exits, so quitting from the tray allows a fresh launch.

The plugin provides Windows, macOS and Linux backends; SentryNeko itself continues to support
Windows only, as described in the README.

### Windows smoke test

1. Launch the built executable, then launch it again with its window visible and another app
   focused. The original window should receive focus, with one resident app process and tray icon.
2. Minimize the window and launch again. The same window should be restored and focused.
3. Close the window to the tray and launch again. The same window should reappear. Repeat several
   times, including quick successive launches; no extra resident process or tray icon should remain.
4. Use the tray's show/hide and Start Pomodoro actions after those attempts; both should still work.
5. Quit from the tray, start with `--autostart` and confirm it stays hidden, then launch normally to
   restore it. Quit and launch once more to confirm the instance lock has been released.

## The menu

| Entry | What it does |
| --- | --- |
| Start Pomodoro | Shows the window, then pushes `tray-start-pomodoro`; the shell reloads the durations and starts the timer from the store, so the phase runs exactly like one started on the page |
| `Today: …` | A disabled line, refreshed every minute by the `tray-stats` thread: focus seconds and completed tasks of the local day, read through the heatmap aggregation so both numbers follow the same calendar rules |
| Show or hide window | Toggles visibility; a left click on the icon does the same |
| Quit SentryNeko | Ends the process |

The menu is built once at startup in the language stored in `config.json`. `set_language` relabels it
in place, so switching the language in the settings page also switches the native copy.

## Copy

Menu labels and the `Today: …` line are built in `services/tray.rs`, next to the notification copy:
the backend owns native strings because Windows paints them, not the webview. Both languages are
covered by unit tests, including the two shapes of the today line — minutes when the day is short,
hours once it is not.

## Starting with Windows

There is no separate process to install: the app is the resident process, so "start with Windows"
is one value under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, written by
`services/autostart.rs`:

- The settings page has a switch that calls `set_autostart`; it stores the quoted path of the
  running executable followed by `--autostart`. Writing the same command twice leaves one entry, and
  switching the entry off deletes it (deleting what is not there is not an error).
- An entry that points somewhere else — an older install, a moved folder — reads as off, so turning
  the switch back on repairs it instead of keeping a stale command.
- `--autostart` is why a login start does not throw a window at the user: the setup step hides the
  window when the flag is present, and the app waits in the tray instead.
- Registry access is behind the `RunKey` trait, so the decision logic is tested against a fake; the
  Win32 calls live in `utils/windows.rs` with the rest of the platform code.

## Limitations

- The tray is Windows-only in practice: the icon comes from the bundle icons, and the app is a
  Windows build. A missing icon fails the setup step with a message instead of starting silently
  without a tray.
- The `Today: …` line catches up once a minute rather than on every change: a native menu cannot be
  updated while the user is reading it, and a minute is short enough for a summary.
- The login entry points at the executable that made the change, which during `pnpm tauri dev` is
  the debug build under `target/debug`; switching the entry on from a dev run registers that build.
- `T28` (global shortcuts) builds on this tray and is not implemented yet.
