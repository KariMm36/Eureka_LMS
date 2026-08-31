<#
.SYNOPSIS
    Builds the Eureka LMS Node backend in this checkout and pushes it to IIS as
    the eureka.growfet.com site, hosted by iisnode.

.DESCRIPTION
    Same shape as the rashet-etr-api and padel-back deploys: build in the source
    folder first, so a build failure aborts before the live site is touched,
    then stop the app pool, replace the deployed files, and start the pool again
    in a finally block.

        powershell -ExecutionPolicy Bypass -File C:\Users\Administrator\eureka__nodejs\deploy.ps1

    Order of operations: preflight -> install -> generate -> stop pool ->
    mirror files -> uploads -> runtime dirs -> migrate -> ACLs -> start pool.

    The post-release smoke test lives in its own script - run .\test.ps1 to
    check that the deployed site answers. Deploying and verifying are separate
    concerns, and a release should not be reported as failed because a network
    round trip to the public host did not come back.

    LAYOUT

        https://eureka.growfet.com/  -> C:\inetpub\wwwroot\eureka  (pool 'eureka')

    IIS hosts the app through iisnode, which require()s iisnode.entry.cjs. That
    shim is CommonJS on purpose - the app is an ESM package and require() cannot
    load an ESM graph with top-level await - and it chdir()s to the app root,
    because dotenv's .env, multer's uploads/ and FIREBASE_SERVICE_ACCOUNT_PATH
    all resolve relative to the working directory. Both that shim and web.config
    are tracked in this repo and deployed from it, so the hosting configuration
    is reproducible from a checkout.

    Nothing is pulled or committed unless you pass -Pull. Whatever is in this
    working tree is what goes live, which is the point of this model - the server
    needs no checkout of its own.

    INSTALL IS CONDITIONAL

    node_modules is built here and mirrored to the site, so a broken install
    never reaches the live app. Because 'npm ci' rewrites all ~13k files, and
    robocopy then has to copy every one of them, the install only runs when
    package-lock.json actually changed - tracked by a hash stamp under
    <SitePath>\.deploy. Same for 'prisma generate' against prisma\schema.prisma.
    Routine code-only releases therefore skip both and mirror a handful of files.

    Dev dependencies are installed deliberately (no --omit=dev): the Prisma CLI
    is a devDependency and 'prisma migrate deploy' needs it on the server.

    The deployed .env, uploads\, iisnode-logs\ and firebase-service-account.json
    are never overwritten or purged: the first is server-specific configuration
    (the source .env points at a dev database), the next two hold runtime data,
    and the last is a server-only credential that is gitignored and would be
    destroyed by the mirror's purge.

.PARAMETER SourceRoot
    Checkout to deploy from. Defaults to the folder holding this script.

.PARAMETER SitePath
    Physical path of the deployed instance, and of the IIS application root.

.PARAMETER SiteName
    IIS site to deploy to. Must already exist.

.PARAMETER AppPool
    IIS application pool to cycle. Must already exist, and must be set to
    "No Managed Code" - preflight checks this.

.PARAMETER NodeExe
    node.exe to build with. Must match the nodeProcessCommandLine in web.config,
    or IIS will run the app on a different runtime than the one it was built
    against; preflight warns when they disagree.

.PARAMETER Install
    Force 'npm ci' and 'prisma generate' even when the lockfile and schema are
    unchanged. Use after deleting node_modules by hand, or when an install is
    suspected of being half-applied.

.PARAMETER SkipInstall
    Never install or generate, whatever the stamps say. Fastest possible
    release; only correct when nothing under package-lock.json or prisma\ moved.

.PARAMETER SkipMigrations
    Skip 'prisma migrate deploy'. Pass it for releases that carry no new
    migrations - the command is idempotent, so this is an optimisation, not a
    safety measure.

.PARAMETER Backup
    mysqldump the deployed database before migrating. Off by default; worth
    passing whenever the release carries new migrations. Credentials are read
    from the DEPLOYED .env, not this checkout's.

.PARAMETER Pull
    Run 'git pull --ff-only' in the source before building. Off by default, to
    keep the working tree the single source of truth.

.EXAMPLE
    # The normal case.
    .\deploy.ps1
.EXAMPLE
    # Code-only change, nothing installed or migrated - the fast path.
    .\deploy.ps1 -SkipInstall -SkipMigrations
.EXAMPLE
    # Release with new migrations, dump the database first.
    .\deploy.ps1 -Backup
.EXAMPLE
    # Pull the latest main, then release.
    .\deploy.ps1 -Pull
#>
[CmdletBinding()]
param(
    [string]$SourceRoot    = '',
    [string]$SitePath      = 'C:\inetpub\wwwroot\eureka',
    [string]$SiteName      = 'eureka',
    [string]$AppPool       = 'eureka',
    [string]$NodeExe       = 'C:\Program Files\nodejs\node.exe',
    [string]$MysqlDumpExe  = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe',
    [string]$BackupRoot    = 'C:\inetpub\backups\eureka',
    [int]$KeepBackups      = 10,
    [switch]$Install,
    [switch]$SkipInstall,
    [switch]$SkipMigrations,
    [switch]$Backup,
    [switch]$Pull
)

$ErrorActionPreference = 'Stop'
$StartedAt = Get-Date

if (-not $SourceRoot) { $SourceRoot = $PSScriptRoot }
$appcmd   = "$env:SystemRoot\System32\inetsrv\appcmd.exe"
$npmCmd   = Join-Path (Split-Path $NodeExe -Parent) 'npm.cmd'
$stampDir = Join-Path $SitePath '.deploy'

# ---------------------------------------------------------------- helpers

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "    OK  $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "    !   $Message" -ForegroundColor Yellow }

# Native tools signal failure through $LASTEXITCODE, which PowerShell will not
# turn into a terminating error on its own. Worse, PowerShell 5.1 turns a native
# command's stderr into ErrorRecords whenever the stream is redirected, and
# $ErrorActionPreference='Stop' then aborts the script on output that is merely
# a warning - a single 'npm warn deprecated ...' line is enough to do it. So
# every native call runs with the preference relaxed, and success is judged by
# the exit code alone.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = '',
        [switch]$AllowFailure
    )
    if (-not $WorkingDirectory) { $WorkingDirectory = $SourceRoot }
    $previousEap = $ErrorActionPreference
    Push-Location $WorkingDirectory
    try {
        $ErrorActionPreference = 'Continue'
        & $FilePath @Arguments | Out-Host
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousEap
        Pop-Location
    }
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $code"
    }
    return $code
}

# Same stderr caveat, for the calls whose OUTPUT is the thing being inspected.
function Get-NativeOutput {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @()
    )
    $previousEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        return (& $FilePath @Arguments | Out-String)
    }
    finally { $ErrorActionPreference = $previousEap }
}

# robocopy reports success with exit codes 0-7; 8 and above are real failures.
function Invoke-Robocopy {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string[]]$ExtraArgs = @()
    )
    $common = @('/NFL', '/NDL', '/NJH', '/NP', '/R:2', '/W:2')
    $previousEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & robocopy $Source $Destination @ExtraArgs @common | Out-Host
        $code = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previousEap }
    if ($code -ge 8) { throw "robocopy '$Source' -> '$Destination' failed with exit code $code" }
    return $code
}

# Existence checks deliberately do NOT go through appcmd's exit code: 'appcmd
# list <object>' exits 0 with empty output for a missing object, so the output
# is what has to be tested.
function Test-IisSite {
    param([string]$Name)
    $out = Get-NativeOutput -FilePath $appcmd -Arguments @('list', 'site', "/name:$Name")
    return $out -match [regex]::Escape('SITE "' + $Name + '"')
}
function Test-IisAppPool {
    param([string]$Name)
    $out = Get-NativeOutput -FilePath $appcmd -Arguments @('list', 'apppool', "/apppool.name:$Name")
    return $out -match [regex]::Escape('APPPOOL "' + $Name + '"')
}
function Get-AppPoolState {
    param([string]$Name)
    return (Get-NativeOutput -FilePath $appcmd -Arguments @('list', 'apppool', $Name, '/text:state')).Trim()
}

# Reads one key out of a .env file. Values may be quoted and may legitimately
# contain '#', so trailing comments are not stripped.
function Get-EnvValue {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Key)
    if (-not (Test-Path $Path)) { return $null }
    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)$'
    foreach ($line in Get-Content $Path) {
        if ($line -match $pattern) {
            $value = $Matches[1].Trim()
            if ($value.Length -ge 2) {
                $first = $value.Substring(0, 1)
                $last  = $value.Substring($value.Length - 1, 1)
                if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
            }
            return $value
        }
    }
    return $null
}

# Splits a Prisma mysql:// URL into parts. Credentials are percent-encoded in
# the URL - the deployed password contains '@', which must travel as %40 - so
# every component is unescaped before it reaches mysqldump.
function Get-MysqlConnection {
    param([Parameter(Mandatory)][string]$Url)
    if ($Url -notmatch '^mysql://([^:/?#]+)(?::([^@]*))?@([^:/?#]+)(?::(\d+))?/([^?#]+)') {
        throw 'DATABASE_URL in the deployed .env is not a mysql:// URL this script can parse'
    }
    $port = 3306
    if ($Matches[4]) { $port = [int]$Matches[4] }
    return [pscustomobject]@{
        User     = [System.Uri]::UnescapeDataString($Matches[1])
        Password = [System.Uri]::UnescapeDataString($Matches[2])
        Server   = $Matches[3]
        Port     = $port
        Database = [System.Uri]::UnescapeDataString($Matches[5])
    }
}

function Get-FileHashOrNull {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
}
function Read-Stamp {
    param([string]$Name)
    $file = Join-Path $stampDir $Name
    if (-not (Test-Path $file)) { return $null }
    return (Get-Content $file -Raw).Trim()
}
function Write-Stamp {
    param([string]$Name, [string]$Value)
    if (-not (Test-Path $stampDir)) { New-Item -ItemType Directory -Path $stampDir -Force | Out-Null }
    Set-Content -Path (Join-Path $stampDir $Name) -Value $Value -Encoding utf8
}

# ---------------------------------------------------------------- preflight

Write-Step 'Preflight'

if ($Install -and $SkipInstall) { throw '-Install and -SkipInstall are mutually exclusive' }

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal($currentIdentity)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Run this from an elevated prompt - appcmd and icacls both need it' }

if (-not (Test-Path $appcmd))  { throw "appcmd.exe not found at $appcmd - is IIS installed?" }
if (-not (Test-Path $NodeExe)) { throw "node.exe not found at $NodeExe" }
if (-not (Test-Path $npmCmd))  { throw "npm.cmd not found at $npmCmd" }
if (-not (Test-Path (Join-Path $SourceRoot 'package.json'))) {
    throw "no package.json under $SourceRoot - is -SourceRoot right?"
}
if (-not (Test-Path (Join-Path $SourceRoot 'iisnode.entry.cjs'))) {
    throw "iisnode.entry.cjs missing from $SourceRoot - iisnode has no entry point to require()"
}
if (-not (Test-Path (Join-Path $SourceRoot 'web.config'))) {
    throw "web.config missing from $SourceRoot - the hosting configuration is deployed from the repo"
}

if (-not (Test-IisSite $SiteName))   { throw "IIS site '$SiteName' does not exist" }
if (-not (Test-IisAppPool $AppPool)) { throw "IIS application pool '$AppPool' does not exist" }

# iisnode is a native module registered server-wide; without it every request
# to the site returns 500 and the cause is not obvious from the response.
$modules = Get-NativeOutput -FilePath $appcmd -Arguments @('list', 'modules')
if ($modules -notmatch 'iisnode') { throw 'the iisnode module is not registered in IIS' }

# A pool left on a managed runtime still serves the app, but it loads the CLR
# into every worker for nothing. Worth failing on, since it means the pool was
# recreated without being reconfigured.
$poolRuntime = (Get-NativeOutput -FilePath $appcmd `
    -Arguments @('list', 'apppool', $AppPool, '/text:managedRuntimeVersion')).Trim()
if ($poolRuntime) {
    throw "app pool '$AppPool' is on managed runtime '$poolRuntime' - set it to No Managed Code"
}

# web.config names the interpreter explicitly. If it disagrees with the node we
# build against, the app runs on a runtime it was never tested on.
$webConfigText = Get-Content (Join-Path $SourceRoot 'web.config') -Raw
if ($webConfigText -match 'nodeProcessCommandLine\s*=\s*"([^"]*)"') {
    $configured = $Matches[1].Replace('&quot;', '"').Trim('"').Trim()
    if ($configured -and $configured -ne $NodeExe) {
        Write-Warn "web.config runs '$configured' but this build uses '$NodeExe'"
    }
}

$deployedEnv = Join-Path $SitePath '.env'
if (-not (Test-Path $deployedEnv)) {
    throw "no .env at $deployedEnv - create the production .env before the first deploy; this script never copies the checkout's dev .env over it"
}

$nodeVersion = (Get-NativeOutput -FilePath $NodeExe -Arguments @('--version')).Trim()
Write-Ok "node $nodeVersion, site '$SiteName', pool '$AppPool'"
Write-Ok "$SourceRoot -> $SitePath"

# ---------------------------------------------------------------- pull

if ($Pull) {
    Write-Step 'Pulling latest'
    Invoke-Native -FilePath 'git' -Arguments @('pull', '--ff-only') | Out-Null
    Write-Ok 'working tree fast-forwarded'
}

# ---------------------------------------------------------------- build

$lockPath   = Join-Path $SourceRoot 'package-lock.json'
$schemaPath = Join-Path $SourceRoot 'prisma\schema.prisma'
$lockHash   = Get-FileHashOrNull $lockPath
$schemaHash = Get-FileHashOrNull $schemaPath
$modulesDir = Join-Path $SourceRoot 'node_modules'

$needInstall  = $Install -or (-not (Test-Path $modulesDir)) -or ($lockHash -ne (Read-Stamp 'package-lock.sha256'))
$needGenerate = $Install -or $needInstall -or ($schemaHash -ne (Read-Stamp 'schema.prisma.sha256'))

if ($SkipInstall) {
    Write-Step 'Skipping install and generate (-SkipInstall)'
    if (-not (Test-Path $modulesDir)) {
        throw 'node_modules is missing from the source and -SkipInstall forbids creating it'
    }
    $needInstall  = $false
    $needGenerate = $false
}

if ($needInstall) {
    Write-Step 'Installing dependencies'
    # Dev dependencies included on purpose: 'prisma migrate deploy' below runs
    # the Prisma CLI, which package.json lists as a devDependency.
    Invoke-Native -FilePath $npmCmd -Arguments @('ci', '--no-audit', '--no-fund') | Out-Null
    Write-Ok 'npm ci complete (lockfile changed)'
}
else { Write-Step 'Dependencies unchanged - skipping npm ci' }

if ($needGenerate) {
    Write-Step 'Generating Prisma client'
    Invoke-Native -FilePath $npmCmd -Arguments @('exec', '--', 'prisma', 'generate') | Out-Null
    Write-Ok 'prisma client generated into node_modules'
}
else { Write-Step 'Prisma schema unchanged - skipping generate' }

# ---------------------------------------------------------------- backup

if ($Backup) {
    Write-Step 'Backing up database'
    if (-not (Test-Path $MysqlDumpExe)) { throw "mysqldump not found at $MysqlDumpExe" }

    $dbUrl = Get-EnvValue -Path $deployedEnv -Key 'DATABASE_URL'
    if (-not $dbUrl) { throw "DATABASE_URL not found in $deployedEnv" }
    $conn = Get-MysqlConnection -Url $dbUrl

    if (-not (Test-Path $BackupRoot)) { New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null }
    $stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dumpFile = Join-Path $BackupRoot ($conn.Database + '-' + $stamp + '.sql')

    # The password goes in through MYSQL_PWD rather than --password= so it never
    # appears in this machine's process list.
    $previousPwd = $env:MYSQL_PWD
    $env:MYSQL_PWD = $conn.Password
    try {
        Invoke-Native -FilePath $MysqlDumpExe -Arguments @(
            "--host=$($conn.Server)",
            "--port=$($conn.Port)",
            "--user=$($conn.User)",
            '--single-transaction',
            '--routines',
            '--triggers',
            '--events',
            "--result-file=$dumpFile",
            $conn.Database
        ) | Out-Null
    }
    finally { $env:MYSQL_PWD = $previousPwd }

    Write-Ok "dumped $($conn.Database) to $dumpFile"

    Get-ChildItem $BackupRoot -Filter '*.sql' |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $KeepBackups |
        ForEach-Object { Remove-Item $_.FullName -Force; Write-Warn "pruned old backup $($_.Name)" }
}

# ---------------------------------------------------------------- release

Write-Step "Stopping application pool '$AppPool'"
# -AllowFailure: appcmd exits non-zero when the pool is already stopped, which
# is a perfectly fine state to start from.
Invoke-Native -FilePath $appcmd -Arguments @('stop', 'apppool', "/apppool.name:$AppPool") -AllowFailure | Out-Null
# Give the worker process a moment to release handles on node_modules, or
# robocopy hits sharing violations on the Prisma query engine binary.
Start-Sleep -Seconds 3
Write-Ok 'pool stopped'

try {
    Write-Step 'Mirroring application files'

    # Excluded from the mirror, and therefore also protected from /MIR's purge.
    # Both source and destination paths are listed: robocopy matches exclusions
    # against the full path of each directory it walks, and it walks both trees.
    $excludeDirs = @()
    foreach ($rel in @('.git', '.github', 'tests', 'coverage', '.vitest', 'uploads', 'iisnode-logs', '.deploy')) {
        $excludeDirs += (Join-Path $SourceRoot $rel)
        $excludeDirs += (Join-Path $SitePath   $rel)
    }
    # .env is server-specific - the checkout's points at a dev database.
    # firebase-service-account.json is a gitignored server-only credential, so
    # the purge would delete it and push notifications would silently drop to
    # mock mode.
    $excludeFiles = @()
    foreach ($rel in @('.env', '.env.example', 'vitest.config.js', 'firebase-service-account.json')) {
        $excludeFiles += (Join-Path $SourceRoot $rel)
        $excludeFiles += (Join-Path $SitePath   $rel)
    }

    $mirrorArgs = @('/MIR') + @('/XD') + $excludeDirs + @('/XF') + $excludeFiles
    Invoke-Robocopy -Source $SourceRoot -Destination $SitePath -ExtraArgs $mirrorArgs | Out-Null
    Write-Ok 'src/, prisma/, node_modules/, web.config and iisnode.entry.cjs mirrored'
    Write-Ok '.env, uploads/, iisnode-logs/ and firebase-service-account.json preserved'

    # uploads\ is excluded from the mirror because it is the live upload target,
    # but .gitkeep is tracked. Copy additively - mirroring here would delete
    # everything uploaded since the last release.
    Write-Step 'Topping up tracked upload files'
    $uploadsSrc = Join-Path $SourceRoot 'uploads'
    if (Test-Path $uploadsSrc) {
        Invoke-Robocopy -Source $uploadsSrc -Destination (Join-Path $SitePath 'uploads') -ExtraArgs @('/E') | Out-Null
        Write-Ok 'uploads topped up without purging user files'
    }

    # Both directories are excluded from the mirror, so on a target that has
    # never run they are simply absent. multer creates uploads\ itself on boot,
    # but iisnode fails to start when it cannot write its log directory.
    Write-Step 'Ensuring writable directories'
    foreach ($rel in @('uploads', 'iisnode-logs')) {
        $target = Join-Path $SitePath $rel
        if (-not (Test-Path $target)) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
            Write-Warn "created missing $rel"
        }
    }
    Write-Ok 'runtime directories present'

    # ------------------------------------------------------------ database

    if ($SkipMigrations) { Write-Step 'Skipping migrations (-SkipMigrations)' }
    else {
        Write-Step 'Running migrations'
        # Run from the SITE, not the checkout: 'migrate deploy' reads .env from
        # its working directory, and only the deployed .env names the production
        # database. 'deploy' never resets and never prompts, unlike 'migrate dev'.
        Invoke-Native -FilePath $npmCmd `
                      -Arguments @('exec', '--', 'prisma', 'migrate', 'deploy') `
                      -WorkingDirectory $SitePath | Out-Null
        Write-Ok 'migrations applied to the deployed database'
    }

    # ------------------------------------------------------------ acls

    Write-Step 'Fixing permissions'
    # The mirror writes files in as Administrator, so the pool identity's rights
    # have to be reapplied on every release, not just at first setup.
    $poolIdentity = "IIS AppPool\$AppPool"
    Invoke-Native -FilePath 'icacls' -Arguments @(
        $SitePath, '/grant', "${poolIdentity}:(OI)(CI)(RX)", '/T', '/C', '/Q') | Out-Null
    foreach ($writable in @('uploads', 'iisnode-logs')) {
        Invoke-Native -FilePath 'icacls' -Arguments @(
            (Join-Path $SitePath $writable), '/grant', "${poolIdentity}:(OI)(CI)(M)", '/T', '/C', '/Q') | Out-Null
    }
    Write-Ok 'read on app root, write on uploads and iisnode-logs'

    # ------------------------------------------------------------ stamps

    # Written last, and only on the success path: a release that died half way
    # through leaves the old stamps, so the next run redoes the install.
    if ($needInstall)  { Write-Stamp 'package-lock.sha256'  $lockHash }
    if ($needGenerate) { Write-Stamp 'schema.prisma.sha256' $schemaHash }
}
finally {
    Write-Step "Starting application pool '$AppPool'"
    # -AllowFailure so a start problem cannot mask the original exception that
    # brought us into this finally block; the state check below reports it.
    Invoke-Native -FilePath $appcmd -Arguments @('start', 'apppool', "/apppool.name:$AppPool") -AllowFailure | Out-Null
    # Rapid-fail protection disables a pool that crashed repeatedly, and 'start'
    # on a disabled pool can report success while leaving it stopped. Say so
    # plainly rather than letting test.ps1 discover it as a 503.
    Start-Sleep -Seconds 2
    $state = Get-AppPoolState $AppPool
    if ($state -eq 'Started') { Write-Ok 'pool started' }
    else {
        Write-Warn "pool is '$state' - it may have been disabled by rapid-fail protection"
        Write-Warn "check $SitePath\iisnode-logs and the System event log, then start it again"
    }
}

# ---------------------------------------------------------------- summary

$elapsed = [math]::Round(((Get-Date) - $StartedAt).TotalSeconds, 1)

Write-Host ''
Write-Host "Deploy complete in ${elapsed}s - $SourceRoot -> $SitePath ($SiteName)" -ForegroundColor Green
Write-Host "Verify with: powershell -ExecutionPolicy Bypass -File $SourceRoot\test.ps1" -ForegroundColor DarkGray
