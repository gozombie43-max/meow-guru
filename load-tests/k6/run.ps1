<#
.SYNOPSIS
  Single Windows PowerShell launcher for Meow k6 load testing & preflight verification.

.EXAMPLE
  .\load-tests\k6\run.ps1 -Environment local -Profile check
  .\load-tests\k6\run.ps1 -Environment local -Profile smoke
  .\load-tests\k6\run.ps1 -Environment staging -Profile smoke -AllowStaging -BaseUrl https://quizguru-stage-1177891703.azurewebsites.net
  .\load-tests\k6\run.ps1 -Environment staging -Profile target -AllowStaging -EnvFile .env.k6.staging
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Environment = 'local',

  [Parameter(Mandatory = $false)]
  [ValidateSet(
    'check', 'preflight', 'auth', 'health',
    'smoke', 'baseline', 'moderate', 'target', 'stress', 'soak', 'ramp',
    'stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'
  )]
  [string]$Profile = 'smoke',

  [Parameter(Mandatory = $false)]
  [string]$Scenario = '',

  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = '',

  [Parameter(Mandatory = $false)]
  [string]$EnvFile = '',

  [Parameter(Mandatory = $false)]
  [ValidateSet('enabled', 'disabled')]
  [string]$RedisMode = 'enabled',

  [switch]$AllowStaging,
  [switch]$StrictSlo,
  [switch]$SkipPreflight,
  [switch]$RequireRedis,
  [switch]$RequireIndexes,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path

function Write-SafeError([string]$Message) {
  Write-Host "[k6][ERROR] $Message" -ForegroundColor Red
}

# 1. Load optional environment file without printing secret values.
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
  $resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
  } else {
    Join-Path $repoRoot $EnvFile
  }
  if (-not (Test-Path -LiteralPath $resolvedEnvFile)) {
    Write-SafeError "EnvFile not found: $resolvedEnvFile"
    exit 1
  }
  Get-Content -LiteralPath $resolvedEnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    if ($line.StartsWith('export ')) { $line = $line.Substring(7).Trim() }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      if ($v.Length -ge 2) { $v = $v.Substring(1, $v.Length - 2) }
    }
    if ($k) {
      [System.Environment]::SetEnvironmentVariable($k, $v, 'Process')
    }
  }
  Write-Host "[k6] Loaded environment variables from $EnvFile (values hidden)."
}

# 2. Enforce strict non-production safety guardrails immediately.
$normalizedEnv = $Environment.Trim().ToLowerInvariant()
if ($normalizedEnv -match 'prod') {
  Write-SafeError "Refusing production environment ('$Environment'). Production load testing is permanently blocked."
  exit 1
}
if ($normalizedEnv -notin @('local', 'staging')) {
  Write-SafeError "Unsupported -Environment '$Environment'. Allowed values: local, staging."
  exit 1
}

$effectiveBaseUrl = if (-not [string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl.Trim()
} elseif ($env:K6_BASE_URL) {
  $env:K6_BASE_URL.Trim()
} elseif ($env:BASE_URL) {
  $env:BASE_URL.Trim()
} else {
  ''
}

if ($effectiveBaseUrl -match '(?i)(?:^|[._:/-])prod(?:uction)?(?:$|[._:/-])') {
  Write-SafeError 'Refusing production-looking BASE_URL.'
  exit 1
}

if ($normalizedEnv -eq 'staging') {
  $stagingApproved = $AllowStaging.IsPresent -or ($env:K6_ALLOW_STAGING -eq 'true') -or ($env:ALLOW_STAGING -eq 'true')
  if (-not $stagingApproved) {
    Write-SafeError 'Staging load tests require explicit approval. Pass -AllowStaging or set $env:K6_ALLOW_STAGING = "true".'
    exit 1
  }
  if ([string]::IsNullOrWhiteSpace($effectiveBaseUrl)) {
    Write-SafeError 'Staging environment requires -BaseUrl or $env:K6_BASE_URL / $env:BASE_URL.'
    exit 1
  }
}

# 3. Verify Node.js and k6 installations before invoking runner.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-SafeError 'Node.js (>=22) was not found on PATH.'
  exit 1
}

$requiresK6Now = ($Profile -notin @('check', 'preflight')) -and (-not $DryRun.IsPresent)
if ($requiresK6Now -and -not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  Write-SafeError 'k6 is not installed or not on PATH. Install on Windows: winget install k6 --source winget'
  exit 1
}

# 4. Build runner arguments and delegate from repo root.
$runnerArgs = @(
  (Join-Path $repoRoot 'load-tests\k6\scripts\run-k6.mjs'),
  '--env', $normalizedEnv,
  '--profile', $Profile.Trim().ToLowerInvariant(),
  '--redis-mode', $RedisMode
)

if (-not [string]::IsNullOrWhiteSpace($Scenario)) {
  $runnerArgs += @('--scenario', $Scenario.Trim().ToLowerInvariant())
}
if (-not [string]::IsNullOrWhiteSpace($effectiveBaseUrl)) {
  $runnerArgs += @('--base-url', $effectiveBaseUrl)
}
if ($AllowStaging.IsPresent) {
  $runnerArgs += '--allow-staging'
}
if ($StrictSlo.IsPresent) {
  $runnerArgs += '--strict-slo'
}
if ($SkipPreflight.IsPresent) {
  $runnerArgs += '--skip-preflight'
}
if ($RequireRedis.IsPresent) {
  $runnerArgs += '--require-redis'
}
if ($RequireIndexes.IsPresent) {
  $runnerArgs += '--require-indexes'
}
if ($DryRun.IsPresent) {
  $runnerArgs += '--dry-run'
}

Push-Location $repoRoot
try {
  & node @runnerArgs
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

exit $exitCode
