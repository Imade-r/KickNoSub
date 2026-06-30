// Reports client-side runtime errors early, before the main app initializes.
(function () {
    let sent = 0;

    function report(payload) {
        if (sent >= 10) return;
        sent++;
        try {
            const body = JSON.stringify(payload);
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
            } else {
                fetch('/api/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    keepalive: true,
                }).catch(() => {});
            }
        } catch (_) {}
    }

    window.addEventListener('error', e => report({
        message: e.message,
        source: e.filename,
        line: e.lineno,
        stack: e.error && e.error.stack ? String(e.error.stack) : '',
    }));

    window.addEventListener('unhandledrejection', e => {
        const reason = e.reason;
        report({
            message: 'unhandledrejection: ' + (reason && reason.message ? reason.message : reason),
            stack: reason && reason.stack ? String(reason.stack) : '',
        });
    });
})();
