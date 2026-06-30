from flask import Flask, request, jsonify, send_from_directory, g
import cloudscraper
import os
import re
import time
import threading
import html as _html
import secrets
from urllib.parse import quote, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
import logging

import twitch
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')
APP_VERSION = "1.4.0"

DEFAULT_CONFIG = {
    "features": {
        "enable_twitch": True,
        "enable_kick": True,
        "enable_downloads": True,
        "enable_chat": True,
    },
    "monitoring": {"check_interval_seconds": 600},
    "playback": {
        "default_quality_height": 720,
        "max_proxy_quality_height": 720,
        "direct_twitch_native_hls": True,
    },
}

def get_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
    except Exception:
        raw = {}

    config = json.loads(json.dumps(DEFAULT_CONFIG))
    for section, values in (raw or {}).items():
        if isinstance(values, dict) and isinstance(config.get(section), dict):
            config[section].update(values)
        else:
            config[section] = values
    return config


def _playback_config():
    return get_config().get("playback", {})


def _variant_height(variant):
    try:
        return int(str(variant.get("resolution", "0x0")).split("x", 1)[1])
    except Exception:
        return 0


def _cap_variants_by_height(variants, max_height):
    try:
        max_height = int(max_height)
    except Exception:
        max_height = 0
    if max_height <= 0:
        return variants
    capped = [v for v in variants if _variant_height(v) and _variant_height(v) <= max_height]
    return capped or variants[-1:]

# Limite la taille des corps de requête (anti-abus / déni de service).
app.config['MAX_CONTENT_LENGTH'] = 256 * 1024  # 256 Ko

# Compression gzip des réponses texte (HTML/CSS/JS/JSON) si flask-compress est dispo.
# Import optionnel : l'app fonctionne même sans le paquet installé.
try:
    from flask_compress import Compress
    Compress(app)
except Exception:
    pass

scraper = cloudscraper.create_scraper()

_INDEX_PATH = os.path.join(app.static_folder, 'index.html')
_INLINE_STYLE_RE = re.compile(r'(<[^>]+?)\sstyle="([^"]*)"([^>]*>)', re.IGNORECASE)

# Rate limiting optionnel (protège les endpoints coûteux). Import facultatif :
# l'app fonctionne même sans flask-limiter installé.
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    limiter = Limiter(get_remote_address, app=app, storage_uri="memory://")
except Exception:
    limiter = None

def maybe_limit(rule):
    """Applique une limite si flask-limiter est dispo, sinon décorateur transparent."""
    return limiter.limit(rule) if limiter else (lambda f: f)


def _read_index_doc():
    with open(_INDEX_PATH, 'r', encoding='utf-8') as f:
        return f.read()


def _add_class_to_tag(tag, class_name):
    if re.search(r'\sclass="', tag, flags=re.IGNORECASE):
        return re.sub(
            r'\sclass="([^"]*)"',
            lambda m: f' class="{m.group(1)} {class_name}"',
            tag,
            count=1,
            flags=re.IGNORECASE,
        )
    if tag.endswith('/>'):
        return f'{tag[:-2]} class="{class_name}"/>'
    if tag.endswith('>'):
        return f'{tag[:-1]} class="{class_name}">'
    return tag


def _extract_inline_styles(doc, nonce):
    rules = []

    def repl(match):
        before, style, after = match.groups()
        class_name = f'kns-s{len(rules)}'
        rules.append(f'.{class_name}{{{_html.unescape(style)}}}')
        return _add_class_to_tag(before + after, class_name)

    doc = _INLINE_STYLE_RE.sub(repl, doc)
    if rules:
        style_block = f'<style nonce="{nonce}" id="kns-inline-styles">\n' + '\n'.join(rules) + '\n</style>\n'
        doc = doc.replace('</head>', style_block + '</head>', 1)
    return doc


def _prepare_html_response(doc, status=200):
    nonce = getattr(g, 'csp_nonce', '')
    doc = doc.replace('__CSP_NONCE__', nonce)
    doc = _extract_inline_styles(doc, nonce)
    return app.response_class(doc, status=status, mimetype='text/html')

def build_csp(nonce):
    return (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}' https://cdn.jsdelivr.net; "
        "script-src-attr 'none'; "
        f"style-src 'self' 'nonce-{nonce}' https://fonts.googleapis.com; "
        f"style-src-elem 'self' 'nonce-{nonce}' https://fonts.googleapis.com; "
        "style-src-attr 'none'; "
        "worker-src 'self' blob:; "
        "child-src 'self' blob:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: https:; "
        "connect-src 'self' https:; "
        "frame-src 'self'; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    )

# Extensions statiques que l'on peut mettre en cache long (elles changent rarement).
_LONG_CACHE_EXT = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf')


@app.before_request
def set_csp_nonce():
    g.csp_nonce = secrets.token_urlsafe(16)


@app.after_request
def add_security_and_cache_headers(response):
    # ── En-têtes de sécurité ──────────────────────────────────
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.setdefault('Content-Security-Policy', build_csp(getattr(g, 'csp_nonce', '')))

    # ── Cache : médias en cache long ; code (HTML/JS/CSS) revalidé pour éviter le stale ──
    path = request.path or ''
    if path.endswith(_LONG_CACHE_EXT):
        response.headers.setdefault('Cache-Control', 'public, max-age=604800')  # 7 jours
    elif path.startswith('/api/'):
        response.headers.setdefault('Cache-Control', 'no-store')
    else:
        # index.html, main.js, style.css… : revalidation via ETag (304), jamais périmé.
        response.headers.setdefault('Cache-Control', 'no-cache')
    return response

# ── Cache mémoire TTL pour les infos de chaîne ──
_channel_cache = {}
_cache_lock = threading.Lock()
CHANNEL_CACHE_TTL = 300  # 5 minutes

# ── Cache des URLs de stream résolues (évite de re-sonder ~33 URLs à chaque chargement) ──
_stream_cache = {}
_stream_lock = threading.Lock()
STREAM_CACHE_TTL = 1800  # 30 minutes

# ── Cache de résolution Twitch (variantes + métadonnées) par identifiant de VOD ──
_twitch_cache = {}
_twitch_lock = threading.Lock()
TWITCH_CACHE_TTL = 1800  # 30 minutes

def _fetch_with_backoff(url, method='GET', max_retries=3, **kwargs):
    retries = 0
    backoff = 1
    while retries <= max_retries:
        try:
            res = scraper.request(method, url, timeout=10, **kwargs)
            if res.status_code == 429:
                logger.warning(f"Rate limited (429) on {url}. Waiting {backoff}s...")
                time.sleep(backoff)
                retries += 1
                backoff *= 2
                continue
            return res
        except Exception as e:
            if retries == max_retries:
                logger.error(f"Error fetching {url}: {e}")
                return None
            time.sleep(backoff)
            retries += 1
            backoff *= 2
    return None

def get_kick_channel_info(channel_slug):
    now = time.time()
    with _cache_lock:
        cached = _channel_cache.get(channel_slug)
        if cached and now - cached[1] < CHANNEL_CACHE_TTL:
            return cached[0]

    url = f"https://kick.com/api/v1/channels/{channel_slug}"
    res = _fetch_with_backoff(url)
    if res and res.status_code == 200:
        data = res.json()
        with _cache_lock:
            _channel_cache[channel_slug] = (data, now)
        return data
    return None

def _check_stream_url(url):
    """Renvoie l'URL si elle répond 200, sinon None. Utilisé en parallèle."""
    try:
        res = scraper.head(url, timeout=5)
        if res.status_code == 200:
            return url
    except Exception:
        return None
    return None

def find_stream_url(channel_name, video_slug):
    # Cache : si l'URL de cette VOD a déjà été résolue récemment, on la réutilise.
    now = time.time()
    with _stream_lock:
        cached = _stream_cache.get(video_slug)
        if cached and now - cached[1] < STREAM_CACHE_TTL:
            return cached[0]

    channel = get_kick_channel_info(channel_name)
    if not channel or 'previous_livestreams' not in channel:
        return {"error": "Channel not found or no past streams available"}

    target_video = None
    for video_obj in channel.get('previous_livestreams', []):
        video = video_obj.get('video', {})
        if video and video.get('uuid') == video_slug:
            target_video = video_obj
            break

    if not target_video:
        return {"error": "Video not found"}

    thumbnail_url = target_video.get("thumbnail", {}).get("src", "")
    start_time_str = target_video.get("start_time")
    
    if not thumbnail_url or not start_time_str:
        return {"error": "Missing video metadata"}

    try:
        start_time = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
        path_parts = thumbnail_url.split("/")
        channel_id = path_parts[4]
        video_id = path_parts[5]

        base_urls = [
            "https://stream.kick.com/ivs/v1/196233775518",
            "https://stream.kick.com/3c81249a5ce0/ivs/v1/196233775518",
            "https://stream.kick.com/0f3cb0ebce7/ivs/v1/196233775518"
        ]

        # Construit toutes les URLs candidates (offsets × bases)
        candidates = []
        for offset in range(-5, 6):
            adjusted_time = start_time + timedelta(minutes=offset)
            for base in base_urls:
                candidates.append(
                    f"{base}/{channel_id}/{adjusted_time.year}/{adjusted_time.month}/"
                    f"{adjusted_time.day}/{adjusted_time.hour}/{adjusted_time.minute}/"
                    f"{video_id}/media/hls/master.m3u8"
                )

        # Teste les candidates en parallèle, renvoie la première qui répond
        found = None
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(_check_stream_url, u): u for u in candidates}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    found = result
                    break

        if found:
            result = {
                "stream_url": found,
                "metadata": target_video,
                "channel": {
                    "id": channel.get("id"),
                    "slug": channel.get("slug"),
                    "profile_pic": channel.get("user", {}).get("profile_pic")
                }
            }
            with _stream_lock:
                _stream_cache[video_slug] = (result, now)
            return result

        return {"error": "Could not find a valid stream within offset limits."}
    except Exception as e:
        return {"error": f"Internal error: {str(e)}"}

def find_clip_stream(clip_id):
    """Résout un clip Kick vers son URL de lecture via l'API clips."""
    url = f"https://kick.com/api/v2/clips/{clip_id}"
    try:
        res = scraper.get(url, timeout=10)
        if res.status_code != 200:
            return {"error": "Clip introuvable"}
        clip = res.json().get("clip") or res.json()
    except Exception as e:
        return {"error": f"Erreur clip : {str(e)}"}

    if not clip:
        return {"error": "Clip introuvable"}

    # L'API renvoie soit un HLS (video_url) soit un mp4 direct (clip_url)
    stream_url = clip.get("video_url") or clip.get("clip_url")
    if not stream_url:
        return {"error": "Aucune URL de lecture pour ce clip"}

    creator = clip.get("creator") or {}
    channel = clip.get("channel") or {}
    return {
        "stream_url": stream_url,
        "is_clip": True,
        "metadata": {
            "session_title": clip.get("title", "Clip Kick"),
            "views": clip.get("views", 0),
            "start_time": clip.get("created_at", ""),
            "duration": clip.get("duration", 0),
        },
        "channel": {
            "id": channel.get("id"),
            "slug": channel.get("slug") or creator.get("username", ""),
            "profile_pic": creator.get("profile_pic") or channel.get("profile_pic", ""),
        }
    }

def get_vod_meta(kick_url):
    """Métadonnées légères (titre, miniature, streamer) d'une VOD, pour les balises OG."""
    try:
        if not kick_url.startswith('http'):
            kick_url = 'https://' + kick_url
        # ── Twitch ──
        if 'twitch.tv' in kick_url:
            vod_id = twitch.extract_vod_id(kick_url)
            if not vod_id:
                return None
            video = twitch._gql_video(vod_id, scraper)
            if not video:
                return None
            owner = video.get('owner') or {}
            return {
                'title':     video.get('title') or 'VOD Twitch',
                'thumbnail': video.get('previewThumbnailURL') or '',
                'streamer':  owner.get('displayName') or owner.get('login') or 'Twitch',
            }
        # ── Kick ──
        if 'kick.com' not in kick_url or 'video' not in kick_url:
            return None
        parts = kick_url.split('/')
        channel_name = parts[3] if len(parts) > 3 else ''
        video_slug   = parts[5] if len(parts) > 5 else ''
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,30}', channel_name) or not video_slug:
            return None
        channel = get_kick_channel_info(channel_name)
        if not channel:
            return None
        for vo in channel.get('previous_livestreams', []):
            v = vo.get('video', {})
            if v and v.get('uuid') == video_slug:
                return {
                    'title':     vo.get('session_title') or 'VOD Kick',
                    'thumbnail': (vo.get('thumbnail') or {}).get('src', ''),
                    'streamer':  (channel.get('user') or {}).get('username', channel_name),
                }
    except Exception:
        return None
    return None

def _render_index_with_meta(vod_url):
    """Injecte titre/description/image OG dynamiques pour un partage de lien VOD riche."""
    meta = get_vod_meta(vod_url)
    if not meta:
        return None
    try:
        doc = _read_index_doc()
    except Exception:
        return None
    title = _html.escape(f"{meta['title']} — {meta['streamer']} | KickNoSub", quote=True)
    desc  = _html.escape(f"Regarde « {meta['title']} » de {meta['streamer']} sur KickNoSub, sans abonnement.", quote=True)
    img   = _html.escape(meta['thumbnail'] or '/static/logo.png', quote=True)

    def repl(pattern, value):
        return lambda d: re.sub(pattern, lambda m: m.group(1) + value + m.group(2), d, count=1)

    for fn in (
        repl(r'(<meta property="og:title" content=")[^"]*(")', title),
        repl(r'(<meta property="og:description" content=")[^"]*(")', desc),
        repl(r'(<meta property="og:image" content=")[^"]*(")', img),
        repl(r'(<meta name="twitter:title" content=")[^"]*(")', title),
        repl(r'(<meta name="twitter:description" content=")[^"]*(")', desc),
        repl(r'(<meta name="twitter:image" content=")[^"]*(")', img),
        repl(r'(<meta property="og:image:width" content=")[^"]*(")', '1280'),
        repl(r'(<meta property="og:image:height" content=")[^"]*(")', '720'),
    ):
        doc = fn(doc)
    doc = doc.replace('name="twitter:card" content="summary"', 'name="twitter:card" content="summary_large_image"')
    return doc

@app.route('/')
def index():
    vod = request.args.get('vod')
    if vod:
        rendered = _render_index_with_meta(vod)
        if rendered:
            return _prepare_html_response(rendered)
    return _prepare_html_response(_read_index_doc())

@app.route('/<path:path>')
def serve_static(path):
    # Ne jamais servir d'outillage/source non destiné au public.
    if path.rsplit('.', 1)[-1].lower() in ('py', 'pyc', 'pyo', 'md', 'txt', 'bak', 'log', 'env'):
        return "Not found", 404
    return send_from_directory('static', path)

def _resolve_twitch_cached(vod_id):
    """Résout une VOD Twitch avec cache (variantes + métadonnées)."""
    now = time.time()
    with _twitch_lock:
        cached = _twitch_cache.get(vod_id)
        if cached and now - cached[1] < TWITCH_CACHE_TTL:
            return cached[0]
    result = twitch.resolve(vod_id, scraper)
    if "error" not in result:
        with _twitch_lock:
            _twitch_cache[vod_id] = (result, now)
    return result


def _twitch_stream_response(url):
    """Construit la réponse get_stream (forme compatible Kick) pour une VOD ou un clip Twitch."""
    # ── Clips Twitch ──
    clip_slug = twitch.extract_clip_slug(url)
    if clip_slug:
        result = twitch.resolve_clip(clip_slug, scraper)
        if "error" in result:
            return jsonify(result), 404
        return jsonify(result)

    # ── VOD Twitch ──
    vod_id = twitch.extract_vod_id(url)
    if not vod_id:
        return jsonify({"error": "URL Twitch invalide (attendu twitch.tv/videos/... ou un clip)"}), 400
    result = _resolve_twitch_cached(vod_id)
    if "error" in result:
        return jsonify(result), 404
    meta = result["meta"]
    # URL brute du meilleur variant (CloudFront), utilisable par ffmpeg
    best_variant = result["variants"][0]["url"] if result.get("variants") else None
    return jsonify({
        "stream_url": f"/api/twitch/master/{vod_id}.m3u8",
        "direct_stream_url": best_variant,
        "is_twitch": True,
        "vod_id": vod_id,
        "storyboard": result.get("storyboard"),
        "download_url": best_variant,
        "metadata": {
            "session_title": meta["title"],
            "start_time":    meta["created_at"],
            "duration":      meta["duration"],
            "views":         meta["views"],
            "thumbnail":     {"src": meta["thumbnail"]},
        },
        "channel": {
            "id":          None,
            "slug":        meta["streamer"] or meta["login"],
            "login":       meta["login"],          # handle pour la recherche des autres VODs
            "profile_pic": meta["avatar"],
        },
    })


@app.route('/api/twitch/master/<vod_id>.m3u8', methods=['GET'])
@maybe_limit("60 per minute")
def twitch_master(vod_id):
    if not re.fullmatch(r'\d{1,15}', vod_id):
        return "Invalid vod id", 400
    result = _resolve_twitch_cached(vod_id)
    if "error" in result:
        return result["error"], 404
    playback = _playback_config()
    variants = _cap_variants_by_height(result["variants"], playback.get("max_proxy_quality_height", 720))
    proxy = lambda u: "/api/twitch/playlist?u=" + quote(u, safe="")
    playlist = twitch.build_master_playlist(variants, proxy)
    return app.response_class(playlist, mimetype="application/vnd.apple.mpegurl")


@app.route('/api/twitch/playlist', methods=['GET'])
@maybe_limit("300 per minute")
def twitch_playlist():
    u = unquote(request.args.get('u', ''))
    if not twitch.is_allowed_proxy_url(u):
        return "Forbidden", 403
    seg_proxy = lambda s: "/api/twitch/segment?u=" + quote(s, safe="")
    playlist = twitch.rewrite_media_playlist(u, scraper, seg_proxy)
    if playlist is None:
        return "Upstream error", 502
    return app.response_class(playlist, mimetype="application/vnd.apple.mpegurl")


@app.route('/api/twitch/streamer_vods', methods=['GET'])
@maybe_limit("30 per minute")
def twitch_streamer_vods():
    login = (request.args.get('login') or '').strip().lower()
    if not re.fullmatch(r'[a-z0-9_]{1,30}', login):
        return jsonify({"error": "Nom de chaîne Twitch invalide"}), 400
    data = twitch.get_streamer_vods(login, scraper)
    if not data:
        return jsonify({"error": f"Chaîne Twitch '{login}' introuvable"}), 404
    return jsonify(data)


@app.route('/api/twitch/chat', methods=['GET'])
@maybe_limit("150 per minute")
def twitch_chat():
    vod_id = request.args.get('vod', '')
    if not re.fullmatch(r'\d{1,15}', vod_id):
        return jsonify({"error": "invalid vod"}), 400
    cursor = request.args.get('cursor') or None
    offset = request.args.get('offset')
    result = twitch.get_chat(vod_id, scraper, offset=offset, cursor=cursor)
    return jsonify(result), (200 if "error" not in result else 502)


@app.route('/api/log', methods=['POST'])
@maybe_limit("30 per minute")
def client_log():
    """Reçoit les erreurs JavaScript runtime du navigateur pour les tracer côté
    serveur (observabilité). Tailles plafonnées, sans données sensibles."""
    data = request.get_json(silent=True) or {}
    msg    = str(data.get('message', ''))[:300]
    source = str(data.get('source', ''))[:200]
    line   = str(data.get('line', ''))[:10]
    stack  = str(data.get('stack', ''))[:600]
    if msg:
        logger.warning("[client] %s @ %s:%s\n%s", msg, source, line, stack)
    return ('', 204)


@app.route('/api/twitch/segment', methods=['GET'])
def twitch_segment():
    # Proxy en streaming des segments CDN Twitch (qui n'envoient pas de CORS).
    u = unquote(request.args.get('u', ''))
    if not twitch.is_allowed_proxy_url(u):
        return "Forbidden", 403
    try:
        upstream = scraper.get(u, stream=True, timeout=20)
    except Exception:
        return "Upstream error", 502
    if not upstream.ok:
        return "Upstream error", upstream.status_code

    def generate():
        try:
            for chunk in upstream.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    resp = app.response_class(generate(), mimetype=upstream.headers.get('Content-Type', 'video/mp2t'))
    cl = upstream.headers.get('Content-Length')
    if cl:
        resp.headers['Content-Length'] = cl
    resp.headers['Cache-Control'] = 'public, max-age=86400'  # segments VOD immuables
    return resp


@app.route('/api/get_stream', methods=['POST'])
@maybe_limit("20 per minute")
def get_stream():
    data = request.get_json(silent=True) or {}
    url = data.get('url', '')

    if "twitch.tv" in url or "clips.twitch.tv" in url:
        return _twitch_stream_response(url)

    if "kick.com" not in url:
        return jsonify({"error": "Lien invalide : colle une URL de VOD Kick ou Twitch."}), 400

    if not url.startswith("http"):
        url = "https://" + url

    # Détection des clips : kick.com/<streamer>/clips/clip_xxx, ?clip=clip_xxx, /clips/clip_xxx
    clip_match = re.search(r'(?:clips?/|clip=)(clip_[A-Za-z0-9]+)', url)
    if clip_match:
        result = find_clip_stream(clip_match.group(1))
        if "error" in result:
            return jsonify(result), 404
        return jsonify(result)

    # Basic URL parsing
    # Expected format: https://kick.com/video/e939a3ea-6020-4f51-b062-871034f5df55
    parts = url.split('/')
    if len(parts) >= 5 and "kick.com" in url and "video" in url:
        channel_name = parts[3]
        video_slug = parts[5] if len(parts) > 5 else parts[4]
        
        # If the URL is like https://kick.com/xqc/video/uuid
        if parts[4] == "video":
            channel_name = parts[3]
            video_slug = parts[5]
        # Or https://kick.com/video/uuid
        elif parts[3] == "video":
            return jsonify({"error": "Invalid URL format. Include the channel name e.g., kick.com/channel/video/uuid"}), 400
            
        result = find_stream_url(channel_name, video_slug)
        if "error" in result:
            return jsonify(result), 404
        return jsonify(result)
    
    return jsonify({"error": "Invalid Kick VOD URL provided."}), 400

@app.route('/api/chat', methods=['GET'])
@maybe_limit("90 per minute")
def get_chat():
    channel_id = request.args.get('channel_id', '')
    start_time = request.args.get('start_time', '')

    if not channel_id or not start_time:
        return jsonify({"error": "Missing parameters"}), 400

    # Validation stricte : empêche toute injection dans l'URL kick.com.
    # channel_id est un identifiant numérique ; start_time est une date ISO 8601.
    if not re.fullmatch(r'\d{1,15}', channel_id):
        return jsonify({"error": "Invalid channel_id"}), 400
    if not re.fullmatch(r'[0-9T:\-.Z+]{1,40}', start_time):
        return jsonify({"error": "Invalid start_time"}), 400

    url = f"https://kick.com/api/v2/channels/{channel_id}/messages?start_time={start_time}"
    try:
        res = scraper.get(url, timeout=10)
        return jsonify(res.json()), res.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/streamer_vods', methods=['GET'])
@maybe_limit("30 per minute")
def get_streamer_vods():
    slug = request.args.get('slug', '').strip().lower()
    if not slug:
        return jsonify({"error": "Nom du streamer manquant"}), 400
    # Pseudos Kick : lettres, chiffres, tirets et underscores uniquement.
    if not re.fullmatch(r'[a-z0-9_-]{1,30}', slug):
        return jsonify({"error": "Nom de streamer invalide"}), 400

    channel = get_kick_channel_info(slug)
    if not channel:
        return jsonify({"error": f"Streamer '{slug}' introuvable sur Kick"}), 404

    vods = []
    for stream in channel.get('previous_livestreams', []):
        video = stream.get('video', {})
        if not video or not video.get('uuid'):
            continue
        vods.append({
            'title':     stream.get('session_title') or 'Sans titre',
            'url':       f"https://kick.com/{slug}/video/{video['uuid']}",
            'thumbnail': (stream.get('thumbnail') or {}).get('src', ''),
            'date':      stream.get('start_time', ''),
            'duration':  stream.get('duration', 0),
            'views':     stream.get('views', 0),
        })

    return jsonify({
        'streamer': {
            'slug':   channel.get('slug', slug),
            'name':   (channel.get('user') or {}).get('username', slug),
            'avatar': (channel.get('user') or {}).get('profile_pic', ''),
        },
        'vods': vods
    })

@app.route('/api/categories', methods=['GET'])
def get_categories():
    try:
        # Fetch top categories
        url = "https://kick.com/api/v1/subcategories?limit=30"
        res = scraper.get(url, timeout=10)
        return jsonify(res.json()), res.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _fetch_streamer_latest_vod(slug):
    """Récupère la dernière rediff d'un streamer, format prêt pour le front."""
    channel = get_kick_channel_info(slug)
    if not channel:
        return None
    livestreams = channel.get('previous_livestreams', [])
    if not livestreams:
        return None
    latest = livestreams[0]
    video = latest.get('video', {})
    if not video or not video.get('uuid'):
        return None
    return {
        'title':     latest.get('session_title') or 'Sans titre',
        'url':       f"https://kick.com/{slug}/video/{video['uuid']}",
        'thumbnail': (latest.get('thumbnail') or {}).get('src', ''),
        'date':      latest.get('start_time', ''),
        'duration':  latest.get('duration', 0),
        'views':     latest.get('views', 0),
        'streamer':  (channel.get('user') or {}).get('username', slug),
        'slug':      slug,
        'avatar':    (channel.get('user') or {}).get('profile_pic', ''),
    }

TRENDING_CACHE = {}
CACHE_TTL = 600  # 10 minutes

@app.route('/api/trending', methods=['GET'])
def get_trending():
    platform = request.args.get('platform', 'kick').lower()
    lang = request.args.get('lang', 'en').lower()
    
    config = get_config()
    if platform == 'kick' and not config.get('features', {}).get('enable_kick', True):
        return jsonify({"error": "Kick is currently disabled."}), 503
    if platform == 'twitch' and not config.get('features', {}).get('enable_twitch', True):
        return jsonify({"error": "Twitch is currently disabled."}), 503
    
    cache_key = f"{platform}_{lang}"
    if cache_key in TRENDING_CACHE:
        data, timestamp = TRENDING_CACHE[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return jsonify({"trending": data}), 200

    # Regional top streamers mapping
    streamers_db = {
        'kick': {
            'fr': ['chowh1', 'yassencore', 'teufeurs', 'papesan', 'xqc', 'adinross'],
            'es': ['juansguarnizo', 'westcol', 'elxokas', 'markito', 'goncho', 'xqc'],
            'pt': ['coringa', 'paulinholoko', 'gaules', 'frttt', 'xqc', 'adinross'],
            'en': ['xqc', 'adinross', 'n3on', 'trainwreckstv', 'iceposeidon', 'ac7ionman']
        },
        'twitch': {
            'fr': ['kamet0', 'aminematue', 'gotaga', 'zerator', 'antoinedaniel', 'jl_tomy'],
            'es': ['auronplay', 'ibai', 'rubius', 'thegrefg', 'illojuan', 'rivers_gg'],
            'pt': ['gaules', 'casimito', 'alanzoka', 'baiano', 'cellbit', 'gabepeixe'],
            'en': ['kai_cenat', 'caseoh_', 'tarik', 'jynxzi', 'shroud', 'hasanabi']
        }
    }

    if platform not in streamers_db:
        return jsonify({"error": "Plateforme invalide"}), 400

    # Fallback to English if language not found
    if lang not in streamers_db[platform]:
        lang = 'en'

    streamers = streamers_db[platform][lang]
    trending_vods = []

    def _fetch_twitch_streamer_latest_vod(login):
        try:
            data = twitch.get_streamer_vods(login, scraper)
            if not data or "vods" not in data:
                return None
            vods = data["vods"]
            if vods and len(vods) > 0:
                v = vods[0]
                v['streamer'] = login
                v['avatar'] = data.get("streamer", {}).get("avatar", "")
                return v
        except Exception as e:
            logger.error(f"[Twitch] Error fetching trending for {login}: {e}")
            pass
        return None

    try:
        if platform == 'twitch':
            with ThreadPoolExecutor(max_workers=6) as executor:
                results = executor.map(_fetch_twitch_streamer_latest_vod, streamers)
            trending_vods = [v for v in results if v]
        else:
            with ThreadPoolExecutor(max_workers=6) as executor:
                results = executor.map(_fetch_streamer_latest_vod, streamers)
            trending_vods = [v for v in results if v]
            
        TRENDING_CACHE[cache_key] = (trending_vods, time.time())
        return jsonify({"trending": trending_vods}), 200
    except Exception as e:
        logger.error(f"[API] Error in get_trending: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
@app.route('/api/status', methods=['GET'])
def get_status():
    try:
        config = get_config()
        features = config.get("features", {})
        playback = config.get("playback", {})
        twitch_ok = bool(features.get("enable_twitch", True) and hasattr(twitch, 'GQL_CLIENT_ID'))
        kick_ok = bool(features.get("enable_kick", True) and scraper is not None)
        chat_ok = bool(features.get("enable_chat", True) and (kick_ok or twitch_ok))
        proxy_ok = bool(scraper is not None and hasattr(twitch, 'is_allowed_proxy_url'))
        downloads_ok = bool(features.get("enable_downloads", True))

        with _cache_lock:
            monitor_snapshot = {
                "last_check": monitor_status.get("last_check"),
                "kick": monitor_status.get("kick_ok"),
                "twitch": monitor_status.get("twitch_ok"),
            }
        
        return jsonify({
            "status": "online" if all([kick_ok, twitch_ok, chat_ok, proxy_ok]) else "degraded",
            "version": APP_VERSION,
            "services": {
                "kick": kick_ok,
                "twitch": twitch_ok,
                "chat": chat_ok,
                "proxy": proxy_ok,
                "downloads": downloads_ok,
            },
            "playback": {
                "default_quality_height": playback.get("default_quality_height", 720),
                "max_proxy_quality_height": playback.get("max_proxy_quality_height", 720),
                "direct_twitch_native_hls": playback.get("direct_twitch_native_hls", True),
            },
            "cache_keys": len(TRENDING_CACHE) + len(_twitch_cache),
            "monitor": monitor_snapshot,
        }), 200
    except Exception as e:
        return jsonify({"status": "degraded", "error": str(e)}), 500
@app.route('/api/config', methods=['GET'])
def get_config_route():
    try:
        config = get_config()
        return jsonify(config), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Auto-Monitoring & Admin ──
monitor_status = {"last_check": None, "kick_ok": False, "twitch_ok": False, "history": []}

def monitoring_loop():
    while True:
        try:
            config = get_config()
            interval = config.get("monitoring", {}).get("check_interval_seconds", 600)
            
            # Simple check
            kick_ok = _fetch_with_backoff("https://kick.com/api/v1/channels/xqc") is not None
            twitch_ok = hasattr(twitch, 'GQL_CLIENT_ID')
            
            with _cache_lock:
                monitor_status["kick_ok"] = kick_ok
                monitor_status["twitch_ok"] = twitch_ok
                monitor_status["last_check"] = datetime.now().isoformat()
                monitor_status["history"].append({
                    "time": monitor_status["last_check"],
                    "kick": kick_ok,
                    "twitch": twitch_ok
                })
                if len(monitor_status["history"]) > 50:
                    monitor_status["history"].pop(0)
            
            time.sleep(interval)
        except Exception as e:
            logger.error(f"Monitoring error: {e}")
            time.sleep(60)

threading.Thread(target=monitoring_loop, daemon=True).start()

@app.route('/admin', methods=['GET'])
def admin_dashboard():
    # Simple basic auth or hidden page
    # Serves the admin.html template (we can just return an HTML string here to avoid template creation if we want to keep it simple, but let's serve admin.html if it exists)
    nonce = getattr(g, 'csp_nonce', '')
    return f"""
    <html><head><title>Admin Dashboard</title><style nonce="{nonce}">body{{font-family:monospace; background:#111; color:#eee; padding:20px;}}</style></head>
    <body>
        <h1>Admin Dashboard</h1>
        <h2>Monitoring Status</h2>
        <pre id="status"></pre>
        <script nonce="{nonce}">
            fetch('/api/status').then(r=>r.json()).then(d => {{
                document.getElementById('status').innerText = JSON.stringify(d, null, 2);
            }});
        </script>
    </body></html>
    """, 200

if __name__ == '__main__':
    app.run(debug=False, port=int(os.environ.get('PORT', 5000)))
