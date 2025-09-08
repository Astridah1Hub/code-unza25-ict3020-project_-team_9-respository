// content_script.js
(() => {
  const HIGHLIGHT_CLASS = 'wsh-highlight';
  const TOOLTIP_CLASS = 'wsh-tooltip';

  // Remove previous highlights if any (idempotent)
  function clearHighlights() {
    const prev = document.querySelectorAll('.' + HIGHLIGHT_CLASS);
    prev.forEach(node => {
      const parent = node.parentNode;
      if (!parent) return;
      // unwrap the span: replace with its text node
      parent.replaceChild(document.createTextNode(node.textContent), node);
    });
    // remove tooltips
    document.querySelectorAll('.' + TOOLTIP_CLASS).forEach(t => t.remove());
  }

    // Simple heuristic: sentence likely needs citation if:
    // - contains a number/year/percentage OR certain cue words (study, research, found, reported, percent, estimate)
    // - AND there is no <sup class="reference"> (Wikipedia reference) within the same paragraph for that sentence
    const cueWords = [
      '\\b(study|studies|research|reported|found|estimated|estimate|survey|according to|percent|%)\\b'
    ];
    const numRegex = /(\d{1,4}|\b\d{1,3}(?:,\d{3})+\b|\b\d+%|\b(18|19|20)\d{2}\b)/; // years, numbers, percents
    const cues = new RegExp(cueWords.join('|'), 'i');

  // split paragraph text into naive sentences using punctuation (works for prototype)
  function splitSentences(text) {
    // keep punctuation attached
    return text.match(/[^.!?]+[.!?]?/g) || [];
  }

  // Checks if the sentence already has a nearby reference inside the paragraph node
  function hasReferenceInParagraph(paragraphNode, sentenceText) {
    // If the paragraph contains <sup class="reference"> or other reference markers, consider it referenced.
    if (paragraphNode.querySelector('sup.reference')) return true;
    // some templates use [citation needed] text — check for that too (if present it's missing)
    const supText = paragraphNode.innerText.toLowerCase();
    if (supText.includes('citation needed')) {
      // presence of 'citation needed' indicates missing citation, so return false (we want to flag)
      return false;
    }
    // look for inline bracket references like [1] close to the sentence
    const idx = paragraphNode.innerText.indexOf(sentenceText.trim());
    if (idx === -1) return false;
    // if there's a bracket like [1] near the sentence, treat as referenced
    const windowText = paragraphNode.innerText.substr(Math.max(0, idx - 40), sentenceText.length + 80);
    if (/\[\d+\]/.test(windowText)) return true;
    return false;
  }

  // Main scan function
  function scanAndHighlight() {
  clearHighlights();
  // Scan all <p> elements on the page
  const paragraphs = Array.from(document.querySelectorAll('p'));
  let flaggedCount = 0;
  // Remove previous banner if any
  const oldBanner = document.getElementById('wsh-missing-info-banner');
  if (oldBanner) oldBanner.remove();

    paragraphs.forEach(p => {
      let html = p.innerHTML;
      // Highlight [citation needed] markers in yellow
      html = html.replace(/\[citation needed\]/gi, function(match) {
        return `<span class="${HIGHLIGHT_CLASS}" title="Missing citation">${match}</span>`;
      });

      const sentences = splitSentences(p.innerText);
      if (sentences.length === 0) {
        p.innerHTML = html;
        return;
      }

      sentences.forEach(s => {
        const trimmed = s.trim();
        if (!trimmed) return;

        const needsHeuristic = (numRegex.test(trimmed) || cues.test(trimmed)) && trimmed.length > 20;
        const hasRef = hasReferenceInParagraph(p, trimmed);

        // Also flag explicit "[citation needed]" markers (already handled above, but keep logic for completeness)
        const hasCitationNeeded = /citation needed/i.test(p.innerText) && p.innerText.includes(trimmed);

        if ((needsHeuristic && !hasRef) || hasCitationNeeded) {
          flaggedCount += 1;

          // Escape string for use in regex replacement (very naive)
          const esc = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Replace the first occurrence of that sentence text with span-wrapped version.
          // Use a unique data-id for click handling
          const dataId = 'wsh-' + Math.random().toString(36).slice(2, 9);

          const replacement = `<span class="${HIGHLIGHT_CLASS}" data-wsh-id="${dataId}" title="Click to search sources">${trimmed}</span>`;
          html = html.replace(new RegExp(esc), replacement);
        }
      });

      // set new html
      p.innerHTML = html;
    });

    // Add click handler to highlight spans
    document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(span => {
      span.style.cursor = 'pointer';
      span.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const text = span.textContent.trim();
        // show quick tooltip with action
        showTooltip(span, text);
      });
    });

    // Show a banner if missing information is found
    if (flaggedCount > 0) {
      // Top banner
      const banner = document.createElement('div');
      banner.id = 'wsh-missing-info-banner';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.width = '100%';
      banner.style.background = '#ffec80';
      banner.style.color = '#222';
      banner.style.fontWeight = 'bold';
      banner.style.fontSize = '18px';
      banner.style.textAlign = 'center';
      banner.style.padding = '10px 0 10px 0';
      banner.style.zIndex = '999999';
      banner.innerHTML = `<span style=\"vertical-align:middle;display:inline-block;margin-right:8px;\">🛈</span>Potential missing information detected${window.location.hostname.includes('wikipedia.org') ? ' in this Wikipedia article' : ' (may be missing Wikipedia references)'}! (${flaggedCount} sentence${flaggedCount > 1 ? 's' : ''} flagged)`;
      document.body.appendChild(banner);
      // Add margin to body so banner doesn't cover content
      document.body.style.marginTop = '50px';

      // Floating indicator near first highlight
      const firstHighlight = document.querySelector('.' + HIGHLIGHT_CLASS);
      if (firstHighlight && !document.getElementById('wsh-floating-indicator')) {
        const rect = firstHighlight.getBoundingClientRect();
        const indicator = document.createElement('div');
        indicator.id = 'wsh-floating-indicator';
        indicator.style.position = 'absolute';
        indicator.style.left = (window.scrollX + rect.left - 36) + 'px';
        indicator.style.top = (window.scrollY + rect.top - 36) + 'px';
        indicator.style.background = '#ffec80';
        indicator.style.color = '#222';
        indicator.style.fontWeight = 'bold';
        indicator.style.fontSize = '15px';
        indicator.style.borderRadius = '50%';
        indicator.style.width = '32px';
        indicator.style.height = '32px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        indicator.style.zIndex = '999999';
        indicator.title = 'Potential missing information here';
        indicator.textContent = '🛈';
        document.body.appendChild(indicator);
      }
    } else {
      document.body.style.marginTop = '';
      const oldIndicator = document.getElementById('wsh-floating-indicator');
      if (oldIndicator) oldIndicator.remove();
    }
    return {count: flaggedCount};
  }

  // Show tooltip next to a span with buttons
  function showTooltip(targetSpan, sentenceText) {
    // remove existing tooltip
    document.querySelectorAll('.' + TOOLTIP_CLASS).forEach(t => t.remove());

    const rect = targetSpan.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = TOOLTIP_CLASS;
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = 999999;
    tooltip.style.left = (rect.right + 8) + 'px';
    tooltip.style.top = (rect.top) + 'px';
    tooltip.style.maxWidth = '360px';
    tooltip.style.padding = '8px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    tooltip.style.background = 'white';
    tooltip.style.fontSize = '13px';
    tooltip.style.color = '#111';
    tooltip.innerHTML = `
      <div style="margin-bottom:6px;"><strong>Potential missing citation</strong></div>
      <div style="margin-bottom:8px; font-size:12px;">"${escapeHtml(sentenceText.slice(0,180))}${sentenceText.length>180?'...':''}"</div>
      <div style="display:flex; gap:6px;">
        <button id="wsh-search-web" style="padding:6px 8px; font-size:12px;">Search web</button>
        <button id="wsh-search-wiki" style="padding:6px 8px; font-size:12px;">Search Wikipedia</button>
        <button id="wsh-close" style="padding:6px 8px; font-size:12px;">Close</button>
      </div>
    `;
    document.body.appendChild(tooltip);

    document.getElementById('wsh-search-web').addEventListener('click', () => {
      // open a google search in new tab for the sentence
      const q = encodeURIComponent(`"${sentenceText}"`);
      chrome.runtime.sendMessage({action: 'openSearch', url: `https://www.google.com/search?q=${q}`});
      tooltip.remove();
    });
    document.getElementById('wsh-search-wiki').addEventListener('click', () => {
      const q = encodeURIComponent(sentenceText);
      chrome.runtime.sendMessage({action: 'openSearch', url: `https://en.wikipedia.org/w/index.php?search=${q}`});
      tooltip.remove();
    });
    document.getElementById('wsh-close').addEventListener('click', () => tooltip.remove());
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Expose scanning to messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'scanPage') {
      const result = scanAndHighlight();
      sendResponse({status: 'scanned', count: result.count});
      return true;
    }
    if (message && message.action === 'clearHighlights') {
      clearHighlights();
      sendResponse({status: 'cleared'});
      return true;
    }
  });

  // Optionally auto-scan if on Wikipedia article pages (comment this out if you want manual only)
  // const isArticle = document.querySelector('#firstHeading') && !document.location.pathname.includes('Main_Page');
  // if (isArticle) scanAndHighlight();

})();
