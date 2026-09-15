# Error Log & Operational Mistakes Tracking

This document logs troubleshooting steps, operational mistakes, failed commands, and bug fixes across the KMD Drainage Field Inspector application repository.

See also the master workspace log at `../MISTAKES.md`.

## Log Entries

### [2026-09-15 08:24] — PowerShell Token '&&' Not Supported in Windows PowerShell 5.1

- **Date/Time:** 2026-09-15 08:24 (WAT)
- **Context:** Executing multiple Node test scripts sequentially in PowerShell.
- **The Mistake/Error:** Attempted to chain commands with `&&` (`node scripts/test_sld_viewer.js && node scripts/test_new_views.js`), causing `The token '&&' is not a valid statement separator in this version`.
- **The Fix:** Use semicolon `;` separator in Windows PowerShell or execute tests individually.
- **Lesson Learned:** Windows PowerShell 5.1 does not support bash-style `&&` chaining; use `;` or separate commands.
