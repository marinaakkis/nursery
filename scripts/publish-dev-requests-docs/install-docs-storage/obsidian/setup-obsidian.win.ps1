#requires -Version 5.1
<#
.SYNOPSIS
  Полная локальная настройка хранилища dev-артефактов на Obsidian (Windows, через Chocolatey).

.DESCRIPTION
  Один запуск на машине разработчика:
    1. Устанавливает Chocolatey (если отсутствует).
    2. Устанавливает Obsidian (+ опционально Node.js LTS).
    3. Создаёт хранилище проекта и базовый каркас .obsidian.
    4. (Best-effort) скачивает плагин Local REST API из GitHub Releases в .obsidian/plugins.
    5. Инициализирует .project-metadata.local.json (docsStorage.apiKey, projectKey, backend).
  Остаётся один ручной шаг: открыть хранилище в Obsidian, доверить плагин,
  скопировать API key из Local REST API в docsStorage.apiKey в .project-metadata.local.json.

.PARAMETER ProjectKey
  Обязательно. Ключ проекта — становится папкой верхнего уровня в Obsidian vault
  и значением docsStorage.projectKey в .project-metadata.local.json.
  Пример: my-service, archi-study-2026.

.PARAMETER VaultPath
  Путь к создаваемому хранилищу. По умолчанию: $HOME\dev-vaults\<ProjectKey>.

.PARAMETER InstallNode
  Дополнительно установить Node.js LTS (рантайм публикатора).

.PARAMETER SkipPlugins
  Не скачивать плагины (только установка приложения и каркас хранилища).

.PARAMETER WhatIf
  Показать действия без выполнения.

.EXAMPLE
  .\setup-obsidian.win.ps1 -ProjectKey my-service -InstallNode
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectKey,
    [string]$VaultPath,
    [switch]$InstallNode,
    [switch]$SkipPlugins
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }

# --- 0. ProjectKey и путь хранилища ---
# Приоритет: 1) явный параметр -VaultPath  2) docsStorage.vaultPath из metadata  3) дефолт
if (-not $VaultPath) {
    $repoRootEarly = git rev-parse --show-toplevel 2>$null
    if ($repoRootEarly) {
        $metaEarly = Join-Path $repoRootEarly '.project-metadata.local.json'
        if (Test-Path $metaEarly) {
            $storedVault = ((Get-Content $metaEarly -Raw | ConvertFrom-Json).docsStorage).vaultPath
            if ($storedVault) { $VaultPath = $storedVault }
        }
    }
}
if (-not $VaultPath) { $VaultPath = Join-Path $HOME "dev-vaults\$ProjectKey" }
Write-Step "ProjectKey: $ProjectKey; хранилище: $VaultPath"

# --- 0a. Проверка прав администратора ---
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn 'Скрипт запущен без прав администратора. Установка через Chocolatey будет пропущена.'
    Write-Warn 'Для тихой автоматической установки запустите PowerShell от имени администратора и повторите.'
}

# --- 1. Chocolatey ---
if (-not $isAdmin) {
    Write-Warn 'Chocolatey: пропуск (нет прав администратора).'
} elseif (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Step 'Устанавливаю Chocolatey'
    if ($PSCmdlet.ShouldProcess('Chocolatey', 'install')) {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
} else {
    Write-Step 'Chocolatey уже установлен'
}

# --- 2. Obsidian (+ Node) ---
$obsidianOk = $false
Write-Step 'Устанавливаю Obsidian'
if (-not $isAdmin) {
    Write-Warn 'Obsidian: пропуск (нет прав администратора).'
    Write-Warn 'Установите вручную: https://obsidian.md — или повторите скрипт от имени администратора.'
} elseif ($PSCmdlet.ShouldProcess('Obsidian', 'choco install')) {
    choco install obsidian -y
    if ($LASTEXITCODE -eq 0) {
        $obsidianOk = $true
    } else {
        Write-Warn "Obsidian не установлен (choco завершился с кодом $LASTEXITCODE)."
    }
} else {
    $obsidianOk = $true  # WhatIf — считаем успехом для отображения шагов
}
if ($InstallNode) {
    Write-Step 'Устанавливаю Node.js LTS'
    if (-not $isAdmin) {
        Write-Warn 'Node.js: пропуск (нет прав администратора).'
    } elseif ($PSCmdlet.ShouldProcess('nodejs-lts', 'choco install')) {
        choco install nodejs-lts -y
    }
}

# --- 3. Каркас хранилища ---
Write-Step 'Создаю каркас хранилища'
$obsidianDir = Join-Path $VaultPath '.obsidian'
$pluginsDir = Join-Path $obsidianDir 'plugins'
if ($PSCmdlet.ShouldProcess($VaultPath, 'create storage skeleton')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $VaultPath $ProjectKey) | Out-Null
    New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
}

# --- 4. Плагины (best-effort) ---
$pluginIds = @('obsidian-local-rest-api')
function Install-ObsidianPlugin {
    param([string]$Repo, [string]$PluginId)
    Write-Step "Плагин $PluginId ($Repo)"
    $dest = Join-Path $pluginsDir $PluginId
    if (-not $PSCmdlet.ShouldProcess($PluginId, 'download release assets')) { return }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    try {
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'setup-obsidian' }
        foreach ($name in @('manifest.json', 'main.js', 'styles.css')) {
            $asset = $rel.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
            if ($asset) { Invoke-WebRequest -Uri $asset.browser_download_url -OutFile (Join-Path $dest $name) -UseBasicParsing }
        }
    } catch {
        Write-Warn "Не удалось скачать $PluginId автоматически: $($_.Exception.Message). Установите вручную из Obsidian (Community plugins)."
    }
}

if (-not $SkipPlugins) {
    Install-ObsidianPlugin -Repo 'coddingtonbear/obsidian-local-rest-api' -PluginId 'obsidian-local-rest-api'
    if ($PSCmdlet.ShouldProcess('community-plugins.json', 'write')) {
        ($pluginIds | ConvertTo-Json) | Set-Content -Path (Join-Path $obsidianDir 'community-plugins.json') -Encoding UTF8
    }
} else {
    Write-Warn 'Плагины пропущены (-SkipPlugins). Установите Local REST API вручную через Obsidian (Community plugins).'
}

# --- 5. .project-metadata.local.json ---
$repoRoot  = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))) }
$localMeta = Join-Path $repoRoot '.project-metadata.local.json'

if ($PSCmdlet.ShouldProcess($localMeta, 'init .project-metadata.local.json')) {
    $meta = if (Test-Path $localMeta) { Get-Content $localMeta -Raw | ConvertFrom-Json } else { [PSCustomObject]@{} }

    if (-not $meta.PSObject.Properties['currentDevRequestNumber']) {
        $meta | Add-Member -NotePropertyName 'currentDevRequestNumber' -NotePropertyValue $null
    }
    if (-not $meta.PSObject.Properties['isGitHooksInited']) {
        $meta | Add-Member -NotePropertyName 'isGitHooksInited' -NotePropertyValue $false
    }
    if (-not $meta.PSObject.Properties['docsStorage'] -or $null -eq $meta.docsStorage) {
        # Первый запуск — создаём docsStorage целиком
        $meta | Add-Member -Force -NotePropertyName 'docsStorage' -NotePropertyValue ([PSCustomObject]@{
            backend    = 'obsidian'
            baseUrl    = 'https://127.0.0.1:27124'
            projectKey = $ProjectKey
            apiKey     = $null
            vaultPath  = $VaultPath
        })
        Write-Step "docsStorage.obsidian добавлен в .project-metadata.local.json"
    } else {
        # Повторный запуск — обновляем только vaultPath (остальные поля не трогаем)
        $meta.docsStorage | Add-Member -Force -NotePropertyName 'vaultPath' -NotePropertyValue $VaultPath
        Write-Warn "docsStorage уже задан; обновлён vaultPath: $VaultPath"
    }
    $meta | ConvertTo-Json -Depth 5 | Set-Content -Path $localMeta -Encoding UTF8
}

# --- Итог + ручные шаги ---
Write-Host ''
if (-not $obsidianOk) {
    Write-Warn '=========================================='
    Write-Warn 'УСТАНОВКА НЕ ЗАВЕРШЕНА: Obsidian не установлен.'
    Write-Warn '=========================================='
    Write-Host ''
    Write-Host 'Что выполнено:'
    Write-Host "  + Каркас хранилища создан: $VaultPath"
    Write-Host '  + Файлы плагинов загружены (или попытка была сделана)'
    Write-Host '  + .project-metadata.local.json инициализирован (docsStorage.apiKey = null)'
    Write-Host ''
    Write-Host 'Что требует исправления:'
    Write-Host '  ! Установите Obsidian одним из способов:'
    Write-Host '    a) Запустите PowerShell от имени администратора и повторите скрипт'
    Write-Host '    b) Скачайте и установите вручную: https://obsidian.md'
    Write-Host ''
    Write-Host 'После установки Obsidian выполните шаги ниже:'
} else {
    Write-Step 'Готово. Осталось вручную:'
}
Write-Host "  1. Открыть vault проекта в Obsidian: $VaultPath"
Write-Host '  2. Settings → Community plugins → включить Local REST API (доверить плагин если потребуется).'
Write-Host '  3. Settings → Local REST API → скопировать API Key.'
Write-Host "  4. Вставить ключ в docsStorage.apiKey в .project-metadata.local.json."
Write-Host "  5. Проверить что docsStorage.projectKey совпадает с именем vault в Obsidian."
Write-Host '  6. Проверка: node scripts/publish-dev-requests-docs/publish-dev-requests-docs.mjs --request r-nnn --backend obsidian'
