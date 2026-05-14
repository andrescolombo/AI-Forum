# Run this from the root of any new project to link AI template files
# Requires PowerShell Core (pwsh) on Linux/macOS
#
# Usage:
#   Windows:       & "D:\Desarrollo\.ai-templates\setup-ai-templates.ps1"
#   Linux/macOS:   pwsh ~/Desarrollo/.ai-templates/setup-ai-templates.ps1
#
# Override templates location with env var: $env:AI_TEMPLATES_DIR

param(
    [string]$Path = (Get-Location)
)

$files = @(
    "AGENTS.md",
    "CLAUDE.md",
    "CURSORRULES",
    "GEMINI.md",
    "HANDOVER.md",
    "HANDOVER_TASK.md",
    "CONVERSATION_INSIGHTS.md"
)

# Resolve templates directory
if ($env:AI_TEMPLATES_DIR) {
    $templates = $env:AI_TEMPLATES_DIR
} elseif ($IsWindows -or $env:OS -eq "Windows_NT") {
    $templates = "D:\Desarrollo\.ai-templates"
} else {
    $templates = "$HOME/Desarrollo/.ai-templates"
}

# Elevation check for Windows (required for SymbolicLinks)
$isWin = $IsWindows -or $env:OS -eq "Windows_NT"
if ($isWin -and -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting administrator privileges to create symbolic links..."
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Path `"$Path`""
    try {
        Start-Process powershell.exe -ArgumentList $argList -Verb RunAs -Wait
        exit
    } catch {
        Write-Warning "Elevation failed or was cancelled. Script might fail to create symbolic links."
    }
}

if (-not (Test-Path $templates)) {
    Write-Error "Templates directory not found: $templates"
    Write-Host "Set `$env:AI_TEMPLATES_DIR to point to your .ai-templates clone."
    exit 1
}

$target = $Path

foreach ($file in $files) {
    $src = Join-Path $templates $file
    $dst = Join-Path $target $file

    if (-not (Test-Path $src)) {
        Write-Host "Skipped (not in templates): $file"
        continue
    }

    if (Test-Path $dst) {
        Write-Host "Skipped (already exists): $file"
        continue
    }

    try {
        New-Item -ItemType SymbolicLink -Path $dst -Target $src -Force -ErrorAction Stop | Out-Null
        Write-Host "Linked: $file"
    } catch {
        Write-Error "Failed to link $file. Error: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Done. AI templates linked in $target"

