$src = "D:\شيماء"
$dest = "C:\Users\alaa1\.gemini\antigravity\scratch\college-project"

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
}

Get-ChildItem -LiteralPath $src -Recurse | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length)
    $target = Join-Path $dest $rel
    if ($_.PSIsContainer) {
        if (-not (Test-Path $target)) {
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        }
    } else {
        $parent = Split-Path $target
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
        }
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
}

Write-Host "COPIED_SUCCESSFULLY"
