<?php
// Single-page controller: render index.html and only switch the webinars block
// Condition: if contenuWebinars.html contains "Aucun webinar" (case-insensitive), show fallback block

$base = __DIR__;
$indexPath = $base . DIRECTORY_SEPARATOR . 'index.html';
$webinarsPath = $base . DIRECTORY_SEPARATOR . 'contenuWebinars.html';

if (!is_file($indexPath)) {
    http_response_code(500);
    echo 'index.html introuvable.';
    exit;
}

$html = file_get_contents($indexPath);
if ($html === false) {
    http_response_code(500);
    echo 'Impossible de lire index.html';
    exit;
}

$hasNoWebinars = false;
if (is_file($webinarsPath)) {
    $whtml = file_get_contents($webinarsPath);
    if ($whtml !== false) {
        $hasNoWebinars = (bool)preg_match('/Aucun\s+webinar/i', $whtml);
    }
}

// Webinars blocks
$blockNoWebinars = <<<HTML
                <!-- Webinars - Two Columns (Fallback: no upcoming webinars) -->
                <section class="webinars-two-col">
                    <div class="webinars-col-left">
                        <div class="sujette-title">Replays & Alertes</div>
                        <p class="font-size-14" style="margin: 14px 0 18px;">
                            Aucun webinar à venir pour le moment. Consultez nos replays et recevez une alerte pour les prochains.
                        </p>
                    </div>

                    <div class="webinars-col-right">
                        <a class="webinar-card" href="contenuWebinars.html">
                            <div class="webinar-card-media">
                                <i class="fas fa-circle-play" aria-hidden="true"></i>
                            </div>
                            <div class="webinar-card-body">
                                <h3>Voir tous les replays</h3>
                                <p class="font-size-14">Accédez aux enregistrements et ressources.</p>
                            </div>
                        </a>

                        <a class="webinar-card" href="inscription.html">
                            <div class="webinar-card-media alt">
                                <i class="fas fa-bell" aria-hidden="true"></i>
                            </div>
                            <div class="webinar-card-body">
                                <h3>Être averti des prochains webinars</h3>
                                <p class="font-size-14">Inscrivez-vous pour recevoir une notification.</p>
                            </div>
                        </a>
                    </div>
                </section>
HTML;

$blockHasWebinars = <<<HTML
                <!-- Webinars - Two Columns -->
                <section class="webinars-two-col">
                    <div class="webinars-col-left">
                        <div class="sujette-title">Webinars</div>
                        <p class="font-size-14" style="margin: 14px 0 18px;">
                            Découvrez nos sessions en ligne pour booster la performance documentaire.
                        </p>
                        <p>
                            <a class="kyo-btn" href="contenuWebinars.html">Voir les webinars</a>
                        </p>
                    </div>

                    <div class="webinars-col-right">
                        <a class="webinar-card" href="newsletter.html?page=3">
                            <div class="webinar-card-media">
                                <i class="fas fa-video" aria-hidden="true"></i>
                            </div>
                            <div class="webinar-card-body">
                                <h3>Spécial Cloud — 26 juin 2025</h3>
                                <p class="font-size-14">Comment booster sa performance documentaire grâce au Cloud ?</p>
                            </div>
                        </a>

                        <a class="webinar-card" href="contenuWebinars.html">
                            <div class="webinar-card-media alt">
                                <i class="fas fa-video" aria-hidden="true"></i>
                            </div>
                            <div class="webinar-card-body">
                                <h3>Tous les webinars</h3>
                                <p class="font-size-14">Agenda complet, replays et inscriptions.</p>
                            </div>
                        </a>
                    </div>
                </section>
HTML;

$chosen = $hasNoWebinars ? $blockNoWebinars : $blockHasWebinars;

// Replace the first <section class="webinars-two-col">...</section>
$pattern = '/<section[^>]*class=\"webinars-two-col\"[^>]*>.*?<\/section>/si';
$replaced = preg_replace($pattern, $chosen, $html, 1, $count);

if ($count === 0) {
    // If not found, output original HTML to avoid breaking the page
    echo $html;
} else {
    echo $replaced;
}