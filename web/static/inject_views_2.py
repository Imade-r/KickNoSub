with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('<section class="hero">', '<div id="home-view" class="view-section active">\n<section class="hero">')
# Close home-view and add the other views right before player-section
views_html = '''
</div> <!-- end home-view -->
<div id="trending-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">
    <h1 data-i18n="trending_title" style="margin-bottom:20px;">Tendances</h1>
    <div id="trending-grid" class="trending-vods-grid-home"></div>
</div>
<div id="games-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">
    <h1 data-i18n="games_title" style="margin-bottom:20px;">Jeux</h1>
    <div id="games-grid" class="trending-vods-grid-home"></div>
</div>
<div id="faq-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">
    <h1 data-i18n="faq_title" style="margin-bottom:20px;">FAQ</h1>
    <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius); margin-bottom:10px;">
        <h3 data-i18n="faq_q1">Est-ce que c'est vraiment gratuit ?</h3>
        <p data-i18n="faq_a1" style="color:var(--text-muted);">Oui, KickNoSub permet de regarder les VODs sub-only sans abonnement.</p>
    </div>
    <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius); margin-bottom:10px;">
        <h3 data-i18n="faq_q2">Comment ça marche ?</h3>
        <p data-i18n="faq_a2" style="color:var(--text-muted);">Récupérez simplement le lien de la VOD sur Kick, collez-le ici et regardez avec le chat synchronisé !</p>
    </div>
</div>
<div id="history-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">
    <h1 data-i18n="history_title" style="margin-bottom:20px;">Historique</h1>
    <div id="history-grid" class="trending-vods-grid-home"></div>
</div>
'''
html = html.replace('<section class="player-section', views_html + '\n<section class="player-section')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
