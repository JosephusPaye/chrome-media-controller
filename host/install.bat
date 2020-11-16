:: Change HKCU to HKLM to install globally (instead of per-user).
:: %~dp0 is the directory containing this bat script and ends with a backslash.
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\io.github.josephuspaye.chromemediacontroller" /ve /t REG_SZ /d "%~dp0manifest.json" /f
