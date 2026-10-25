<#
.SYNOPSIS
  One measured load-test run (REST or KAFKA): checks the mode, drains leftovers, optional warm-up,
  resets both tables, runs JMeter, waits until every payment exists, samples CPU/memory, and
  appends one row to results\summary.csv.

.EXAMPLE
  .\loadtest\run-test.ps1 -Mode REST  -Requests 1000 -Run 1 -Warmup
  .\loadtest\run-test.ps1 -Mode KAFKA -Requests 1000 -Run 1 -Warmup
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet("REST", "KAFKA")][string]$Mode,
    [Parameter(Mandatory = $true)][int]$Requests,
    [int]$Threads = 10,
    [int]$Run = 1,
    [switch]$Warmup
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false
$inv     = [Globalization.CultureInfo]::InvariantCulture
$root    = Split-Path $PSScriptRoot -Parent
$tag     = "{0}-{1}-run{2}" -f $Mode.ToLower(), $Requests, $Run
$relOut  = "results\$tag"                      # relative on purpose: JMeter args must not contain spaces
$absOut  = Join-Path $root $relOut
$summary = Join-Path $root "results\summary.csv"

if ($Requests % $Threads -ne 0) { throw "Requests ($Requests) must be divisible by Threads ($Threads)." }
$loops = [int]($Requests / $Threads)
if (-not (Get-Command jmeter -ErrorAction SilentlyContinue)) { throw "jmeter not found in PATH. Install JMeter and add its bin folder to PATH." }

function Sql([string]$container, [string]$db, [string]$query) {
    $r = docker exec -e MYSQL_PWD=root $container mysql -uroot -N -B $db -e $query
    if ($LASTEXITCODE -ne 0) {
        throw "SQL failed on $container : $query"
    }
    return $r
}
function Get-Rows([string]$container, [string]$db, [string]$table) {
    return [int](Sql $container $db "SELECT COUNT(*) FROM $table;" | Select-Object -First 1)
}
function Wait-Payments([int]$target, [int]$timeoutSec) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        $p = Get-Rows payment-mysql paymentdb payments
        if ($p -ge $target) { return $p }
        if ($sw.Elapsed.TotalSeconds -gt $timeoutSec) { Write-Warning "Timeout: only $p of $target payments exist."; return $p }
        Start-Sleep -Milliseconds 500
    }
}
function Wait-Drained([int]$timeoutSec) {       # every saved order has its payment (nothing in flight)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        $o = Get-Rows order-mysql orderdb orders
        $p = Get-Rows payment-mysql paymentdb payments
        if ($p -ge $o) { return }
        if ($sw.Elapsed.TotalSeconds -gt $timeoutSec) { Write-Warning "Timeout draining: $p payments for $o orders."; return }
        Start-Sleep -Milliseconds 500
    }
}
function ToMiB([string]$s) {
    if ($s -match '^([\d\.]+)\s*(GiB|MiB|KiB|B)$') {
        $v = [double]::Parse($matches[1], $inv)
        switch ($matches[2]) { 'GiB' { return $v * 1024 } 'MiB' { return $v } 'KiB' { return $v / 1024 } default { return $v / 1MB } }
    }
    return 0
}

Push-Location $root
$job = $null
try {
    # 1. both services must be in the requested mode
    foreach ($c in "order-service", "payment-service") {
        $m = (docker exec $c printenv COMMUNICATION_MODE | Out-String).Trim()
        if ($m -ne $Mode) { throw "$c is running in mode '$m' but -Mode $Mode was requested. Restart the stack in the right mode." }
    }

    # 2. leftovers, warm-up, reset
    Write-Host "== Draining leftovers from previous run"
    Wait-Drained 120
    if ($Warmup) {
        Write-Host "== Warm-up: $($Threads * 30) requests (not measured)"
        jmeter -n -t loadtest\order-load.jmx "-Jthreads=$Threads" "-Jloops=30" | Out-Null
        Wait-Drained 120
    }
    Write-Host "== Resetting tables"
    Sql order-mysql orderdb "TRUNCATE TABLE orders;" | Out-Null
    Sql payment-mysql paymentdb "TRUNCATE TABLE payments;" | Out-Null

    # 3. resource sampling in the background (all containers, ~every 2 s)
    if (Test-Path $absOut) { Remove-Item $absOut -Recurse -Force }
    New-Item -ItemType Directory -Path $absOut | Out-Null
    $statsFile = Join-Path $absOut "docker-stats.csv"
    $job = Start-Job -ArgumentList $statsFile -ScriptBlock {
        param($f)
        while ($true) {
            docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" |
                ForEach-Object { "$(Get-Date -Format o),$_" } | Add-Content -Path $f
        }
    }

    # 4. the measured run
    Write-Host "== Measured run: $Mode | $Requests requests | $Threads threads"
    jmeter -n -t loadtest\order-load.jmx "-Jthreads=$Threads" "-Jloops=$loops" -l "$relOut\jmeter.jtl" -e -o "$relOut\jmeter-report"

    # 5. wait until every payment is stored (immediate for REST, asynchronous for KAFKA)
    Write-Host "== Waiting for all $Requests payments"
    $paid = Wait-Payments $Requests 180
    Stop-Job $job; Remove-Job $job -Force; $job = $null

    # 6. end-to-end numbers from the database (processed_at - event_created_at)
    Sql payment-mysql paymentdb "SELECT TIMESTAMPDIFF(MICROSECOND, event_created_at, processed_at) / 1000 FROM payments WHERE event_created_at IS NOT NULL ORDER BY id;" |
        Out-File -Encoding ascii (Join-Path $absOut "e2e_ms.txt")
    $w = (Sql payment-mysql paymentdb "SELECT TIMESTAMPDIFF(MICROSECOND, MIN(event_created_at), MAX(processed_at)) / 1000000 FROM payments;" | Select-Object -First 1)
    $windowS = if ($w -match '^[\d\.]+$') { [double]::Parse($w, $inv) } else { 0 }

    $vals = @(Get-Content (Join-Path $absOut "e2e_ms.txt") | Where-Object { $_ -match '\d' } |
              ForEach-Object { [double]::Parse($_, $inv) } | Sort-Object)
    function Pct([double]$p) {
        if ($vals.Count -eq 0) { return $null }
        $i = [int][math]::Ceiling($p / 100 * $vals.Count) - 1
        if ($i -lt 0) { $i = 0 }
        return [math]::Round($vals[$i], 2)
    }
    $e2eAvg = if ($vals.Count -gt 0) { [math]::Round(($vals | Measure-Object -Average).Average, 2) } else { $null }
    $e2eMax = if ($vals.Count -gt 0) { [math]::Round($vals[-1], 2) } else { $null }
    $e2eRps = if ($windowS -gt 0) { [math]::Round($paid / $windowS, 1) } else { $null }

    # 7. JMeter (API side) numbers
    $st = (Get-Content "$relOut\jmeter-report\statistics.json" -Raw | ConvertFrom-Json).Total

    # 8. CPU / memory per container
    function Res([string]$name) {
        $rows = @(Import-Csv $statsFile -Header time, name, cpu, mem | Where-Object { $_.name -eq $name -and $_.cpu -match '^[\d\.]+%$' })
        if ($rows.Count -eq 0) { return @{ avg = $null; max = $null; mem = $null } }
        $cpu = $rows | ForEach-Object { [double]::Parse($_.cpu.TrimEnd('%'), $inv) }
        $mem = $rows | ForEach-Object { ToMiB (($_.mem -split ' / ')[0]) }
        return @{
            avg = [math]::Round(($cpu | Measure-Object -Average).Average, 1)
            max = [math]::Round(($cpu | Measure-Object -Maximum).Maximum, 1)
            mem = [math]::Round(($mem | Measure-Object -Maximum).Maximum, 0)
        }
    }
    $o = Res "order-service"; $p = Res "payment-service"; $k = Res "kafka"

    $row = [pscustomobject][ordered]@{
        Mode = $Mode; Requests = $Requests; Threads = $Threads; Run = $Run
        ApiErrorPct = $st.errorPct; ApiAvgMs = $st.meanResTime; ApiP95Ms = $st.pct2ResTime; ApiP99Ms = $st.pct3ResTime
        ApiThroughputRps = $st.throughput
        PaymentsStored = $paid; E2eAvgMs = $e2eAvg; E2eP95Ms = (Pct 95); E2eP99Ms = (Pct 99); E2eMaxMs = $e2eMax
        E2eWindowS = [math]::Round($windowS, 3); E2eThroughputRps = $e2eRps
        OrderCpuAvgPct = $o.avg; OrderCpuMaxPct = $o.max; OrderMemMaxMiB = $o.mem
        PaymentCpuAvgPct = $p.avg; PaymentCpuMaxPct = $p.max; PaymentMemMaxMiB = $p.mem
        KafkaCpuAvgPct = $k.avg; KafkaCpuMaxPct = $k.max; KafkaMemMaxMiB = $k.mem
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $summary) | Out-Null
    $row | Export-Csv -Path $summary -Append -NoTypeInformation

    Write-Host ""
    Write-Host "================ RESULT: $tag ================"
    $row | Format-List | Out-String | Write-Host
    Write-Host "JMeter report: $absOut\jmeter-report\index.html"
    if ($paid -lt $Requests -or [double]$st.errorPct -gt 0) { Write-Warning "Incomplete run (errors or missing payments). Do not use these numbers; investigate first." }
}
finally {
    if ($job) { Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue }
    Pop-Location
}
