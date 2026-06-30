import os
import pytest
from playwright.sync_api import Page, expect
import time

# To run this test, ensure the app is running locally (e.g. on http://127.0.0.1:5000)
# Command: pytest tests/test_browser.py
# Override the target with KNS_BASE_URL if the app runs on another port.

BASE_URL = os.environ.get("KNS_BASE_URL", "http://127.0.0.1:5000")

def test_home_page_language_and_tabs(page: Page):
    # Load the page
    page.goto(BASE_URL)
    
    # Check title
    expect(page).to_have_title("Regarder les VOD Kick et Twitch sans abonnement | KickNoSub")
    
    # 1. Change Language to English (les liens de langue sont directs, pas un menu)
    page.click('a[data-lang="en"]')
    # Wait for translation to apply
    time.sleep(1)

    # Verify a text changed
    expect(page.locator('#watch-now-btn span')).to_have_text("Watch now")
    
    # 2. Check Trending Tabs
    # Click Twitch trending tab
    page.click('button[data-tab="twitch-trending"]')
    # The Kick grid should be hidden, Twitch grid should be visible
    expect(page.locator('#trending-twitch-grid')).to_be_visible()
    
    # Click Kick trending tab
    page.click('button[data-tab="kick-trending"]')
    expect(page.locator('#trending-grid')).to_be_visible()

    # 3. Check Mobile Menu
    # Set viewport to mobile size
    page.set_viewport_size({"width": 375, "height": 812})
    # Wait for layout shift
    time.sleep(0.5)
    
    # Open mobile menu
    page.click('#mobileMenuToggle')
    # Menu should be visible
    expect(page.locator('.nav-links')).to_be_visible()
    
    # 4. Confirm no unwanted redirects (check URL is still same)
    assert page.url == f"{BASE_URL}/"

    print("Browser E2E test passed perfectly!")


def test_twitch_vod_loads_without_errors_and_bookmark_works(page: Page):
    """Garde-fou contre les bugs trouvés à l'audit : ReferenceError d'init
    (downloadModal, hlsPlayer), CSP qui bloque le worker hls.js, et boutons
    de fonctionnalités qui plantent. Charge une vraie VOD Twitch et vérifie
    qu'aucune erreur bloquante n'apparaît + que le marque-page écrit bien."""
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE_URL)
    vod = page.evaluate(
        """async () => {
            const r = await fetch('/api/trending?platform=twitch&lang=fr');
            const d = await r.json();
            return (d.trending && d.trending[0]) ? d.trending[0].url : null;
        }"""
    )
    if not vod:
        pytest.skip("Aucune VOD Twitch tendance disponible")

    page.goto(f"{BASE_URL}/?vod={vod}")
    page.wait_for_function(
        "() => (document.getElementById('video_player')?.duration || 0) > 0",
        timeout=20000,
    )
    page.wait_for_timeout(1500)

    blocking = [e for e in errors if "Content Security Policy" in e or "is not defined" in e]
    assert not blocking, f"Erreurs bloquantes au chargement: {blocking}"

    # Marque-page : ouvrir, titrer, sauver → doit écrire en localStorage
    page.evaluate("document.getElementById('video_player').currentTime = 60")
    page.evaluate("document.getElementById('btn-bookmark').click()")
    page.evaluate("document.getElementById('bookmark-title-input').value = 'Test'")
    page.evaluate("document.getElementById('btn-save-bookmark').click()")
    count = page.evaluate("JSON.parse(localStorage.getItem('kicknosub_bookmarks') || '[]').length")
    assert count > 0, "Le marque-page n'a pas été sauvegardé"
