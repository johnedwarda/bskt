// A small stand-in for the design canvas's component runtime, so the prototype can run on a
// plain web page. It understands the parts of the .dc.html format the prototype uses:
//   <x-dc> templates with {{path}} values, <sc-if value>, <sc-for list as>, <dc-import name>,
//   <helmet> (copied into <head>), and a `class Component extends DCLogic` script with
//   props, state, setState and renderVals().
// Components are registered from the source text of their .dc.html files.
(function () {
  'use strict';
  const React = window.React;
  const h = React.createElement;
  const Fragment = React.Fragment;

  // ---- expressions: paths, literals, !, and ===/!==/==/!= ----
  const NUM = /^-?\d+(\.\d+)?$/;
  const PATH = /^[A-Za-z_$][\w$]*(\.[\w$]+)*$/;

  function compileExpr(src) {
    const t = String(src).trim();
    if (!t) return () => undefined;
    if (t[0] === '(' && t[t.length - 1] === ')') return compileExpr(t.slice(1, -1));
    const cmp = t.match(/^(.+?)\s*(===|!==|==|!=)\s*(.+)$/);
    if (cmp) {
      const a = compileExpr(cmp[1]), b = compileExpr(cmp[3]), op = cmp[2];
      return (s) => {
        const x = a(s), y = b(s);
        return op === '===' ? x === y : op === '!==' ? x !== y : op === '==' ? x == y : x != y; // eslint-disable-line eqeqeq
      };
    }
    if (t[0] === '!') { const a = compileExpr(t.slice(1)); return (s) => !a(s); }
    if (t === 'true') return () => true;
    if (t === 'false') return () => false;
    if (t === 'null') return () => null;
    if (t === 'undefined') return () => undefined;
    if (NUM.test(t)) { const n = Number(t); return () => n; }
    if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t[t.length - 1] === t[0]) { const v = t.slice(1, -1); return () => v; }
    if (PATH.test(t)) {
      const parts = t.split('.');
      return (s) => {
        let v = s;
        for (let i = 0; i < parts.length; i++) {
          if (v == null) return undefined;
          v = v[parts[i]];
        }
        return v;
      };
    }
    console.warn('[runtime] unsupported expression {{' + t + '}}');
    return () => undefined;
  }

  // "a {{b}} c" -> getter. A lone {{b}} gives the raw value; mixed text gives a string.
  function compileValue(text) {
    const parts = String(text).split(/\{\{([\s\S]+?)\}\}/g);
    if (parts.length === 1) return { raw: false, get: () => text };
    if (parts.length === 3 && parts[0] === '' && parts[2] === '') return { raw: true, get: compileExpr(parts[1]) };
    const getters = parts.map((p, i) => (i & 1 ? compileExpr(p) : null));
    return {
      raw: false,
      get: (s) => {
        let out = '';
        for (let i = 0; i < parts.length; i++) {
          if (i & 1) { const v = getters[i](s); out += v == null || v === false ? '' : String(v); }
          else out += parts[i];
        }
        return out;
      },
    };
  }

  // ---- inline styles: "a: b; c: d" -> { a: 'b', c: 'd' } ----
  const styleCache = new Map();
  function parseStyle(css) {
    if (styleCache.has(css)) return styleCache.get(css);
    const out = {};
    let depth = 0, start = 0;
    const decls = [];
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) { decls.push(css.slice(start, i)); start = i + 1; }
    }
    decls.push(css.slice(start));
    for (const d of decls) {
      const c = d.indexOf(':');
      if (c < 0) continue;
      const prop = d.slice(0, c).trim();
      const val = d.slice(c + 1).trim();
      if (!prop || val === '') continue;
      const key = prop.startsWith('--') ? prop : prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_, x) => x.toUpperCase());
      out[key] = val;
    }
    if (styleCache.size > 5000) styleCache.clear();
    styleCache.set(css, out);
    return out;
  }

  // ---- attribute names: HTML (lowercased by the parser) -> React ----
  const EVENTS = {};
  ['Click', 'ContextMenu', 'Change', 'Input', 'Focus', 'Blur', 'KeyDown', 'KeyUp', 'KeyPress',
    'PointerDown', 'PointerUp', 'PointerMove', 'PointerEnter', 'PointerLeave', 'PointerCancel', 'PointerOver', 'PointerOut',
    'GotPointerCapture', 'LostPointerCapture', 'MouseDown', 'MouseUp', 'MouseMove', 'MouseEnter', 'MouseLeave',
    'TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Scroll', 'Wheel', 'Submit', 'AnimationEnd', 'AnimationStart',
    'TransitionEnd', 'Load', 'Error', 'Paste', 'Copy', 'Cut', 'DragStart', 'DragEnd', 'DragOver', 'Drop',
    'CompositionStart', 'CompositionEnd', 'BeforeInput', 'Select'].forEach((e) => { EVENTS['on' + e.toLowerCase()] = 'on' + e; });
  EVENTS.ondblclick = 'onDoubleClick';
  const NAMES = {
    class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autocomplete: 'autoComplete', inputmode: 'inputMode',
    readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', autofocus: 'autoFocus', spellcheck: 'spellCheck',
    enterkeyhint: 'enterKeyHint', autocapitalize: 'autoCapitalize', autocorrect: 'autoCorrect', contenteditable: 'contentEditable',
    crossorigin: 'crossOrigin', srcset: 'srcSet', colspan: 'colSpan', rowspan: 'rowSpan', novalidate: 'noValidate',
    'xlink:href': 'xlinkHref', playsinline: 'playsInline',
  };
  const BOOLEAN = new Set(['disabled', 'checked', 'readOnly', 'required', 'hidden', 'autoFocus', 'multiple', 'selected', 'open', 'noValidate', 'playsInline', 'muted', 'loop', 'autoPlay', 'controls']);
  const FORM = new Set(['input', 'textarea', 'select']);
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

  // ---- template compile: DOM node -> (scope, key) => React node ----
  function compileChildren(node) {
    const out = [];
    node.childNodes.forEach((c) => { const r = compileNode(c); if (r) out.push(r); });
    return out;
  }
  const renderAll = (list, s) => list.map((r, i) => r(s, i));

  function compileNode(node) {
    if (node.nodeType === 3) {
      const text = node.nodeValue || '';
      if (!text.includes('{{')) {
        if (!text.trim() && !text.includes(' ')) return null; // newline-only whitespace between tags
        return () => text;
      }
      const v = compileValue(text);
      return (s, key) => {
        const x = v.get(s);
        return x == null || x === false ? null : h(Fragment, { key }, String(x));
      };
    }
    if (node.nodeType !== 1) return null;
    const tag = node.localName;
    if (tag === 'helmet' || tag === 'sc-helmet' || tag === 'script') return null;

    if (tag === 'sc-if') {
      const test = compileExpr(stripBraces(node.getAttribute('value') || ''));
      const kids = compileChildren(node);
      return (s, key) => (test(s) ? h(Fragment, { key }, ...renderAll(kids, s)) : null);
    }

    if (tag === 'sc-for') {
      const list = compileExpr(stripBraces(node.getAttribute('list') || ''));
      const as = node.getAttribute('as') || 'item';
      const kids = compileChildren(node);
      return (s, key) => {
        const arr = list(s);
        if (!Array.isArray(arr)) return null;
        return h(Fragment, { key }, arr.map((item, i) => {
          const scope = Object.create(s);
          scope[as] = item;
          scope.$index = i;
          return h(Fragment, { key: i }, ...renderAll(kids, scope));
        }));
      };
    }

    if (tag === 'dc-import' || tag === 'x-import') {
      const name = node.getAttribute('name') || node.getAttribute('component') || '';
      const props = [];
      for (const a of Array.from(node.attributes)) {
        if (a.name === 'name' || a.name === 'component' || a.name === 'style' || a.name.startsWith('hint-')) continue;
        props.push([a.name, compileValue(a.value)]);
      }
      return (s, key) => {
        const p = { key, __name: name };
        for (const [n, v] of props) p[n] = v.get(s);
        return h(DCHost, p);
      };
    }

    // an ordinary element
    const form = FORM.has(tag);
    const attrs = [];
    for (const a of Array.from(node.attributes)) {
      let name = a.name;
      if (name.startsWith('hint-')) continue;
      const lower = name.toLowerCase();
      if (EVENTS[lower]) name = EVENTS[lower];
      else if (NAMES[lower]) name = NAMES[lower];
      const v = compileValue(a.value);
      if (!v.raw && !a.value.includes('{{')) {
        // static attribute
        let val = a.value;
        if (name === 'style') val = parseStyle(val);
        else if (BOOLEAN.has(name)) val = true;
        if (form && name === 'value') name = 'defaultValue';
        if (form && name === 'checked') name = 'defaultChecked';
        if (name.startsWith('on')) continue; // inline JS handlers aren't part of the format
        attrs.push([name, () => val]);
        continue;
      }
      const isEvent = name.startsWith('on') && name.length > 2 && name[2] === name[2].toUpperCase();
      const aria = name.startsWith('aria-') || name.startsWith('data-');
      attrs.push([name, (s) => {
        let x = v.get(s);
        if (name === 'style') return typeof x === 'string' ? parseStyle(x) : x;
        if (isEvent) return typeof x === 'function' ? x : undefined;
        if (form && name === 'value' && x == null) return '';
        if (form && name === 'checked') return !!x;
        if (aria && (typeof x === 'boolean' || typeof x === 'number')) return String(x);
        return x;
      }]);
    }
    const kids = VOID.has(tag) ? [] : compileChildren(node);
    return (s, key) => {
      const p = { key };
      for (const [n, g] of attrs) {
        const x = g(s);
        if (x !== undefined && x !== null) p[n] = x;
      }
      if (form && 'value' in p && !p.onChange && !p.onInput) p.readOnly = true;
      return kids.length ? h(tag, p, ...renderAll(kids, s)) : h(tag, p);
    };
  }

  function stripBraces(v) {
    const m = String(v).match(/^\s*\{\{([\s\S]*)\}\}\s*$/);
    return m ? m[1] : v;
  }

  // ---- the logic base class ----
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this.__host = null; }
    setState(patch, cb) { if (this.__host) this.__host.__setLogicState(patch, cb); }
    forceUpdate() { if (this.__host) this.__host.forceUpdate(); }
    componentDidMount() {}
    componentDidUpdate() {}
    componentWillUnmount() {}
    renderVals() { return {}; }
  }

  // ---- registry ----
  const registry = {};
  const helmetDone = new Set();

  function register(name, source) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const root = doc.querySelector('x-dc');
    if (!root) throw new Error(name + ': no <x-dc> template');
    const helmet = root.querySelector(':scope > helmet');
    const script = doc.querySelector('script[data-dc-script]');
    let defaults = {};
    let Logic = DCLogic;
    if (script) {
      try {
        const meta = JSON.parse(script.getAttribute('data-props') || '{}');
        for (const k of Object.keys(meta)) {
          if (k[0] !== '$' && meta[k] && typeof meta[k] === 'object' && 'default' in meta[k]) defaults[k] = meta[k].default;
        }
      } catch (e) { console.warn('[runtime] bad data-props in ' + name, e); }
      const code = script.textContent;
      const C = new Function('DCLogic', 'StreamableLogic', 'React', code + '\n;return (typeof Component!=="undefined"&&Component)||undefined;')(DCLogic, DCLogic, React);
      if (typeof C === 'function') Logic = C;
    }
    registry[name] = { name, render: compileChildren(root), helmet, defaults, Logic };
  }

  function applyHelmet(def) {
    if (!def.helmet || helmetDone.has(def.name)) return;
    helmetDone.add(def.name);
    Array.from(def.helmet.children).forEach((el) => document.head.appendChild(document.importNode(el, true)));
  }

  // ---- a component instance: logic object + template ----
  class DCHost extends React.Component {
    constructor(props) {
      super(props);
      this.def = registry[props.__name];
      this.state = { v: 0 };
      if (!this.def) return;
      applyHelmet(this.def);
      this.logic = new this.def.Logic(this.userProps());
      if (!this.logic.state) this.logic.state = {};
      this.logic.__host = this;
    }
    userProps() {
      const p = { ...(this.def ? this.def.defaults : {}) };
      for (const k in this.props) if (k !== '__name' && k !== 'key') p[k] = this.props[k];
      return p;
    }
    __setLogicState(patch, cb) {
      const prev = this.logic.state;
      const d = typeof patch === 'function' ? patch(prev, this.logic.props) : patch;
      this.logic.state = { ...prev, ...d };
      this.setState((s) => ({ v: s.v + 1 }), cb);
    }
    componentDidMount() { try { this.logic && this.logic.componentDidMount(); } catch (e) { console.error(e); } }
    componentDidUpdate(prev) {
      if (!this.logic) return;
      try { this.logic.componentDidUpdate(this.__prevProps || prev); } catch (e) { console.error(e); }
    }
    componentWillUnmount() { try { this.logic && this.logic.componentWillUnmount(); } catch (e) { console.error(e); } }
    render() {
      if (!this.def) return h('span', { style: { color: 'red' } }, 'Missing component ' + this.props.__name);
      this.__prevProps = this.logic.props;
      this.logic.props = this.userProps();
      let vals;
      try { vals = this.logic.renderVals() || {}; } catch (e) { console.error('[runtime] renderVals failed in ' + this.def.name, e); vals = {}; }
      const scope = Object.assign(Object.create(null), this.logic.props, vals);
      return h(Fragment, null, ...renderAll(this.def.render, scope));
    }
  }

  window.DCRuntime = {
    register,
    mount(name, el, props) {
      ReactDOM.createRoot(el).render(h(DCHost, { __name: name, ...(props || {}) }));
    },
  };
})();
