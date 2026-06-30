// Converts legacy inline style attributes into nonce-backed generated CSS rules.
(function () {
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.content || '';
    const nativeInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    const nativeSetAttribute = Element.prototype.setAttribute;
    const styleEl = document.createElement('style');
    const styleToClass = new Map();
    const elementRuntimeClass = new WeakMap();
    let counter = 0;
    let converting = false;

    if (nonce) styleEl.setAttribute('nonce', nonce);
    styleEl.id = 'kns-runtime-inline-styles';
    document.head.appendChild(styleEl);

    function addRule(styleText) {
        const normalized = String(styleText || '').trim();
        if (!normalized) return '';
        if (styleToClass.has(normalized)) return styleToClass.get(normalized);

        const className = `kns-rs${counter++}`;
        const rule = `.${className}{${normalized}}`;
        try {
            styleEl.sheet.insertRule(rule, styleEl.sheet.cssRules.length);
        } catch (_) {
            styleEl.appendChild(document.createTextNode(`${rule}\n`));
        }
        styleToClass.set(normalized, className);
        return className;
    }

    function addClassToTag(tag, className) {
        if (!className) return tag;
        if (/\sclass=(["'])/i.test(tag)) {
            return tag.replace(/\sclass=(["'])(.*?)\1/i, (_match, quote, value) => ` class=${quote}${value} ${className}${quote}`);
        }
        return tag.replace(/\/?>$/, end => ` class="${className}"${end}`);
    }

    function convertStyleAttributesInHtml(html) {
        return String(html ?? '').replace(/(<[^>]+?)\sstyle=(["'])(.*?)\2([^>]*>)/gi, (_match, before, _quote, styleText, after) => {
            return addClassToTag(`${before}${after}`, addRule(styleText));
        });
    }

    function convertElement(el) {
        if (!(el instanceof Element) || !el.hasAttribute('style')) return;
        const className = addRule(el.getAttribute('style'));
        converting = true;
        try {
            const previousClass = elementRuntimeClass.get(el);
            if (previousClass) el.classList.remove(previousClass);
            if (className) el.classList.add(className);
            if (className) elementRuntimeClass.set(el, className);
            else elementRuntimeClass.delete(el);
            el.removeAttribute('style');
        } finally {
            converting = false;
        }
    }

    function convertTree(root) {
        if (!(root instanceof Element)) return;
        convertElement(root);
        root.querySelectorAll?.('[style]').forEach(convertElement);
    }

    function safeFragment(html) {
        const template = document.createElement('template');
        nativeInnerHTML.set.call(template, convertStyleAttributesInHtml(html));
        template.content.querySelectorAll?.('[style]').forEach(convertElement);
        return template;
    }

    Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: nativeInnerHTML.enumerable,
        get: nativeInnerHTML.get,
        set(html) {
            const template = safeFragment(html);
            this.replaceChildren(template.content.cloneNode(true));
        },
    });

    Element.prototype.insertAdjacentHTML = function (position, html) {
        const template = safeFragment(html);
        return nativeInsertAdjacentHTML.call(this, position, nativeInnerHTML.get.call(template));
    };

    Element.prototype.setAttribute = function (name, value) {
        if (!converting && String(name).toLowerCase() === 'style') {
            const className = addRule(value);
            converting = true;
            try {
                const previousClass = elementRuntimeClass.get(this);
                if (previousClass) this.classList.remove(previousClass);
                if (className) this.classList.add(className);
                if (className) elementRuntimeClass.set(this, className);
                else elementRuntimeClass.delete(this);
                this.removeAttribute('style');
            } finally {
                converting = false;
            }
            return;
        }
        return nativeSetAttribute.call(this, name, value);
    };

    if (document.documentElement) convertTree(document.documentElement);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => convertTree(document.documentElement), { once: true });
    }

    new MutationObserver(records => {
        if (converting) return;
        records.forEach(record => {
            if (record.type === 'attributes') convertElement(record.target);
            record.addedNodes.forEach(node => convertTree(node));
        });
    }).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style'],
    });

    window.KNSConvertInlineStyles = convertTree;
})();
