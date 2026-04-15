' KI-OS Community Edition — EXE Builder
' Erstellt eine EXE mit Icon aus der BAT-Datei

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Pfad ermitteln
strScriptPath = WScript.ScriptFullName
strScriptDir = objFSO.GetParentFolderName(strScriptPath)

' KI-OS Logo als ICO speichern (vereinfacht)
' Hinweis: Für ein echtes Icon benötigst du eine .ico Datei
' Diese kannst du hier erstellen lassen: https://www.convertico.com/

' Verknüpfung erstellen
Set oShellLink = WshShell.CreateShortcut(strScriptDir & "\KI-OS Community.lnk")
oShellLink.TargetPath = strScriptDir & "\KI-OS-Community.bat"
oShellLink.WorkingDirectory = strScriptDir
oShellLink.Description = "KI-OS Community Edition v1.1.1-security"
oShellLink.IconLocation = "%SystemRoot%\System32\shell32.dll,13" ' Standard-Console Icon
oShellLink.WindowStyle = 1 ' Normal window
oShellLink.Save

WScript.Echo "Verknüpfung erstellt: " & strScriptDir & "\KI-OS Community.lnk"
WScript.Echo ""
WScript.Echo "Hinweis: Für ein benutzerdefiniertes Icon:"
WScript.Echo "1. Logo als .ico speichern (z.B. von https://convertico.com)"
WScript.Echo "2. In den Eigenschaften der Verknüpfung das Icon ändern"
