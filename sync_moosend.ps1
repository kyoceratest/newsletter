# Configuration: GitHub repo and Pages base URL (edit here if repo/folder renamed)
$GitHubOwner = 'kyoceratest'
$GitHubRepo  = 'newsletter'
$PagesBaseUrl = "https://$GitHubOwner.github.io/$GitHubRepo"
# Normalize base URL (no trailing slash)
if ($PagesBaseUrl.EndsWith('/')) { $PagesBaseUrl = $PagesBaseUrl.TrimEnd('/') }

# Paths (restored)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $root 'index.html'
$tetePath = Join-Path $root 'teteSuperieure.html'
$gauchePath = Join-Path $root 'contenuDeGauche.html'
$centralPath = Join-Path $root 'contenuCentral.html'
$droitePath = Join-Path $root 'contenuDeDroite.html'
$templatePath = Join-Path $root 'moosend_template.html'

# Read files (force UTF-8 to preserve French diacritics)
$indexHtml = Get-Content -Path $indexPath -Raw -Encoding UTF8
$templateHtml = Get-Content -Path $templatePath -Raw -Encoding UTF8
$teteHtml = $null
if (Test-Path $tetePath) { $teteHtml = Get-Content -Path $tetePath -Raw -Encoding UTF8 }
$gaucheHtml = $null
if (Test-Path $gauchePath) { $gaucheHtml = Get-Content -Path $gauchePath -Raw -Encoding UTF8 }
$centralHtml = $null
if (Test-Path $centralPath) { $centralHtml = Get-Content -Path $centralPath -Raw -Encoding UTF8 }
$droiteHtml = $null
if (Test-Path $droitePath) { $droiteHtml = Get-Content -Path $droitePath -Raw -Encoding UTF8 }

# Normalize existing tile hrefs in template to the configured base URL
$templateHtml = $templateHtml -replace 'https://[^"\s]*/newsletter/newsletter\.html\?page=', "$PagesBaseUrl/newsletter.html?page="

# Option: serve images from GitHub Pages instead of jsDelivr (more predictable caching)
$UsePagesForImages = $true

# Choose image base URL accordingly and normalize existing references in the template
if ($UsePagesForImages) {
  $ImageBase = "$PagesBaseUrl/Image/"
  # Normalize any jsDelivr URLs to Pages base
  $templateHtml = $templateHtml -replace 'https://cdn\.jsdelivr\.net/gh/[^/]+/[^@]+@main/Image/', $ImageBase
  # Normalize any different host Pages URLs to the configured base
  $templateHtml = $templateHtml -replace 'https://[^"\s]*/newsletter/Image/', $ImageBase
} else {
  $ImageBase = "https://cdn.jsdelivr.net/gh/$GitHubOwner/$GitHubRepo@main/Image/"
  # Normalize any Pages URLs back to jsDelivr base
  $templateHtml = $templateHtml -replace 'https://[^"\s]*/newsletter/Image/', $ImageBase
}

# Extract helpers (singleline regex)
# Preferred: from teteSuperieure.html spans sized 52px (subject) and 22px (resume)
$subject = $null
$resume  = $null

if ($teteHtml) {
  # Collect all 52px spans and pick the first non-empty text
  $subjectSpans = [regex]::Matches($teteHtml, '<span[^>]*style=["''][^"'']*font-size\s*:\s*52px[^"'']*["''][^>]*>([\s\S]*?)</span>', 'Singleline, IgnoreCase')
  foreach ($m in $subjectSpans) {
    $txt = ($m.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
    if ($txt) { $subject = $txt; break }
  }

  # Collect all 22px spans and pick the first non-empty text
  $resumeSpans  = [regex]::Matches($teteHtml, '<span[^>]*style=["''][^"'']*font-size\s*:\s*22px[^"'']*["''][^>]*>([\s\S]*?)</span>', 'Singleline, IgnoreCase')
  foreach ($m in $resumeSpans) {
    $txt = ($m.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
    if ($txt) { $resume = $txt; break }
  }
}

# Fallback: index.html h1.title-accent and p.lead
if (-not $subject) {
  $subjectMatch = [regex]::Match($indexHtml, '<h1[^>]*class=["'']([^"'']*\btitle-accent\b[^"'']*)["''][^>]*>([\s\S]*?)</h1>', 'Singleline, IgnoreCase')
  if ($subjectMatch.Success) { $subject = ($subjectMatch.Groups[2].Value -replace '\s+', ' ').Trim() }
}
if (-not $resume) {
  $resumeMatch  = [regex]::Match($indexHtml, '<p[^>]*class=["'']([^"'']*\blead\b[^"'']*)["''][^>]*>([\s\S]*?)</p>', 'Singleline, IgnoreCase')
  if ($resumeMatch.Success) { $resume  = ($resumeMatch.Groups[2].Value  -replace '\s+', ' ').Trim() }
}

Write-Host "[sync_moosend.ps1] Extracted:" -ForegroundColor Cyan
if ($subject) { Write-Host "  - Subject: $subject" }
else { Write-Warning "  - Subject not found (52px span or h1.title-accent)" }
if ($resume) { Write-Host  "  - Resume:  $resume" }
else { Write-Warning "  - Resume not found (22px span or p.lead)" }

# Replace helpers (replace only first occurrence)
function Replace-First {
  param(
    [string]$Text,
    [string]$Pattern,
    [string]$Replacement,
    [System.Text.RegularExpressions.RegexOptions]$Options = [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  $regex = New-Object System.Text.RegularExpressions.Regex($Pattern, $Options)
  return $regex.Replace($Text, $Replacement, 1)
}

# HTML-encode to ensure accents and symbols render correctly in all clients
function HtmlEncode([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return $s }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int][char]$ch
    switch ($ch) {
      '&' { [void]$sb.Append('&amp;'); continue }
      '<' { [void]$sb.Append('&lt;'); continue }
      '>' { [void]$sb.Append('&gt;'); continue }
      '"' { [void]$sb.Append('&quot;'); continue }
      "'" { [void]$sb.Append('&#39;'); continue }
    }
    if ($code -gt 127) {
      [void]$sb.Append('&#').Append($code).Append(';')
    } else {
      [void]$sb.Append($ch)
    }
  }
  return $sb.ToString()
}

# Extract title/description from a content HTML file.
# - Title preference: first non-empty span with font-size:52px, else first <h2>/<h3>
# - Description preference: first <p><span style="font-size:14px">..</span></p>, else first non-empty <p>
function Extract-TitleDesc {
  param([string]$html)
  if ([string]::IsNullOrEmpty($html)) { return @('', '') }
  $title = ''
  $desc  = ''
  # Title from 52px span
  $titleSpans = [regex]::Matches($html, '<span[^>]*style=["''][^"'']*font-size\s*:\s*52px[^"'']*["''][^>]*>([\s\S]*?)</span>', 'Singleline, IgnoreCase')
  foreach ($m in $titleSpans) {
    $txt = ($m.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
    if ($txt) { $title = $txt; break }
  }
  if (-not $title) {
    $h = [regex]::Match($html, '<h[23][^>]*>([\s\S]*?)</h[23]>', 'Singleline, IgnoreCase')
    if ($h.Success) { $title = ($h.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim() }
  }
  # Description from 14px span paragraph
  $descSpans = [regex]::Matches($html, '<p[^>]*>\s*<span[^>]*style=["''][^"'']*font-size\s*:\s*14px[^"'']*["''][^>]*>([\s\S]*?)</span>\s*</p>', 'Singleline, IgnoreCase')
  foreach ($m in $descSpans) {
    $txt = ($m.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
    if ($txt) { $desc = $txt; break }
  }
  if (-not $desc) {
    $p = [regex]::Matches($html, '<p[^>]*>([\s\S]*?)</p>', 'Singleline, IgnoreCase')
    foreach ($m in $p) {
      $txt = ($m.Groups[1].Value -replace '<[^>]+>', '' -replace '\s+', ' ').Trim()
      if ($txt) { $desc = $txt; break }
    }
  }
  return @($title, $desc)
}

# Update one tile in the template identified by the page href.
function Update-Tile {
  param(
    [string]$html,
    [int]$page,
    [string]$title,
    [string]$desc
  )
  if (-not $title -and -not $desc) { return $html }
  $titleEnc = if ($title) { HtmlEncode $title } else { '' }
  $descEnc  = if ($desc)  { HtmlEncode $desc }  else { '' }
  # Build an href pattern matching the configured base URL
  $baseEsc = [regex]::Escape("$PagesBaseUrl/newsletter.html?page=")
  $href = $baseEsc + $page
  # Replace title <h3> that appears after the specific <a href> block
  if ($title) {
    $patternTitle = '(?s)(<a\s+href="' + $href + '"[^>]*>.*?</a>.*?<h3[^>]*>)([\s\S]*?)(</h3>)'
    $html = [regex]::Replace($html, $patternTitle, "`$1$titleEnc`$3", 1)
  }
  # Replace description <p> that appears after the same block
  if ($desc) {
    $patternDesc  = '(?s)(<a\s+href="' + $href + '"[^>]*>.*?</a>.*?<p[^>]*>)([\s\S]*?)(</p>)'
    $html = [regex]::Replace($html, $patternDesc, "`$1$descEnc`$3", 1)
  }
  return $html
}

if ($subject) {
  $subjectEnc = HtmlEncode $subject
  # <title>
  $templateHtml = Replace-First -Text $templateHtml -Pattern '(<title>)([\s\S]*?)(</title>)' -Replacement ("`$1$subjectEnc`$3") -Options ([System.Text.RegularExpressions.RegexOptions] 'Singleline, IgnoreCase')
  # first <h1>
  $templateHtml = Replace-First -Text $templateHtml -Pattern '(<h1[^>]*>)([\s\S]*?)(</h1>)' -Replacement ("`$1$subjectEnc`$3") -Options ([System.Text.RegularExpressions.RegexOptions] 'Singleline, IgnoreCase')
}

if ($resume) {
  $resumeEnc = HtmlEncode $resume
  # hidden preheader (first display:none div)
  $templateHtml = Replace-First -Text $templateHtml -Pattern '(<div\s+style=\"display:none;[\s\S]*?\">)([\s\S]*?)(</div>)' -Replacement ("`$1$resumeEnc`$3") -Options ([System.Text.RegularExpressions.RegexOptions] 'Singleline, IgnoreCase')
  # first paragraph
  $templateHtml = Replace-First -Text $templateHtml -Pattern '(<p[^>]*>)([\s\S]*?)(</p>)' -Replacement ("`$1$resumeEnc`$3") -Options ([System.Text.RegularExpressions.RegexOptions] 'Singleline, IgnoreCase')
}

# Update the 'Newsletter — <Month> <Year>' ribbon to NEXT month (French locale)
$fr = [System.Globalization.CultureInfo]::GetCultureInfo('fr-FR')
$nextDate = (Get-Date).AddMonths(1)
# Month names are lowercase in French; we capitalize the first letter for consistency with the template
$labelRaw = $nextDate.ToString('MMMM yyyy', $fr)
$ti = $fr.TextInfo
$labelCased = $ti.ToTitleCase($labelRaw)
$nextMonthLabel = HtmlEncode $labelCased
# Replace the first occurrence of the ribbon text after 'Newsletter — '
$templateHtml = Replace-First -Text $templateHtml -Pattern '(<div[^>]*>Newsletter\s+&#8212;\s+)([^<]+)(</div>)' -Replacement ("`$1$nextMonthLabel`$3") -Options ([System.Text.RegularExpressions.RegexOptions] 'Singleline, IgnoreCase')

# Charset meta injection not needed; template already has <meta charset="UTF-8"> and we HTML-encode text

# Write back (UTF-8)
# Update tiles from content files
if ($gaucheHtml) {
  $pair = Extract-TitleDesc -html $gaucheHtml
  $templateHtml = Update-Tile -html $templateHtml -page 2 -title $pair[0] -desc $pair[1]
}
if ($centralHtml) {
  $pair = Extract-TitleDesc -html $centralHtml
  $templateHtml = Update-Tile -html $templateHtml -page 3 -title $pair[0] -desc $pair[1]
}
if ($droiteHtml) {
  $pair = Extract-TitleDesc -html $droiteHtml
  $templateHtml = Update-Tile -html $templateHtml -page 4 -title $pair[0] -desc $pair[1]
}

# Optional: automatic cache-busting for Image/* URLs in the template (against the chosen base)
$EnableImageCacheBuster = $true
if ($EnableImageCacheBuster) {
  try {
    $cacheBust = (Get-Date).ToString('yyyyMMddHHmmss')
    $imgEsc = [regex]::Escape($ImageBase)
    $pattern = $imgEsc + '([^"'']+?\.(?:png|jpg|jpeg|svg|gif|webp))(?:\?[^"'']*)?'

    $evaluator = {
      param([System.Text.RegularExpressions.Match]$m)
      $filePart = $m.Groups[1].Value
      $full = $m.Value
      $baseFile = $using:ImageBase + $filePart
      if ($full -match '\?') {
        $qsIndex = $full.IndexOf('?')
        if ($qsIndex -ge 0) {
          $query = $full.Substring($qsIndex + 1)
          $pairs = @()
          if ($query) { $pairs = $query -split '&' | Where-Object { $_ -and ($_ -notmatch '^v=') } }
          $newq = ($pairs + ("v=" + $cacheBust)) -join '&'
          return $baseFile + '?' + $newq
        }
      }
      return $baseFile + '?v=' + $cacheBust
    }

    $templateHtml = [regex]::Replace($templateHtml, $pattern, $evaluator)
  } catch {
    Write-Warning "[sync_moosend.ps1] Cache-buster update failed (continuing)"
  }
}

Set-Content -Path $templatePath -Value $templateHtml -Encoding UTF8

# Auto-purge jsDelivr cache for ALL files in the Image/ folder so Moosend fetches the latest files
try {
  $imageDir = Join-Path $root 'Image'
  $extensions = @('*.png','*.jpg','*.jpeg','*.svg','*.gif','*.webp')
  $files = @()
  foreach ($ext in $extensions) {
    if (Test-Path $imageDir) {
      $files += Get-ChildItem -Path $imageDir -Filter $ext -File -ErrorAction SilentlyContinue
    }
  }
  $purgePaths = @()
  foreach ($f in $files) {
    # Build jsDelivr purge path: /gh/<owner>/<repo>@main/<relative-path>
    $rel = $f.FullName.Substring($root.Length).TrimStart('\\','/')
    $rel = $rel -replace '\\','/'
    $purgePaths += "/gh/$GitHubOwner/$GitHubRepo@main/" + $rel
  }
  if ($purgePaths.Count -gt 0) {
    $bodyJson = @{ path = $purgePaths } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri 'https://purge.jsdelivr.net/' -ContentType 'application/json' -Body $bodyJson | Out-Null
    Write-Host ("[sync_moosend.ps1] Purged jsDelivr cache for {0} images" -f $purgePaths.Count) -ForegroundColor Yellow
  } else {
    Write-Host "[sync_moosend.ps1] No images found to purge in Image/" -ForegroundColor Yellow
  }
} catch {
  Write-Warning "[sync_moosend.ps1] jsDelivr purge failed (continuing)"
}

Write-Host "[sync_moosend.ps1] Sync completed. Updated moosend_template.html" -ForegroundColor Green
