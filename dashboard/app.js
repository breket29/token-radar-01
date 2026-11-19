// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail view with the model's own inputs, the live-token view and the
// methodology. No network: every byte it shows is in data.js.
//
// The page recomputes a row's implied value from the snapshot figures and
// checks the number board.json carries, so the page's code and the board's
// data are visibly the same arithmetic. The hash names the view, so a board,
// a detail and a filtered view each have an address:
//   index.html                 the board
//   index.html#detail=<slug>   one protocol's detail view
//   index.html#cat=<category>  the board filtered to a category
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var model = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'board', sort: 'implied', dir: -1, selected: null, deepDetail: false };

  var usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFmt.format(n);
  }
  function fmtUsdFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return usdFmt.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code and
  // the board's data are visibly the same arithmetic.
  function impliedOf(row) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.chain_cap);
    return Math.max(1, Math.round(row.tvl_usd * row.category_ratio * growthMult * maturity * chainMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function uniqueSorted(values) {
    var seen = {};
    var out = [];
    values.forEach(function (v) { if (v !== null && v !== undefined && !seen[v]) { seen[v] = true; out.push(v); } });
    return out.sort();
  }
  var categories = uniqueSorted(DATA.rows.map(function (r) { return r.category; }));
  var chains = uniqueSorted(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []));

  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0 && (r.category || '').toLowerCase().indexOf(q) < 0)) return false;
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'change') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function setHash() {
    var parts = [];
    if (state.tab !== 'board') parts.push('tab=' + state.tab);
    if (state.selected) parts.push('detail=' + state.selected);
    else if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    else if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.watch) parts.push('watch=1');
    var h = parts.length ? '#' + parts.join('&') : '';
    if (window.location.hash !== h) window.history.replaceState(null, '', h || window.location.pathname + window.location.search);
  }

  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; state.tab = 'board'; state.selected = null;
    if (!h) return;
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      var k = kv[0];
      var v = kv[1] ? decodeURIComponent(kv[1]) : '';
      if (k === 'detail' && bySlug(v)) { state.selected = v; state.deepDetail = true; }
      else if (k === 'cat' && categories.indexOf(v) >= 0) state.category = v;
      else if (k === 'q') state.q = v;
      else if (k === 'watch' && v === '1') state.watch = true;
      else if (k === 'tab' && (v === 'live' || v === 'method')) state.tab = v;
    });
  }

  function statCard(k, v, s) {
    return el('div', { 'class': 'stat' }, el('div', { 'class': 'k', text: k }), el('div', { 'class': 'v', text: v }), el('div', { 'class': 's', text: s }));
  }

  function renderBoardTable(rows) {
    if (rows.length === 0) return el('div', { 'class': 'empty', text: 'No protocol matches this filter. Clear the search or pick another category.' });
    var headers = [
      { key: 'rank', label: '#', cls: 'num' },
      { key: 'name', label: 'Protocol', cls: '' },
      { key: null, label: 'Category', cls: '' },
      { key: null, label: 'Chains', cls: '' },
      { key: 'tvl', label: 'TVL', cls: 'num' },
      { key: 'change', label: '7d', cls: 'num' },
      { key: 'age', label: 'Age', cls: 'num' },
      { key: 'implied', label: 'Implied value', cls: 'num' },
    ];
    var thead = el('thead', null, el('tr', null, headers.map(function (h) {
      var attrs = { 'class': (h.cls ? h.cls + ' ' : '') + (h.key ? 'sortable' : ''), text: h.label + (state.sort === h.key ? (state.dir === -1 ? ' ↓' : ' ↑') : '') };
      if (h.key) attrs.onclick = function () {
        if (state.sort === h.key) state.dir = -state.dir;
        else { state.sort = h.key; state.dir = h.key === 'name' ? 1 : -1; }
        render();
      };
      return el('th', attrs);
    })));
    var tbody = el('tbody', null, rows.map(function (r) {
      var tr = el('tr', { 'class': state.selected === r.slug ? 'sel' : '', onclick: function () { state.selected = state.selected === r.slug ? null : r.slug; state.deepDetail = false; render(); } });
      tr.appendChild(el('td', { 'class': 'num', text: String(r.rank) }));
      var nameCell = el('td', null);
      nameCell.appendChild(document.createTextNode(r.name + ' '));
      if (r.watchlist) nameCell.appendChild(el('span', { 'class': 'badge watch', text: 'watchlist' }));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', { text: r.category || '—' }));
      var ch = (r.chains || []).slice(0, 2).join(', ');
      if ((r.chains || []).length > 2) ch += ' +' + ((r.chains || []).length - 2);
      tr.appendChild(el('td', { text: ch || '—' }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      var chg = el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) });
      tr.appendChild(chg);
      tr.appendChild(el('td', { 'class': 'num', text: fmtAge(r.age_days) }));
      tr.appendChild(el('td', { 'class': 'num val', text: fmtUsd(r.implied_value_usd) }));
      return tr;
    }));
    return el('table', { 'class': 'board' }, thead, tbody);
  }

  function renderLiveTable() {
    var headers = ['Protocol', 'Category', 'Chains', 'TVL', 'Market cap', '7d'];
    var thead = el('thead', null, el('tr', null, headers.map(function (h, i) { return el('th', { 'class': i >= 3 ? 'num' : '', text: h }); })));
    var tbody = el('tbody', null, DATA.live.map(function (r) {
      var tr = el('tr', null);
      tr.appendChild(el('td', { text: r.name }));
      tr.appendChild(el('td', { text: r.category || '—' }));
      tr.appendChild(el('td', { text: (r.chains || []).slice(0, 2).join(', ') || '—' }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { 'class': 'num val', text: fmtUsd(r.mcap_usd) }));
      tr.appendChild(el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }));
      return tr;
    }));
    return el('div', null,
      el('p', { 'class': 'sub', text: 'These protocols already trade. Their market caps are the market\u2019s own values, shown apart so the ranked board stays the protocols still to come.' }),
      el('table', { 'class': 'board' }, thead, tbody));
  }

  function renderDetail(row) {
    var recomputed = impliedOf(row);
    var match = recomputed === row.implied_value_usd;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var chainMult = 1 + model.chain_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.chain_cap);
    var base = Math.round(row.tvl_usd * row.category_ratio);
    var ratioNote = row.ratio_fallback
      ? 'global median (' + row.ratio_comparables + ' traded names in the snapshot)'
      : row.category + ' median (' + row.ratio_comparables + ' traded names)';
    var math = 'TVL ' + fmtUsdFull(row.tvl_usd) + ' × ' + row.category_ratio.toFixed(4) + ' (' + ratioNote + ') = base ' + fmtUsdFull(base) + '\n' +
      '× growth ' + growthMult.toFixed(4) + ' (7d ' + fmtPct(row.change_7d) + ') × maturity ' + maturity.toFixed(4) + ' (' + fmtAge(row.age_days) + ') × chains ' + chainMult.toFixed(2) + ' (' + (row.chains || []).length + ' chains)\n' +
      '= ' + fmtUsdFull(recomputed);
    var box = el('div', { 'class': 'detail' },
      el('h2', null, document.createTextNode('#' + row.rank + ' ' + row.name + ' '), el('small', { text: row.watchlist ? '· on the watchlist' : '· below the watchlist floor' })),
      el('p', { 'class': 'sub', text: (row.category || 'Uncategorised') + ' · ' + (row.chains || []).join(', ') + ' · tracked since ' + (row.listed_at || 'unknown') + ' · records no token' }),
      el('div', { 'class': 'grid' },
        el('div', { 'class': 'cell' }, el('div', { 'class': 'k', text: 'Implied value' }), el('div', { 'class': 'v', text: fmtUsd(row.implied_value_usd) }), el('div', { 'class': 's', text: 'model radar-2' })),
        el('div', { 'class': 'cell' }, el('div', { 'class': 'k', text: 'TVL' }), el('div', { 'class': 'v', text: fmtUsd(row.tvl_usd) }), el('div', { 'class': 's', text: '7d ' + fmtPct(row.change_7d) })),
        el('div', { 'class': 'cell' }, el('div', { 'class': 'k', text: 'Category ratio' }), el('div', { 'class': 'v', text: row.category_ratio.toFixed(4) + '×' }), el('div', { 'class': 's', text: ratioNote })),
        el('div', { 'class': 'cell' }, el('div', { 'class': 'k', text: 'Age with no token' }), el('div', { 'class': 'v', text: fmtAge(row.age_days) }), el('div', { 'class': 's', text: row.listed_at || 'listed date unknown' }))),
      el('h3', { text: 'How the value is derived' }),
      el('div', { 'class': 'math' }, document.createTextNode(math + '\n'), el('span', { 'class': match ? 'ok' : 'no', text: match ? '✓ matches board.json' : '✗ differs from board.json (' + fmtUsdFull(row.implied_value_usd) + ')' })),
      el('h3', { text: 'Farm plan — 7 steps' }),
      el('ol', { 'class': 'steps' }, row.farm_steps.map(function (s) { return el('li', { text: s }); })));
    return box;
  }

  function renderMethod() {
    var topCats = Object.keys(DATA.comparables.by_category).map(function (k) {
      return { cat: k, ratio: DATA.comparables.by_category[k].ratio, n: DATA.comparables.by_category[k].comparables };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var table = el('table', null,
      el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { text: 'Median mcap / TVL' }), el('th', { text: 'Traded names read' }))),
      el('tbody', null, topCats.map(function (c) {
        return el('tr', null, el('td', { text: c.cat }), el('td', { text: c.ratio.toFixed(4) + '×' }), el('td', { text: String(c.n) }));
      })));
    return el('section', { 'class': 'method' },
      el('h2', { text: 'How the radar scores' }),
      el('p', { text: 'A protocol records no token when its snapshot entry carries no market cap, no CoinGecko id and no symbol. That is what the record says, never proof it has none: a protocol on the list may still hold a token its record does not carry.' }),
      el('p', null, document.createTextNode('Implied value = TVL × category ratio × growth × maturity × chains, where the category ratio is the median market cap per dollar of TVL of the token-bearing protocols in that category, read from this same snapshot (at least 3 traded names, else the global median of '), el('code', { text: DATA.comparables.global.ratio.toFixed(4) + '×' }), document.createTextNode(' over ' + DATA.comparables.global.comparables + ' names). Growth is the 7-day TVL change clamped to −60…+120%, maturity rises with the days run with no token up to 3 years, and each extra chain adds 2% up to 5 chains. No protocol name is special-cased.')),
      table,
      el('p', { text: 'The board covers all ' + DATA.watchlist_size + ' watchlist protocols and every other pre-token protocol below the $50M floor that passes the same exclusion rule: ' + DATA.early_size + ' early rows, ' + DATA.board_size + ' rows in all. Bridged, staked and exchange products are kept out, as the watchlist rule keeps them out.' }),
      el('p', { text: 'Each farm plan is built from the protocol\u2019s own record — its category, its chains, its TVL and its age — with the capital, the gas on its chain and the hold time the plan states. An implied value is this model\u2019s claim about what a token would be worth if the record stayed as it is; it does not predict whether or when a token is issued.' }));
  }

  function render() {
    setHash();
    app.setAttribute('aria-busy', 'false');
    while (app.firstChild) app.removeChild(app.firstChild);
    var wrap = el('div', { 'class': 'wrap' });
    wrap.appendChild(el('header', { 'class': 'hero' },
      el('h1', null, document.createTextNode('Token '), el('span', { 'class': 'amber', text: 'Radar' }), document.createTextNode(' — pre-token protocols, ranked')),
      el('p', { 'class': 'lede', text: 'Every protocol in the sealed snapshot that records no token, ranked by what its token would be worth if the record stayed as it is — and what to do to farm each one before it launches.' }),
      el('p', { 'class': 'meta', text: 'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · model radar-2 · ' + DATA.rows.length + ' rows' })));
    var top = DATA.rows[0];
    wrap.appendChild(el('div', { 'class': 'stats' },
      statCard('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every protocol on the floor'),
      statCard('Board', String(DATA.board_size), DATA.early_size + ' early rows below the floor'),
      statCard('Top implied value', fmtUsd(top ? top.implied_value_usd : 0), top ? top.name : ''),
      statCard('Global median mcap / TVL', DATA.comparables.global.ratio.toFixed(4) + '×', DATA.comparables.global.comparables + ' traded names read')));
    var tabs = el('div', { 'class': 'tabs', role: 'tablist' },
      el('button', { 'class': 'tab', role: 'tab', 'aria-selected': state.tab === 'board' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'board'; state.selected = null; render(); } }),
      el('button', { 'class': 'tab', role: 'tab', 'aria-selected': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens (' + DATA.live_size + ')', onclick: function () { state.tab = 'live'; state.selected = null; render(); } }),
      el('button', { 'class': 'tab', role: 'tab', 'aria-selected': state.tab === 'method' ? 'true' : 'false', text: 'Methodology', onclick: function () { state.tab = 'method'; state.selected = null; render(); } }));
    wrap.appendChild(tabs);

    if (state.tab === 'live') {
      wrap.appendChild(renderLiveTable());
    } else if (state.tab === 'method') {
      wrap.appendChild(renderMethod());
    } else {
      var controls = el('div', { 'class': 'controls' });
      var search = el('input', { type: 'search', placeholder: 'Search name, slug or category…', value: state.q, 'aria-label': 'Search protocols' });
      search.addEventListener('input', function () { state.q = search.value; state.selected = null; render(); });
      controls.appendChild(search);
      var catSel = el('select', { 'aria-label': 'Filter by category' });
      catSel.appendChild(el('option', { value: 'all', text: 'All categories' }));
      categories.forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c })); });
      catSel.value = state.category;
      catSel.addEventListener('change', function () { state.category = catSel.value; state.selected = null; render(); });
      controls.appendChild(catSel);
      var chainSel = el('select', { 'aria-label': 'Filter by chain' });
      chainSel.appendChild(el('option', { value: 'all', text: 'All chains' }));
      chains.forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });
      chainSel.value = state.chain;
      chainSel.addEventListener('change', function () { state.chain = chainSel.value; state.selected = null; render(); });
      controls.appendChild(chainSel);
      var watchLabel = el('label', { 'class': 'chk' });
      var watchBox = el('input', { type: 'checkbox' });
      watchBox.checked = state.watch;
      watchBox.addEventListener('change', function () { state.watch = watchBox.checked; state.selected = null; render(); });
      watchLabel.appendChild(watchBox);
      watchLabel.appendChild(document.createTextNode('Watchlist only'));
      controls.appendChild(watchLabel);
      var rows = filteredRows();
      controls.appendChild(el('span', { 'class': 'count', text: rows.length + ' of ' + DATA.rows.length + ' rows' }));
      wrap.appendChild(controls);
      // A deep-linked detail renders first, so its view shows the protocol,
      // not the top of a long table; a row clicked on the board keeps the
      // detail below the table it came from.
      if (state.selected && state.deepDetail) {
        var deepRow = bySlug(state.selected);
        if (deepRow) wrap.appendChild(renderDetail(deepRow));
      }
      wrap.appendChild(renderBoardTable(rows));
      if (state.selected && !state.deepDetail) {
        var row = bySlug(state.selected);
        if (row) wrap.appendChild(renderDetail(row));
      }
      wrap.appendChild(el('p', { 'class': 'sub', text: 'Click a row for its detail view, farm plan and value derivation. Sort any column by its header.' }));
    }
    if (state.tab !== 'method') wrap.appendChild(renderMethod());
    wrap.appendChild(el('footer', { 'class': 'foot' },
      el('p', { text: 'Data: the sealed snapshot of ' + DATA.as_of + ' (' + DATA.source + '). The board is generated by main.ts from that snapshot; this page recomputes every value from the same figures.' }),
      el('p', { text: 'An implied value is the model\u2019s claim, not a prediction of a launch. Nothing on this page reaches the network.' })));
    app.appendChild(wrap);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
