import os
import json
import re
import threading
import urllib.request
import pytest
from playwright.sync_api import Page, expect
import time

# To run this test, ensure the app is running locally (e.g. on http://127.0.0.1:5000)
# Command: pytest tests/test_browser.py
# Override the target with KNS_BASE_URL if the app runs on another port.

BASE_URL = os.environ.get("KNS_BASE_URL", "http://127.0.0.1:5000")
MOCK_VOD_URL = "https://www.twitch.tv/videos/123456789"


def server_is_ready(url):
    try:
        with urllib.request.urlopen(url, timeout=1.5) as response:
            return b"KickNoSub" in response.read(2048)
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def ensure_local_server():
    if server_is_ready(BASE_URL):
        yield
        return

    from werkzeug.serving import make_server
    from app import app

    server = make_server("127.0.0.1", 5000, app)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    for _ in range(30):
        if server_is_ready(BASE_URL):
            break
        time.sleep(0.2)
    else:
        server.shutdown()
        pytest.fail(f"Impossible de démarrer le serveur local sur {BASE_URL}")

    yield
    server.shutdown()


def mock_player_routes(page: Page):
    def fulfill_json(route, payload):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(payload),
        )

    page.route("**/api/config", lambda route: fulfill_json(route, {
        "features": {
            "enable_twitch": True,
            "enable_kick": True,
            "enable_downloads": True,
            "enable_chat": True,
        },
        "playback": {
            "default_quality_height": 720,
            "max_proxy_quality_height": 720,
            "direct_twitch_native_hls": True,
        },
    }))
    page.route("**/api/get_stream", lambda route: fulfill_json(route, {
        "stream_url": "/mock/master.m3u8",
        "direct_stream_url": "/mock/direct.m3u8",
        "download_url": "/mock/master.m3u8",
        "is_twitch": True,
        "vod_id": "123456789",
        "storyboard": None,
        "metadata": {
            "session_title": "Mock Twitch VOD",
            "start_time": "2026-06-21T20:00:00Z",
            "duration": 600000,
            "views": 1234,
            "thumbnail": {"src": ""},
        },
        "channel": {
            "id": None,
            "slug": "mockstreamer",
            "login": "mockstreamer",
            "profile_pic": "",
        },
    }))
    page.route("**/api/twitch/streamer_vods?*", lambda route: fulfill_json(route, {
        "vods": [],
        "streamer": {"slug": "mockstreamer", "name": "Mock Streamer", "avatar": ""},
    }))
    page.route("**/api/twitch/chat?*", lambda route: fulfill_json(route, {
        "comments": [{
            "id": "chat-1",
            "offset": 0,
            "user": "tester",
            "color": "#53fc18",
            "badges": [],
            "frags": [{"text": "hello"}],
        }],
        "hasNext": False,
    }))
    page.route("**/api/log", lambda route: route.fulfill(status=204, body=""))
    page.route("**/mock/master.m3u8", lambda route: route.fulfill(
        status=200,
        content_type="application/vnd.apple.mpegurl",
        body=(
            "#EXTM3U\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720,CODECS=\"avc1.42e01e,mp4a.40.2\"\n"
            "/mock/720.m3u8\n"
        ),
    ))
    page.route("**/mock/720.m3u8", lambda route: route.fulfill(
        status=200,
        content_type="application/vnd.apple.mpegurl",
        body="#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\n/mock/seg0.ts\n#EXT-X-ENDLIST\n",
    ))
    page.route("**/mock/seg0.ts", lambda route: route.fulfill(
        status=200,
        content_type="video/mp2t",
        body=b"\x47" * 188,
    ))


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


def test_player_actions_with_mocked_vod(page: Page):
    mock_player_routes(page)
    page.goto(f"{BASE_URL}/?vod={MOCK_VOD_URL}")

    expect(page.locator("#player-section")).to_be_visible(timeout=10000)
    expect(page.locator(".stream-title")).to_have_text("Mock Twitch VOD")
    expect(page.locator("#quality-select-player")).to_contain_text("Auto")

    page.click("#download-btn")
    expect(page.locator("#download-modal")).to_be_visible()
    expect(page.locator("#download-m3u8-input")).to_have_value(re.compile(r"/mock/master\.m3u8"))
    expect(page.locator("#download-ffmpeg-input")).to_have_value(re.compile(r"ffmpeg .*mock/master\.m3u8"))
    page.click("#btn-close-download-modal")

    page.click("#btn-fav")
    expect(page.locator("#fav-count-badge")).to_have_text("1")

    page.click("#btn-more-actions")
    page.click("#btn-clipper")
    expect(page.locator("#clipper-modal")).to_be_visible()
    expect(page.locator("#clipper-cmd-input")).to_have_value(re.compile(r"00:00:00 -to 00:00:10"))
    page.click("#btn-close-clipper-modal")

    page.click("#btn-more-actions")
    page.click("#btn-copy-timecode")
    expect(page.locator("#copy-fallback-modal, .toast")).to_be_visible(timeout=3000)

    page.click('[data-action="navigate-history"]')
    expect(page.locator("#history-view")).to_be_visible()
    expect(page.locator("#history-grid")).to_contain_text("Mock Twitch VOD")

    page.click('[data-action="navigate-stats"]')
    expect(page.locator("#stats-view")).to_be_visible()
    expect(page.locator("#stats-grid")).to_contain_text("VOD")

    page.set_viewport_size({"width": 844, "height": 390})
    page.goto(f"{BASE_URL}/?vod={MOCK_VOD_URL}")
    expect(page.locator("#chat-overlay-btn")).to_be_visible(timeout=10000)
    page.click("#chat-overlay-btn")
    expect(page.locator("#vod-chat-sidebar")).to_have_class(re.compile(r"is-overlay"))
    expect(page.locator("#chat-messages")).to_contain_text("tester", timeout=6000)


def test_twitch_vod_loads_without_errors_and_bookmark_works(page: Page):
    """Garde-fou contre les bugs trouvés à l'audit : ReferenceError d'init
    (downloadModal, hlsPlayer), CSP qui bloque le worker hls.js, et boutons
    de fonctionnalités qui plantent. Charge une vraie VOD Twitch et vérifie
    qu'aucune erreur bloquante n'apparaît + que le marque-page écrit bien."""
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    mock_player_routes(page)
    page.goto(f"{BASE_URL}/?vod={MOCK_VOD_URL}")
    expect(page.locator(".stream-title")).to_have_text("Mock Twitch VOD", timeout=10000)
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
