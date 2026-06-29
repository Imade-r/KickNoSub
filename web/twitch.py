"""Résolution des VOD Twitch (y compris sub-only), portage Python de la méthode
TwitchNoSub : on interroge l'API GraphQL publique pour obtenir le `seekPreviewsURL`
(storyboard, accessible sans abonnement), qui révèle le domaine CDN et le
`vodSpecialID` permettant de reconstruire directement les playlists de segments,
contournant le token sub-only d'usher.
"""
import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

GQL_URL = "https://gql.twitch.tv/gql"
# Client-Id public du client web Twitch (identique à celui utilisé par le site).
GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"

# Persisted query officielle des commentaires de VOD (chat replay).
CHAT_QUERY_HASH = "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a"
EMOTE_URL = "https://static-cdn.jtvnw.net/emoticons/v2/{id}/default/dark/1.0"

# Qualités candidates, de la meilleure à la plus basse.
QUALITIES = [
    ("chunked", "Source",  "1920x1080", 60),
    ("1080p60", "1080p60", "1920x1080", 60),
    ("720p60",  "720p60",  "1280x720",  60),
    ("480p30",  "480p",    "854x480",   30),
    ("360p30",  "360p",    "640x360",   30),
    ("160p30",  "160p",    "284x160",   30),
]

# Domaines autorisés pour le proxy de playlist (anti-SSRF).
_ALLOWED_PROXY_HOSTS = ('.cloudfront.net', '.ttvnw.net')


def extract_vod_id(url):
    """Extrait l'identifiant numérique d'une URL de VOD Twitch."""
    m = re.search(r'twitch\.tv/(?:[^/]+/)?v(?:ideos?)?/(\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'/videos?/(\d+)', url)
    if m:
        return m.group(1)
    return None


def _gql_video(vod_id, scraper):
    query = (
        'query { video(id: "%s") { broadcastType, createdAt, lengthSeconds, '
        'title, previewThumbnailURL(width: 1280, height: 720), seekPreviewsURL, '
        'viewCount, owner { login, displayName, profileImageURL(width: 70) } } }'
        % vod_id
    )
    try:
        res = scraper.post(
            GQL_URL,
            json={"query": query},
            headers={"Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json"},
            timeout=10,
        )
        if res.status_code != 200:
            return None
        return (res.json() or {}).get("data", {}).get("video")
    except Exception:
        return None


def _candidate_url(domain, special_id, vod_id, login, broadcast_type, days_old, quality):
    bt = (broadcast_type or "").lower()
    if bt == "highlight":
        return f"https://{domain}/{special_id}/{quality}/highlight-{vod_id}.m3u8"
    if bt == "upload" and days_old > 7:
        return f"https://{domain}/{login}/{vod_id}/{special_id}/{quality}/index-dvr.m3u8"
    return f"https://{domain}/{special_id}/{quality}/index-dvr.m3u8"


def _probe_quality(url, scraper):
    """Renvoie le codec si la playlist existe (contient des segments), sinon None."""
    try:
        r = scraper.get(url, timeout=6)
        if not r.ok:
            return None
        body = r.text
        if ".ts" in body:
            return "avc1.4D001E"
        if ".mp4" in body:
            try:
                init = scraper.get(url.replace("index-dvr.m3u8", "init-0.mp4"), timeout=6)
                if init.ok and "hev1" in init.text:
                    return "hev1.1.6.L93.B0"
            except Exception:
                pass
            return "avc1.4D001E"
    except Exception:
        return None
    return None


def resolve(vod_id, scraper):
    """Résout une VOD Twitch -> liste de variantes valides + métadonnées.
    Retourne {"variants": [...], "meta": {...}} ou {"error": "..."}.
    """
    video = _gql_video(vod_id, scraper)
    if not video:
        return {"error": "VOD Twitch introuvable"}

    seek = video.get("seekPreviewsURL")
    if not seek:
        return {"error": "VOD privée ou indisponible (pas de storyboard)"}

    parsed = urlparse(seek)
    domain = parsed.netloc
    paths = parsed.path.split("/")
    try:
        sb_idx = next(i for i, p in enumerate(paths) if "storyboards" in p)
    except StopIteration:
        return {"error": "Format de storyboard inattendu"}
    if sb_idx <= 0:
        return {"error": "Impossible de déterminer l'identifiant VOD"}
    special_id = paths[sb_idx - 1]

    login = (video.get("owner") or {}).get("login", "")
    broadcast_type = video.get("broadcastType", "ARCHIVE")
    try:
        created = datetime.fromisoformat(video["createdAt"].replace("Z", "+00:00"))
        days_old = (datetime.now(timezone.utc) - created).days
    except Exception:
        days_old = 9999

    # Teste toutes les qualités en parallèle.
    variants = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {}
        for key, name, resolution, fps in QUALITIES:
            url = _candidate_url(domain, special_id, vod_id, login, broadcast_type, days_old, key)
            futs[ex.submit(_probe_quality, url, scraper)] = (key, name, resolution, fps, url)
        for fut in as_completed(futs):
            codec = fut.result()
            if codec:
                key, name, resolution, fps, url = futs[fut]
                variants.append({
                    "key": key, "name": name, "resolution": resolution,
                    "fps": fps, "url": url, "codec": codec,
                })

    if not variants:
        return {"error": "Aucune qualité disponible pour cette VOD"}

    # Ordonne de la meilleure à la plus basse selon QUALITIES.
    order = {q[0]: i for i, q in enumerate(QUALITIES)}
    variants.sort(key=lambda v: order.get(v["key"], 99))

    owner = video.get("owner") or {}
    meta = {
        "title":     video.get("title") or "VOD Twitch",
        "duration":  int(video.get("lengthSeconds") or 0) * 1000,  # ms, comme Kick
        "thumbnail": video.get("previewThumbnailURL") or "",
        "views":     video.get("viewCount") or 0,
        "created_at": video.get("createdAt") or "",
        "streamer":  owner.get("displayName") or owner.get("login") or "",
        "login":     owner.get("login") or "",
        "avatar":    owner.get("profileImageURL") or "",
    }
    return {"variants": variants, "meta": meta}


def get_chat(vod_id, scraper, offset=None, cursor=None):
    """Chat replay d'une VOD Twitch. Pagination par `offset` (secondes) au départ,
    puis par `cursor`. Renvoie {comments, cursor, hasNext} ou {error}."""
    variables = {"videoID": str(vod_id)}
    if cursor:
        variables["cursor"] = cursor
    else:
        variables["contentOffsetSeconds"] = int(offset or 0)
    body = [{
        "operationName": "VideoCommentsByOffsetOrCursor",
        "variables": variables,
        "extensions": {"persistedQuery": {"version": 1, "sha256Hash": CHAT_QUERY_HASH}},
    }]
    try:
        r = scraper.post(GQL_URL, json=body,
                         headers={"Client-Id": GQL_CLIENT_ID, "Content-Type": "application/json"},
                         timeout=10)
        if r.status_code != 200:
            return {"error": "chat indisponible"}
        node = (r.json()[0].get("data", {}).get("video") or {}).get("comments")
        if node is None:
            return {"error": "chat indisponible"}
    except Exception:
        return {"error": "chat indisponible"}

    comments, last_cursor = [], None
    for edge in node.get("edges", []):
        last_cursor = edge.get("cursor") or last_cursor
        n = edge.get("node") or {}
        commenter = n.get("commenter") or {}
        msg = n.get("message") or {}
        frags = []
        for f in msg.get("fragments", []):
            emote = f.get("emote")
            if emote and emote.get("emoteID"):
                frags.append({"emote": EMOTE_URL.format(id=emote["emoteID"]), "name": f.get("text", "")})
            elif f.get("text"):
                frags.append({"text": f["text"]})
        comments.append({
            "id":     n.get("id"),
            "offset": n.get("contentOffsetSeconds", 0),
            "user":   commenter.get("displayName") or commenter.get("login") or "?",
            "color":  msg.get("userColor") or "",
            "frags":  frags,
        })
    return {
        "comments": comments,
        "cursor":   last_cursor,
        "hasNext":  bool((node.get("pageInfo") or {}).get("hasNextPage")),
    }


def build_master_playlist(variants, proxy_path):
    """Construit une playlist maître HLS dont les variantes pointent vers le proxy
    (`proxy_path` doit produire une URL à partir de l'URL CDN encodée)."""
    lines = ["#EXTM3U"]
    bandwidth = 8534030
    for v in variants:
        group = v["key"]
        default = "YES" if v["key"] == "chunked" else "NO"
        lines.append(
            f'#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="{group}",NAME="{v["name"]}",'
            f'AUTOSELECT={default},DEFAULT={default}'
        )
        lines.append(
            f'#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},CODECS="{v["codec"]},mp4a.40.2",'
            f'RESOLUTION={v["resolution"]},VIDEO="{group}",FRAME-RATE={v["fps"]}'
        )
        lines.append(proxy_path(v["url"]))
        bandwidth -= 100
    return "\n".join(lines) + "\n"


def is_allowed_proxy_url(url):
    """N'autorise le proxy que vers les CDN Twitch (anti-SSRF)."""
    try:
        host = urlparse(url).netloc.lower()
        return any(host.endswith(suf) for suf in _ALLOWED_PROXY_HOSTS)
    except Exception:
        return False


def rewrite_media_playlist(url, scraper, seg_proxy):
    """Récupère une playlist de segments Twitch et la réécrit : `-unmuted` -> `-muted`
    (segments audio coupés pour copyright) et chaque segment passe par `seg_proxy`
    (les CDN Twitch n'envoient pas de CORS : les octets doivent transiter par le
    backend pour être lisibles par hls.js)."""
    try:
        r = scraper.get(url, timeout=10)
        if not r.ok:
            return None
    except Exception:
        return None
    base = url.rsplit("/", 1)[0] + "/"
    out = []
    for line in r.text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            out.append(line)
            continue
        s = s.replace("-unmuted", "-muted")
        if not s.startswith("http"):
            s = base + s
        out.append(seg_proxy(s))
    return "\n".join(out) + "\n"
