<#
.SYNOPSIS
    PC片付けスクリプト（1つずつ確認しながら、安全な範囲だけ掃除します）

.DESCRIPTION
    pc-health-check.ps1 で見つかった「安全に消せるもの」を片付けます。
    すべての手順で「実行しますか？ (y/N)」と聞きます。y 以外を入力すれば何もしません。
    消すのは次のものだけです。写真・書類・アプリなど、あなたが作ったものには触れません。

      1. ごみ箱を空にする
      2. ユーザーの一時ファイル（%TEMP%）のうち、7日以上前のもの
      3. Windows の一時ファイル（C:\Windows\Temp）のうち、7日以上前のもの ※管理者権限
      4. Windows Update のダウンロード済みファイル（SoftwareDistribution\Download）※管理者権限
      5. Windows 標準の「ディスク クリーンアップ」を起動する（画面で選んで消す）
      6. Windows の更新コンポーネントの整理（DISM StartComponentCleanup）※管理者権限・時間がかかる
      7. ドライブの最適化（SSDならトリム、HDDならデフラグ）※管理者権限
      8. システムファイルの整合性チェック（sfc /scannow）※管理者権限・10〜20分

.PARAMETER Steps
    実行する手順番号を指定（例: -Steps 1,2,5）。省略すると全手順を順に確認します。

.PARAMETER Yes
    確認を省略してすべて実行します（Claude などの自動実行向け。手動では使わないでください）。

.PARAMETER NoElevate
    管理者権限への昇格を行いません。

.PARAMETER Pause
    最後に Enter 待ちをします。
#>
[CmdletBinding()]
param(
    [int[]]$Steps = @(),
    [switch]$Yes,
    [switch]$NoElevate,
    [switch]$Pause,
    [int]$OlderThanDays = 7
)

$ErrorActionPreference = 'Continue'
$script:IsWindowsOS = ($env:OS -eq 'Windows_NT')

function Test-IsAdmin {
    if (-not $script:IsWindowsOS) { return $false }
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}
$script:IsAdmin = Test-IsAdmin

if ($script:IsWindowsOS -and -not $script:IsAdmin -and -not $NoElevate) {
    Write-Host '手順 3・4・6・7・8 には管理者権限が必要です。確認画面が出たら「はい」を押してください。' -ForegroundColor Yellow
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-NoElevate', '-OlderThanDays', $OlderThanDays)
    if ($Steps.Count -gt 0) { $argList += '-Steps'; $argList += ($Steps -join ',') }
    if ($Yes) { $argList += '-Yes' }
    if ($Pause) { $argList += '-Pause' }
    try {
        $exe = (Get-Process -Id $PID).Path
        if ([string]::IsNullOrWhiteSpace($exe)) { $exe = 'powershell.exe' }
        Start-Process -FilePath $exe -ArgumentList $argList -Verb RunAs -ErrorAction Stop | Out-Null
        Write-Host '管理者権限で別ウィンドウを開きました。このウィンドウは閉じて構いません。'
        return
    } catch {
        Write-Host '管理者権限なしで続行します（管理者権限が必要な手順は省略します）。' -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------
$desktop = ''
try { $desktop = [Environment]::GetFolderPath('Desktop') } catch { }
if ([string]::IsNullOrWhiteSpace($desktop) -or -not (Test-Path $desktop)) { $desktop = $HOME }
$logPath = Join-Path $desktop ('PC片付けログ_' + (Get-Date).ToString('yyyyMMdd_HHmm') + '.txt')
$script:Log = New-Object System.Text.StringBuilder
$script:FreedBytes = [long]0

function Log { param([string]$Msg) ; Write-Host $Msg ; [void]$script:Log.AppendLine((Get-Date).ToString('HH:mm:ss') + '  ' + $Msg) }

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N0} KB' -f ($Bytes / 1KB)) }
    return ('{0:N0} B' -f $Bytes)
}

function Get-FolderSize {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return 0 }
    $total = [long]0
    $stack = New-Object System.Collections.Stack
    $stack.Push((New-Object System.IO.DirectoryInfo($Path)))
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try {
            foreach ($e in $dir.EnumerateFileSystemInfos()) {
                if (($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                if ($e -is [System.IO.DirectoryInfo]) { $stack.Push($e); continue }
                $total += $e.Length
            }
        } catch { }
    }
    return $total
}

function Confirm-Step {
    param([int]$Number, [string]$Title, [string]$Description, [bool]$NeedsAdmin = $false)
    if ($Steps.Count -gt 0 -and $Steps -notcontains $Number) { return $false }
    Write-Host ''
    Write-Host ('--- 手順 ' + $Number + ': ' + $Title + ' ---') -ForegroundColor Cyan
    Write-Host ('  ' + $Description)
    if ($NeedsAdmin -and -not $script:IsAdmin) {
        Log ('  → 管理者権限がないため、手順 ' + $Number + ' は省略します。')
        return $false
    }
    if ($Yes) { Log ('  → -Yes 指定のため実行します。'); return $true }
    $ans = Read-Host '  実行しますか？ (y/N)'
    if ($ans -match '^[yY]') { return $true }
    Log ('  → 手順 ' + $Number + ' はスキップしました。')
    return $false
}

function Remove-OldFiles {
    # 指定フォルダー内の「N日以上前のファイル」を削除。使用中のファイルは自動的にスキップされる。
    param([string]$Path, [int]$Days)
    if (-not (Test-Path -LiteralPath $Path)) { Log ('  フォルダーがありません: ' + $Path); return }
    $before = Get-FolderSize -Path $Path
    $cutoff = (Get-Date).AddDays(-$Days)
    $files = Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff }
    $n = 0; $skipped = 0
    foreach ($f in $files) {
        try { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop; $n++ } catch { $skipped++ }
    }
    # 空になったフォルダーを削除
    Get-ChildItem -LiteralPath $Path -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object { try { if (-not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } } catch { } }
    $after = Get-FolderSize -Path $Path
    $freed = [math]::Max($before - $after, 0)
    $script:FreedBytes += $freed
    Log ('  削除 ' + $n + ' 件 / 使用中などでスキップ ' + $skipped + ' 件 / 空いた容量 ' + (Format-Size $freed))
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  PC片付け  （1つずつ確認します。y 以外なら何もしません）' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ('  管理者権限: ' + $(if ($script:IsAdmin) { 'あり' } else { 'なし' }))
Write-Host ('  ログ保存先: ' + $logPath)
if (-not $script:IsWindowsOS) { Write-Host 'このスクリプトは Windows 専用です。'; return }

# 1. ごみ箱
if (Confirm-Step -Number 1 -Title 'ごみ箱を空にする' -Description 'ごみ箱の中身を完全に削除します。必要なものが残っていないか、先に確認してください。') {
    try {
        Clear-RecycleBin -Force -ErrorAction Stop
        Log '  ごみ箱を空にしました。'
    } catch { Log ('  失敗: ' + $_.Exception.Message) }
}

# 2. ユーザー一時ファイル
if (Confirm-Step -Number 2 -Title 'ユーザーの一時ファイルを削除' -Description ($env:TEMP + ' の中の ' + $OlderThanDays + ' 日以上前のファイルを消します。アプリが今使っているものは自動で残ります。')) {
    Remove-OldFiles -Path $env:TEMP -Days $OlderThanDays
}

# 3. Windows一時ファイル
if (Confirm-Step -Number 3 -Title 'Windows の一時ファイルを削除' -Description ((Join-Path $env:SystemRoot 'Temp') + ' の中の ' + $OlderThanDays + ' 日以上前のファイルを消します。') -NeedsAdmin $true) {
    Remove-OldFiles -Path (Join-Path $env:SystemRoot 'Temp') -Days $OlderThanDays
}

# 4. Windows Update ダウンロードキャッシュ
if (Confirm-Step -Number 4 -Title 'Windows Update のダウンロード済みファイルを削除' -Description '適用済みの更新プログラムの元ファイルを消します。必要になれば自動で再ダウンロードされます。一時的に Windows Update サービスを止めて再開します。' -NeedsAdmin $true) {
    $sd = Join-Path $env:SystemRoot 'SoftwareDistribution\Download'
    $before = Get-FolderSize -Path $sd
    try {
        Stop-Service -Name wuauserv -Force -ErrorAction Stop
        Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
        Get-ChildItem -LiteralPath $sd -Force -ErrorAction SilentlyContinue | ForEach-Object { try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop } catch { } }
    } catch { Log ('  サービス停止に失敗: ' + $_.Exception.Message) }
    finally {
        Start-Service -Name bits -ErrorAction SilentlyContinue
        Start-Service -Name wuauserv -ErrorAction SilentlyContinue
    }
    $after = Get-FolderSize -Path $sd
    $freed = [math]::Max($before - $after, 0); $script:FreedBytes += $freed
    Log ('  空いた容量 ' + (Format-Size $freed))
}

# 5. ディスククリーンアップ
if (Confirm-Step -Number 5 -Title 'Windows 標準の「ディスク クリーンアップ」を起動' -Description '別の画面が開きます。「システム ファイルのクリーンアップ」を押してから、消したい項目にチェックを入れて OK を押してください。「以前の Windows のインストール」「Windows Update のクリーンアップ」が大きいことが多いです。') {
    try {
        $sysDrive = $env:SystemDrive; if (-not $sysDrive) { $sysDrive = 'C:' }
        Start-Process -FilePath 'cleanmgr.exe' -ArgumentList ('/d ' + $sysDrive) -ErrorAction Stop | Out-Null
        Log '  ディスク クリーンアップを起動しました（画面の指示に従ってください）。'
    } catch { Log ('  起動に失敗: ' + $_.Exception.Message) }
}

# 6. DISM
if (Confirm-Step -Number 6 -Title 'Windows の更新コンポーネントを整理（DISM）' -Description '古い更新プログラムの残りかすを安全に整理します。数分〜十数分かかります。' -NeedsAdmin $true) {
    try {
        Log '  実行中... （ウィンドウを閉じないでください）'
        & Dism.exe /Online /Cleanup-Image /StartComponentCleanup 2>&1 | ForEach-Object { if ($_ -match 'エラー|Error|完了|complete') { Log ('  ' + $_) } }
        Log '  完了しました。'
    } catch { Log ('  失敗: ' + $_.Exception.Message) }
}

# 7. 最適化
if (Confirm-Step -Number 7 -Title 'ドライブの最適化' -Description 'SSD ならトリム、HDD ならデフラグを行います。Windows が自動で週1回やっている作業と同じものです。' -NeedsAdmin $true) {
    try {
        $letter = ($env:SystemDrive -replace ':', ''); if (-not $letter) { $letter = 'C' }
        Optimize-Volume -DriveLetter $letter -ErrorAction Stop
        Log ('  ' + $letter + ': ドライブを最適化しました。')
    } catch { Log ('  失敗: ' + $_.Exception.Message) }
}

# 8. sfc
if (Confirm-Step -Number 8 -Title 'システムファイルの整合性チェック（sfc /scannow）' -Description 'Windows の重要ファイルが壊れていないか調べ、壊れていれば修復します。10〜20分かかります。原因不明の不調がある時に有効です。' -NeedsAdmin $true) {
    try {
        Log '  実行中... （ウィンドウを閉じないでください）'
        $out = & sfc.exe /scannow 2>&1 | Out-String
        $lastLines = ($out -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join ' / '
        Log ('  結果: ' + $lastLines)
    } catch { Log ('  失敗: ' + $_.Exception.Message) }
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Log ('片付け完了。このスクリプトで空いた容量の合計（計測できた分）: ' + (Format-Size $script:FreedBytes))
Write-Host '  ブラウザのキャッシュは、各ブラウザの「閲覧履歴データの削除」から消してください（このスクリプトでは触りません）。'
Write-Host '============================================================' -ForegroundColor Green
try { [System.IO.File]::WriteAllText($logPath, $script:Log.ToString(), (New-Object System.Text.UTF8Encoding($true))) } catch { }
if ($Pause) { Read-Host 'Enter キーを押すと閉じます' | Out-Null }
