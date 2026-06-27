import sys

file_path = "C:\\Users\\Boulsan\\Desktop\\KickNoSub-main\\web\\static\\index.html"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# keep lines up to 228 (0-indexed 227)
lines = lines[:228]

new_content = """<section class="player-section" id="player-section" style="display:none">
        <div class="container player-container">
            <div class="player-card glass-card">
                <div class="mobile-quality-bar">
                    <label for="quality_select_mobile">Qualité:</label>
                    <select id="quality_select_mobile" class="quality-select" data-action="change-quality">
                        <option value="chunked">Source</option>
                        <option value="1080p">1080p</option>
                        <option value="720p" selected>720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                        <option value="160p">160p</option>
                    </select>
                </div>
                <div class="video-wrapper" id="video-wrapper-container">
                    <video id="video_player" class="video-player" preload="auto" playsinline webkit-playsinline>
                        <p class="vjs-no-js">To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video.</p>
                    </video>
                    <div id="resume-prompt-overlay" class="resume-prompt-overlay" style="display: none;">
                        <div class="resume-prompt-card">
                            <div class="resume-prompt-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                            </div>
                            <h3>Continuer à regarder ?</h3>
                            <p>Reprendre à <span id="resume-time">0:00</span></p>
                            <div class="resume-prompt-buttons">
                                <button id="resume-btn" class="btn-resume">Reprendre</button>
                                <button id="start-over-btn" class="btn-start-over">Recommencer</button>
                            </div>
                        </div>
                    </div>
                    <div id="vod-game-container" style="margin: 4px 0 0; font-size: 0.8125rem; display: none;">
                        <a id="vod-game" href="#" style="color: var(--accent-primary, #9146ff); text-decoration: none;"></a>
                        <span id="vod-language" class="vod-language-tag" style="display: none; margin-left: 8px;">EN</span>
                    </div>
                    <div class="video-info-container">
                        <div class="video-info"></div>
                        <div id="player-action-btns" class="player-action-btns" style="display:none">
                            <button id="btn-fav" class="player-action-btn" title="Ajouter aux favoris">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                <span>Favoris</span>
                            </button>
                            <button id="btn-download" class="player-action-btn" title="Télécharger la VOD">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>Télécharger</span>
                            </button>
                            <button id="btn-copy-link" class="player-action-btn" title="Copier le lien">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                <span>Lien</span>
                            </button>
                            <button id="btn-share" class="player-action-btn" title="Partager">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                <span>Partager</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Support & Ads Container -->
                    <div class="monetization-container" style="margin-top: 16px; display: flex; flex-direction: column; gap: 16px;">
                        <!-- Donation CTA -->
                        <div class="support-banner glass-card" style="display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-left: 4px solid var(--accent-primary);">
                            <div>
                                <h4 style="margin:0 0 5px 0; color: var(--accent-primary); display: flex; align-items: center; gap: 8px;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                                    Soutenez KickNoSub !
                                </h4>
                                <p style="margin:0; font-size: 0.85rem; color: var(--text-secondary);">Ce site est 100% gratuit et sans pub intrusive. Un don m'aide à payer les serveurs !</p>
                            </div>
                            <a href="https://www.buymeacoffee.com/kicknosub" target="_blank" class="player-action-btn" style="background: var(--accent-primary); color: white; border: none; font-weight: bold; padding: 8px 16px; text-decoration: none;">
                                Faire un don
                            </a>
                        </div>
                        
                        <!-- Main Ad Slot (Banner 728x90) -->
                        <div class="ad-slot ad-slot-main">
                            <!-- [ADSTERRA/MONETAG MAIN BANNER CODE HERE] -->
                            <span class="ad-label">Emplacement Publicité (728x90)</span>
                        </div>
                    </div>
                </div>
                
                <div id="vod-chat-sidebar" class="vod-chat-sidebar">
                    <div class="chat-header-title" data-i18n="chat_title">Chat de la VOD</div>
                    
                    <!-- Chat Ad Slot (Banner 300x250 or Native) -->
                    <div class="ad-slot ad-slot-sidebar" style="margin-bottom: 10px;">
                        <!-- [ADSTERRA/MONETAG SIDEBAR BANNER CODE HERE] -->
                        <span class="ad-label">Emplacement Publicité (300x250)</span>
                    </div>

                    <div class="sidebar-content">
                        <div id="chat-tab-content" class="tab-content active">
                            <div id="chat-messages" class="chat-messages"></div>
                        </div>
                    </div>
                </div>
            </div>
    </section>

</main>

<footer class="footer">
    <div class="container">
        <div class="footer-content">
            <div class="footer-logo">
                <span>Kick<span class="gradient-text">NoSub</span></span>
            </div>
            
            <p class="footer-copy">
                Fait avec
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                © 2026 KickNoSub
            </p>
        </div>
    </div>
</footer>

<div class="toast-container"></div>

<!-- Download Modal -->
<div id="download-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
        <h2 style="margin-top:0; display:flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Télécharger la VOD
        </h2>
        <p style="color:var(--text-secondary); margin-bottom: 20px;">
            Les rediffusions Kick sont diffusées en direct via un flux M3U8. Pour télécharger le fichier vidéo complet (MP4), choisissez l'une des méthodes ci-dessous :
        </p>
        
        <div style="background: rgba(255,255,255,0.05); padding:16px; border-radius:8px; margin-bottom:16px;">
            <h4 style="margin:0 0 8px 0; color:var(--accent-primary);">Option 1 : Lien M3U8 Direct (Recommandé)</h4>
            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:6px;">À utiliser avec un logiciel comme VLC (Média > Convertir/Enregistrer) ou JDownloader sur PC.</p>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <strong>Sur Mobile :</strong> Installez l'application gratuite "1DM" (Android) ou "VLC" et collez-y ce lien.
            </p>
            <div style="display:flex; gap:8px;">
                <input type="text" id="download-m3u8-input" readonly style="flex-grow:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:8px 12px; border-radius:6px;">
                <button id="btn-copy-m3u8" class="player-action-btn" style="margin:0;">Copier</button>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding:16px; border-radius:8px; margin-bottom:24px;">
            <h4 style="margin:0 0 8px 0; color:#fff;">Option 2 : Ligne de commande FFmpeg</h4>
            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">Pour les utilisateurs avancés. Exécutez cette commande dans votre terminal PC.</p>
            <div style="display:flex; gap:8px;">
                <input type="text" id="download-ffmpeg-input" readonly style="flex-grow:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:8px 12px; border-radius:6px; font-family:monospace; font-size:0.8rem;">
                <button id="btn-copy-ffmpeg" class="player-action-btn" style="margin:0;">Copier</button>
            </div>
        </div>

        <div style="display:flex; justify-content:flex-end;">
            <button id="btn-close-download-modal" class="player-action-btn" style="background:rgba(255,255,255,0.1);">Fermer</button>
        </div>
    </div>
</div>

<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
<script src="/static/lang.js"></script>
<script src="/static/main.js"></script>
</body>
</html>
"""

lines.append(new_content)

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
