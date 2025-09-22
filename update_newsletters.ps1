# Update contenuDeDroite.html
$filePath = "c:\Newsletter\remover ASP Done\contenuDeDroite.html"
$content = Get-Content -Path $filePath -Raw
$content = $content -replace '<title>.*?</title>', '<title>Les Nouvelles du Mois</title>'
$content = $content -replace '<h3[^>]*>.*?<\/h3>', '<h3 style=""><span style="line-height: 1.2;"><span style="font-size: 52px; line-height: 1.2; font-weight: bold;">Les Nouvelles du Mois</span></span></h3>'
$content = $content -replace '<p[^>]*>.*?<\/p>', '<p style="background-color: white;"><span style="font-size: 16px;">Découvrez les dernières actualités et événements importants de ce mois-ci.</span></p>'
Set-Content -Path $filePath -Value $content

# Update contenuDeGauche.html
$filePath = "c:\Newsletter\remover ASP Done\contenuDeGauche.html"
$content = Get-Content -Path $filePath -Raw
$content = $content -replace '<title>.*?</title>', '<title>Les Nouvelles du Mois</title>'
$content = $content -replace '<h3[^>]*>.*?<\/h3>', '<h3 style=""><span style="line-height: 1.2;"><span style="font-size: 52px; line-height: 1.2; font-weight: bold;">Les Nouvelles du Mois</span></span></h3>'
$content = $content -replace '<p[^>]*>.*?<\/p>', '<p style="background-color: white;"><span style="font-size: 16px;">Restez informé des dernières actualités et événements de ce mois-ci.</span></p>'
Set-Content -Path $filePath -Value $content

# Update contenuWebinars.html
$filePath = "c:\Newsletter\remover ASP Done\contenuWebinars.html"
$content = Get-Content -Path $filePath -Raw
$content = $content -replace '<title>.*?</title>', '<title>Les Nouvelles du Mois</title>'
$content = $content -replace '<h3[^>]*>.*?<\/h3>', '<h3 style=""><span style="line-height: 1.2;"><span style="font-size: 52px; line-height: 1.2; font-weight: bold;">Les Nouvelles du Mois</span></span></h3>'
$content = $content -replace '<p[^>]*>.*?<\/p>', '<p style="background-color: white;"><span style="font-size: 16px;">Découvrez nos webinaires et événements à venir ce mois-ci.</span></p>'
Set-Content -Path $filePath -Value $content

Write-Host "Tous les fichiers ont été mis à jour avec succès !"
