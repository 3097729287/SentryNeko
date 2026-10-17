# System tray

The window is the face of the app, not the app itself: foreground tracking, the Pomodoro timer and
the alarms keep running while it is hidden. That makes the tray the only place to reach a resident
app from.

## Closing is not quitting

`services/tray.rs::hide_on_close` intercepts `CloseRequested` on the main window, cancels the close
and hides the window. The process stays alive, so `RunningCollector`, `RunningScheduler` and the
frontend timer keep their course. The tray's `Quit SentryNeko` entry is the only way out: it calls
`app.exit(0)`, and `RunEvent::Exit` then stops the background threads and closes the collector's open
row.

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

## Limitations

- The tray is Windows-only in practice: the icon comes from the bundle icons, and the app is a
  Windows build. A missing icon fails the setup step with a message instead of starting silently
  without a tray.
- The `Today: …` line catches up once a minute rather than on every change: a native menu cannot be
  updated while the user is reading it, and a minute is short enough for a summary.
- `T26` (auto-start with Windows) and `T28` (global shortcuts) build on this tray; neither is
  implemented yet.
