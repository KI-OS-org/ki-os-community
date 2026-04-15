/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { baseDir } = require('../desktop.companion');

function supported() {
  return process.platform === 'win32';
}

function helperPath() {
  return path.join(baseDir(), 'windows-desktop-helper.ps1');
}

function buildScript() {
  return String.raw`
param([string]$PayloadJson)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DesktopNative {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
}
"@
function Get-IdleMs {
  $li = New-Object DesktopNative+LASTINPUTINFO
  $li.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($li)
  [void][DesktopNative]::GetLastInputInfo([ref]$li)
  return [Environment]::TickCount - $li.dwTime
}
function Get-WindowInfo {
  $h = [DesktopNative]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][DesktopNative]::GetWindowText($h, $sb, $sb.Capacity)
  $pid = 0
  [void][DesktopNative]::GetWindowThreadProcessId($h, [ref]$pid)
  $name = $null
  try { $name = (Get-Process -Id $pid -ErrorAction Stop).ProcessName } catch {}
  return @{ frontmostApp = $name; activeWindowTitle = $sb.ToString() }
}
function Save-Screenshot([string]$target) {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
function Do-Click([string]$button) {
  if ($button -eq 'right') { [DesktopNative]::mouse_event(0x0008,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [DesktopNative]::mouse_event(0x0010,0,0,0,[UIntPtr]::Zero); return }
  if ($button -eq 'middle') { [DesktopNative]::mouse_event(0x0020,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [DesktopNative]::mouse_event(0x0040,0,0,0,[UIntPtr]::Zero); return }
  [DesktopNative]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [DesktopNative]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
}
function To-SendKeys([string[]]$keys) {
  $mods = @(); $main = @()
  foreach ($k in $keys) {
    switch ($k.ToLower()) {
      'ctrl' { $mods += '^' }
      'control' { $mods += '^' }
      'alt' { $mods += '%' }
      'shift' { $mods += '+' }
      'win' { }
      'cmd' { }
      default { $main += $k }
    }
  }
  return ($mods -join '') + (($main -join ''))
}
$payload = ConvertFrom-Json $PayloadJson
$result = @{ success = $true; platform = 'win32'; adapter = 'windows-powershell'; idleMs = (Get-IdleMs) }
$winInfo = Get-WindowInfo
$result.frontmostApp = $winInfo.frontmostApp
$result.activeWindowTitle = $winInfo.activeWindowTitle
if ($payload.mode -eq 'status') {
  $cursor = [System.Windows.Forms.Cursor]::Position
  $result.cursor = @{ x = $cursor.X; y = $cursor.Y }
  $result.userActive = ($result.idleMs -lt [int]($payload.userActiveThresholdMs | ForEach-Object { if ($_){$_} else {250} }))
  $result | ConvertTo-Json -Depth 8; exit 0
}
if ($payload.mode -eq 'screenshot') {
  Save-Screenshot $payload.target
  $result.path = $payload.target
  $result | ConvertTo-Json -Depth 8; exit 0
}
if ($payload.mode -eq 'action') {
  $action = [string]$payload.action
  $button = [string]($payload.button | ForEach-Object { if ($_){$_} else {'left'} })
  if ($action -in @('move','click','doubleClick','rightClick')) {
    [void][DesktopNative]::SetCursorPos([int]$payload.x, [int]$payload.y)
    Start-Sleep -Milliseconds 20
    if ($action -eq 'click') { Do-Click $button }
    elseif ($action -eq 'doubleClick') { Do-Click 'left'; Start-Sleep -Milliseconds 80; Do-Click 'left' }
    elseif ($action -eq 'rightClick') { Do-Click 'right' }
  } elseif ($action -eq 'drag') {
    [void][DesktopNative]::SetCursorPos([int]$payload.x, [int]$payload.y); Start-Sleep -Milliseconds 20
    [DesktopNative]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
    $steps = [Math]::Max([int]($payload.steps | ForEach-Object { if ($_){$_} else {12} }), 3)
    for ($i=1; $i -le $steps; $i++) {
      $nx = [int]($payload.x + (($payload.toX - $payload.x) * $i / $steps))
      $ny = [int]($payload.y + (($payload.toY - $payload.y) * $i / $steps))
      [void][DesktopNative]::SetCursorPos($nx, $ny)
      Start-Sleep -Milliseconds 15
    }
    [DesktopNative]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
  } elseif ($action -eq 'scroll') {
    [DesktopNative]::mouse_event(0x0800,0,0,[uint32]([int]($payload.delta | ForEach-Object { if ($_){$_} else {120} })),[UIntPtr]::Zero)
  } elseif ($action -eq 'type') {
    $ws = New-Object -ComObject WScript.Shell
    foreach ($ch in [string]$payload.text.ToCharArray()) { $ws.SendKeys([string]$ch); Start-Sleep -Milliseconds 20 }
  } elseif ($action -eq 'key') {
    $ws = New-Object -ComObject WScript.Shell
    $ws.SendKeys([string]$payload.key)
  } elseif ($action -eq 'hotkey') {
    $ws = New-Object -ComObject WScript.Shell
    $send = To-SendKeys @($payload.keys)
    $ws.SendKeys($send)
  } elseif ($action -eq 'wait') {
    Start-Sleep -Milliseconds ([int]($payload.durationMs | ForEach-Object { if ($_){$_} else {100} }))
  } else {
    throw "unsupported_action:$action"
  }
  $result.action = $action
  $result | ConvertTo-Json -Depth 8; exit 0
}
throw "unsupported_mode:$($payload.mode)"
`;
}

async function ensureHelper() {
  await fs.mkdir(baseDir(), { recursive: true });
  const target = helperPath();
  await fs.writeFile(target, buildScript(), 'utf8');
  return target;
}

async function execPayload(payload, timeoutMs = Number(process.env.DESKTOP_TIMEOUT_MS || 15000)) {
  const helper = await ensureHelper();
  const json = JSON.stringify(payload);
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-PayloadJson', json], {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(String(stdout || '{}').trim() || '{}');
}

async function status(options = {}) {
  return execPayload({ mode: 'status', userActiveThresholdMs: options.userActiveThresholdMs });
}
async function screenshot(target) {
  return execPayload({ mode: 'screenshot', target });
}
async function action(params) {
  return execPayload({ mode: 'action', ...params }, Number(params?.timeoutMs || process.env.DESKTOP_TIMEOUT_MS || 15000));
}

module.exports = { supported, status, screenshot, action, helperPath };
