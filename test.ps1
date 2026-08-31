<#
.SYNOPSIS
    Smoke-tests the deployed Eureka LMS API over HTTPS.

.DESCRIPTION
    Run after deploy.ps1. Deploying and verifying are separate concerns: a
    release should not be reported as failed because a network round trip to the
    public host did not come back, and a green deploy is not evidence that the
    app answers.

        powershell -ExecutionPolicy Bypass -File C:\Users\Administrator\eureka__nodejs\test.ps1

    Checks, in order:

        health          liveness, no database touched
        readiness       liveness AND 'database: connected'
        api-docs        Swagger UI is being served
        login           POST reaches Express validation (400, not 404/500)
        secrets         .env and package.json are NOT served as static files
        websocket       Socket.IO upgrade survives IIS -> iisnode -> the app

    The websocket check is the one worth having. Everything else here would also
    pass with the WebSocket feature missing or <webSocket enabled="false"/>
    dropped from web.config, because Socket.IO silently falls back to HTTP long
    polling. This forces transports:['websocket'] with no fallback, so a broken
    upgrade path fails instead of quietly degrading. Reaching the app's JWT
    middleware - which rejects the deliberately invalid token - proves the whole
    chain carried a real WebSocket frame.

.PARAMETER BaseUrl
    Origin to test. Defaults to the live site.

.PARAMETER SitePath
    Deployed app root. Only used to locate socket.io-client for the websocket
    check; pass -SkipSocket if the site is on another machine.

.PARAMETER SkipSocket
    Skip the websocket check.

.EXAMPLE
    .\test.ps1
.EXAMPLE
    # Bypass DNS and the public network, hitting IIS directly on this box.
    .\test.ps1 -BaseUrl http://localhost -HostHeader eureka.growfet.com
#>
[CmdletBinding()]
param(
    [string]$BaseUrl    = 'https://eureka.growfet.com',
    [string]$HostHeader = '',
    [string]$SitePath   = 'C:\inetpub\wwwroot\eureka',
    [switch]$SkipSocket
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

$script:Failures = 0

function Write-Pass { param([string]$Message) Write-Host "  PASS  $Message" -ForegroundColor Green }
function Write-Fail {
    param([string]$Message)
    $script:Failures++
    Write-Host "  FAIL  $Message" -ForegroundColor Red
}

# Invoke-WebRequest throws on any 4xx/5xx, but several checks here EXPECT one.
# Normalise both paths into a status code plus a body so callers can just
# compare, and let a genuine transport failure surface as status 0.
function Invoke-Probe {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Method = 'GET',
        [string]$Body,
        [string]$ContentType = 'application/json'
    )
    $params = @{
        Uri             = "$BaseUrl$Path"
        Method          = $Method
        UseBasicParsing = $true
        TimeoutSec      = 60
        ErrorAction     = 'Stop'
    }
    if ($HostHeader) { $params.Headers = @{ Host = $HostHeader } }
    if ($PSBoundParameters.ContainsKey('Body')) {
        $params.Body        = $Body
        $params.ContentType = $ContentType
    }
    try {
        $response = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $response.Content; Error = '' }
    }
    catch {
        $webResponse = $_.Exception.Response
        if ($webResponse) {
            $status = [int]$webResponse.StatusCode
            $body   = ''
            try {
                $reader = New-Object IO.StreamReader($webResponse.GetResponseStream())
                $body   = $reader.ReadToEnd()
            }
            catch { }
            return [pscustomobject]@{ Status = $status; Body = $body; Error = '' }
        }
        return [pscustomobject]@{ Status = 0; Body = ''; Error = $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "Smoke-testing $BaseUrl" -ForegroundColor Cyan
if ($HostHeader) { Write-Host "  (Host: $HostHeader)" -ForegroundColor DarkGray }
Write-Host ""

# ---------------------------------------------------------------- liveness

$probe = Invoke-Probe -Path '/health'
if ($probe.Status -eq 200) { Write-Pass "GET /health -> 200" }
else { Write-Fail "GET /health -> $($probe.Status) $($probe.Error)" }

# ---------------------------------------------------------------- readiness

$probe = Invoke-Probe -Path '/health/readiness'
if ($probe.Status -eq 200 -and $probe.Body -match '"database"\s*:\s*"connected"') {
    Write-Pass "GET /health/readiness -> 200, database connected"
}
elseif ($probe.Status -eq 200) {
    Write-Fail "GET /health/readiness -> 200 but the database is not reporting connected: $($probe.Body)"
}
else { Write-Fail "GET /health/readiness -> $($probe.Status) $($probe.Error)" }

# ---------------------------------------------------------------- swagger

$probe = Invoke-Probe -Path '/api-docs/'
if ($probe.Status -eq 200 -and $probe.Body -match 'swagger') { Write-Pass "GET /api-docs/ -> 200, Swagger UI served" }
else { Write-Fail "GET /api-docs/ -> $($probe.Status) $($probe.Error)" }

# ---------------------------------------------------------------- routing

# An empty body must reach the route's validator. 400 proves Express matched
# the route; 404 would mean the rewrite or the router is wrong, and 500 that the
# app is up but broken.
$probe = Invoke-Probe -Path '/api/v1/auth/login' -Method 'POST' -Body '{}'
if ($probe.Status -eq 400) { Write-Pass "POST /api/v1/auth/login -> 400, reached Express validation" }
else { Write-Fail "POST /api/v1/auth/login -> $($probe.Status) (expected 400) $($probe.Error)" }

# ---------------------------------------------------------------- secrets

# Everything is rewritten to Node precisely so IIS never serves these as static
# files. A 200 here means the rewrite rule regressed and the site is leaking its
# JWT secrets and database password.
foreach ($secretPath in @('/.env', '/package.json', '/prisma/schema.prisma')) {
    $probe = Invoke-Probe -Path $secretPath
    if ($probe.Status -eq 200) { Write-Fail "GET $secretPath -> 200 - THIS FILE IS BEING SERVED, fix the rewrite rule" }
    else { Write-Pass "GET $secretPath -> $($probe.Status), not served" }
}

# ---------------------------------------------------------------- websocket

if ($SkipSocket) { Write-Host "  SKIP  websocket check (-SkipSocket)" -ForegroundColor DarkGray }
else {
    $clientDir = Join-Path $SitePath 'node_modules\socket.io-client'
    if (-not (Test-Path $clientDir)) {
        Write-Host "  SKIP  websocket check - socket.io-client not installed under $SitePath" -ForegroundColor DarkGray
    }
    else {
        # Written into the site so Node resolves socket.io-client from the app's
        # own node_modules, then removed. .mjs because the probe is ESM while the
        # file sits in a directory whose package.json it must not depend on.
        $probeFile = Join-Path $SitePath '_smoke-websocket.mjs'
        $wsOrigin  = $BaseUrl
        $probeSource = @'
import { io } from 'socket.io-client';

const socket = io(process.argv[2], {
  transports: ['websocket'],   // no polling fallback: a broken upgrade must fail
  auth: { token: 'deliberately-invalid' },
  timeout: 15000,
  reconnection: false,
});

const finish = (code, message) => { console.log(message); socket.close(); process.exit(code); };

socket.on('connect', () => finish(1, 'UNEXPECTED: connected with an invalid token - check the JWT handshake middleware'));
socket.on('connect_error', (err) => {
  // A transport-level failure and an auth rejection are both connect_error.
  // Only the latter proves a real WebSocket frame reached the application.
  if (/Authentication failed|token/i.test(err.message)) {
    finish(0, `websocket upgrade carried through, app rejected the token: "${err.message}"`);
  }
  finish(1, `transport failed before reaching the app: "${err.message}"`);
});

setTimeout(() => finish(1, 'timed out with no websocket response'), 20000);
'@
        Set-Content -Path $probeFile -Value $probeSource -Encoding utf8
        Push-Location $SitePath
        try {
            $output = (& node $probeFile $wsOrigin | Out-String).Trim()
            $code = $LASTEXITCODE
            if ($code -eq 0) { Write-Pass "websocket: $output" }
            else { Write-Fail "websocket: $output" }
        }
        finally {
            Pop-Location
            Remove-Item $probeFile -Force -ErrorAction SilentlyContinue
        }
    }
}

# ---------------------------------------------------------------- summary

Write-Host ""
if ($script:Failures -eq 0) {
    Write-Host "All checks passed - $BaseUrl is healthy" -ForegroundColor Green
    exit 0
}
Write-Host "$($script:Failures) check(s) failed against $BaseUrl" -ForegroundColor Red
Write-Host "iisnode stderr logs: $SitePath\iisnode-logs" -ForegroundColor DarkGray
exit 1
