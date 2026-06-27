// Background Service Worker
console.log("Kick Unlocker: Background service worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CHECK_STREAM_URL") {
        checkUrlAsync(message.url).then(isValid => {
            sendResponse({ valid: isValid });
        });
        return true; // Keep the messaging channel open
    }

    if (message.action === "GET_LATEST_RELEASE") {
        getLatestReleaseAsync().then((release) => {
            sendResponse({ release });
        }).catch(() => {
            sendResponse({ release: null });
        });
        return true;
    }
});

async function checkUrlAsync(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        return response.ok;
    } catch (e) {
        // console.warn("Background fetch failed for", url, e);
        return false;
    }
}

async function getLatestReleaseAsync() {
    try {
        const response = await fetch('https://api.github.com/repos/Enmn/KickNoSub/releases/latest', {
            headers: {
                'Accept': 'application/vnd.github+json'
            },
            cache: 'no-store'
        });

        if (!response.ok) return null;

        const data = await response.json();
        return {
            tagName: data.tag_name,
            htmlUrl: data.html_url,
            name: data.name
        };
    } catch (e) {
        return null;
    }
}