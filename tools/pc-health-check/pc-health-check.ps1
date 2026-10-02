<#
.SYNOPSIS
    PC健康診断スクリプト（読み取り専用・何も削除しません）

.DESCRIPTION
    Windows 11 / 10 のパソコンを調べて、次の内容をレポート（HTML・テキスト・JSON）にまとめます。
      - 基本情報（Windowsのバージョン、CPU、メモリ、起動してからの時間）
      - ディスクの空き容量と、ディスク本体の健康状態
      - 容量を食っている場所（一時ファイル、ごみ箱、更新プログラムの残りかす、ブラウザのキャッシュ など）
      - 大きいファイルの一覧
      - メモリを多く使っているアプリ
      - パソコン起動時に自動で立ち上がるアプリ（スタートアップ）
      - Windows Update の状態、再起動待ちかどうか
      - セキュリティ（Microsoft Defender、ファイアウォール）
      - バッテリーの劣化度（ノートパソコンの場合）
      - 直近7日間のエラー記録
      - インストール済みアプリ（サイズの大きい順）
      - 総合所見（「これを消すと良い」「ここを直すと速くなる」）

    このスクリプトは「調べるだけ」です。ファイルの削除や設定変更は一切行いません。
    片付けを行いたい場合は、同じフォルダーの pc-cleanup.ps1 を使ってください。

.PARAMETER OutputDir
    レポートの保存先。省略するとデスクトップに「PC健康診断_日付_時刻」フォルダーを作ります。

.PARAMETER LargeFileMB
    「大きいファイル」として一覧に載せる最小サイズ（MB）。既定 200。

.PARAMETER SkipProfileScan
    ユーザーフォルダー全体の走査（数分かかることがある）を省略します。

.PARAMETER NoElevate
    管理者権限への昇格（UACの確認画面）を出さずに、今の権限のまま実行します。

.PARAMETER NoOpen
    最後にレポートを自動で開きません。

.PARAMETER Pause
    最後に「Enterキーで閉じます」と表示して待ちます（ダブルクリック実行向け）。

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\pc-health-check.ps1 -Pause
#>
[CmdletBinding()]
param(
    [string]$OutputDir = '',
    [int]$LargeFileMB = 200,
    [switch]$SkipProfileScan,
    [switch]$NoElevate,
    [switch]$NoOpen,
    [switch]$Pause
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$script:ScriptVersion = '1.0.0'
$script:IsWindowsOS = ($env:OS -eq 'Windows_NT')
$script:StartedAt = Get-Date

# ------------------------------------------------------------
# 出力先の決定（昇格前に決めておく。昇格後も同じ場所に書く）
# ------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $desktop = ''
    try { $desktop = [Environment]::GetFolderPath('Desktop') } catch { }
    if ([string]::IsNullOrWhiteSpace($desktop) -or -not (Test-Path $desktop)) { $desktop = $HOME }
    $OutputDir = Join-Path $desktop ('PC健康診断_' + $script:StartedAt.ToString('yyyyMMdd_HHmm'))
}

# ------------------------------------------------------------
# 管理者権限チェックと昇格
# ------------------------------------------------------------
function Test-IsAdmin {
    if (-not $script:IsWindowsOS) { return $false }
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $p = New-Object Security.Principal.WindowsPrincipal($id)
        return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

$script:IsAdmin = Test-IsAdmin

if ($script:IsWindowsOS -and -not $script:IsAdmin -and -not $NoElevate) {
    Write-Host ''
    Write-Host '管理者権限があると、より多くの項目（ディスクの温度・摩耗度、システムの一時ファイル など）を調べられます。' -ForegroundColor Yellow
    Write-Host 'このあと「このアプリがデバイスに変更を加えることを許可しますか？」という画面が出たら「はい」を押してください。' -ForegroundColor Yellow
    Write-Host '「いいえ」を押した場合は、今の権限のまま続行します。'
    Write-Host ''
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'),
                 '-OutputDir', ('"' + $OutputDir + '"'), '-LargeFileMB', $LargeFileMB, '-NoElevate')
    if ($SkipProfileScan) { $argList += '-SkipProfileScan' }
    if ($NoOpen) { $argList += '-NoOpen' }
    if ($Pause) { $argList += '-Pause' }
    try {
        $exe = (Get-Process -Id $PID).Path
        if ([string]::IsNullOrWhiteSpace($exe)) { $exe = 'powershell.exe' }
        Start-Process -FilePath $exe -ArgumentList $argList -Verb RunAs -ErrorAction Stop | Out-Null
        Write-Host '管理者権限で別ウィンドウを開きました。このウィンドウは閉じて構いません。'
        return
    } catch {
        Write-Host '管理者権限なしで続行します（一部の項目は「取得できず」になります）。' -ForegroundColor Yellow
    }
}

# ------------------------------------------------------------
# 共通ヘルパー
# ------------------------------------------------------------
$script:Findings = New-Object System.Collections.Generic.List[object]
$script:Sections = New-Object System.Collections.Generic.List[object]
$script:Summary = [ordered]@{}
$script:Errors = New-Object System.Collections.Generic.List[string]

function Add-Finding {
    param(
        [ValidateSet('高', '中', '低', '情報')][string]$Level,
        [string]$Title,
        [string]$Detail,
        [string]$Action
    )
    $script:Findings.Add([pscustomobject]@{ Level = $Level; Title = $Title; Detail = $Detail; Action = $Action })
}

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1TB) { return ('{0:N2} TB' -f ($Bytes / 1TB)) }
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N0} KB' -f ($Bytes / 1KB)) }
    return ('{0:N0} B' -f $Bytes)
}

function HtmlEnc {
    param($Value)
    if ($null -eq $Value) { return '' }
    return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function ConvertTo-SimpleTable {
    # オブジェクト配列 → HTMLの表 と テキストの表 を同時に作る
    param(
        [object[]]$Rows,
        [string[]]$Columns,
        [string[]]$Headers,
        [string]$EmptyMessage = '該当なし'
    )
    if ($null -eq $Headers -or $Headers.Count -eq 0) { $Headers = $Columns }
    $sbH = New-Object System.Text.StringBuilder
    $sbT = New-Object System.Text.StringBuilder
    if ($null -eq $Rows -or $Rows.Count -eq 0) {
        [void]$sbH.Append('<p class="muted">' + (HtmlEnc $EmptyMessage) + '</p>')
        [void]$sbT.AppendLine('  ' + $EmptyMessage)
        return [pscustomobject]@{ Html = $sbH.ToString(); Text = $sbT.ToString() }
    }
    [void]$sbH.Append('<table><thead><tr>')
    foreach ($h in $Headers) { [void]$sbH.Append('<th>' + (HtmlEnc $h) + '</th>') }
    [void]$sbH.Append('</tr></thead><tbody>')
    [void]$sbT.AppendLine('  ' + ($Headers -join ' | '))
    foreach ($r in $Rows) {
        [void]$sbH.Append('<tr>')
        $cells = @()
        foreach ($c in $Columns) {
            $v = $null
            try { $v = $r.$c } catch { }
            if ($v -is [datetime]) { $v = $v.ToString('yyyy/MM/dd HH:mm') }
            [void]$sbH.Append('<td>' + (HtmlEnc $v) + '</td>')
            $cells += [string]$v
        }
        [void]$sbH.Append('</tr>')
        [void]$sbT.AppendLine('  ' + ($cells -join ' | '))
    }
    [void]$sbH.Append('</tbody></table>')
    return [pscustomobject]@{ Html = $sbH.ToString(); Text = $sbT.ToString() }
}

function Add-Section {
    param([string]$Title, [string]$Html, [string]$Text, [string]$Note = '')
    $script:Sections.Add([pscustomobject]@{ Title = $Title; Html = $Html; Text = $Text; Note = $Note })
}

function Invoke-Check {
    # 1つの検査項目を実行。失敗しても全体は止めない。
    param([string]$Name, [scriptblock]$Script)
    Write-Host ('[' + (Get-Date).ToString('HH:mm:ss') + '] ' + $Name + ' を調べています...') -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Script
    } catch {
        $msg = $Name + ': ' + $_.Exception.Message
        $script:Errors.Add($msg)
        Write-Host ('  → この項目は取得できませんでした（' + $_.Exception.Message + '）') -ForegroundColor DarkYellow
        Add-Section -Title $Name -Html ('<p class="muted">この項目は取得できませんでした: ' + (HtmlEnc $_.Exception.Message) + '</p>') -Text ('  取得できず: ' + $_.Exception.Message)
    }
    $sw.Stop()
    Write-Host ('  完了（' + [int]$sw.Elapsed.TotalSeconds + '秒）') -ForegroundColor DarkGray
}

function Get-FolderSize {
    # 指定フォルダー配下の合計サイズ（バイト）。アクセスできないものは無視。ジャンクションは辿らない。
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) { return $null }
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

function Get-TreeStats {
    # フォルダー全体を1回だけ走査して「直下フォルダーごとの合計」と「大きいファイル」を同時に集める
    param([string]$Root, [int]$LargeMB)
    $rootInfo = New-Object System.IO.DirectoryInfo($Root)
    $rootFull = $rootInfo.FullName.TrimEnd([IO.Path]::DirectorySeparatorChar)
    $sep = [IO.Path]::DirectorySeparatorChar
    $threshold = [long]$LargeMB * 1MB
    $topSizes = @{}
    $large = New-Object System.Collections.Generic.List[object]
    $total = [long]0
    $count = [long]0
    $stack = New-Object System.Collections.Stack
    $stack.Push($rootInfo)
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try {
            foreach ($e in $dir.EnumerateFileSystemInfos()) {
                if (($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                if ($e -is [System.IO.DirectoryInfo]) { $stack.Push($e); continue }
                $len = [long]$e.Length
                $total += $len
                $count++
                $rel = $e.FullName.Substring($rootFull.Length).TrimStart($sep)
                $idx = $rel.IndexOf($sep)
                if ($idx -ge 0) { $top = $rel.Substring(0, $idx) } else { $top = '(フォルダー直下のファイル)' }
                if ($topSizes.ContainsKey($top)) { $topSizes[$top] += $len } else { $topSizes[$top] = $len }
                if ($len -ge $threshold) {
                    $large.Add([pscustomobject]@{ Path = $e.FullName; Bytes = $len; Modified = $e.LastWriteTime })
                }
            }
        } catch { }
    }
    return [pscustomobject]@{ TotalBytes = $total; FileCount = $count; TopSizes = $topSizes; LargeFiles = $large }
}

function Get-RecycleBinBytes {
    if (-not $script:IsWindowsOS) { return $null }
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.NameSpace(0xA)
    if ($null -eq $bin) { return $null }
    $sum = [long]0
    function Sum-Items($folder) {
        $s = [long]0
        foreach ($it in $folder.Items()) {
            if ($it.IsFolder -and $null -ne $it.GetFolder) {
                try { $s += (Sum-Items $it.GetFolder) } catch { }
            } else {
                $s += [long]$it.Size
            }
        }
        return $s
    }
    $sum = Sum-Items $bin
    return $sum
}

function Get-RegValue {
    param([string]$Path, [string]$Name)
    try { return (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name } catch { return $null }
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host ('  PC健康診断 v' + $script:ScriptVersion + '  （調べるだけ。何も削除・変更しません）') -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ('  保存先: ' + $OutputDir)
Write-Host ('  管理者権限: ' + $(if ($script:IsAdmin) { 'あり' } else { 'なし（一部項目は省略）' }))
Write-Host ''

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# ============================================================
# 1. 基本情報
# ============================================================
Invoke-Check -Name '1. 基本情報' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $displayVersion = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'DisplayVersion'
    $ubr = Get-RegValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'UBR'
    $uptime = (Get-Date) - $os.LastBootUpTime
    $totalMemGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
    $rows = @(
        [pscustomobject]@{ 項目 = 'パソコン名'; 値 = $cs.Name }
        [pscustomobject]@{ 項目 = 'メーカー / 型番'; 値 = ($cs.Manufacturer + ' / ' + $cs.Model) }
        [pscustomobject]@{ 項目 = 'Windows'; 値 = ($os.Caption + ' ' + $displayVersion + '（ビルド ' + $os.BuildNumber + '.' + $ubr + '）') }
        [pscustomobject]@{ 項目 = 'Windowsをインストールした日'; 値 = $os.InstallDate.ToString('yyyy/MM/dd') }
        [pscustomobject]@{ 項目 = 'CPU'; 値 = ($cpu.Name.Trim() + '（' + $cpu.NumberOfCores + 'コア / ' + $cpu.NumberOfLogicalProcessors + 'スレッド）') }
        [pscustomobject]@{ 項目 = 'メモリ（搭載量）'; 値 = ($totalMemGB.ToString() + ' GB') }
        [pscustomobject]@{ 項目 = '最後に起動した日時'; 値 = $os.LastBootUpTime.ToString('yyyy/MM/dd HH:mm') }
        [pscustomobject]@{ 項目 = '起動してからの時間'; 値 = ('{0}日 {1}時間 {2}分' -f $uptime.Days, $uptime.Hours, $uptime.Minutes) }
        [pscustomobject]@{ 項目 = 'ログイン中のユーザー'; 値 = $env:USERNAME }
        [pscustomobject]@{ 項目 = 'このレポートの実行権限'; 値 = $(if ($script:IsAdmin) { '管理者' } else { '標準ユーザー' }) }
    )
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('項目', '値')
    Add-Section -Title '1. 基本情報' -Html $t.Html -Text $t.Text
    $script:Summary['os'] = ($os.Caption + ' ' + $displayVersion + ' build ' + $os.BuildNumber + '.' + $ubr)
    $script:Summary['model'] = ($cs.Manufacturer + ' ' + $cs.Model)
    $script:Summary['cpu'] = $cpu.Name.Trim()
    $script:Summary['memoryGB'] = $totalMemGB
    $script:Summary['uptimeDays'] = [math]::Round($uptime.TotalDays, 1)
    $script:Summary['isAdmin'] = $script:IsAdmin

    if ($uptime.TotalDays -ge 7) {
        Add-Finding -Level '中' -Title ('パソコンを ' + [int]$uptime.TotalDays + ' 日間、再起動していません') `
            -Detail '「シャットダウン」は既定で「高速スタートアップ」という仕組みが働くため、本当の意味での再起動になっていないことがあります。長く再起動しないと、メモリの使い残しがたまって動作が重くなったり、更新プログラムが適用されないままになります。' `
            -Action 'スタート → 電源 → 「再起動」を1回行ってください（「シャットダウン」ではなく「再起動」）。'
    }
    if ($totalMemGB -le 8) {
        Add-Finding -Level '中' -Title ('メモリが ' + $totalMemGB + ' GB と少なめです') `
            -Detail 'ブラウザのタブをたくさん開いたり、複数のアプリを同時に使うと、メモリ不足で動作が重くなりやすい容量です。' `
            -Action '使っていないアプリやタブをこまめに閉じる。スタートアップアプリを減らす（後述）。増設できる機種なら16GB以上への増設が最も効果的です。'
    }
}

# ============================================================
# 2. ディスクの空き容量
# ============================================================
Invoke-Check -Name '2. ディスクの空き容量' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $disks = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3'
    $rows = @()
    $diskSummary = @()
    foreach ($d in $disks) {
        if ($d.Size -eq 0 -or $null -eq $d.Size) { continue }
        $freePct = [math]::Round($d.FreeSpace / $d.Size * 100, 1)
        $rows += [pscustomobject]@{
            ドライブ = $d.DeviceID
            名前 = $d.VolumeName
            合計 = (Format-Size $d.Size)
            使用中 = (Format-Size ($d.Size - $d.FreeSpace))
            空き = (Format-Size $d.FreeSpace)
            '空き率' = ($freePct.ToString() + ' %')
        }
        $diskSummary += [ordered]@{ drive = $d.DeviceID; totalGB = [math]::Round($d.Size / 1GB, 1); freeGB = [math]::Round($d.FreeSpace / 1GB, 1); freePct = $freePct }
        if ($freePct -lt 10) {
            Add-Finding -Level '高' -Title ($d.DeviceID + ' ドライブの空きが ' + $freePct + ' % しかありません') `
                -Detail ('空きが ' + (Format-Size $d.FreeSpace) + ' です。空きが1割を切ると、Windows Update が失敗したり、動作が極端に遅くなったりします。') `
                -Action '「4. 容量を使っている場所」「5. 大きいファイル」を見て、不要なものを整理してください。pc-cleanup.ps1 で安全な片付けができます。'
        } elseif ($freePct -lt 20) {
            Add-Finding -Level '中' -Title ($d.DeviceID + ' ドライブの空きが ' + $freePct + ' % と少なめです') `
                -Detail ('空きが ' + (Format-Size $d.FreeSpace) + ' です。2割を切ると更新プログラムの適用に支障が出始めます。') `
                -Action '「4. 容量を使っている場所」「5. 大きいファイル」を見て、不要なものを整理してください。'
        }
    }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('ドライブ', '名前', '合計', '使用中', '空き', '空き率')
    Add-Section -Title '2. ディスクの空き容量' -Html $t.Html -Text $t.Text -Note '目安: 空きが 20% 以上あれば安心。10% を切ると要対応。'
    $script:Summary['disks'] = $diskSummary
}

# ============================================================
# 3. ディスク本体の健康状態
# ============================================================
Invoke-Check -Name '3. ディスク本体の健康状態' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $pds = Get-PhysicalDisk
    $rows = @()
    $pdSummary = @()
    foreach ($pd in $pds) {
        $temp = ''; $wear = ''; $hours = ''; $readErr = ''
        if ($script:IsAdmin) {
            try {
                $rc = $pd | Get-StorageReliabilityCounter -ErrorAction Stop
                if ($null -ne $rc.Temperature -and $rc.Temperature -gt 0) { $temp = ($rc.Temperature.ToString() + ' ℃') }
                if ($null -ne $rc.Wear) { $wear = ($rc.Wear.ToString() + ' %') }
                if ($null -ne $rc.PowerOnHours) { $hours = ($rc.PowerOnHours.ToString() + ' 時間') }
                if ($null -ne $rc.ReadErrorsTotal) { $readErr = $rc.ReadErrorsTotal.ToString() }
            } catch { $temp = '(取得できず)' }
        } else {
            $temp = '(管理者権限が必要)'
        }
        $rows += [pscustomobject]@{
            名前 = $pd.FriendlyName
            種類 = $pd.MediaType
            接続 = $pd.BusType
            容量 = (Format-Size $pd.Size)
            健康状態 = $pd.HealthStatus
            動作状態 = ($pd.OperationalStatus -join ',')
            温度 = $temp
            摩耗度 = $wear
            通電時間 = $hours
            読み取りエラー = $readErr
        }
        $pdSummary += [ordered]@{ name = $pd.FriendlyName; mediaType = [string]$pd.MediaType; health = [string]$pd.HealthStatus; wear = $wear; temperature = $temp; powerOnHours = $hours }
        if ([string]$pd.HealthStatus -ne 'Healthy') {
            Add-Finding -Level '高' -Title ('ディスク「' + $pd.FriendlyName + '」の健康状態が「' + $pd.HealthStatus + '」です') `
                -Detail 'Windows がディスクの異常を検知しています。突然データが読めなくなる前触れの可能性があります。' `
                -Action '今すぐ大事なデータを外付けドライブや OneDrive などにバックアップしてください。その上でメーカーのサポートに相談を。'
        }
        if ($wear -match '^\d+' -and [int]($wear -replace '[^\d]', '') -ge 80) {
            Add-Finding -Level '高' -Title ('SSD「' + $pd.FriendlyName + '」の摩耗度が ' + $wear + ' です') `
                -Detail 'SSDには書き込み回数の寿命があります。摩耗度が高いと、交換時期が近づいています。' `
                -Action 'バックアップを取り、交換の計画を立ててください。'
        }
        if ([string]$pd.MediaType -eq 'HDD') {
            Add-Finding -Level '低' -Title ('「' + $pd.FriendlyName + '」は HDD（回転式ディスク）です') `
                -Detail 'HDD は SSD に比べて起動やアプリの立ち上げが数倍遅くなります。パソコンが遅い最大の原因になっていることが多い部品です。' `
                -Action '可能であれば SSD への交換が、体感速度を上げる最も効果の大きい対策です。'
        }
    }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('名前', '種類', '接続', '容量', '健康状態', '動作状態', '温度', '摩耗度', '通電時間', '読み取りエラー')
    Add-Section -Title '3. ディスク本体の健康状態' -Html $t.Html -Text $t.Text -Note '「健康状態」が Healthy なら正常。摩耗度は SSD の使い込み度合い（0% が新品）。'
    $script:Summary['physicalDisks'] = $pdSummary
}

# ============================================================
# 4. 容量を使っている場所
# ============================================================
Invoke-Check -Name '4. 容量を使っている場所' -Script {
    $sysDrive = $env:SystemDrive
    if ([string]::IsNullOrWhiteSpace($sysDrive)) { $sysDrive = 'C:' }
    function Add-SpaceItem {
        param([string]$Label, [string]$Path, [string]$Comment, [string]$Category)
        if ([string]::IsNullOrWhiteSpace($Path)) { return }
        $bytes = $null
        try { $bytes = Get-FolderSize -Path $Path } catch { }
        $script:spaceRows.Add([pscustomobject]@{ Label = $Label; Path = $Path; Bytes = $bytes; Comment = $Comment; Category = $Category })
    }
    $script:spaceRows = New-Object System.Collections.Generic.List[object]

    # 安全に消せるもの
    Add-SpaceItem -Label 'ユーザーの一時ファイル (%TEMP%)' -Path $env:TEMP -Comment 'アプリが作業用に作った一時ファイル。消しても問題なし。' -Category 'safe'
    if ($script:IsWindowsOS -and $env:LOCALAPPDATA) {
        Add-SpaceItem -Label 'Windowsの一時ファイル' -Path (Join-Path $env:SystemRoot 'Temp') -Comment 'システムの一時ファイル。消しても問題なし（管理者権限が必要）。' -Category 'safe'
        Add-SpaceItem -Label 'Windows Update のダウンロード置き場' -Path (Join-Path $env:SystemRoot 'SoftwareDistribution\Download') -Comment '更新プログラムのダウンロード済みファイル。適用済みなら不要。' -Category 'safe'
        Add-SpaceItem -Label 'Windows.old（以前のWindows）' -Path (Join-Path $sysDrive 'Windows.old') -Comment '大型アップデート前のWindows一式。元に戻す予定がなければ不要。' -Category 'safe'
        Add-SpaceItem -Label 'エラー報告の保存データ' -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\WER') -Comment 'アプリがクラッシュした時の記録。消しても問題なし。' -Category 'safe'
        Add-SpaceItem -Label 'サムネイル等のキャッシュ' -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer') -Comment 'エクスプローラーの縮小表示キャッシュ。消しても再生成される。' -Category 'safe'
        Add-SpaceItem -Label 'インストーラーの残りかす' -Path (Join-Path $env:LOCALAPPDATA 'Package Cache') -Comment '一部アプリの修復用に残されるもの。基本は触らない。' -Category 'info'
    }

    # ブラウザのキャッシュ
    $lad = $env:LOCALAPPDATA; if ([string]::IsNullOrWhiteSpace($lad)) { $lad = Join-Path $HOME '.nonexistent' }
    $browserCaches = @(
        @{ Label = 'Google Chrome のキャッシュ'; Base = (Join-Path $lad 'Google\Chrome\User Data') }
        @{ Label = 'Microsoft Edge のキャッシュ'; Base = (Join-Path $lad 'Microsoft\Edge\User Data') }
        @{ Label = 'Brave のキャッシュ'; Base = (Join-Path $lad 'BraveSoftware\Brave-Browser\User Data') }
    )
    foreach ($b in $browserCaches) {
        if (-not (Test-Path -LiteralPath $b.Base)) { continue }
        $sum = [long]0
        try {
            $profiles = Get-ChildItem -LiteralPath $b.Base -Directory -ErrorAction SilentlyContinue
            foreach ($p in $profiles) {
                foreach ($sub in @('Cache', 'Code Cache', 'GPUCache', 'Service Worker\CacheStorage', 'Service Worker\ScriptCache')) {
                    $cp = Join-Path $p.FullName $sub
                    if (Test-Path -LiteralPath $cp) { $s = Get-FolderSize -Path $cp; if ($null -ne $s) { $sum += $s } }
                }
            }
        } catch { }
        $script:spaceRows.Add([pscustomobject]@{ Label = $b.Label; Path = $b.Base; Bytes = $sum; Comment = 'ブラウザの設定画面から「閲覧履歴データの削除 → キャッシュされた画像とファイル」で消せる。' ; Category = 'browser' })
    }

    # ごみ箱
    $binBytes = $null
    try { $binBytes = Get-RecycleBinBytes } catch { }
    $script:spaceRows.Add([pscustomobject]@{ Label = 'ごみ箱'; Path = '(ごみ箱)'; Bytes = $binBytes; Comment = '「ごみ箱を空にする」で消える。中に必要なものがないか一度確認を。'; Category = 'safe' })

    # 休止・ページファイル（情報のみ）
    if ($script:IsWindowsOS) {
        foreach ($sf in @(@{ L = '休止状態ファイル (hiberfil.sys)'; P = (Join-Path $sysDrive 'hiberfil.sys'); C = '「高速スタートアップ」「休止状態」に使うファイル。消す場合は設定変更が必要で、通常は触らない。' },
                          @{ L = '仮想メモリ (pagefile.sys)'; P = (Join-Path $sysDrive 'pagefile.sys'); C = 'メモリ不足を補うファイル。通常は触らない。' })) {
            $sz = $null
            try { $f = Get-Item -LiteralPath $sf.P -Force -ErrorAction Stop; $sz = $f.Length } catch { }
            if ($null -ne $sz) { $script:spaceRows.Add([pscustomobject]@{ Label = $sf.L; Path = $sf.P; Bytes = $sz; Comment = $sf.C; Category = 'info' }) }
        }
    }

    # 表示用
    $rows = @()
    $safeTotal = [long]0
    $spaceSummary = @()
    foreach ($r in $script:spaceRows) {
        $sizeText = if ($null -eq $r.Bytes) { '(なし / 取得できず)' } else { Format-Size $r.Bytes }
        $rows += [pscustomobject]@{ 場所 = $r.Label; サイズ = $sizeText; 説明 = $r.Comment; パス = $r.Path }
        if ($r.Category -eq 'safe' -and $null -ne $r.Bytes) { $safeTotal += $r.Bytes }
        $spaceSummary += [ordered]@{ label = $r.Label; bytes = $r.Bytes; category = $r.Category }
    }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('場所', 'サイズ', '説明', 'パス')
    $note = '「安全に消せるもの」の合計: ' + (Format-Size $safeTotal) + '（一時ファイル・更新プログラムの残り・Windows.old・ごみ箱 など）'
    Add-Section -Title '4. 容量を使っている場所' -Html $t.Html -Text $t.Text -Note $note
    $script:Summary['safeToDeleteBytes'] = $safeTotal
    $script:Summary['spaceItems'] = $spaceSummary

    foreach ($r in $script:spaceRows) {
        if ($null -eq $r.Bytes) { continue }
        $gb = $r.Bytes / 1GB
        if ($r.Label -like 'Windows.old*' -and $gb -ge 1) {
            Add-Finding -Level '中' -Title ('以前のWindows（Windows.old）が ' + (Format-Size $r.Bytes) + ' 残っています') `
                -Detail '大型アップデートの前のWindowsが丸ごと保存されています。10日を過ぎると元に戻せなくなるので、保存しておく意味はほぼありません。' `
                -Action '設定 → システム → 記憶域 → 一時ファイル → 「以前の Windows のインストール」にチェックを入れて削除。'
        } elseif ($r.Label -eq 'ごみ箱' -and $gb -ge 1) {
            Add-Finding -Level '低' -Title ('ごみ箱に ' + (Format-Size $r.Bytes) + ' 入っています') `
                -Detail 'ごみ箱の中身は、空にするまでディスク容量を使い続けます。' `
                -Action 'デスクトップのごみ箱を右クリック → 「ごみ箱を空にする」。'
        } elseif ($r.Category -eq 'safe' -and $gb -ge 1) {
            Add-Finding -Level '低' -Title ($r.Label + ' が ' + (Format-Size $r.Bytes) + ' あります') `
                -Detail $r.Comment `
                -Action '設定 → システム → 記憶域 → 一時ファイル で削除できます。pc-cleanup.ps1 でも片付けられます。'
        } elseif ($r.Category -eq 'browser' -and $gb -ge 2) {
            Add-Finding -Level '低' -Title ($r.Label + ' が ' + (Format-Size $r.Bytes) + ' あります') `
                -Detail 'キャッシュは表示を速くするための一時データで、消しても次回アクセス時に自動で作り直されます。' `
                -Action $r.Comment
        }
    }
}

# ============================================================
# 5. ユーザーフォルダーの内訳と大きいファイル
# ============================================================
if ($SkipProfileScan) {
    Add-Section -Title '5. ユーザーフォルダーの内訳と大きいファイル' -Html '<p class="muted">-SkipProfileScan 指定のため省略しました。</p>' -Text '  省略'
} else {
    Invoke-Check -Name '5. ユーザーフォルダーの内訳と大きいファイル（数分かかることがあります）' -Script {
        $profile = $env:USERPROFILE
        if ([string]::IsNullOrWhiteSpace($profile)) { $profile = $HOME }
        $stats = Get-TreeStats -Root $profile -LargeMB $LargeFileMB
        $topRows = @()
        foreach ($k in ($stats.TopSizes.Keys | Sort-Object { $stats.TopSizes[$_] } -Descending | Select-Object -First 20)) {
            $topRows += [pscustomobject]@{ フォルダー = $k; サイズ = (Format-Size $stats.TopSizes[$k]); 割合 = ('{0:N1} %' -f ($stats.TopSizes[$k] / [math]::Max($stats.TotalBytes, 1) * 100)) }
        }
        $t1 = ConvertTo-SimpleTable -Rows $topRows -Columns @('フォルダー', 'サイズ', '割合')
        $largeRows = @()
        $largeSorted = $stats.LargeFiles | Sort-Object Bytes -Descending | Select-Object -First 40
        foreach ($f in $largeSorted) {
            $largeRows += [pscustomobject]@{ サイズ = (Format-Size $f.Bytes); 更新日 = $f.Modified.ToString('yyyy/MM/dd'); ファイル = $f.Path }
        }
        $t2 = ConvertTo-SimpleTable -Rows $largeRows -Columns @('サイズ', '更新日', 'ファイル') -EmptyMessage ($LargeFileMB.ToString() + ' MB 以上のファイルはありませんでした')
        $html = '<h3>ユーザーフォルダー（' + (HtmlEnc $profile) + '）の内訳 上位20　合計 ' + (Format-Size $stats.TotalBytes) + ' / ' + $stats.FileCount.ToString('N0') + ' ファイル</h3>' + $t1.Html +
                '<h3>' + $LargeFileMB + ' MB 以上の大きいファイル（上位40）</h3>' + $t2.Html
        $text = '  [内訳 上位20]  合計 ' + (Format-Size $stats.TotalBytes) + "`r`n" + $t1.Text + "`r`n  [大きいファイル 上位40]`r`n" + $t2.Text
        Add-Section -Title '5. ユーザーフォルダーの内訳と大きいファイル' -Html $html -Text $text -Note '動画・ISO・古いバックアップ・ダウンロードしたインストーラー（.exe/.msi/.zip）は、消しても困らないことが多いものです。'
        $script:Summary['profileBytes'] = $stats.TotalBytes
        $script:Summary['profileTop'] = @($topRows | Select-Object -First 10 | ForEach-Object { [ordered]@{ folder = $_.'フォルダー'; size = $_.'サイズ' } })
        $script:Summary['largeFiles'] = @($largeSorted | Select-Object -First 15 | ForEach-Object { [ordered]@{ path = $_.Path; bytes = $_.Bytes; modified = $_.Modified.ToString('yyyy-MM-dd') } })

        # ダウンロードフォルダー
        $dl = Join-Path $profile 'Downloads'
        if ($stats.TopSizes.ContainsKey('Downloads') -and $stats.TopSizes['Downloads'] -ge 5GB) {
            Add-Finding -Level '低' -Title ('ダウンロードフォルダーが ' + (Format-Size $stats.TopSizes['Downloads']) + ' あります') `
                -Detail 'ダウンロードフォルダーには、一度使っただけのインストーラーや資料がたまりがちです。' `
                -Action 'エクスプローラーでダウンロードフォルダーを開き、「サイズ」順に並べ替えて、不要なものを削除してください。'
        }
        $installers = @($stats.LargeFiles | Where-Object { $_.Path -match '\.(exe|msi|iso|zip|7z|rar|dmg)$' })
        if ($installers.Count -gt 0) {
            $isum = ($installers | Measure-Object Bytes -Sum).Sum
            Add-Finding -Level '低' -Title ('大きなインストーラー・圧縮ファイルが ' + $installers.Count + ' 個（合計 ' + (Format-Size $isum) + '）あります') `
                -Detail 'インストール済みのアプリの .exe / .msi や、展開済みの .zip は残しておく必要がありません。' `
                -Action '「5. 大きいファイル」の一覧を見て、心当たりのないものや使い終わったものを削除してください。'
        }
    }
}

# ============================================================
# 6. メモリとプロセス
# ============================================================
Invoke-Check -Name '6. メモリの使用状況と、重いアプリ' -Script {
    $memRows = @()
    $availPct = $null
    if ($script:IsWindowsOS) {
        $os = Get-CimInstance Win32_OperatingSystem
        $totalKB = $os.TotalVisibleMemorySize; $freeKB = $os.FreePhysicalMemory
        $availPct = [math]::Round($freeKB / $totalKB * 100, 1)
        $memRows += [pscustomobject]@{ 項目 = 'メモリ合計'; 値 = (Format-Size ($totalKB * 1KB)) }
        $memRows += [pscustomobject]@{ 項目 = '使用中'; 値 = (Format-Size (($totalKB - $freeKB) * 1KB)) + ('（' + [math]::Round(100 - $availPct, 1) + ' %）') }
        $memRows += [pscustomobject]@{ 項目 = '空き'; 値 = (Format-Size ($freeKB * 1KB)) + ('（' + $availPct + ' %）') }
        $script:Summary['memoryFreePct'] = $availPct
    }
    $procs = Get-Process -ErrorAction SilentlyContinue
    $grouped = $procs | Group-Object ProcessName | ForEach-Object {
        $ws = ($_.Group | Measure-Object WorkingSet64 -Sum).Sum
        $cpuSec = ($_.Group | Measure-Object CPU -Sum -ErrorAction SilentlyContinue).Sum
        [pscustomobject]@{ Name = $_.Name; Count = $_.Count; WS = $ws; CPU = $cpuSec }
    } | Sort-Object WS -Descending | Select-Object -First 15
    $procRows = @()
    foreach ($g in $grouped) {
        $procRows += [pscustomobject]@{ アプリ = $g.Name; プロセス数 = $g.Count; メモリ使用量 = (Format-Size $g.WS); 'CPU累計(秒)' = [math]::Round([double]$g.CPU, 0) }
    }
    $t1 = ConvertTo-SimpleTable -Rows $memRows -Columns @('項目', '値')
    $t2 = ConvertTo-SimpleTable -Rows $procRows -Columns @('アプリ', 'プロセス数', 'メモリ使用量', 'CPU累計(秒)')
    Add-Section -Title '6. メモリの使用状況と、重いアプリ' -Html ($t1.Html + '<h3>メモリを多く使っているアプリ 上位15（同じ名前はまとめて集計）</h3>' + $t2.Html) -Text ($t1.Text + "`r`n  [重いアプリ 上位15]`r`n" + $t2.Text) `
        -Note 'ブラウザ（chrome / msedge）はタブごとにプロセスが増えます。タブを閉じるだけでメモリが戻ります。'
    $script:Summary['topProcesses'] = @($grouped | Select-Object -First 8 | ForEach-Object { [ordered]@{ name = $_.Name; count = $_.Count; memory = (Format-Size $_.WS) } })
    if ($null -ne $availPct -and $availPct -lt 15) {
        Add-Finding -Level '中' -Title ('メモリの空きが ' + $availPct + ' % しかありません（診断を実行した時点）') `
            -Detail 'メモリが足りなくなると、Windows はディスクを代わりに使い始めるため、全体がガクッと遅くなります。' `
            -Action '上の「重いアプリ」で上位にあるもののうち、今使っていないものを閉じる。常駐しているなら「7. スタートアップ」で自動起動を止める。'
    }
}

# ============================================================
# 7. スタートアップアプリ
# ============================================================
Invoke-Check -Name '7. スタートアップ（自動起動）アプリ' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $approvedPaths = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32'
    )
    $approved = @{}
    foreach ($ap in $approvedPaths) {
        try {
            $key = Get-Item -Path $ap -ErrorAction Stop
            foreach ($vn in $key.GetValueNames()) {
                $bytes = $key.GetValue($vn)
                if ($bytes -is [byte[]] -and $bytes.Length -gt 0) {
                    # 先頭バイトが 2 → 有効、3 → 無効（タスクマネージャーの表示と同じ）
                    $approved[$vn.ToLowerInvariant()] = $(if ($bytes[0] -eq 2) { '有効' } elseif ($bytes[0] -eq 3) { '無効' } else { '不明' })
                }
            }
        } catch { }
    }
    $sc = Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue
    $rows = @()
    $enabledCount = 0
    foreach ($s in $sc) {
        $status = '有効'
        $k = ([string]$s.Name).ToLowerInvariant()
        if ($approved.ContainsKey($k)) { $status = $approved[$k] }
        else {
            # スタートアップフォルダーのショートカットはファイル名で登録される
            foreach ($ak in $approved.Keys) { if ($k -like ($ak -replace '\.lnk$', '') ) { $status = $approved[$ak]; break } }
        }
        if ($status -eq '有効') { $enabledCount++ }
        $rows += [pscustomobject]@{ 名前 = $s.Name; 状態 = $status; コマンド = $s.Command; 登録場所 = $s.Location; ユーザー = $s.User }
    }
    $rows = $rows | Sort-Object 状態, 名前
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('名前', '状態', 'コマンド', '登録場所')
    Add-Section -Title '7. スタートアップ（自動起動）アプリ' -Html $t.Html -Text $t.Text -Note ('有効: ' + $enabledCount + ' 個。パソコンの起動が遅い最大の原因になりやすい項目です。')
    $script:Summary['startupEnabled'] = $enabledCount
    $script:Summary['startupApps'] = @($rows | Where-Object { $_.'状態' -eq '有効' } | ForEach-Object { $_.'名前' })
    if ($enabledCount -ge 8) {
        Add-Finding -Level '中' -Title ('自動起動するアプリが ' + $enabledCount + ' 個あります') `
            -Detail '起動時に自動で立ち上がるアプリが多いほど、起動が遅くなり、常にメモリを使い続けます。「通信ソフト」「クラウド同期」「メーカー製ユーティリティ」「更新チェッカー」などが典型です。' `
            -Action 'スタートボタンを右クリック → タスク マネージャー → 「スタートアップ アプリ」で、毎日使わないものを右クリック → 「無効化」。（無効にしてもアプリ自体は消えません。必要な時に自分で起動すればOK）'
    } elseif ($enabledCount -ge 4) {
        Add-Finding -Level '低' -Title ('自動起動するアプリが ' + $enabledCount + ' 個あります') `
            -Detail '毎日使わないアプリまで自動起動していないか確認する価値があります。' `
            -Action 'タスク マネージャー → 「スタートアップ アプリ」で、「スタートアップへの影響」が「高」のものから見直してください。'
    }
}

# ============================================================
# 8. Windows Update と再起動待ち
# ============================================================
Invoke-Check -Name '8. Windows Update の状態' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $hf = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending | Select-Object -First 10
    $rows = @()
    foreach ($h in $hf) {
        $rows += [pscustomobject]@{ 更新プログラム = $h.HotFixID; 種類 = $h.Description; 適用日 = $(if ($h.InstalledOn) { $h.InstalledOn.ToString('yyyy/MM/dd') } else { '' }) }
    }
    $latest = $hf | Where-Object { $_.InstalledOn } | Select-Object -First 1
    $pending = @()
    if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { $pending += 'コンポーネントの更新' }
    if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $pending += 'Windows Update' }
    $pfro = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' 'PendingFileRenameOperations'
    if ($null -ne $pfro -and @($pfro).Count -gt 0) { $pending += 'ファイルの置き換え' }
    $pendingText = if ($pending.Count -gt 0) { '再起動待ちあり（' + ($pending -join '、') + '）' } else { '再起動待ちなし' }
    $lastText = if ($latest) { $latest.InstalledOn.ToString('yyyy/MM/dd') } else { '(不明)' }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('更新プログラム', '種類', '適用日')
    $html = '<p>最後に更新プログラムが適用された日: <b>' + (HtmlEnc $lastText) + '</b>　／　' + (HtmlEnc $pendingText) + '</p>' + $t.Html
    Add-Section -Title '8. Windows Update の状態' -Html $html -Text ('  最終適用日: ' + $lastText + '  ' + $pendingText + "`r`n" + $t.Text) `
        -Note '最新かどうかは「設定 → Windows Update → 更新プログラムのチェック」で確認できます。'
    $script:Summary['lastUpdateDate'] = $lastText
    $script:Summary['rebootPending'] = ($pending.Count -gt 0)
    if ($pending.Count -gt 0) {
        Add-Finding -Level '中' -Title '更新プログラムの適用が「再起動待ち」になっています' `
            -Detail '再起動するまで更新が完了せず、その間はパソコンが不安定になったり遅くなったりすることがあります。' `
            -Action 'スタート → 電源 → 「更新して再起動」を実行してください。'
    }
    if ($latest -and ((Get-Date) - $latest.InstalledOn).TotalDays -gt 45) {
        Add-Finding -Level '中' -Title ('更新プログラムが ' + [int]((Get-Date) - $latest.InstalledOn).TotalDays + ' 日間適用されていません') `
            -Detail 'Windows の更新は通常、月に1回は配信されます。長く止まっている場合、更新が失敗し続けている可能性があります。' `
            -Action '設定 → Windows Update → 「更新プログラムのチェック」。エラーが出る場合は空き容量不足のことが多いので、先に容量を確保してください。'
    }
}

# ============================================================
# 9. セキュリティ
# ============================================================
Invoke-Check -Name '9. セキュリティ（Defender・ファイアウォール）' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $rows = @()
    $mp = $null
    try { $mp = Get-MpComputerStatus -ErrorAction Stop } catch { }
    if ($mp) {
        $sigAge = $null
        if ($mp.AntivirusSignatureLastUpdated) { $sigAge = [int]((Get-Date) - $mp.AntivirusSignatureLastUpdated).TotalDays }
        $rows += [pscustomobject]@{ 項目 = 'Microsoft Defender ウイルス対策'; 状態 = $(if ($mp.AntivirusEnabled) { '有効' } else { '無効（他社製ソフトを使っている場合は正常）' }) }
        $rows += [pscustomobject]@{ 項目 = 'リアルタイム保護'; 状態 = $(if ($mp.RealTimeProtectionEnabled) { '有効' } else { '無効' }) }
        $rows += [pscustomobject]@{ 項目 = 'ウイルス定義の最終更新'; 状態 = $(if ($mp.AntivirusSignatureLastUpdated) { $mp.AntivirusSignatureLastUpdated.ToString('yyyy/MM/dd HH:mm') + '（' + $sigAge + ' 日前）' } else { '不明' }) }
        $rows += [pscustomobject]@{ 項目 = '最後のクイックスキャン'; 状態 = $(if ($mp.QuickScanEndTime) { $mp.QuickScanEndTime.ToString('yyyy/MM/dd HH:mm') } else { '記録なし' }) }
        $rows += [pscustomobject]@{ 項目 = '最後のフルスキャン'; 状態 = $(if ($mp.FullScanEndTime) { $mp.FullScanEndTime.ToString('yyyy/MM/dd HH:mm') } else { '記録なし' }) }
        $script:Summary['defenderEnabled'] = [bool]$mp.AntivirusEnabled
        $script:Summary['defenderSignatureAgeDays'] = $sigAge
        if ($mp.AntivirusEnabled -and $null -ne $sigAge -and $sigAge -gt 7) {
            Add-Finding -Level '高' -Title ('ウイルス定義ファイルが ' + $sigAge + ' 日間更新されていません') `
                -Detail '定義ファイルは通常、毎日自動更新されます。止まっている場合、新しいウイルスを検知できません。' `
                -Action '設定 → プライバシーとセキュリティ → Windows セキュリティ → ウイルスと脅威の防止 → 「保護の更新」→「更新プログラムのチェック」。'
        }
        if ($mp.AntivirusEnabled -and -not $mp.RealTimeProtectionEnabled) {
            Add-Finding -Level '高' -Title 'リアルタイム保護が無効になっています' `
                -Detail 'ファイルを開いた瞬間にウイルスを止める機能が止まっています。' `
                -Action 'Windows セキュリティ → ウイルスと脅威の防止 → 設定の管理 → 「リアルタイム保護」をオン。'
        }
    } else {
        $rows += [pscustomobject]@{ 項目 = 'Microsoft Defender'; 状態 = '情報を取得できませんでした（他社製ソフト使用中の可能性）' }
    }
    try {
        $fw = Get-NetFirewallProfile -ErrorAction Stop
        foreach ($p in $fw) {
            $rows += [pscustomobject]@{ 項目 = ('ファイアウォール（' + $p.Name + '）'); 状態 = $(if ($p.Enabled) { '有効' } else { '無効' }) }
            if (-not $p.Enabled) {
                Add-Finding -Level '中' -Title ('ファイアウォール（' + $p.Name + '）が無効です') -Detail '外部からの不正な通信を防ぐ機能が止まっています。' -Action 'Windows セキュリティ → ファイアウォールとネットワーク保護 で有効にしてください。'
            }
        }
    } catch { $rows += [pscustomobject]@{ 項目 = 'ファイアウォール'; 状態 = '取得できず' } }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('項目', '状態')
    Add-Section -Title '9. セキュリティ' -Html $t.Html -Text $t.Text
}

# ============================================================
# 10. バッテリー
# ============================================================
Invoke-Check -Name '10. バッテリー' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $bat) {
        Add-Section -Title '10. バッテリー' -Html '<p class="muted">バッテリーは見つかりませんでした（デスクトップPCの場合は正常です）。</p>' -Text '  バッテリーなし'
        $script:Summary['battery'] = $null
        return
    }
    $rows = @()
    $statusMap = @{ 1 = '放電中（バッテリー駆動）'; 2 = '電源接続中'; 3 = '満充電'; 4 = '残りわずか'; 5 = '残り危険'; 6 = '充電中'; 7 = '充電中（高）'; 8 = '充電中（低）'; 9 = '充電中（危険）'; 10 = '不明'; 11 = '部分充電' }
    $st = $statusMap[[int]$bat.BatteryStatus]; if (-not $st) { $st = [string]$bat.BatteryStatus }
    $rows += [pscustomobject]@{ 項目 = '現在の残量'; 値 = ([string]$bat.EstimatedChargeRemaining + ' %') }
    $rows += [pscustomobject]@{ 項目 = '状態'; 値 = $st }
    $design = $null; $full = $null; $cycles = $null
    $xmlPath = Join-Path $OutputDir 'battery-report.xml'
    $htmlPath = Join-Path $OutputDir 'battery-report.html'
    try {
        & powercfg.exe /batteryreport /xml /output "$xmlPath" 2>&1 | Out-Null
        & powercfg.exe /batteryreport /output "$htmlPath" 2>&1 | Out-Null
        if (Test-Path -LiteralPath $xmlPath) {
            [xml]$x = Get-Content -LiteralPath $xmlPath -Raw
            $b = $x.BatteryReport.Batteries.Battery | Select-Object -First 1
            if ($b) {
                $design = [double]$b.DesignCapacity; $full = [double]$b.FullChargeCapacity; $cycles = $b.CycleCount
            }
        }
    } catch { }
    if ($design -gt 0 -and $full -gt 0) {
        $healthPct = [math]::Round($full / $design * 100, 1)
        $rows += [pscustomobject]@{ 項目 = '設計容量（新品時）'; 値 = ([string]$design + ' mWh') }
        $rows += [pscustomobject]@{ 項目 = '現在の満充電容量'; 値 = ([string]$full + ' mWh') }
        $rows += [pscustomobject]@{ 項目 = 'バッテリーの健康度'; 値 = ($healthPct.ToString() + ' %（新品を100%とした場合）') }
        if ($cycles) { $rows += [pscustomobject]@{ 項目 = '充放電サイクル回数'; 値 = [string]$cycles } }
        $script:Summary['battery'] = [ordered]@{ chargePct = [int]$bat.EstimatedChargeRemaining; healthPct = $healthPct; designmWh = $design; fullChargemWh = $full; cycles = [string]$cycles }
        if ($healthPct -lt 60) {
            Add-Finding -Level '中' -Title ('バッテリーの健康度が ' + $healthPct + ' % まで落ちています') `
                -Detail '新品時の6割以下しか充電できなくなっています。持ち時間が大幅に短くなり、急に電源が落ちることもあります。' `
                -Action 'バッテリー交換を検討してください。詳しくは同じフォルダーの battery-report.html を参照。'
        } elseif ($healthPct -lt 80) {
            Add-Finding -Level '低' -Title ('バッテリーの健康度が ' + $healthPct + ' % です') `
                -Detail '劣化が進んでいます。すぐに交換が必要なほどではありません。' `
                -Action '可能なら、常に100%で電源につなぎっぱなしにせず、メーカーの「バッテリー保護モード」（80%で充電を止める設定）を使うと劣化を遅らせられます。'
        }
    } else {
        $rows += [pscustomobject]@{ 項目 = 'バッテリーの健康度'; 値 = '取得できず（battery-report.html があれば、そちらで確認できます）' }
        $script:Summary['battery'] = [ordered]@{ chargePct = [int]$bat.EstimatedChargeRemaining; healthPct = $null }
    }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('項目', '値')
    Add-Section -Title '10. バッテリー' -Html $t.Html -Text $t.Text -Note 'Windows標準の powercfg /batteryreport の結果をもとにしています。'
}

# ============================================================
# 11. 直近7日間のエラー記録
# ============================================================
Invoke-Check -Name '11. 直近7日間のエラー記録（イベントログ）' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $since = (Get-Date).AddDays(-7)
    $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Level = @(1, 2); StartTime = $since } -ErrorAction SilentlyContinue)
    $rows = @()
    $grouped = $events | Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 12
    foreach ($g in $grouped) {
        $sample = ($g.Group | Select-Object -First 1).Message
        if ($sample) { $sample = ($sample -replace '\s+', ' '); if ($sample.Length -gt 120) { $sample = $sample.Substring(0, 120) + '…' } }
        $rows += [pscustomobject]@{ 発生源 = $g.Name; 件数 = $g.Count; 例 = $sample }
    }
    $kernelPower = @($events | Where-Object { $_.ProviderName -eq 'Microsoft-Windows-Kernel-Power' -and $_.Id -eq 41 }).Count
    $diskErr = @($events | Where-Object { $_.ProviderName -in @('disk', 'Disk', 'Ntfs', 'volmgr', 'storahci', 'stornvme', 'iaStorA', 'iaStorAC', 'Microsoft-Windows-Ntfs') }).Count
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('発生源', '件数', '例') -EmptyMessage '直近7日間にエラー・重大な記録はありませんでした'
    $html = '<p>直近7日間のエラー・重大: <b>' + $events.Count + ' 件</b>　／　予期しない電源断（フリーズ・強制終了）: <b>' + $kernelPower + ' 回</b>　／　ディスク関連エラー: <b>' + $diskErr + ' 件</b></p>' + $t.Html
    Add-Section -Title '11. 直近7日間のエラー記録' -Html $html -Text ('  合計 ' + $events.Count + ' 件 / 予期しない電源断 ' + $kernelPower + ' 回 / ディスク関連 ' + $diskErr + ' 件' + "`r`n" + $t.Text) `
        -Note 'エラーが多少あるのは普通です。「予期しない電源断」や「ディスク関連」が繰り返し出ている場合だけ注意。'
    $script:Summary['errorEvents7d'] = $events.Count
    $script:Summary['unexpectedShutdowns7d'] = $kernelPower
    $script:Summary['diskErrors7d'] = $diskErr
    if ($diskErr -gt 0) {
        Add-Finding -Level '高' -Title ('ディスク関連のエラーが直近7日で ' + $diskErr + ' 件記録されています') `
            -Detail 'ディスクの読み書きに失敗した記録です。故障の前兆のことがあります。' `
            -Action '今すぐ大事なデータをバックアップしてください。繰り返す場合はディスク交換を検討。'
    }
    if ($kernelPower -ge 2) {
        Add-Finding -Level '中' -Title ('フリーズや強制終了による再起動が直近7日で ' + $kernelPower + ' 回あります') `
            -Detail '正常なシャットダウンを経ずに電源が切れた記録です。熱・電源・ドライバー・メモリのどれかに問題がある可能性があります。' `
            -Action '通気口のほこりを掃除する。電源ケーブルを確認する。頻発するならメーカーサポートへ。'
    }
}

# ============================================================
# 12. インストール済みアプリ
# ============================================================
Invoke-Check -Name '12. インストール済みアプリ' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $paths = @(
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $apps = @()
    foreach ($p in $paths) {
        $apps += Get-ItemProperty -Path $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and -not $_.SystemComponent }
    }
    $apps = $apps | Sort-Object DisplayName -Unique
    $rows = @()
    foreach ($a in ($apps | Sort-Object { [double]($_.EstimatedSize) } -Descending | Select-Object -First 30)) {
        $sz = if ($a.EstimatedSize) { Format-Size ([double]$a.EstimatedSize * 1KB) } else { '' }
        $inst = ''
        if ($a.InstallDate -and ([string]$a.InstallDate) -match '^(\d{4})(\d{2})(\d{2})$') { $inst = ($Matches[1] + '/' + $Matches[2] + '/' + $Matches[3]) }
        $rows += [pscustomobject]@{ アプリ = $a.DisplayName; サイズ = $sz; 発行元 = $a.Publisher; インストール日 = $inst; バージョン = $a.DisplayVersion }
    }
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('アプリ', 'サイズ', '発行元', 'インストール日', 'バージョン')
    Add-Section -Title '12. インストール済みアプリ（サイズの大きい順 上位30）' -Html ('<p>合計 ' + @($apps).Count + ' 個</p>' + $t.Html) -Text ('  合計 ' + @($apps).Count + ' 個' + "`r`n" + $t.Text) `
        -Note '使っていないアプリは 設定 → アプリ → インストールされているアプリ から削除できます。Microsoft Store アプリはこの一覧に含まれません。'
    $script:Summary['installedAppCount'] = @($apps).Count
    $script:Summary['largestApps'] = @($rows | Select-Object -First 10 | ForEach-Object { [ordered]@{ name = $_.'アプリ'; size = $_.'サイズ'; installed = $_.'インストール日' } })
}

# ============================================================
# 13. 電源設定
# ============================================================
Invoke-Check -Name '13. 電源設定' -Script {
    if (-not $script:IsWindowsOS) { throw 'Windows以外のOSでは取得できません' }
    $scheme = (& powercfg.exe /getactivescheme 2>&1 | Out-String).Trim()
    $hib = Get-RegValue 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled'
    $rows = @(
        [pscustomobject]@{ 項目 = '現在の電源プラン'; 値 = $scheme }
        [pscustomobject]@{ 項目 = '高速スタートアップ'; 値 = $(if ($hib -eq 1) { '有効' } elseif ($hib -eq 0) { '無効' } else { '不明' }) }
    )
    $t = ConvertTo-SimpleTable -Rows $rows -Columns @('項目', '値')
    Add-Section -Title '13. 電源設定' -Html $t.Html -Text $t.Text -Note 'Windows 11 の「電源モード」は 設定 → システム → 電源とバッテリー で変えられます。'
    $script:Summary['powerScheme'] = $scheme
}

# ============================================================
# 総合所見とレポート出力
# ============================================================
Write-Host ''
Write-Host 'レポートを書き出しています...' -ForegroundColor Cyan

$levelOrder = @{ '高' = 0; '中' = 1; '低' = 2; '情報' = 3 }
$sortedFindings = $script:Findings | Sort-Object { $levelOrder[$_.Level] }
$counts = @{ '高' = 0; '中' = 0; '低' = 0; '情報' = 0 }
foreach ($f in $sortedFindings) { $counts[$f.Level]++ }

if ($counts['高'] -gt 0) { $overall = '要対応'; $overallClass = 'bad'; $overallText = 'すぐに対応したほうがよい項目があります。' }
elseif ($counts['中'] -gt 0) { $overall = 'おおむね良好（改善の余地あり）'; $overallClass = 'warn'; $overallText = '大きな問題はありませんが、直すと快適になる項目があります。' }
elseif ($counts['低'] -gt 0) { $overall = '良好'; $overallClass = 'good'; $overallText = '軽い片付けをすればさらに快適になります。' }
else { $overall = 'とても良好'; $overallClass = 'good'; $overallText = '特に問題は見つかりませんでした。' }

$script:Summary['overall'] = $overall
$script:Summary['findingCounts'] = [ordered]@{ high = $counts['高']; medium = $counts['中']; low = $counts['低'] }
$script:Summary['findings'] = @($sortedFindings | ForEach-Object { [ordered]@{ level = $_.Level; title = $_.Title; detail = $_.Detail; action = $_.Action } })
$script:Summary['errors'] = @($script:Errors)
$script:Summary['generatedAt'] = $script:StartedAt.ToString('yyyy-MM-dd HH:mm:ss')
$script:Summary['scriptVersion'] = $script:ScriptVersion
$script:Summary['outputDir'] = $OutputDir

# --- HTML ---
$css = @'
body{font-family:"Yu Gothic UI","Meiryo UI","Segoe UI",sans-serif;margin:0;background:#f5f6f8;color:#1f2328}
.wrap{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 8px;padding-bottom:4px;border-bottom:2px solid #d0d7de}
h3{font-size:15px;margin:16px 0 6px}
.sub{color:#57606a;font-size:13px}
.overall{padding:16px 20px;border-radius:10px;margin:16px 0;font-size:16px}
.overall.good{background:#dafbe1;border:1px solid #2da44e}
.overall.warn{background:#fff8c5;border:1px solid #d4a72c}
.overall.bad{background:#ffebe9;border:1px solid #cf222e}
.overall b{font-size:20px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px;margin:6px 0}
th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-all}
th{background:#eaeef2;white-space:nowrap}
.muted{color:#57606a}
.note{background:#eef4ff;border-left:4px solid #0969da;padding:8px 12px;margin:8px 0;font-size:13px}
.finding{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:12px 14px;margin:10px 0}
.finding .t{font-weight:bold;font-size:15px}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;color:#fff;margin-right:8px;vertical-align:middle}
.b-高{background:#cf222e}.b-中{background:#bf8700}.b-低{background:#0969da}.b-情報{background:#57606a}
.finding .d{margin:6px 0;color:#424a53}
.finding .a{margin:6px 0;padding:8px 10px;background:#f6f8fa;border-radius:6px}
.finding .a::before{content:"やること: ";font-weight:bold}
footer{margin:40px 0 0;color:#57606a;font-size:12px}
'@

$sbH = New-Object System.Text.StringBuilder
[void]$sbH.AppendLine('<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PC健康診断レポート</title><style>' + $css + '</style></head><body><div class="wrap">')
[void]$sbH.AppendLine('<h1>PC健康診断レポート</h1><div class="sub">作成日時: ' + (HtmlEnc $script:StartedAt.ToString('yyyy/MM/dd HH:mm')) + '　／　パソコン: ' + (HtmlEnc $env:COMPUTERNAME) + '　／　スクリプト v' + $script:ScriptVersion + '　／　' + $(if ($script:IsAdmin) { '管理者権限で実行' } else { '標準権限で実行（一部項目は省略）' }) + '</div>')
[void]$sbH.AppendLine('<div class="overall ' + $overallClass + '">総合判定: <b>' + (HtmlEnc $overall) + '</b><br>' + (HtmlEnc $overallText) + '<br><span class="sub">要対応(高) ' + $counts['高'] + ' 件 ／ 改善推奨(中) ' + $counts['中'] + ' 件 ／ できれば(低) ' + $counts['低'] + ' 件</span></div>')
[void]$sbH.AppendLine('<h2>総合所見 — やるべきこと一覧</h2>')
if ($sortedFindings.Count -eq 0) {
    [void]$sbH.AppendLine('<p class="muted">指摘事項はありません。</p>')
} else {
    foreach ($f in $sortedFindings) {
        [void]$sbH.AppendLine('<div class="finding"><div class="t"><span class="badge b-' + $f.Level + '">' + $f.Level + '</span>' + (HtmlEnc $f.Title) + '</div><div class="d">' + (HtmlEnc $f.Detail) + '</div><div class="a">' + (HtmlEnc $f.Action) + '</div></div>')
    }
}
foreach ($s in $script:Sections) {
    [void]$sbH.AppendLine('<h2>' + (HtmlEnc $s.Title) + '</h2>')
    if ($s.Note) { [void]$sbH.AppendLine('<div class="note">' + (HtmlEnc $s.Note) + '</div>') }
    [void]$sbH.AppendLine($s.Html)
}
if ($script:Errors.Count -gt 0) {
    [void]$sbH.AppendLine('<h2>取得できなかった項目</h2><ul>')
    foreach ($e in $script:Errors) { [void]$sbH.AppendLine('<li>' + (HtmlEnc $e) + '</li>') }
    [void]$sbH.AppendLine('</ul>')
}
[void]$sbH.AppendLine('<footer>このレポートは「調べるだけ」のスクリプトで作成されました。ファイルの削除や設定変更は行っていません。<br>所要時間: ' + [int]((Get-Date) - $script:StartedAt).TotalSeconds + ' 秒</footer></div></body></html>')

# --- テキスト ---
$sbT = New-Object System.Text.StringBuilder
[void]$sbT.AppendLine('PC健康診断レポート  ' + $script:StartedAt.ToString('yyyy/MM/dd HH:mm') + '  ' + $env:COMPUTERNAME)
[void]$sbT.AppendLine('総合判定: ' + $overall + '  （高 ' + $counts['高'] + ' / 中 ' + $counts['中'] + ' / 低 ' + $counts['低'] + '）')
[void]$sbT.AppendLine('')
[void]$sbT.AppendLine('== 総合所見 ==')
foreach ($f in $sortedFindings) {
    [void]$sbT.AppendLine('[' + $f.Level + '] ' + $f.Title)
    [void]$sbT.AppendLine('    ' + $f.Detail)
    [void]$sbT.AppendLine('    → ' + $f.Action)
}
foreach ($s in $script:Sections) {
    [void]$sbT.AppendLine('')
    [void]$sbT.AppendLine('== ' + $s.Title + ' ==')
    if ($s.Note) { [void]$sbT.AppendLine('  (' + $s.Note + ')') }
    [void]$sbT.AppendLine($s.Text)
}

$htmlPath = Join-Path $OutputDir 'PC健康診断レポート.html'
$txtPath = Join-Path $OutputDir 'PC健康診断レポート.txt'
$jsonPath = Join-Path $OutputDir 'summary.json'
$utf8 = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($htmlPath, $sbH.ToString(), $utf8)
[System.IO.File]::WriteAllText($txtPath, $sbT.ToString(), $utf8)
[System.IO.File]::WriteAllText($jsonPath, ($script:Summary | ConvertTo-Json -Depth 6), $utf8)

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host ('  総合判定: ' + $overall) -ForegroundColor $(if ($overallClass -eq 'bad') { 'Red' } elseif ($overallClass -eq 'warn') { 'Yellow' } else { 'Green' })
Write-Host ('  要対応 ' + $counts['高'] + ' 件 / 改善推奨 ' + $counts['中'] + ' 件 / できれば ' + $counts['低'] + ' 件')
Write-Host '------------------------------------------------------------'
foreach ($f in $sortedFindings) { Write-Host ('  [' + $f.Level + '] ' + $f.Title) }
Write-Host '------------------------------------------------------------'
Write-Host ('  レポート: ' + $htmlPath)
Write-Host ('  テキスト: ' + $txtPath)
Write-Host ('  JSON   : ' + $jsonPath)
Write-Host '============================================================' -ForegroundColor Green

if (-not $NoOpen -and $script:IsWindowsOS) {
    try { Start-Process -FilePath $htmlPath | Out-Null } catch { }
}
if ($Pause) {
    Write-Host ''
    Read-Host 'Enter キーを押すと閉じます' | Out-Null
}
