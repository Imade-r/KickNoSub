// Keeps broken remote thumbnails from leaving empty image icons in cards/lists.
(function () {
    document.addEventListener('error', event => {
        const target = event.target;
        if (target instanceof HTMLImageElement) {
            target.hidden = true;
        }
    }, true);
})();
