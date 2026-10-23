/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),i=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const s=this.t;if(e&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=i.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&i.set(s,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,s,i)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[i+1],t[0]);return new n(i,t,s)},o=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:a,defineProperty:l,getOwnPropertyDescriptor:d,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:u}=Object,p=globalThis,_=p.trustedTypes,g=_?_.emptyScript:"",m=p.reactiveElementPolyfillSupport,f=(t,e)=>t,$={toAttribute(t,e){switch(e){case Boolean:t=t?g:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch(t){s=null}}return s}},v=(t,e)=>!a(t,e),b={attribute:!0,type:String,converter:$,reflect:!1,useDefault:!1,hasChanged:v};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),p.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(t,s,e);void 0!==i&&l(this.prototype,t,i)}}static getPropertyDescriptor(t,e,s){const{get:i,set:n}=d(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:i,set(e){const r=i?.call(this);n?.call(this,e),this.requestUpdate(t,r,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...c(t),...h(t)];for(const s of e)this.createProperty(s,t[s])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,s]of e)this.elementProperties.set(t,s)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const t of s)e.unshift(o(t))}else void 0!==t&&e.push(o(t));return e}static _$Eu(t,e){const s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,i)=>{if(e)s.adoptedStyleSheets=i.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of i){const i=document.createElement("style"),n=t.litNonce;void 0!==n&&i.setAttribute("nonce",n),i.textContent=e.cssText,s.appendChild(i)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),i=this.constructor._$Eu(t,s);if(void 0!==i&&!0===s.reflect){const n=(void 0!==s.converter?.toAttribute?s.converter:$).toAttribute(e,s.type);this._$Em=t,null==n?this.removeAttribute(i):this.setAttribute(i,n),this._$Em=null}}_$AK(t,e){const s=this.constructor,i=s._$Eh.get(t);if(void 0!==i&&this._$Em!==i){const t=s.getPropertyOptions(i),n="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:$;this._$Em=i;const r=n.fromAttribute(e,t.type);this[i]=r??this._$Ej?.get(i)??r,this._$Em=null}}requestUpdate(t,e,s,i=!1,n){if(void 0!==t){const r=this.constructor;if(!1===i&&(n=this[t]),s??=r.getPropertyOptions(t),!((s.hasChanged??v)(n,e)||s.useDefault&&s.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,s))))return;this.C(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:i,wrapped:n},r){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??e??this[t]),!0!==n||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),!0===i&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,s]of t){const{wrapped:t}=s,i=this[e];!0!==t||this._$AL.has(e)||void 0===i||this.C(e,void 0,s,i)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[f("elementProperties")]=new Map,y[f("finalized")]=new Map,m?.({ReactiveElement:y}),(p.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const x=globalThis,k=t=>t,w=x.trustedTypes,A=w?w.createPolicy("lit-html",{createHTML:t=>t}):void 0,E="$lit$",S=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+S,M=`<${C}>`,z=document,T=()=>z.createComment(""),D=t=>null===t||"object"!=typeof t&&"function"!=typeof t,P=Array.isArray,H="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,R=/>/g,L=RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),O=/'/g,B=/"/g,V=/^(?:script|style|textarea|title)$/i,W=t=>(e,...s)=>({_$litType$:t,strings:e,values:s}),j=W(1),I=W(2),F=Symbol.for("lit-noChange"),G=Symbol.for("lit-nothing"),Z=new WeakMap,q=z.createTreeWalker(z,129);function K(t,e){if(!P(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(e):e}const Q=(t,e)=>{const s=t.length-1,i=[];let n,r=2===e?"<svg>":3===e?"<math>":"",o=N;for(let e=0;e<s;e++){const s=t[e];let a,l,d=-1,c=0;for(;c<s.length&&(o.lastIndex=c,l=o.exec(s),null!==l);)c=o.lastIndex,o===N?"!--"===l[1]?o=U:void 0!==l[1]?o=R:void 0!==l[2]?(V.test(l[2])&&(n=RegExp("</"+l[2],"g")),o=L):void 0!==l[3]&&(o=L):o===L?">"===l[0]?(o=n??N,d=-1):void 0===l[1]?d=-2:(d=o.lastIndex-l[2].length,a=l[1],o=void 0===l[3]?L:'"'===l[3]?B:O):o===B||o===O?o=L:o===U||o===R?o=N:(o=L,n=void 0);const h=o===L&&t[e+1].startsWith("/>")?" ":"";r+=o===N?s+M:d>=0?(i.push(a),s.slice(0,d)+E+s.slice(d)+S+h):s+S+(-2===d?e:h)}return[K(t,r+(t[s]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),i]};class Y{constructor({strings:t,_$litType$:e},s){let i;this.parts=[];let n=0,r=0;const o=t.length-1,a=this.parts,[l,d]=Q(t,e);if(this.el=Y.createElement(l,s),q.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(i=q.nextNode())&&a.length<o;){if(1===i.nodeType){if(i.hasAttributes())for(const t of i.getAttributeNames())if(t.endsWith(E)){const e=d[r++],s=i.getAttribute(t).split(S),o=/([.?@])?(.*)/.exec(e);a.push({type:1,index:n,name:o[2],strings:s,ctor:"."===o[1]?st:"?"===o[1]?it:"@"===o[1]?nt:et}),i.removeAttribute(t)}else t.startsWith(S)&&(a.push({type:6,index:n}),i.removeAttribute(t));if(V.test(i.tagName)){const t=i.textContent.split(S),e=t.length-1;if(e>0){i.textContent=w?w.emptyScript:"";for(let s=0;s<e;s++)i.append(t[s],T()),q.nextNode(),a.push({type:2,index:++n});i.append(t[e],T())}}}else if(8===i.nodeType)if(i.data===C)a.push({type:2,index:n});else{let t=-1;for(;-1!==(t=i.data.indexOf(S,t+1));)a.push({type:7,index:n}),t+=S.length-1}n++}}static createElement(t,e){const s=z.createElement("template");return s.innerHTML=t,s}}function X(t,e,s=t,i){if(e===F)return e;let n=void 0!==i?s._$Co?.[i]:s._$Cl;const r=D(e)?void 0:e._$litDirective$;return n?.constructor!==r&&(n?._$AO?.(!1),void 0===r?n=void 0:(n=new r(t),n._$AT(t,s,i)),void 0!==i?(s._$Co??=[])[i]=n:s._$Cl=n),void 0!==n&&(e=X(t,n._$AS(t,e.values),n,i)),e}class J{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,i=(t?.creationScope??z).importNode(e,!0);q.currentNode=i;let n=q.nextNode(),r=0,o=0,a=s[0];for(;void 0!==a;){if(r===a.index){let e;2===a.type?e=new tt(n,n.nextSibling,this,t):1===a.type?e=new a.ctor(n,a.name,a.strings,this,t):6===a.type&&(e=new rt(n,this,t)),this._$AV.push(e),a=s[++o]}r!==a?.index&&(n=q.nextNode(),r++)}return q.currentNode=z,i}p(t){let e=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,i){this.type=2,this._$AH=G,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=X(this,t,e),D(t)?t===G||null==t||""===t?(this._$AH!==G&&this._$AR(),this._$AH=G):t!==this._$AH&&t!==F&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>P(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==G&&D(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,i="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=Y.createElement(K(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(e);else{const t=new J(i,this),s=t.u(this.options);t.p(e),this.T(s),this._$AH=t}}_$AC(t){let e=Z.get(t.strings);return void 0===e&&Z.set(t.strings,e=new Y(t)),e}k(t){P(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,i=0;for(const n of t)i===e.length?e.push(s=new tt(this.O(T()),this.O(T()),this,this.options)):s=e[i],s._$AI(n),i++;i<e.length&&(this._$AR(s&&s._$AB.nextSibling,i),e.length=i)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=k(t).nextSibling;k(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,i,n){this.type=1,this._$AH=G,this._$AN=void 0,this.element=t,this.name=e,this._$AM=i,this.options=n,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=G}_$AI(t,e=this,s,i){const n=this.strings;let r=!1;if(void 0===n)t=X(this,t,e,0),r=!D(t)||t!==this._$AH&&t!==F,r&&(this._$AH=t);else{const i=t;let o,a;for(t=n[0],o=0;o<n.length-1;o++)a=X(this,i[s+o],e,o),a===F&&(a=this._$AH[o]),r||=!D(a)||a!==this._$AH[o],a===G?t=G:t!==G&&(t+=(a??"")+n[o+1]),this._$AH[o]=a}r&&!i&&this.j(t)}j(t){t===G?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class st extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===G?void 0:t}}class it extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==G)}}class nt extends et{constructor(t,e,s,i,n){super(t,e,s,i,n),this.type=5}_$AI(t,e=this){if((t=X(this,t,e,0)??G)===F)return;const s=this._$AH,i=t===G&&s!==G||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,n=t!==G&&(s===G||i);i&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){X(this,t)}}const ot=x.litHtmlPolyfillSupport;ot?.(Y,tt),(x.litHtmlVersions??=[]).push("3.3.3");const at=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class lt extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,s)=>{const i=s?.renderBefore??e;let n=i._$litPart$;if(void 0===n){const t=s?.renderBefore??null;i._$litPart$=n=new tt(e.insertBefore(T(),t),t,void 0,s??{})}return n._$AI(t),n})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return F}}lt._$litElement$=!0,lt.finalized=!0,at.litElementHydrateSupport?.({LitElement:lt});const dt=at.litElementPolyfillSupport;function ct(t,e,s){const i="string"==typeof s?s.trim():s;i?t[e]=i:delete t[e]}function ht(t){const e=new Map;for(const s of t)e.has(s.stat_consumption)||e.set(s.stat_consumption,{stat:s.stat_consumption,device:s,children:[],problem:null});const s=function(t){const e=new Map;for(const s of t)e.has(s.stat_consumption)||e.set(s.stat_consumption,s.included_in_stat??null);return e}(t),i=function(t){const e=new Set,s=new Set;for(const i of t.keys()){const n=[],r=new Map;let o=i;for(;null!==o&&t.has(o)&&!s.has(o);){const s=r.get(o);if(void 0!==s){n.slice(s).forEach(t=>e.add(t));break}r.set(o,n.length),n.push(o),o=t.get(o)??null}n.forEach(t=>s.add(t))}return e}(s),n=[];for(const[t,r]of e){const o=s.get(t)??null;i.has(t)?(r.problem="cycle",n.push(r)):null===o?n.push(r):e.has(o)?e.get(o).children.push(r):(r.problem="missing_parent",n.push(r))}return n}function ut(t){return t.flatMap(t=>[t,...ut(t.children)])}function pt(t,e,s){const i=t.find(t=>t.stat_consumption===e);return void 0!==i&&((i.included_in_stat??null)!==s&&(null===s||!function(t,e){const s=new Set([e]);let i=!0;for(;i;){i=!1;for(const e of t){const t=e.included_in_stat;t&&s.has(t)&&!s.has(e.stat_consumption)&&(s.add(e.stat_consumption),i=!0)}}return s}(t,e).has(s)))}function _t(t,e){return t.map(t=>t.stat_consumption).filter(s=>pt(t,e,s))}dt?.({LitElement:lt}),(at.litElementVersions??=[]).push("4.2.2");const gt={mW:.001,W:1,kW:1e3,MW:1e6};function mt(t,e){const s=e?t.states[e]:void 0;if(void 0===s)return null;const i=Number.parseFloat(s.state),n=gt[s.attributes.unit_of_measurement??"W"];return Number.isFinite(i)&&void 0!==n?i*n:null}function ft(t,e){const s=new Map;for(const i of ut(t)){if(0===i.children.length)continue;const t=e.get(i.stat)??null,n=i.children.map(t=>e.get(t.stat)??null);s.set(i.stat,null===t||n.some(t=>null===t)?null:t-n.reduce((t,e)=>t+(e??0),0))}return s}const $t={grid:["import","export"],solar:["production",null],battery:["discharge","charge"],gas:["consumption",null],water:["consumption",null]};function vt(t){const e=[];for(const s of t){const[t,i]=$t[s.type]??["consumption",null];s.stat_energy_from&&e.push({type:s.type,role:t,stat:s.stat_energy_from,name:s.name}),null!==i&&s.stat_energy_to&&e.push({type:s.type,role:i,stat:s.stat_energy_to,name:s.name})}return e}const bt={menu:"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",dots:"M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",refresh:"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",home:"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",undo:"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",history:"M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"};function yt(t){return I`<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d=${bt[t]}></path></svg>`}const xt=220,kt=72,wt=160,At=24,Et=24,St="home",Ct=["import","production","battery","export"],Mt=["import","production","discharge","consumption"];function zt(t,e,s){return t.map(t=>{const i=0===t.children.length||s.has(t.stat)?[]:[...zt(t.children,e,s),{id:(n=t.stat,`untracked:${n}`),kind:"untracked",stat:t.stat,children:[]}];var n;return{id:t.stat,kind:"device",stat:t.stat,node:t,children:i}})}function Tt(t){if(0===t.children.length)return xt;const e=t.children.reduce((t,e)=>t+Tt(e),0);return Math.max(xt,e+At*(t.children.length-1))}function Dt(t,e,s,i,n=new Set){const r=[],o=[],a=new Set(e.map(t=>"battery"===t.type?"battery":t.role)),l=e.map((t,e)=>({id:`source:${e}`,kind:"source",x:0,y:Et,w:wt,h:kt,stat:t.stat,role:t.role,source:t}));for(const t of Ct)a.has(t)||l.push({id:`placeholder:${t}`,kind:"placeholder",x:0,y:Et,w:wt,h:kt,role:t});const d=l.length*wt+(l.length-1)*At,c=zt(t,i,n),h=c.length?c.reduce((t,e)=>t+Tt(e),0)+At*(c.length-1):xt,u=Math.max(d,h,xt),p=Et+u/2;let _=p-d/2;for(const t of l)t.x=_,_+=184,r.push(t);r.push({id:St,kind:"home",x:p-110,y:152,w:xt,h:kt});for(const t of l){if("source"!==t.kind)continue;const e=Mt.includes(t.role);o.push({from:e?t.id:St,to:e?St:t.id,kind:"source",power:null})}let g=224;const m=(t,e,n,a)=>{const l=Tt(t),d=152+128*(n+1);g=Math.max(g,d+kt),r.push({id:t.id,kind:t.kind,x:e+(l-xt)/2,y:d,w:xt,h:kt,stat:t.stat,node:t.node}),o.push({from:a,to:t.id,kind:t.kind,power:"untracked"===t.kind?i.get(t.stat)??null:s.get(t.stat)??null});let c=e+(l-(t.children.reduce((t,e)=>t+Tt(e),0)+At*(t.children.length-1)))/2;for(const e of t.children)m(e,c,n+1,t.id),c+=Tt(e)+At};let f=p-h/2;for(const t of c)m(t,f,0,St),f+=Tt(t)+At;return{blocks:r,edges:o,width:u+48,height:g+Et}}const Pt={title:"Energy Flow Mapper",menu:"Menu",more:"More",reload:"Reload",undo:"Undo last save",backups:"Backups",loading:"Loading…",load_failed:"The energy settings could not be loaded.",sources:"Sources",sources_hint:"Sources are only shown here. Change them in the energy settings.",open_energy_settings:"Energy settings",no_sources:"No sources configured.",role_import:"Grid import",role_export:"Grid export",role_production:"Solar production",role_discharge:"Battery discharge",role_charge:"Battery charge",role_gas:"Gas",role_water:"Water",diagram:"Energy flow",zoom_hint:"Zoom with the mouse wheel or two fingers, drag an empty area to move.",zoom_in:"Zoom in",zoom_out:"Zoom out",fit:"Fit",role_battery:"Battery",home_measured:"{power} measured",devices:"Devices",devices_hint:"Drag a device onto another one to include it there, or use the ⋮ menu.",home:"Home",home_drop:"Drop here for the top level",no_devices:"No devices in the energy dashboard yet. Add a free sensor.",untracked:"Not tracked individually",free_sensors:"Free sensors",free_sensors_hint:"Energy meters that are not in the energy dashboard yet.",search:"Search",no_candidates:"No free energy sensors.",add:"Add",add_title:"Add {name} under …",with_power:"Power sensor: {entity}",actions:"Actions for {name}",move:"Move to …",move_title:"Move {name} to …",top_level:"Top level (Home)",no_targets:"There is no other place for this device.",rename:"Rename …",rename_title:"Rename {name}",name_label:"Name",name_hint:"Leave empty to use the entity name.",remove:"Remove from the energy dashboard",remove_hint:"Its devices move up one level.",cancel:"Cancel",ok:"OK",close:"Close",details:"Details",select_hint:"Select a device to see its details.",detail_statistic:"Statistic",detail_power_sensor:"Power sensor",detail_device:"Device",detail_area:"Area",detail_power:"Power now",detail_untracked:"Not tracked by its devices",detail_issues:"Problems",none:"–",change_one:"1 change",change_other:"{count} changes",discard:"Discard",save:"Save",confirm_title:"Save changes?",confirm_errors:"Fix these problems first:",confirm_warnings:"Please note:",checking:"Checking …",saving:"Saving …",saved:"Saved. A backup of the previous settings was created.",nothing_to_save:"Nothing changed.",diff_added:"{name} added",diff_added_under:"{name} added under {to}",diff_removed:"{name} removed",diff_moved:"{name} moved under {to}",diff_moved_top:"{name} moved to the top level",diff_renamed:"{name} renamed to “{to}”",diff_renamed_reset:"{name} uses the entity name again",diff_rate:"Power sensor of {name} changed",issue_cycle:"Part of a loop of devices",issue_self_parent:"Included in itself",issue_duplicate:"Listed more than once",issue_missing_parent:"Its parent device is not in the energy dashboard",issue_source_and_device:"Also used as a source",issue_statistic_missing:"Statistic not found",issue_not_energy_unit:"Unit {unit} is not an energy unit",issue_children_exceed_parent:"Its devices use more than this device",backups_title:"Backups",backups_empty:"No backups yet. One is created before every save.",backup_by:"by {user}",restore:"Restore",restore_confirm:"Restore the backup from {date}? The current settings are backed up first.",undo_confirm:"Restore the settings from before the last save ({date})? The current settings are backed up first.",draft_lost:"Your unsaved changes will be discarded.",restored:"Backup restored.",summary_added:"{count} added",summary_removed:"{count} removed",summary_moved:"{count} moved",summary_renamed:"{count} renamed",summary_rate:"{count} power sensor changed",summary_restored:"Restored a backup",error_conflict:"The energy settings were changed elsewhere in the meantime. They were reloaded; check your changes and save again.",error_not_loaded:"Energy Flow Mapper is not loaded.",error_unsupported_energy_api:"The energy settings of this Home Assistant release are not supported. The editor is disabled to protect your settings.",error_unknown:"Error: {message}"},Ht={de:{title:"Energy Flow Mapper",menu:"Menü",more:"Mehr",reload:"Neu laden",undo:"Letztes Speichern rückgängig machen",backups:"Sicherungen",loading:"Wird geladen …",load_failed:"Die Energie-Einstellungen konnten nicht geladen werden.",sources:"Quellen",sources_hint:"Quellen werden hier nur angezeigt. Ändern kannst du sie in den Energie-Einstellungen.",open_energy_settings:"Energie-Einstellungen",no_sources:"Keine Quellen eingerichtet.",role_import:"Netz-Bezug",role_export:"Einspeisung",role_production:"Solar-Ertrag",role_discharge:"Batterie entladen",role_charge:"Batterie laden",role_gas:"Gas",role_water:"Wasser",diagram:"Energiefluss",zoom_hint:"Zoomen mit dem Mausrad oder zwei Fingern, Ziehen auf freier Fläche verschiebt.",zoom_in:"Vergrössern",zoom_out:"Verkleinern",fit:"Einpassen",role_battery:"Batterie",home_measured:"{power} gemessen",devices:"Geräte",devices_hint:"Zieh ein Gerät auf ein anderes, um es dort unterzuordnen, oder nutze das ⋮-Menü.",home:"Zuhause",home_drop:"Hier ablegen für die oberste Ebene",no_devices:"Noch keine Geräte im Energie-Dashboard. Füge einen freien Sensor hinzu.",untracked:"Nicht einzeln erfasst",free_sensors:"Freie Sensoren",free_sensors_hint:"Energie-Zähler, die noch nicht im Energie-Dashboard sind.",search:"Suchen",no_candidates:"Keine freien Energie-Sensoren.",add:"Hinzufügen",add_title:"{name} hinzufügen unter …",with_power:"Leistungssensor: {entity}",actions:"Aktionen für {name}",move:"Verschieben nach …",move_title:"{name} verschieben nach …",top_level:"Oberste Ebene (Zuhause)",no_targets:"Für dieses Gerät gibt es keinen anderen Platz.",rename:"Umbenennen …",rename_title:"{name} umbenennen",name_label:"Name",name_hint:"Leer lassen, um den Namen der Entity zu verwenden.",remove:"Aus dem Energie-Dashboard entfernen",remove_hint:"Seine Geräte rutschen eine Ebene nach oben.",cancel:"Abbrechen",ok:"OK",close:"Schliessen",details:"Details",select_hint:"Wähle ein Gerät, um Details zu sehen.",detail_statistic:"Statistik",detail_power_sensor:"Leistungssensor",detail_device:"Gerät",detail_area:"Bereich",detail_power:"Leistung jetzt",detail_untracked:"Nicht von seinen Geräten erfasst",detail_issues:"Probleme",none:"–",change_one:"1 Änderung",change_other:"{count} Änderungen",discard:"Verwerfen",save:"Speichern",confirm_title:"Änderungen speichern?",confirm_errors:"Behebe zuerst diese Probleme:",confirm_warnings:"Bitte beachten:",checking:"Wird geprüft …",saving:"Wird gespeichert …",saved:"Gespeichert. Die vorherigen Einstellungen wurden gesichert.",nothing_to_save:"Es hat sich nichts geändert.",diff_added:"{name} hinzugefügt",diff_added_under:"{name} hinzugefügt unter {to}",diff_removed:"{name} entfernt",diff_moved:"{name} verschoben unter {to}",diff_moved_top:"{name} auf die oberste Ebene verschoben",diff_renamed:"{name} umbenannt in «{to}»",diff_renamed_reset:"{name} verwendet wieder den Namen der Entity",diff_rate:"Leistungssensor von {name} geändert",issue_cycle:"Teil einer Schleife von Geräten",issue_self_parent:"Sich selbst untergeordnet",issue_duplicate:"Mehrfach eingetragen",issue_missing_parent:"Das übergeordnete Gerät ist nicht im Energie-Dashboard",issue_source_and_device:"Wird auch als Quelle verwendet",issue_statistic_missing:"Statistik nicht gefunden",issue_not_energy_unit:"Die Einheit {unit} ist keine Energie-Einheit",issue_children_exceed_parent:"Seine Geräte verbrauchen mehr als dieses Gerät",backups_title:"Sicherungen",backups_empty:"Noch keine Sicherungen. Vor jedem Speichern wird eine angelegt.",backup_by:"von {user}",restore:"Wiederherstellen",restore_confirm:"Die Sicherung vom {date} wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",undo_confirm:"Die Einstellungen von vor dem letzten Speichern ({date}) wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",draft_lost:"Deine ungespeicherten Änderungen gehen dabei verloren.",restored:"Sicherung wiederhergestellt.",summary_added:"{count} hinzugefügt",summary_removed:"{count} entfernt",summary_moved:"{count} verschoben",summary_renamed:"{count} umbenannt",summary_rate:"{count} Leistungssensor geändert",summary_restored:"Sicherung wiederhergestellt",error_conflict:"Die Energie-Einstellungen wurden in der Zwischenzeit an anderer Stelle geändert. Sie wurden neu geladen; prüfe deine Änderungen und speichere noch einmal.",error_not_loaded:"Energy Flow Mapper ist nicht geladen.",error_unsupported_energy_api:"Die Energie-Einstellungen dieser Home-Assistant-Version werden nicht unterstützt. Zum Schutz deiner Einstellungen ist der Editor deaktiviert.",error_unknown:"Fehler: {message}"},en:Pt};function Nt(t){return t?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function Ut(t,e,s={}){return(i=Nt(t),Ht[i]??Ht[i.split("-")[0]]??Pt)[e].replace(/\{(\w+)\}/g,(t,e)=>e in s?s[e]:t);var i}function Rt(t){return t in Pt}const Lt={comma_decimal:["en-US","en"],decimal_comma:["de","es","it"],quote_decimal:["de-CH"],space_comma:["fr","sv","cs"],system:void 0};function Ot(t,e,s=0){const i=t?.locale.number_format??"language",n=i in Lt?Lt[i]:"none"===i?["en-US"]:[Nt(t)];try{return new Intl.NumberFormat(n,{useGrouping:"none"!==i,maximumFractionDigits:s}).format(e)}catch{return String(e)}}function Bt(t,e){return Math.abs(e)>=1e3?`${Ot(t,e/1e3,2)} kW`:`${Ot(t,e)} W`}function Vt(t,e){try{return new Intl.DateTimeFormat(Nt(t),{dateStyle:"medium",timeStyle:"short"}).format(new Date(e))}catch{return e}}const Wt="energy-flow-mapper-panel",jt="energy_flow_mapper",It=4e3,Ft="__home__",Gt=.2,Zt=2.5,qt=.8,Kt=48,Qt={import:"var(--energy-grid-consumption-color, #488fc2)",export:"var(--energy-grid-return-color, #8353d1)",production:"var(--energy-solar-color, #ff9800)",battery:"var(--energy-battery-out-color, #4db6ac)",discharge:"var(--energy-battery-out-color, #4db6ac)",charge:"var(--energy-battery-in-color, #f06292)",consumption:"var(--energy-gas-color, #8e021b)"};function Yt(t,e){const s=e??{},i=`error_${s.translation_key??""}`;return s.translation_key&&Rt(i)?Ut(t,i):Ut(t,"error_unknown",{message:s.message??String(e)})}function Xt(t){history.pushState(null,"",t),window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:!1}}))}class Jt extends lt{static properties={hass:{attribute:!1},narrow:{type:Boolean},_snapshot:{state:!0},_loadError:{state:!0},_changes:{state:!0},_validation:{state:!0},_selected:{state:!0},_collapsed:{state:!0},_dragged:{state:!0},_dropTarget:{state:!0},_search:{state:!0},_dialog:{state:!0},_busy:{state:!0},_toast:{state:!0},_renameValue:{state:!0},_view:{state:!0},_zoom:{state:!0}};_loading=!1;_validateRequest=0;_toastTimer;_fitted=!1;_pointers=new Map;_pointerType="mouse";constructor(){super(),this.narrow=!1,this._snapshot=null,this._loadError=null,this._changes=[],this._validation=null,this._selected=null,this._collapsed=new Set,this._dragged=null,this._dropTarget=null,this._search="",this._dialog=null,this._busy=!1,this._toast=null,this._renameValue="",this._view="diagram",this._zoom={x:0,y:0,k:1}}_t(t,e={}){return Ut(this.hass,t,e)}willUpdate(t){!t.has("hass")||!this.hass||this._snapshot||this._loading||this._loadError||this._load()}async _load(){if(this.hass){this._loading=!0;try{this._snapshot=await this.hass.callWS({type:`${jt}/get`}),this._loadError=null}catch(t){this._loadError=Yt(this.hass,t)}finally{this._loading=!1}await this._validate()}}get draft(){return function(t,e){const s=structuredClone(t);for(const t of e){const e=s.findIndex(e=>e.stat_consumption===t.stat);if("add"===t.type){if(-1!==e)continue;const i={stat_consumption:t.stat};ct(i,"stat_rate",t.stat_rate),ct(i,"name",t.name),ct(i,"included_in_stat",t.parent),s.push(i);continue}if(-1!==e)if("move"===t.type)ct(s[e],"included_in_stat",t.parent);else if("rename"===t.type)ct(s[e],"name",t.name);else{const[i]=s.splice(e,1);for(const e of s)e.included_in_stat===t.stat&&ct(e,"included_in_stat",i.included_in_stat)}}return s}(this._snapshot?.prefs.device_consumption??[],this._changes)}_name(t,e=this.draft){return function(t,e,s){const i=e.find(e=>e.stat_consumption===t);return i?.name||s[t]?.name||t}(t,e,{...this._snapshot?.stats,...Object.fromEntries((this._snapshot?.candidates??[]).map(t=>[t.stat,t]))})}_issues(){return this._validation?.issues??this._snapshot?.issues??[]}_issuesFor(t){return this._issues().filter(e=>e.stat===t)}_change(t){this._changes=[...this._changes,t],this._validate()}async _validate(){const t=++this._validateRequest;if(!this.hass||!this._snapshot||0===this._changes.length)return this._validation=null,null;try{const e=await this.hass.callWS({type:`${jt}/validate`,base_hash:this._snapshot.hash,changes:this._changes});return t===this._validateRequest&&(this._validation=e),e}catch(t){return await this._handleError(t),null}}async _handleError(t){this._showToast(Yt(this.hass,t)),"conflict"===t?.translation_key&&(this._snapshot=null,await this._load())}_discard(){this._changes=[],this._validation=null}async _openConfirm(){this._dialog={kind:"confirm",result:null};const t=await this._validate();"confirm"===this._dialog?.kind&&(this._dialog=t?{kind:"confirm",result:t}:null)}async _save(){if(this.hass&&this._snapshot){this._busy=!0;try{const t=await this.hass.callWS({type:`${jt}/save`,base_hash:this._snapshot.hash,changes:this._changes});this._dialog=null,this._discard(),this._showToast(this._t(t.backup_id?"saved":"nothing_to_save")),await this._load()}catch(t){this._dialog=null,await this._handleError(t)}finally{this._busy=!1}}}async _openBackups(t){if(this.hass)try{const{backups:e}=await this.hass.callWS({type:`${jt}/backups`});t&&e.length>0?this._dialog={kind:"restore",backup:e[0],undo:!0}:this._dialog={kind:"backups",entries:e}}catch(t){await this._handleError(t)}}async _restore(t){if(this.hass&&this._snapshot){this._busy=!0;try{await this.hass.callWS({type:`${jt}/restore`,backup_id:t.id,base_hash:this._snapshot.hash}),this._dialog=null,this._discard(),this._showToast(this._t("restored")),await this._load()}catch(t){this._dialog=null,await this._handleError(t)}finally{this._busy=!1}}}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},4e3)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this._toastTimer)}_canDrop(t){const e=this._dragged;if(null===e)return!1;const s=t===Ft?null:t;return"candidate"===e.kind||pt(this.draft,e.stat,s)}_drop(t){const e=this._dragged,s=this._canDrop(t);if(this._dragged=null,this._dropTarget=null,null===e||!s)return;const i=t===Ft?null:t;"candidate"===e.kind?this._addCandidate(e.stat,i):this._change({type:"move",stat:e.stat,parent:i})}_dragHandlers(t){return{over:e=>{this._canDrop(t)&&(e.preventDefault(),this._dropTarget=t)},leave:()=>{this._dropTarget===t&&(this._dropTarget=null)},drop:e=>{e.preventDefault(),this._drop(t)}}}_startDrag(t,e){t.dataTransfer?.setData("text/plain",e.stat),t.dataTransfer&&(t.dataTransfer.effectAllowed="move"),"device"===e.kind&&"diagram"===this._view&&this._setDragImage(t),this._dragged=e}_setDragImage(t){const e=t.currentTarget,s=t.dataTransfer;if(!e||!s?.setDragImage)return;const i="touch"===this._pointerType||"pen"===this._pointerType,n=i?Math.max(this._zoom.k,.8):this._zoom.k,r=e.offsetWidth*n,o=e.offsetHeight*n,a=document.createElement("div");a.className="drag-ghost",a.style.cssText=`position:fixed;left:0;top:-${Math.ceil(o)+100}px;width:${r}px;height:${o}px;overflow:hidden;pointer-events:none`;const l=e.cloneNode(!0);l.style.left="0",l.style.top="0",l.style.transform=`scale(${n})`,l.style.transformOrigin="0 0",a.append(l),this.renderRoot.append(a);const d=e.getBoundingClientRect();i?s.setDragImage(a,r/2,o+48):s.setDragImage(a,Math.min(r,Math.max(0,t.clientX-d.left)),Math.min(o,Math.max(0,t.clientY-d.top))),setTimeout(()=>a.remove(),0)}_addCandidate(t,e){const s=this._snapshot?.candidates.find(e=>e.stat===t);this._change({type:"add",stat:t,parent:e,stat_rate:s?.power??null}),this._selected=t}_freeCandidates(){const t=new Set(this.draft.map(t=>t.stat_consumption)),e=this._search.trim().toLowerCase();return(this._snapshot?.candidates??[]).filter(s=>!t.has(s.stat)&&(!e||[s.name,s.stat,s.area_name,s.device_name].some(t=>t?.toLowerCase().includes(e))))}updated(t){if(!this._fitted&&this._snapshot&&"diagram"===this._view&&(this._fitted=this.fit()),!t.has("_dialog"))return;const e=this.renderRoot.querySelector("dialog");e&&(this._dialog&&!e.open?e.showModal?.():!this._dialog&&e.open&&e.close?.())}_reload(){this._snapshot=null,this._loadError=null,this._load()}render(){return j`
      <div class="header">
        ${this.narrow?j`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${()=>this.dispatchEvent(new Event("hass-toggle-menu",{bubbles:!0,composed:!0}))}
            >
              ${yt("menu")}
            </button>`:G}
        <h1>${this._t("title")}</h1>
        ${this.narrow?j`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${()=>this._dialog={kind:"menu"}}
            >
              ${yt("dots")}
            </button>`:j`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
                ${yt("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
                ${yt("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${()=>this._reload()}
              >
                ${yt("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast?j`<div class="toast" role="status">${this._toast}</div>`:G}
    `}_renderBody(){return this._loadError?j`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`:this._snapshot?j`
      <div class="content ${this.narrow?"narrow":""}">
        ${this.narrow?G:j`<aside class="column">${this._renderCandidates()}</aside>`}
        <main class="column main">
          ${"list"===this._view?j`${this._renderSources()} ${this._renderTree()}`:this._renderDiagram()}
        </main>
        ${this.narrow?G:j`<aside class="column">${this._renderDetails()}</aside>`}
      </div>
    `:j`<div class="message">${this._t("loading")}</div>`}_powerMap(t){return new Map(t.map(t=>[t.stat_consumption,this.hass?mt(this.hass,t.stat_rate):null]))}diagramLayout(){const t=this.draft,e=ht(t),s=this._powerMap(t);return Dt(e,vt(this._snapshot?.prefs.energy_sources??[]),s,ft(e,s),this._collapsed)}_viewport(){return this.renderRoot.querySelector(".viewport")}fit(){const t=this._viewport(),e=t?.clientWidth??0,s=t?.clientHeight??0;if(!e||!s)return!1;const{width:i,height:n}=this.diagramLayout(),r=Math.min(1.4,Math.max(.2,Math.min(e/i,s/n)));return this._zoom={k:r,x:(e-i*r)/2,y:Math.max(0,(s-n*r)/2)},!0}zoomAt(t,e,s){const{x:i,y:n,k:r}=this._zoom,o=Math.min(2.5,Math.max(.2,r*s)),a=o/r;this._zoom={k:o,x:t-(t-i)*a,y:e-(e-n)*a}}_zoomCenter(t){const e=this._viewport();this.zoomAt((e?.clientWidth??0)/2,(e?.clientHeight??0)/2,t)}_local(t){const e=this._viewport()?.getBoundingClientRect();return{x:t.clientX-(e?.left??0),y:t.clientY-(e?.top??0)}}_onWheel(t){t.preventDefault();const{x:e,y:s}=this._local(t);this.zoomAt(e,s,Math.exp(.0015*-t.deltaY))}_onPointerDown(t){this._pointerType=t.pointerType||"mouse",t.target.closest?.(".block, button, a")||(t.currentTarget?.setPointerCapture?.(t.pointerId),this._pointers.set(t.pointerId,this._local(t)))}_onPointerMove(t){const e=this._pointers.get(t.pointerId);if(!e)return;const s=[...this._pointers.values()],i=this._local(t);if(this._pointers.set(t.pointerId,i),1===this._pointers.size)return void(this._zoom={...this._zoom,x:this._zoom.x+i.x-e.x,y:this._zoom.y+i.y-e.y});const n=[...this._pointers.values()],r=t=>Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y),o=t=>({x:(t[0].x+t[1].x)/2,y:(t[0].y+t[1].y)/2}),[a,l]=[o(s),o(n)];this._zoom={...this._zoom,x:this._zoom.x+l.x-a.x,y:this._zoom.y+l.y-a.y},r(s)>0&&this.zoomAt(l.x,l.y,r(n)/r(s))}_onPointerUp(t){this._pointers.delete(t.pointerId)}_renderDiagram(){const t=this.draft,e=this.diagramLayout(),s=new Map(e.blocks.map(t=>[t.id,t])),i=Math.max(0,...e.edges.map(t=>t.power??0)),n=this._powerMap(t),r=ft(ht(t),n),o=ht(t).map(t=>n.get(t.stat)).filter(t=>null!=t),a=o.length?o.reduce((t,e)=>t+e,0):null,{x:l,y:d,k:c}=this._zoom;return j`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t("diagram")}</h2>
          <div class="toolbar">
            <button
              class="icon"
              aria-label=${this._t("zoom_out")}
              title=${this._t("zoom_out")}
              @click=${()=>this._zoomCenter(.8)}
            >
              −
            </button>
            <button
              class="icon"
              aria-label=${this._t("zoom_in")}
              title=${this._t("zoom_in")}
              @click=${()=>this._zoomCenter(1.25)}
            >
              +
            </button>
            <button @click=${()=>this.fit()}>${this._t("fit")}</button>
          </div>
        </div>
        <p class="hint">${this._t("devices_hint")} ${this._t("zoom_hint")}</p>
        <div
          class="viewport ${this._dragged?"dragging":""}"
          @wheel=${t=>this._onWheel(t)}
          @pointerdown=${t=>this._onPointerDown(t)}
          @pointermove=${t=>this._onPointerMove(t)}
          @pointerup=${t=>this._onPointerUp(t)}
          @pointercancel=${t=>this._onPointerUp(t)}
        >
          <div
            class="canvas"
            style="width:${e.width}px;height:${e.height}px;transform:translate(${l}px, ${d}px) scale(${c})"
          >
            <svg class="edges" width=${e.width} height=${e.height} aria-hidden="true">
              ${e.edges.map(t=>this._renderEdge(t,s,i))}
            </svg>
            ${e.blocks.map(e=>this._renderBlock(e,t,a,r))}
          </div>
        </div>
      </section>
    `}_edgeColor(t,e){if("untracked"===t.kind)return"var(--secondary-text-color)";if("source"===t.kind){const s=e.get(t.from===St?t.to:t.from);return Qt[s?.role??""]??"var(--secondary-text-color)"}return"var(--primary-color)"}_renderEdge(t,e,s){const i=e.get(t.from),n=e.get(t.to);if(!i||!n)return G;const r=this._edgeColor(t,e),o="untracked"===t.kind||"device"===t.kind&&null===t.power;return I`<g class="edge edge-${t.kind}" data-from=${t.from} data-to=${t.to}>
      <path
        d=${function(t,e){const s=t.y<=e.y,i=t.x+t.w/2,n=s?t.y+t.h:t.y,r=e.x+e.w/2,o=s?e.y:e.y+e.h,a=(n+o)/2;return`M ${i} ${n} C ${i} ${a}, ${r} ${a}, ${r} ${o}`}(i,n)}
        fill="none"
        stroke=${r}
        stroke-width=${function(t,e){return null===t||e<=0?2:2+6*Math.min(1,Math.max(0,t)/e)}(t.power,s)}
        stroke-dasharray=${o?"4 4":"none"}
        stroke-linecap="round"
      ></path>
      <polygon points=${function(t,e,s=6){const i=t.y<=e.y,n=e.x+e.w/2,r=i?e.y:e.y+e.h,o=i?r-1.4*s:r+1.4*s;return`${n-s},${o} ${n+s},${o} ${n},${r}`}(i,n)} fill=${r}></polygon>
    </g>`}_blockStyle(t){return`left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px`}_renderBlock(t,e,s,i){const n=this._blockStyle(t);switch(t.kind){case"home":{const t=this._dragHandlers(Ft);return j`<div
          class="block home ${this._dropTarget===Ft?"drop":""} ${this._dragged&&this._canDrop(Ft)?"can-drop":""}"
          style=${n}
          @dragover=${t.over}
          @dragleave=${t.leave}
          @drop=${t.drop}
        >
          ${yt("home")}
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${null===s?G:j`<span class="sub"
                  >${this._t("home_measured",{power:Bt(this.hass,s)})}</span
                >`}
          </div>
        </div>`}case"source":case"placeholder":{const e=t.role??"import",s="consumption"===e?this._t(`role_${t.source?.type??"gas"}`):this._t(`role_${e}`);return j`<button
          class="block source ${t.kind}"
          style="${n};--source-color:${Qt[e]??"var(--divider-color)"}"
          title=${this._t("sources_hint")}
          @click=${()=>Xt("/config/energy")}
        >
          <div class="block-text">
            <span class="node-name">${"placeholder"===t.kind?`+ ${s}`:s}</span>
            ${t.stat?j`<span class="sub">${t.source?.name||this._name(t.stat)}</span>`:G}
          </div>
        </button>`}case"untracked":{const e=i.get(t.stat);return j`<div class="block untracked" style=${n} data-parent=${t.stat}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub">${null==e?this._t("none"):Bt(this.hass,e)}</span>
          </div>
        </div>`}default:return this._renderDeviceBlock(t,e)}}_renderDeviceBlock(t,e){const s=t.stat,i=t.node,n=this._name(s,e),r=this._issuesFor(s),o=r.some(t=>"error"===t.severity)||null!==i.problem,a=this._dragHandlers(s),l=e.find(t=>t.stat_consumption===s),d=this.hass?mt(this.hass,l?.stat_rate):null,c=this._snapshot?.stats[s]??this._snapshot?.candidates.find(t=>t.stat===s),h=[null===d?null:Bt(this.hass,d),c?.area_name].filter(Boolean).join(" · "),u=this._collapsed.has(s);return j`<div
      class="block device node ${this._selected===s?"selected":""} ${this._dropTarget===s?"drop":""} ${o?"has-error":r.length?"has-warning":""} ${this._dragged?.stat===s?"dragged":this._dragged&&this._canDrop(s)?"can-drop":""}"
      style=${this._blockStyle(t)}
      draggable="true"
      data-stat=${s}
      @dragstart=${t=>this._startDrag(t,{kind:"device",stat:s})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @dragover=${a.over}
      @dragleave=${a.leave}
      @drop=${a.drop}
      @click=${()=>{this._selected=s,this.narrow&&(this._dialog={kind:"details"})}}
    >
      ${i.children.length?j`<button
            class="icon toggle"
            aria-label=${n}
            aria-expanded=${String(!u)}
            @click=${t=>{t.stopPropagation(),this._toggle(s)}}
          >
            ${u?"▸":"▾"}
          </button>`:G}
      <div class="block-text">
        <span class="node-name" title=${n}>${n}</span>
        ${h?j`<span class="sub">${h}</span>`:G}
      </div>
      ${r.length||i.problem?j`<span class="badge" title=${r.map(t=>this._issueText(t)).join("\n")}
            >!</span
          >`:G}
      <button
        class="icon"
        aria-label=${this._t("actions",{name:n})}
        @click=${t=>{t.stopPropagation(),this._dialog={kind:"actions",stat:s}}}
      >
        ${yt("dots")}
      </button>
    </div>`}_toggle(t){const e=new Set(this._collapsed);e.has(t)?e.delete(t):e.add(t),this._collapsed=e}_renderSources(){const t=vt(this._snapshot?.prefs.energy_sources??[]);return j`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${()=>Xt("/config/energy")}>
            ${this._t("open_energy_settings")}
          </button>
        </div>
        <p class="hint">${this._t("sources_hint")}</p>
        ${0===t.length?j`<p class="empty">${this._t("no_sources")}</p>`:j`<div class="sources">
              ${t.map(t=>j`<div class="source">
                  <span class="source-role"
                    >${this._t("consumption"===t.role?`role_${t.type}`:`role_${t.role}`)}</span
                  >
                  <span class="source-name">${t.name||this._name(t.stat)}</span>
                </div>`)}
            </div>`}
      </section>
    `}_renderTree(){const t=this.draft,e=ht(t),s=new Map(t.map(t=>[t.stat_consumption,this.hass?mt(this.hass,t.stat_rate):null])),i=ft(e,s),n=this._dragHandlers(Ft);return j`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget===Ft?"drop":""}"
          @dragover=${n.over}
          @dragleave=${n.leave}
          @drop=${n.drop}
        >
          ${yt("home")}
          <span>${this._t("home")}</span>
          ${this._dragged?j`<span class="hint">${this._t("home_drop")}</span>`:G}
        </div>
        ${0===e.length?j`<p class="empty">${this._t("no_devices")}</p>`:j`<ul class="tree" role="tree">
              ${e.map(e=>this._renderNode(e,t,s,i))}
            </ul>`}
      </section>
    `}_renderNode(t,e,s,i){const n=this._name(t.stat,e),r=this._issuesFor(t.stat),o=r.some(t=>"error"===t.severity)||null!==t.problem,a=this._collapsed.has(t.stat),l=this._dragHandlers(t.stat),d=s.get(t.stat)??null,c=i.get(t.stat);return j`
      <li role="treeitem" aria-expanded=${t.children.length?String(!a):G}>
        <div
          class="node ${this._selected===t.stat?"selected":""} ${this._dropTarget===t.stat?"drop":""} ${o?"has-error":r.length?"has-warning":""}"
          draggable="true"
          data-stat=${t.stat}
          @dragstart=${e=>this._startDrag(e,{kind:"device",stat:t.stat})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
          @dragover=${l.over}
          @dragleave=${l.leave}
          @drop=${l.drop}
          @click=${()=>{this._selected=t.stat,this.narrow&&(this._dialog={kind:"details"})}}
        >
          ${t.children.length?j`<button
                class="icon toggle"
                aria-label=${n}
                @click=${e=>{e.stopPropagation();const s=new Set(this._collapsed);a?s.delete(t.stat):s.add(t.stat),this._collapsed=s}}
              >
                ${a?"▸":"▾"}
              </button>`:j`<span class="toggle"></span>`}
          <span class="node-name">${n}</span>
          ${r.length||t.problem?j`<span
                class="badge"
                title=${r.map(t=>this._issueText(t)).join("\n")}
                >!</span
              >`:G}
          <span class="node-power">${null===d?G:Bt(this.hass,d)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions",{name:n})}
            @click=${e=>{e.stopPropagation(),this._dialog={kind:"actions",stat:t.stat}}}
          >
            ${yt("dots")}
          </button>
        </div>
        ${t.children.length&&!a?j`<ul role="group">
              ${t.children.map(t=>this._renderNode(t,e,s,i))}
              ${void 0!==c?j`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power"
                      >${null===c?this._t("none"):Bt(this.hass,c)}</span
                    >
                  </li>`:G}
            </ul>`:G}
      </li>
    `}_renderCandidates(){const t=this._freeCandidates();return j`
      <section class="card">
        <div class="card-header"><h2>${this._t("free_sensors")}</h2></div>
        <p class="hint">${this._t("free_sensors_hint")}</p>
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${t=>this._search=t.target.value}
        />
        ${0===t.length?j`<p class="empty">${this._t("no_candidates")}</p>`:j`<ul class="candidates">
              ${t.map(t=>j`<li
                  class="candidate"
                  draggable="true"
                  data-stat=${t.stat}
                  @dragstart=${e=>this._startDrag(e,{kind:"candidate",stat:t.stat})}
                  @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
                >
                  <div class="candidate-text">
                    <span class="node-name">${t.name||t.stat}</span>
                    <span class="sub">${[t.area_name,t.device_name].filter(Boolean).join(" · ")||t.stat}</span>
                  </div>
                  <button @click=${()=>this._dialog={kind:"add",stat:t.stat}}>
                    ${this._t("add")}
                  </button>
                </li>`)}
            </ul>`}
      </section>
    `}_renderDetails(){const t=this._selected,e=this.draft,s=e.find(e=>e.stat_consumption===t);if(!t||!s)return j`<section class="card">
        <div class="card-header"><h2>${this._t("details")}</h2></div>
        <p class="empty">${this._t("select_hint")}</p>
      </section>`;const i=this._snapshot?.stats[t]??this._snapshot?.candidates.find(e=>e.stat===t),n=this.hass?mt(this.hass,s.stat_rate):null,r=ht(e),o=new Map(e.map(t=>[t.stat_consumption,this.hass?mt(this.hass,t.stat_rate):null])),a=ft(r,o).get(t),l=this._issuesFor(t),d=(t,e)=>j`<dt>${this._t(t)}</dt>
        <dd>${e||this._t("none")}</dd>`;return j`
      <section class="card">
        <div class="card-header"><h2>${this._name(t,e)}</h2></div>
        <dl>
          ${d("detail_statistic",t)} ${d("detail_power_sensor",s.stat_rate)}
          ${d("detail_device",i?.device_name)} ${d("detail_area",i?.area_name)}
          ${d("detail_power",null===n?null:Bt(this.hass,n))}
          ${void 0!==a?d("detail_untracked",null===a?null:Bt(this.hass,a)):G}
        </dl>
        ${l.length?j`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${l.map(t=>j`<li class=${t.severity}>${this._issueText(t)}</li>`)}
              </ul>`:G}
      </section>
    `}_renderFooter(){if(0===this._changes.length)return G;const t=this._validation?.diff.length??this._changes.length;return j`<div class="footer">
      <span
        >${1===t?this._t("change_one"):this._t("change_other",{count:Ot(this.hass,t)})}</span
      >
      <button @click=${()=>this._discard()}>${this._t("discard")}</button>
      <button class="primary" @click=${()=>this._openConfirm()}>${this._t("save")}</button>
    </div>`}_issueText(t){const e=`issue_${t.code}`;return Rt(e)?this._t(e,{unit:String(t.details.unit??"")}):t.code}_diffText(t){const e=this._name(t.stat),s=t.to?this._name(t.to):"";switch(t.type){case"added":return t.parent?this._t("diff_added_under",{name:e,to:this._name(t.parent)}):this._t("diff_added",{name:e});case"removed":return this._t("diff_removed",{name:this._name(t.stat,this._snapshot?.prefs.device_consumption)});case"moved":return t.to?this._t("diff_moved",{name:e,to:s}):this._t("diff_moved_top",{name:e});case"renamed":return t.to?this._t("diff_renamed",{name:t.from||this._name(t.stat),to:t.to}):this._t("diff_renamed_reset",{name:e});default:return this._t("diff_rate",{name:e})}}_summaryText(t){return Object.entries(t).map(([t,e])=>{const s=`summary_${t}`;return Rt(s)?this._t(s,{count:String(e)}):`${t}: ${e}`}).join(", ")}_renderDialog(){return j`<dialog
      @close=${()=>{this._dialog=null}}
      @cancel=${()=>{this._dialog=null}}
    >
      ${this._dialog?this._renderDialogContent(this._dialog):G}
    </dialog>`}_close(){this._dialog=null}_targetList(t,e){return 0===t.length?j`<p class="empty">${this._t("no_targets")}</p>`:j`<ul class="targets">
      ${t.map(t=>j`<li>
          <button class="target" data-target=${t??Ft} @click=${()=>e(t)}>
            ${null===t?this._t("top_level"):this._name(t)}
          </button>
        </li>`)}
    </ul>`}_renderDialogContent(t){const e=this.draft;switch(t.kind){case"actions":{const s=this._name(t.stat,e);return j`<h2>${s}</h2>
          <div class="dialog-actions column-actions">
            <button @click=${()=>this._dialog={kind:"move",stat:t.stat}}>
              ${this._t("move")}
            </button>
            <button
              @click=${()=>{this._renameValue=e.find(e=>e.stat_consumption===t.stat)?.name??"",this._dialog={kind:"rename",stat:t.stat}}}
            >
              ${this._t("rename")}
            </button>
            <button
              class="danger"
              @click=${()=>{this._close(),this._selected===t.stat&&(this._selected=null),this._change({type:"remove",stat:t.stat})}}
            >
              ${this._t("remove")}
            </button>
            ${e.some(e=>e.included_in_stat===t.stat)?j`<p class="hint">${this._t("remove_hint")}</p>`:G}
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"move":{const s=this._name(t.stat,e),i=[...pt(e,t.stat,null)?[null]:[],..._t(e,t.stat)];return j`<h2>${this._t("move_title",{name:s})}</h2>
          ${this._targetList(i,e=>{this._close(),this._change({type:"move",stat:t.stat,parent:e})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"add":{const s=this._snapshot?.candidates.find(e=>e.stat===t.stat),i=s?.name||t.stat,n=[null,...e.map(t=>t.stat_consumption)];return j`<h2>${this._t("add_title",{name:i})}</h2>
          ${s?.power?j`<p class="hint">${this._t("with_power",{entity:s.power})}</p>`:G}
          ${this._targetList(n,e=>{this._close(),this._addCandidate(t.stat,e)})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"rename":{const s=this._name(t.stat,e);return j`<h2>${this._t("rename_title",{name:s})}</h2>
          <label
            >${this._t("name_label")}
            <input
              type="text"
              .value=${this._renameValue}
              placeholder=${this._snapshot?.stats[t.stat]?.name??""}
              @input=${t=>this._renameValue=t.target.value}
            />
          </label>
          <p class="hint">${this._t("name_hint")}</p>
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              @click=${()=>{this._close(),this._change({type:"rename",stat:t.stat,name:this._renameValue.trim()||null})}}
            >
              ${this._t("ok")}
            </button>
          </div>`}case"confirm":{const e=t.result;if(null===e)return j`<h2>${this._t("confirm_title")}</h2>
            <p>${this._t("checking")}</p>`;const s=e.issues.filter(t=>"error"===t.severity),i=e.issues.filter(t=>"warning"===t.severity),n=t=>j`<ul class="issues">
            ${t.map(t=>j`<li class=${t.severity}>${this._name(t.stat)}: ${this._issueText(t)}</li>`)}
          </ul>`;return j`<h2>${this._t("confirm_title")}</h2>
          <ul class="diff">
            ${e.diff.map(t=>j`<li>${this._diffText(t)}</li>`)}
          </ul>
          ${s.length?j`<p>${this._t("confirm_errors")}</p>${n(s)}`:G}
          ${i.length?j`<p>${this._t("confirm_warnings")}</p>${n(i)}`:G}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!e.valid||this._busy}
              @click=${()=>this._save()}
            >
              ${this._busy?this._t("saving"):this._t("save")}
            </button>
          </div>`}case"backups":return j`<h2>${this._t("backups_title")}</h2>
          ${0===t.entries.length?j`<p class="empty">${this._t("backups_empty")}</p>`:j`<ul class="backups">
                ${t.entries.map(t=>j`<li>
                    <div class="candidate-text">
                      <span class="node-name">${Vt(this.hass,t.created)}</span>
                      <span class="sub"
                        >${this._summaryText(t.summary)}${t.user_name?` · ${this._t("backup_by",{user:t.user_name})}`:""}</span
                      >
                    </div>
                    <button
                      @click=${()=>this._dialog={kind:"restore",backup:t,undo:!1}}
                    >
                      ${this._t("restore")}
                    </button>
                  </li>`)}
              </ul>`}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"restore":{const e=Vt(this.hass,t.backup.created);return j`<h2>${this._t(t.undo?"undo":"restore")}</h2>
          <p>${this._t(t.undo?"undo_confirm":"restore_confirm",{date:e})}</p>
          ${this._changes.length?j`<p class="warning">${this._t("draft_lost")}</p>`:G}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._restore(t.backup)}
            >
              ${this._t("restore")}
            </button>
          </div>`}case"menu":return j`<div class="dialog-actions column-actions">
          <button ?disabled=${!this._snapshot} @click=${()=>this._dialog={kind:"candidates"}}>
            ${this._t("free_sensors")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
            ${yt("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
            ${yt("history")} ${this._t("backups")}
          </button>
          <button
            @click=${()=>{this._close(),this._reload()}}
          >
            ${yt("refresh")} ${this._t("reload")}
          </button>
          <button @click=${()=>this._close()}>${this._t("close")}</button>
        </div>`;case"candidates":return j`${this._renderCandidates()}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"details":return j`${this._renderDetails()}
          <div class="dialog-actions">
            ${this._selected?j`<button
                  @click=${()=>this._dialog={kind:"actions",stat:this._selected}}
                >
                  ${this._t("actions",{name:this._name(this._selected)})}
                </button>`:G}
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`}}static styles=r`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      padding-bottom: 72px;
      box-sizing: border-box;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--header-height, 56px);
      padding: 0 12px;
      background: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color, #fff));
      position: sticky;
      top: 0;
      z-index: 2;
    }
    h1 {
      flex: 1;
      margin: 0 4px;
      font-size: 20px;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .header button {
      color: inherit;
      border-color: transparent;
      background: transparent;
    }
    button {
      font: inherit;
      color: var(--primary-color);
      background: transparent;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button.primary {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    button.danger {
      color: var(--error-color);
    }
    button.icon {
      border: none;
      padding: 4px 8px;
      line-height: 1;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .mdi {
      width: 20px;
      height: 20px;
      fill: currentColor;
      flex: none;
    }
    .home .mdi {
      color: var(--secondary-text-color);
    }
    button.link {
      border: none;
      padding: 0;
      text-decoration: underline;
    }
    .content {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(320px, 2fr) minmax(220px, 1fr);
      gap: 16px;
      padding: 16px;
      align-items: start;
    }
    .content.narrow {
      grid-template-columns: 1fr;
      padding: 8px;
      gap: 8px;
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .card {
      background: var(--card-background-color, var(--ha-card-background));
      border-radius: var(--ha-card-border-radius, 12px);
      border: 1px solid var(--divider-color);
      padding: 12px 16px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    h3 {
      font-size: 15px;
      margin: 12px 0 4px;
    }
    .hint,
    .sub,
    .empty {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    .message {
      padding: 32px 16px;
      text-align: center;
    }
    .error,
    .issues .error {
      color: var(--error-color);
    }
    .warning,
    .issues .warning {
      color: var(--warning-color);
    }
    .sources {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .source {
      display: flex;
      flex-direction: column;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .source-role {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .tree ul {
      padding-left: 20px;
      border-left: 1px dashed var(--divider-color);
      margin-left: 12px;
    }
    .home,
    .node,
    .untracked {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      min-height: 32px;
    }
    .home {
      margin-top: 8px;
      font-weight: 500;
      border: 1px dashed transparent;
    }
    .node {
      cursor: grab;
    }
    .node:hover {
      background: var(--secondary-background-color);
    }
    .node.selected {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
    }
    .drop {
      outline: 2px dashed var(--primary-color);
      outline-offset: -2px;
    }
    .node.has-error .node-name {
      color: var(--error-color);
    }
    .untracked {
      color: var(--secondary-text-color);
      font-style: italic;
    }
    .toggle {
      width: 24px;
      flex: none;
      text-align: center;
    }
    .node-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .node-power {
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      background: var(--warning-color);
      color: #fff;
    }
    .has-error .badge {
      background: var(--error-color);
    }
    input[type="search"],
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      margin: 8px 0;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font: inherit;
    }
    .candidates li,
    .backups li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid var(--divider-color);
    }
    .candidate {
      cursor: grab;
    }
    .candidate-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 12px 0 0;
      font-size: 14px;
    }
    dt {
      color: var(--secondary-text-color);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .diagram-card {
      padding-bottom: 0;
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      gap: 4px;
    }
    .toolbar button.icon {
      font-size: 18px;
      min-width: 32px;
      border: 1px solid var(--divider-color);
    }
    .viewport {
      /* Contrast colours, derived from the theme so light and dark both work. */
      --block-bg: var(--card-background-color, var(--primary-background-color));
      --block-border: color-mix(in srgb, var(--primary-text-color) 35%, transparent);
      --canvas-bg: color-mix(in srgb, var(--primary-text-color) 4%, var(--primary-background-color));
      position: relative;
      overflow: hidden;
      height: calc(100vh - 250px);
      min-height: 360px;
      margin: 8px -16px 0;
      border-top: 1px solid var(--divider-color);
      touch-action: none;
      cursor: grab;
      background-color: var(--canvas-bg);
      background-image: radial-gradient(
        color-mix(in srgb, var(--primary-text-color) 18%, transparent) 1px,
        transparent 1px
      );
      background-size: 20px 20px;
    }
    .narrow .viewport {
      height: calc(100vh - 230px);
    }
    .canvas {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }
    .edges {
      position: absolute;
      left: 0;
      top: 0;
      overflow: visible;
      pointer-events: none;
    }
    .block {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 4px 6px 12px;
      border-radius: 10px;
      border: 1px solid var(--block-border);
      background: var(--block-bg);
      color: var(--primary-text-color);
      font-size: 14px;
      text-align: left;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    .block-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-self: stretch;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }
    .block .node-name {
      flex: none;
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.25;
      font-size: 14px;
      font-weight: 500;
    }
    .block .sub {
      font-size: 13px;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .block.device {
      cursor: grab;
      border-left: 5px solid var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 10%, var(--block-bg));
    }
    .block.device.selected {
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 25%, var(--block-bg));
    }
    .block.home {
      border: 2px solid var(--primary-text-color);
      font-size: 15px;
    }
    .block.home .mdi {
      color: var(--primary-text-color);
    }
    .block.source {
      border: 1px solid var(--source-color);
      border-left: 5px solid var(--source-color);
      background: color-mix(in srgb, var(--source-color) 14%, var(--block-bg));
      padding-right: 10px;
      cursor: pointer;
      font: inherit;
      font-size: 14px;
      justify-content: flex-start;
    }
    .block.placeholder {
      border: 2px dashed var(--source-color);
      background: color-mix(in srgb, var(--source-color) 8%, transparent);
      box-shadow: none;
    }
    .block.placeholder .node-name {
      color: var(--source-color);
    }
    .block.untracked {
      border: 2px dashed var(--block-border);
      background: transparent;
      box-shadow: none;
    }
    .block.untracked .node-name {
      font-style: italic;
      font-weight: 400;
      color: var(--secondary-text-color);
    }
    .block .toggle {
      width: auto;
      padding: 2px 4px;
      color: var(--primary-text-color);
    }
    .dragging .block.device:not(.can-drop):not(.dragged),
    .dragging .block.home:not(.can-drop) {
      opacity: 0.45;
    }
    .block.can-drop {
      outline: 2px dashed var(--primary-color);
      outline-offset: 3px;
    }
    .block.drop {
      outline: 3px solid var(--primary-color);
      outline-offset: 3px;
      background: color-mix(in srgb, var(--primary-color) 35%, var(--block-bg));
    }
    .block.dragged {
      opacity: 0.35;
      border-style: dashed;
    }
    .block.has-error {
      border-color: var(--error-color);
    }
    .footer {
      position: fixed;
      left: var(--mdc-drawer-width, 0);
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      background: var(--card-background-color, var(--primary-background-color));
      border-top: 1px solid var(--divider-color);
      z-index: 2;
    }
    .footer span {
      flex: 1;
    }
    dialog {
      border: none;
      border-radius: 16px;
      padding: 20px;
      width: min(480px, calc(100vw - 32px));
      max-height: calc(100vh - 64px);
      background: var(--card-background-color, var(--primary-background-color));
      color: var(--primary-text-color);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
    dialog .card {
      border: none;
      padding: 0;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .column-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .targets {
      max-height: 50vh;
      overflow: auto;
      margin-top: 12px;
    }
    .targets button {
      width: 100%;
      text-align: left;
      margin-bottom: 4px;
      color: var(--primary-text-color);
    }
    .diff li,
    .issues li {
      padding: 2px 0;
    }
    .diff {
      margin: 12px 0;
      padding-left: 18px;
      list-style: disc;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 80px;
      transform: translateX(-50%);
      max-width: calc(100vw - 32px);
      padding: 10px 16px;
      border-radius: 8px;
      background: var(--primary-text-color);
      color: var(--primary-background-color);
      z-index: 3;
    }
  `}customElements.get(Wt)||customElements.define(Wt,Jt);export{jt as DOMAIN,Jt as EnergyFlowMapperPanel,Zt as MAX_ZOOM,Gt as MIN_ZOOM,Wt as PANEL_TAG,It as TOAST_MS,Kt as TOUCH_DRAG_LIFT,qt as TOUCH_DRAG_SCALE,Yt as errorText};
