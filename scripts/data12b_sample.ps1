<#
.SYNOPSIS
    DATA-12B Live Minute Verification Sampler

.DESCRIPTION
    Samples /api/debug/minute-trace, /api/debug/minute-health, and
    /api/live-score every 30 seconds for 10 minutes during a live WC match.
    Writes all output to data12b_output_<MatchId>.txt.

.PARAMETER MatchId
    Football-data.org match ID to trace. Default: 537391 (France vs Senegal).

.EXAMPLE
    $env:CRON_SECRET = "goalradar_cron_xxxx"
    .\scripts\data12b_sample.ps1 537391

.EXAMPLE
    $env:CRON_SECRET = "goalradar_cron_xxxx"
    .\scripts\data12b_sample.ps1 537392
#>
param(
    [string]$MatchId = "537391"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Validate CRON_SECRET ──────────────────────────────────────────────────────
$Secret = $env:CRON_SECRET
if (-not $Secret) {
    Write-Error "CRON_SECRET is not set. Run:`n  `$env:CRON_SECRET = '<your_secret>'"
    exit 1
}

$Base     = "https://www.goalradar.org"
$Samples  = 20
$Interval = 30
$OutFile  = "data12b_output_${MatchId}.txt"

function Get-UtcNow {
    (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Invoke-Api {
    param([string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        return $resp.Content
    } catch {
        return '{"error":"request_failed","detail":"' + ($_.Exception.Message -replace '"','\"') + '"}'
    }
}

function Extract-Field {
    param([string]$Json, [string]$Field)
    if ($Json -match ('"' + [regex]::Escape($Field) + '"\s*:\s*("([^"]*)"|(null|\d+))')) {
        if ($Matches[2]) { return $Matches[2] }
        return $Matches[3]
    }
    return ""
}

# ── Output helper ─────────────────────────────────────────────────────────────
function Write-Out {
    param([string]$Line)
    Write-Host $Line
    Add-Content -Path $OutFile -Value $Line -Encoding UTF8
}

# ── Header ────────────────────────────────────────────────────────────────────
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }

Write-Out "=== DATA-12B Live Minute Verification ==="
Write-Out "Match ID : $MatchId"
Write-Out "Started  : $(Get-UtcNow)"
Write-Out "Samples  : $Samples x ${Interval}s"
Write-Out "Base URL : $Base"
Write-Out ""

# ── Summary table header ──────────────────────────────────────────────────────
Write-Out "SUMMARY TABLE"
Write-Out ("{0,-4} {1,-22} {2,-12} {3,-8} {4,-8} {5,-10} {6,-8} {7}" -f "N","Time","Status","Provider","KV","LiveScore","Snap","Decision")
Write-Out ("{0,-4} {1,-22} {2,-12} {3,-8} {4,-8} {5,-10} {6,-8} {7}" -f "---","--------------------","----------","--------","--------","----------","--------","---------")

$SampleNum = 0

while ($SampleNum -lt $Samples) {
    $SampleNum++
    $Ts = Get-UtcNow

    Write-Out ""
    Write-Out "--- Sample $SampleNum/$Samples at $Ts ---"

    # ── Layer 1+2+3: minute-trace ─────────────────────────────────────────────
    Write-Out "[minute-trace]"
    $TraceUrl  = "${Base}/api/debug/minute-trace/${MatchId}?secret=${Secret}"
    $TraceJson = Invoke-Api -Url $TraceUrl
    Write-Out $TraceJson

    # Extract minuteTrace sub-object (present when match is IN_PLAY/PAUSED)
    $PMin    = "null"
    $KvMin   = "null"
    $LsMin   = "null"
    $SnapMin = "null"
    if ($TraceJson -match '"minuteTrace"\s*:\s*\{([^}]+)\}') {
        $MT = $Matches[1]
        if ($MT -match '"provider"\s*:\s*(\d+|null)')  { $PMin    = $Matches[1] }
        if ($MT -match '"kv"\s*:\s*(\d+|null)')        { $KvMin   = $Matches[1] }
        if ($MT -match '"liveScore"\s*:\s*(\d+|null)') { $LsMin   = $Matches[1] }
        if ($MT -match '"snapshot"\s*:\s*(\d+|null)')  { $SnapMin = $Matches[1] }
    }

    # Status from snapshotMatch or liveScoreResponse sub-object
    $Status = "?"
    if ($TraceJson -match '"snapshotMatch"\s*:\s*\{[^}]*"status"\s*:\s*"([^"]*)"') {
        $Status = $Matches[1]
    } elseif ($TraceJson -match '"liveScoreResponse"\s*:\s*\{[^}]*"status"\s*:\s*"([^"]*)"') {
        $Status = $Matches[1]
    }
    $Decision = Extract-Field -Json $TraceJson -Field "decision"

    if (-not $PMin)    { $PMin    = "null" }
    if (-not $KvMin)   { $KvMin   = "null" }
    if (-not $LsMin)   { $LsMin   = "null" }
    if (-not $SnapMin) { $SnapMin = "null" }
    if (-not $Status)  { $Status  = "?" }
    if (-not $Decision){ $Decision= "?" }

    Write-Out "  trace: status=$Status  provider=$PMin  kv=$KvMin  live-score=$LsMin  snapshot=$SnapMin  => $Decision"

    # ── minute-health (all live matches overview) ─────────────────────────────
    Write-Out "[minute-health]"
    $HealthUrl  = "${Base}/api/debug/minute-health?secret=${Secret}"
    $HealthJson = Invoke-Api -Url $HealthUrl
    Write-Out $HealthJson

    $HealthDiag = Extract-Field -Json $HealthJson -Field "diagnosis"
    if (-not $HealthDiag) { $HealthDiag = "?" }
    Write-Out "  health.diagnosis=$HealthDiag"

    # ── live-score API (public, no auth) ──────────────────────────────────────
    Write-Out "[live-score]"
    $LsUrl    = "${Base}/api/live-score/${MatchId}"
    $LsApiJson= Invoke-Api -Url $LsUrl
    Write-Out $LsApiJson

    $LsApiMin    = Extract-Field -Json $LsApiJson -Field "minute"
    $LsApiStatus = Extract-Field -Json $LsApiJson -Field "status"
    if (-not $LsApiMin)    { $LsApiMin    = "null" }
    if (-not $LsApiStatus) { $LsApiStatus = "?" }
    Write-Out "  live-score: status=$LsApiStatus  minute=$LsApiMin"

    # ── One-line summary row ──────────────────────────────────────────────────
    $Row = ("{0,-4} {1,-22} {2,-12} {3,-8} {4,-8} {5,-10} {6,-8} {7}" -f `
        $SampleNum, $Ts, $Status, $PMin, $KvMin, $LsApiMin, $SnapMin, $Decision)
    Write-Out "SUMMARY_ROW: $Row"

    if ($SampleNum -lt $Samples) {
        Write-Host "  (waiting ${Interval}s...)" -ForegroundColor DarkGray
        Start-Sleep -Seconds $Interval
    }
}

Write-Out ""
Write-Out "=== Sampling complete ==="
Write-Out "Finished : $(Get-UtcNow)"
Write-Out ""

# ── Final: match page SSR check (initialMinute in HTML) ──────────────────────
Write-Out "=== Match page SSR initialMinute check ==="
try {
    $PageHtml = (Invoke-WebRequest -Uri "${Base}/match/${MatchId}" -UseBasicParsing -TimeoutSec 15).Content
    if ($PageHtml -match '"initialMinute"\s*:\s*(\d+|null)') {
        Write-Out "initialMinute from SSR: $($Matches[1])"
    } else {
        Write-Out "initialMinute from SSR: not_found_in_page"
    }
} catch {
    Write-Out "initialMinute from SSR: fetch_failed ($($_.Exception.Message))"
}

Write-Out ""
Write-Out "=== DONE ==="
Write-Out "Output file: $OutFile"
Write-Out "Paste contents into DATA12B_RUNTIME_REPORT.md"
Write-Host ""
Write-Host "Done. Output written to: $OutFile" -ForegroundColor Green
Write-Host "Quick scan: Select-String 'SUMMARY_ROW' $OutFile" -ForegroundColor Cyan
