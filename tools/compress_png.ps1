param(
    [Parameter(Mandatory=$true)][string]$Path,
    [int]$TargetKB = 800,
    [int[]]$Widths = @(1600,1400,1200,1000,900,800,700,600)
)

$ErrorActionPreference = 'Stop'
if (!(Test-Path $Path)) { throw "File not found: $Path" }

# Backup
$backup = [System.IO.Path]::ChangeExtension($Path, '.backup.png')
Copy-Item $Path $backup -Force
Write-Host "Backup created: $backup"

Add-Type -AssemblyName System.Drawing

function Resize-Png($inPath, $maxW) {
    $img = [System.Drawing.Image]::FromFile($inPath)
    try {
        if ($img.Width -le $maxW) { return $false }
        $nw = [int]$maxW
        $nh = [int]([double]$img.Height * $nw / $img.Width)
        $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
        $gr = [System.Drawing.Graphics]::FromImage($bmp)
        $gr.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gr.DrawImage($img, 0, 0, $nw, $nh)
        $gr.Dispose()

        # Save to temp file first to avoid overwriting an open handle
        $dir = [System.IO.Path]::GetDirectoryName((Resolve-Path $inPath))
        $tmp = Join-Path $dir ("tmp_" + [System.IO.Path]::GetRandomFileName() + ".png")
        $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
    }
    finally {
        $img.Dispose()
    }
    # Now replace original with temp
    Move-Item -LiteralPath $tmp -Destination $inPath -Force
    return $true
}

foreach ($w in $Widths) {
    $size = (Get-Item $Path).Length
    Write-Host ("Current size: {0} KB" -f [Math]::Round($size/1KB))
    if ($size -le ($TargetKB*1KB)) { break }
    if (Resize-Png -inPath $Path -maxW $w) {
        $size2 = (Get-Item $Path).Length
        Write-Host ("After resize to {0}px => {1} KB" -f $w, [Math]::Round($size2/1KB))
        if ($size2 -le ($TargetKB*1KB)) { break }
    } else {
        Write-Host ("Image width already <= {0}px, skipping resize." -f $w)
    }
}

$final = (Get-Item $Path).Length
Write-Host ("Final size: {0} KB" -f [Math]::Round($final/1KB))
