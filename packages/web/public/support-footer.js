/**
 * Stoatworks Labs — support footer.
 *
 * One in-flow footer, appended to the end of <body>, saying the same thing on
 * every hosted web app: the tool is free, it comes from Stoatworks Labs, and
 * there are four ways to fund the work.
 *
 * This file is the MASTER. It is vendored into each hosted app by
 * scripts/sync-support-footer.sh — edit it HERE and re-run the sync, or the
 * copies drift and the apps start making slightly different promises.
 *
 * Why a script rather than markup pasted into nine templates:
 *   - The apps are a React SPA (blend-calc, pixel-peeker, RFutils), a
 *     hand-written landing page (pmse-to-wwb) and four recorded demos whose
 *     HTML is a committed build artefact. There is no shared template.
 *   - One file means the wording and the funding links have exactly one
 *     definition. A copy-pasted footer is four dead links waiting to happen.
 *
 * Why plain classic script and not a module:
 *   `document.currentScript` is null in a module, and the per-app config below
 *   is read off the tag. Load it deferred, so <body> exists when it runs:
 *
 *     <script src="/support-footer.js" defer
 *             data-app="Pixel Peeker"
 *             data-repo="https://github.com/stoatworks-labs/pixel-peeker"></script>
 *
 * Config, all optional:
 *   data-app   Name of the app, bolded in the first line. Defaults to <title>.
 *   data-repo  Source URL. Omit and the "source" link is left out rather than
 *              pointed somewhere plausible-but-wrong.
 *   data-note  One extra sentence, app-specific, shown under the lead. Used for
 *              things only true of some apps ("nothing leaves your browser").
 *
 * Styling: the footer deliberately has no colours of its own. It inherits the
 * page's background and text colour and draws its rules and chips from
 * `currentColor`, so it lands correctly on the dark apps (blend-calc,
 * pixel-peeker, RFutils) and the light ones (flock, pmse-to-wwb in light mode)
 * without either being told which it is. An app that wants its accent on the
 * links sets `--sw-support-accent` in its own stylesheet.
 */
(() => {
  const script = document.currentScript;

  /**
   * The canonical set, matching stoatworks-backend/funding/FUNDING.yml and the
   * website's src/data/site.json. GitHub Sponsors is first because it is the
   * preferred route — it takes no extra account for anyone already signed in to
   * GitHub, which is everyone arriving from a repo link.
   */
  const FUNDING = [
    { name: 'GitHub Sponsors', url: 'https://github.com/sponsors/stoatworks-labs' },
    { name: 'Ko-fi', url: 'https://ko-fi.com/stoatworkslabs' },
    { name: 'Patreon', url: 'https://patreon.com/StoatworksLabs' },
    { name: 'Liberapay', url: 'https://liberapay.com/stoatworks-labs' },
  ];

  const HOME = 'https://stoatworks-labs.com';

  const CSS = `
.sw-support {
  --sw-rule: color-mix(in srgb, currentColor 14%, transparent);
  --sw-chip: color-mix(in srgb, currentColor 8%, transparent);
  --sw-chip-hover: color-mix(in srgb, currentColor 16%, transparent);
  box-sizing: border-box;
  margin-top: 2.5rem;
  border-top: 1px solid var(--sw-rule);
  padding: 1.25rem 1.25rem 1.6rem;
  font: 13px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* Inherits the page's own colours; only the emphasis is dialled down. */
  opacity: 0.92;
}
/* Deliberately one column, chips under the text, at every width. A two-column
   "text left / chips right" version only actually fits in a narrow band of
   viewport widths — four chips need ~28rem beside 46rem of prose — so it spent
   most of its life wrapping into this layout anyway, just less predictably. */
.sw-support__inner {
  max-width: 62rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}
.sw-support__say { margin: 0; max-width: 46rem; }
.sw-support__say p { margin: 0 0 0.25rem; }
.sw-support__say p:last-child { margin-bottom: 0; }
.sw-support__note { opacity: 0.75; }
.sw-support__ask { opacity: 0.75; }
.sw-support a { color: var(--sw-support-accent, inherit); }
.sw-support__say a { text-decoration: underline; text-underline-offset: 2px; }

.sw-support__links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.sw-support__links a {
  display: inline-block;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--sw-rule);
  border-radius: 999px;
  background: var(--sw-chip);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.sw-support__links a:hover,
.sw-support__links a:focus-visible {
  background: var(--sw-chip-hover);
  border-color: color-mix(in srgb, currentColor 30%, transparent);
}

@media print { .sw-support { display: none; } }
`;

  function build() {
    if (document.querySelector('.sw-support')) return;

    const app = script?.dataset.app || document.title || 'This tool';
    const repo = script?.dataset.repo || '';
    const note = script?.dataset.note || '';

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const footer = document.createElement('footer');
    footer.className = 'sw-support';
    // Not role="contentinfo": several of these apps already have a <footer> or a
    // landmark of their own, and two contentinfo landmarks in one document is
    // worse for a screen reader than none.
    footer.setAttribute('aria-label', 'About and support');

    const say = document.createElement('div');
    say.className = 'sw-support__say';

    const lead = document.createElement('p');
    const name = document.createElement('strong');
    name.textContent = app;
    lead.append(name, ' is free to use, from ');
    lead.append(link(HOME, 'Stoatworks Labs'));
    lead.append(repo ? ' — open source, and the ' : ' — open source.');
    if (repo) lead.append(link(repo, 'source is on GitHub'), '.');
    say.appendChild(lead);

    if (note) {
      const p = document.createElement('p');
      p.className = 'sw-support__note';
      p.textContent = note;
      say.appendChild(p);
    }

    const ask = document.createElement('p');
    ask.className = 'sw-support__ask';
    ask.textContent = "If it's useful to you, supporting the work keeps it coming.";
    say.appendChild(ask);

    const list = document.createElement('ul');
    list.className = 'sw-support__links';
    for (const f of FUNDING) {
      const li = document.createElement('li');
      li.appendChild(link(f.url, f.name));
      list.appendChild(li);
    }

    footer.append(say, list);
    document.body.appendChild(footer);
    clearDemoBanner(footer);
  }

  /**
   * The four recorded demos carry the demo shim's banner: fixed to the bottom
   * edge of the viewport, and never optional, because a demo must not be
   * mistakable for live equipment.
   *
   * The shim reserves room for it with `body { padding-bottom }`. That is right
   * for an app that ends where the body ends, but this footer is the body's last
   * child — so scrolled to the bottom, the banner lands on top of the funding
   * chips, which are the one part of the footer that has to be clickable.
   *
   * Rather than have two scripts fight over the same body padding, the footer
   * carries the banner's height as its own bottom padding. Watched, not measured
   * once: the banner appears only after the shim's fixtures have loaded, which is
   * well after this runs, and it grows a second line whenever a write is
   * attempted.
   */
  function clearDemoBanner(footer) {
    const BASE = '1.6rem';
    let observer = null;

    const track = (banner) => {
      const apply = () => {
        footer.style.paddingBottom = `calc(${BASE} + ${banner.offsetHeight}px)`;
      };
      apply();
      if (window.ResizeObserver) new ResizeObserver(apply).observe(banner);
      window.addEventListener('resize', apply);
    };

    const found = document.getElementById('stoatworks-demo-banner');
    if (found) return track(found);

    // No banner in this document yet. On an app that has none — every one of
    // these except the demos — the observer simply never fires and is
    // disconnected on load, so nothing is left watching.
    if (!window.MutationObserver) return;
    observer = new MutationObserver(() => {
      const banner = document.getElementById('stoatworks-demo-banner');
      if (!banner) return;
      observer.disconnect();
      track(banner);
    });
    observer.observe(document.body, { childList: true });
    window.addEventListener('load', () => {
      setTimeout(() => observer && observer.disconnect(), 5000);
    });
  }

  function link(href, text) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // `defer` already puts this after parsing, but the demos load the shim and the
  // app script in the same document and one of them may still be writing to
  // <body>; appending on DOMContentLoaded keeps the footer last either way.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
})();
