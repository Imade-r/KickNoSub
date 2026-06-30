"""Tests de l'API KickNoSub — chemins ne nécessitant pas le réseau Kick
(validation des entrées, en-têtes de sécurité, politique de cache)."""


def test_index_serves_html(client):
    r = client.get('/')
    assert r.status_code == 200
    assert b'KickNoSub' in r.data
    assert b'__CSP_NONCE__' not in r.data
    assert b'nonce="' in r.data
    assert b'style="' not in r.data


def test_security_headers_present(client):
    r = client.get('/')
    assert r.headers.get('X-Content-Type-Options') == 'nosniff'
    assert r.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert r.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'
    csp = r.headers.get('Content-Security-Policy', '')
    assert "'unsafe-inline'" not in csp
    assert "'unsafe-eval'" not in csp
    assert "'nonce-" in csp
    assert "script-src-attr 'none'" in csp
    assert "style-src-attr 'none'" in csp
    assert "object-src 'none'" in csp
    assert "frame-ancestors 'self'" in csp


def test_get_stream_rejects_non_kick_url(client):
    # Protection anti-SSRF : seules les URLs kick.com sont acceptées.
    r = client.post('/api/get_stream', json={'url': 'https://evil.example.com/x'})
    assert r.status_code == 400


def test_get_stream_requires_url(client):
    assert client.post('/api/get_stream', json={}).status_code == 400


def test_chat_missing_params(client):
    assert client.get('/api/chat').status_code == 400


def test_chat_rejects_non_numeric_channel_id(client):
    r = client.get('/api/chat', query_string={
        'channel_id': '123abc', 'start_time': '2024-01-01T00:00:00Z'})
    assert r.status_code == 400


def test_chat_rejects_malicious_start_time(client):
    r = client.get('/api/chat', query_string={
        'channel_id': '123', 'start_time': 'bad<script>'})
    assert r.status_code == 400


def test_streamer_vods_requires_slug(client):
    assert client.get('/api/streamer_vods').status_code == 400


def test_streamer_vods_rejects_invalid_slug(client):
    r = client.get('/api/streamer_vods', query_string={'slug': 'bad/slug here'})
    assert r.status_code == 400


def test_static_css_revalidated(client):
    r = client.get('/static/style.css')
    assert r.status_code == 200
    assert r.headers.get('Cache-Control') == 'no-cache'


def test_api_responses_not_stored(client):
    r = client.get('/api/chat')  # 400 mais les en-têtes de cache s'appliquent quand même
    assert r.headers.get('Cache-Control') == 'no-store'


def test_status_exposes_core_services_and_playback(client):
    r = client.get('/api/status')
    assert r.status_code == 200
    data = r.get_json()
    assert data["version"] == "1.4.0"
    assert {"kick", "twitch", "chat", "proxy", "downloads"} <= set(data["services"])
    assert data["playback"]["default_quality_height"] == 720
    assert data["playback"]["max_proxy_quality_height"] == 720
    assert data["playback"]["direct_twitch_native_hls"] is True


# ── Twitch ──

def test_get_stream_rejects_unknown_platform(client):
    r = client.post('/api/get_stream', json={'url': 'https://youtube.com/watch?v=x'})
    assert r.status_code == 400


def test_twitch_master_rejects_non_numeric_id(client):
    assert client.get('/api/twitch/master/abc.m3u8').status_code == 400


def test_twitch_proxy_rejects_non_twitch_host(client):
    # Anti-SSRF : le proxy ne doit accepter que les CDN Twitch.
    r = client.get('/api/twitch/playlist', query_string={'u': 'https://evil.example.com/x.m3u8'})
    assert r.status_code == 403
    r2 = client.get('/api/twitch/segment', query_string={'u': 'https://evil.example.com/0.ts'})
    assert r2.status_code == 403


def test_twitch_extract_vod_id():
    import twitch
    assert twitch.extract_vod_id('https://www.twitch.tv/videos/2807719385') == '2807719385'
    assert twitch.extract_vod_id('twitch.tv/xqc/v/123456') == '123456'
    assert twitch.extract_vod_id('https://kick.com/xqc/video/uuid') is None


def test_twitch_proxy_allows_cloudfront_host():
    import twitch
    assert twitch.is_allowed_proxy_url('https://abc.cloudfront.net/x/index-dvr.m3u8') is True
    assert twitch.is_allowed_proxy_url('https://evil.com/x.m3u8') is False


def test_twitch_chat_rejects_invalid_vod(client):
    assert client.get('/api/twitch/chat', query_string={'vod': 'abc'}).status_code == 400
    assert client.get('/api/twitch/chat').status_code == 400


def test_twitch_streamer_vods_rejects_invalid_login(client):
    assert client.get('/api/twitch/streamer_vods', query_string={'login': 'bad/name'}).status_code == 400
    assert client.get('/api/twitch/streamer_vods').status_code == 400


# ── Twitch Clips ──

def test_twitch_extract_clip_slug():
    import twitch
    # clips.twitch.tv format
    assert twitch.extract_clip_slug('https://clips.twitch.tv/FunnyClipName-abc123') == 'FunnyClipName-abc123'
    # twitch.tv/<channel>/clip/<slug> format
    assert twitch.extract_clip_slug('https://www.twitch.tv/xqc/clip/AmazingPlay123') == 'AmazingPlay123'
    # With query params
    assert twitch.extract_clip_slug('https://twitch.tv/shroud/clip/CoolClip?filter=all') == 'CoolClip'
    # Not a clip URL
    assert twitch.extract_clip_slug('https://www.twitch.tv/videos/2807719385') is None
    assert twitch.extract_clip_slug('https://kick.com/xqc/video/uuid') is None


def test_get_stream_accepts_clips_twitch_tv(client):
    """clips.twitch.tv URLs should be routed to Twitch, not rejected as non-Kick."""
    r = client.post('/api/get_stream', json={'url': 'https://clips.twitch.tv/TestSlug'})
    # 404 (clip not found on Twitch) is OK — the important thing is it's NOT 400 (invalid platform)
    assert r.status_code != 400
