/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),n=new WeakMap;let i=class{constructor(t,e,n){if(this._$cssResult$=!0,n!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const s=this.t;if(e&&void 0===t){const e=void 0!==s&&1===s.length;e&&(t=n.get(s)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&n.set(s,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const n=1===t.length?t[0]:e.reduce((e,s,n)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[n+1],t[0]);return new i(n,t,s)},a=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const s of t.cssRules)e+=s.cssText;return(t=>new i("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:o,defineProperty:d,getOwnPropertyDescriptor:l,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:u}=Object,_=globalThis,p=_.trustedTypes,g=p?p.emptyScript:"",m=_.reactiveElementPolyfillSupport,f=(t,e)=>t,$={toAttribute(t,e){switch(e){case Boolean:t=t?g:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let s=t;switch(e){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t)}catch(t){s=null}}return s}},v=(t,e)=>!o(t,e),b={attribute:!0,type:String,converter:$,reflect:!1,useDefault:!1,hasChanged:v};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),_.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const s=Symbol(),n=this.getPropertyDescriptor(t,s,e);void 0!==n&&d(this.prototype,t,n)}}static getPropertyDescriptor(t,e,s){const{get:n,set:i}=l(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:n,set(e){const r=n?.call(this);i?.call(this,e),this.requestUpdate(t,r,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...c(t),...h(t)];for(const s of e)this.createProperty(s,t[s])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,s]of e)this.elementProperties.set(t,s)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const s=this._$Eu(t,e);void 0!==s&&this._$Eh.set(s,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const t of s)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const s=e.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const s of e.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,n)=>{if(e)s.adoptedStyleSheets=n.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of n){const n=document.createElement("style"),i=t.litNonce;void 0!==i&&n.setAttribute("nonce",i),n.textContent=e.cssText,s.appendChild(n)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,s){this._$AK(t,s)}_$ET(t,e){const s=this.constructor.elementProperties.get(t),n=this.constructor._$Eu(t,s);if(void 0!==n&&!0===s.reflect){const i=(void 0!==s.converter?.toAttribute?s.converter:$).toAttribute(e,s.type);this._$Em=t,null==i?this.removeAttribute(n):this.setAttribute(n,i),this._$Em=null}}_$AK(t,e){const s=this.constructor,n=s._$Eh.get(t);if(void 0!==n&&this._$Em!==n){const t=s.getPropertyOptions(n),i="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:$;this._$Em=n;const r=i.fromAttribute(e,t.type);this[n]=r??this._$Ej?.get(n)??r,this._$Em=null}}requestUpdate(t,e,s,n=!1,i){if(void 0!==t){const r=this.constructor;if(!1===n&&(i=this[t]),s??=r.getPropertyOptions(t),!((s.hasChanged??v)(i,e)||s.useDefault&&s.reflect&&i===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,s))))return;this.C(t,e,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:s,reflect:n,wrapped:i},r){s&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??e??this[t]),!0!==i||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||s||(e=void 0),this._$AL.set(t,e)),!0===n&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,s]of t){const{wrapped:t}=s,n=this[e];!0!==t||this._$AL.has(e)||void 0===n||this.C(e,void 0,s,n)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[f("elementProperties")]=new Map,y[f("finalized")]=new Map,m?.({ReactiveElement:y}),(_.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const w=globalThis,x=t=>t,k=w.trustedTypes,A=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,E="$lit$",S=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+S,T=`<${C}>`,M=document,H=()=>M.createComment(""),P=t=>null===t||"object"!=typeof t&&"function"!=typeof t,D=Array.isArray,N="[ \t\n\f\r]",z=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,L=/>/g,O=RegExp(`>|${N}(?:([^\\s"'>=/]+)(${N}*=${N}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),R=/'/g,B=/"/g,V=/^(?:script|style|textarea|title)$/i,W=t=>(e,...s)=>({_$litType$:t,strings:e,values:s}),j=W(1),F=W(2),I=Symbol.for("lit-noChange"),G=Symbol.for("lit-nothing"),Z=new WeakMap,q=M.createTreeWalker(M,129);function K(t,e){if(!D(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(e):e}const Q=(t,e)=>{const s=t.length-1,n=[];let i,r=2===e?"<svg>":3===e?"<math>":"",a=z;for(let e=0;e<s;e++){const s=t[e];let o,d,l=-1,c=0;for(;c<s.length&&(a.lastIndex=c,d=a.exec(s),null!==d);)c=a.lastIndex,a===z?"!--"===d[1]?a=U:void 0!==d[1]?a=L:void 0!==d[2]?(V.test(d[2])&&(i=RegExp("</"+d[2],"g")),a=O):void 0!==d[3]&&(a=O):a===O?">"===d[0]?(a=i??z,l=-1):void 0===d[1]?l=-2:(l=a.lastIndex-d[2].length,o=d[1],a=void 0===d[3]?O:'"'===d[3]?B:R):a===B||a===R?a=O:a===U||a===L?a=z:(a=O,i=void 0);const h=a===O&&t[e+1].startsWith("/>")?" ":"";r+=a===z?s+T:l>=0?(n.push(o),s.slice(0,l)+E+s.slice(l)+S+h):s+S+(-2===l?e:h)}return[K(t,r+(t[s]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),n]};class J{constructor({strings:t,_$litType$:e},s){let n;this.parts=[];let i=0,r=0;const a=t.length-1,o=this.parts,[d,l]=Q(t,e);if(this.el=J.createElement(d,s),q.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(n=q.nextNode())&&o.length<a;){if(1===n.nodeType){if(n.hasAttributes())for(const t of n.getAttributeNames())if(t.endsWith(E)){const e=l[r++],s=n.getAttribute(t).split(S),a=/([.?@])?(.*)/.exec(e);o.push({type:1,index:i,name:a[2],strings:s,ctor:"."===a[1]?st:"?"===a[1]?nt:"@"===a[1]?it:et}),n.removeAttribute(t)}else t.startsWith(S)&&(o.push({type:6,index:i}),n.removeAttribute(t));if(V.test(n.tagName)){const t=n.textContent.split(S),e=t.length-1;if(e>0){n.textContent=k?k.emptyScript:"";for(let s=0;s<e;s++)n.append(t[s],H()),q.nextNode(),o.push({type:2,index:++i});n.append(t[e],H())}}}else if(8===n.nodeType)if(n.data===C)o.push({type:2,index:i});else{let t=-1;for(;-1!==(t=n.data.indexOf(S,t+1));)o.push({type:7,index:i}),t+=S.length-1}i++}}static createElement(t,e){const s=M.createElement("template");return s.innerHTML=t,s}}function X(t,e,s=t,n){if(e===I)return e;let i=void 0!==n?s._$Co?.[n]:s._$Cl;const r=P(e)?void 0:e._$litDirective$;return i?.constructor!==r&&(i?._$AO?.(!1),void 0===r?i=void 0:(i=new r(t),i._$AT(t,s,n)),void 0!==n?(s._$Co??=[])[n]=i:s._$Cl=i),void 0!==i&&(e=X(t,i._$AS(t,e.values),i,n)),e}class Y{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:s}=this._$AD,n=(t?.creationScope??M).importNode(e,!0);q.currentNode=n;let i=q.nextNode(),r=0,a=0,o=s[0];for(;void 0!==o;){if(r===o.index){let e;2===o.type?e=new tt(i,i.nextSibling,this,t):1===o.type?e=new o.ctor(i,o.name,o.strings,this,t):6===o.type&&(e=new rt(i,this,t)),this._$AV.push(e),o=s[++a]}r!==o?.index&&(i=q.nextNode(),r++)}return q.currentNode=M,n}p(t){let e=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,e),e+=s.strings.length-2):s._$AI(t[e])),e++}}class tt{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,s,n){this.type=2,this._$AH=G,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=s,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=X(this,t,e),P(t)?t===G||null==t||""===t?(this._$AH!==G&&this._$AR(),this._$AH=G):t!==this._$AH&&t!==I&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>D(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==G&&P(this._$AH)?this._$AA.nextSibling.data=t:this.T(M.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:s}=t,n="number"==typeof s?this._$AC(t):(void 0===s.el&&(s.el=J.createElement(K(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===n)this._$AH.p(e);else{const t=new Y(n,this),s=t.u(this.options);t.p(e),this.T(s),this._$AH=t}}_$AC(t){let e=Z.get(t.strings);return void 0===e&&Z.set(t.strings,e=new J(t)),e}k(t){D(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let s,n=0;for(const i of t)n===e.length?e.push(s=new tt(this.O(H()),this.O(H()),this,this.options)):s=e[n],s._$AI(i),n++;n<e.length&&(this._$AR(s&&s._$AB.nextSibling,n),e.length=n)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=x(t).nextSibling;x(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class et{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,s,n,i){this.type=1,this._$AH=G,this._$AN=void 0,this.element=t,this.name=e,this._$AM=n,this.options=i,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=G}_$AI(t,e=this,s,n){const i=this.strings;let r=!1;if(void 0===i)t=X(this,t,e,0),r=!P(t)||t!==this._$AH&&t!==I,r&&(this._$AH=t);else{const n=t;let a,o;for(t=i[0],a=0;a<i.length-1;a++)o=X(this,n[s+a],e,a),o===I&&(o=this._$AH[a]),r||=!P(o)||o!==this._$AH[a],o===G?t=G:t!==G&&(t+=(o??"")+i[a+1]),this._$AH[a]=o}r&&!n&&this.j(t)}j(t){t===G?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class st extends et{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===G?void 0:t}}class nt extends et{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==G)}}class it extends et{constructor(t,e,s,n,i){super(t,e,s,n,i),this.type=5}_$AI(t,e=this){if((t=X(this,t,e,0)??G)===I)return;const s=this._$AH,n=t===G&&s!==G||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,i=t!==G&&(s===G||n);n&&this.element.removeEventListener(this.name,this,s),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){X(this,t)}}const at=w.litHtmlPolyfillSupport;at?.(J,tt),(w.litHtmlVersions??=[]).push("3.3.3");const ot=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class dt extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,s)=>{const n=s?.renderBefore??e;let i=n._$litPart$;if(void 0===i){const t=s?.renderBefore??null;n._$litPart$=i=new tt(e.insertBefore(H(),t),t,void 0,s??{})}return i._$AI(t),i})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return I}}dt._$litElement$=!0,dt.finalized=!0,ot.litElementHydrateSupport?.({LitElement:dt});const lt=ot.litElementPolyfillSupport;function ct(t,e,s){const n="string"==typeof s?s.trim():s;n?t[e]=n:delete t[e]}function ht(t){const e=new Map;for(const s of t)e.has(s.stat_consumption)||e.set(s.stat_consumption,{stat:s.stat_consumption,device:s,children:[],problem:null});const s=function(t){const e=new Map;for(const s of t)e.has(s.stat_consumption)||e.set(s.stat_consumption,s.included_in_stat??null);return e}(t),n=function(t){const e=new Set,s=new Set;for(const n of t.keys()){const i=[],r=new Map;let a=n;for(;null!==a&&t.has(a)&&!s.has(a);){const s=r.get(a);if(void 0!==s){i.slice(s).forEach(t=>e.add(t));break}r.set(a,i.length),i.push(a),a=t.get(a)??null}i.forEach(t=>s.add(t))}return e}(s),i=[];for(const[t,r]of e){const a=s.get(t)??null;n.has(t)?(r.problem="cycle",i.push(r)):null===a?i.push(r):e.has(a)?e.get(a).children.push(r):(r.problem="missing_parent",i.push(r))}return i}function ut(t){return t.flatMap(t=>[t,...ut(t.children)])}function _t(t,e,s){const n=t.find(t=>t.stat_consumption===e);return void 0!==n&&((n.included_in_stat??null)!==s&&(null===s||!function(t,e){const s=new Set([e]);let n=!0;for(;n;){n=!1;for(const e of t){const t=e.included_in_stat;t&&s.has(t)&&!s.has(e.stat_consumption)&&(s.add(e.stat_consumption),n=!0)}}return s}(t,e).has(s)))}function pt(t,e){return t.map(t=>t.stat_consumption).filter(s=>_t(t,e,s))}lt?.({LitElement:dt}),(ot.litElementVersions??=[]).push("4.2.2");const gt={mW:.001,W:1,kW:1e3,MW:1e6};function mt(t,e){const s=e?t.states[e]:void 0;if(void 0===s)return null;const n=Number.parseFloat(s.state),i=gt[s.attributes.unit_of_measurement??"W"];return Number.isFinite(n)&&void 0!==i?n*i:null}function ft(t,e){const s=new Map;for(const n of ut(t)){if(0===n.children.length)continue;const t=e.get(n.stat)??null,i=n.children.map(t=>e.get(t.stat)??null);s.set(n.stat,null===t||i.some(t=>null===t)?null:t-i.reduce((t,e)=>t+(e??0),0))}return s}const $t={grid:["import","export"],solar:["production",null],battery:["discharge","charge"],gas:["consumption",null],water:["consumption",null]};const vt={menu:"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",dots:"M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",refresh:"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",home:"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",undo:"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",history:"M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"};function bt(t){return F`<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d=${vt[t]}></path></svg>`}const yt={title:"Energy Flow Mapper",menu:"Menu",more:"More",reload:"Reload",undo:"Undo last save",backups:"Backups",loading:"Loading…",load_failed:"The energy settings could not be loaded.",sources:"Sources",sources_hint:"Sources are only shown here. Change them in the energy settings.",open_energy_settings:"Energy settings",no_sources:"No sources configured.",role_import:"Grid import",role_export:"Grid export",role_production:"Solar production",role_discharge:"Battery discharge",role_charge:"Battery charge",role_gas:"Gas",role_water:"Water",devices:"Devices",devices_hint:"Drag a device onto another one to include it there, or use the ⋮ menu.",home:"Home",home_drop:"Drop here for the top level",no_devices:"No devices in the energy dashboard yet. Add a free sensor.",untracked:"Not tracked individually",free_sensors:"Free sensors",free_sensors_hint:"Energy meters that are not in the energy dashboard yet.",search:"Search",no_candidates:"No free energy sensors.",add:"Add",add_title:"Add {name} under …",with_power:"Power sensor: {entity}",actions:"Actions for {name}",move:"Move to …",move_title:"Move {name} to …",top_level:"Top level (Home)",no_targets:"There is no other place for this device.",rename:"Rename …",rename_title:"Rename {name}",name_label:"Name",name_hint:"Leave empty to use the entity name.",remove:"Remove from the energy dashboard",remove_hint:"Its devices move up one level.",cancel:"Cancel",ok:"OK",close:"Close",details:"Details",select_hint:"Select a device to see its details.",detail_statistic:"Statistic",detail_power_sensor:"Power sensor",detail_device:"Device",detail_area:"Area",detail_power:"Power now",detail_untracked:"Not tracked by its devices",detail_issues:"Problems",none:"–",change_one:"1 change",change_other:"{count} changes",discard:"Discard",save:"Save",confirm_title:"Save changes?",confirm_errors:"Fix these problems first:",confirm_warnings:"Please note:",checking:"Checking …",saving:"Saving …",saved:"Saved. A backup of the previous settings was created.",nothing_to_save:"Nothing changed.",diff_added:"{name} added",diff_added_under:"{name} added under {to}",diff_removed:"{name} removed",diff_moved:"{name} moved under {to}",diff_moved_top:"{name} moved to the top level",diff_renamed:"{name} renamed to “{to}”",diff_renamed_reset:"{name} uses the entity name again",diff_rate:"Power sensor of {name} changed",issue_cycle:"Part of a loop of devices",issue_self_parent:"Included in itself",issue_duplicate:"Listed more than once",issue_missing_parent:"Its parent device is not in the energy dashboard",issue_source_and_device:"Also used as a source",issue_statistic_missing:"Statistic not found",issue_not_energy_unit:"Unit {unit} is not an energy unit",issue_children_exceed_parent:"Its devices use more than this device",backups_title:"Backups",backups_empty:"No backups yet. One is created before every save.",backup_by:"by {user}",restore:"Restore",restore_confirm:"Restore the backup from {date}? The current settings are backed up first.",undo_confirm:"Restore the settings from before the last save ({date})? The current settings are backed up first.",draft_lost:"Your unsaved changes will be discarded.",restored:"Backup restored.",summary_added:"{count} added",summary_removed:"{count} removed",summary_moved:"{count} moved",summary_renamed:"{count} renamed",summary_rate:"{count} power sensor changed",summary_restored:"Restored a backup",error_conflict:"The energy settings were changed elsewhere in the meantime. They were reloaded; check your changes and save again.",error_not_loaded:"Energy Flow Mapper is not loaded.",error_unsupported_energy_api:"The energy settings of this Home Assistant release are not supported. The editor is disabled to protect your settings.",error_unknown:"Error: {message}"},wt={de:{title:"Energy Flow Mapper",menu:"Menü",more:"Mehr",reload:"Neu laden",undo:"Letztes Speichern rückgängig machen",backups:"Sicherungen",loading:"Wird geladen …",load_failed:"Die Energie-Einstellungen konnten nicht geladen werden.",sources:"Quellen",sources_hint:"Quellen werden hier nur angezeigt. Ändern kannst du sie in den Energie-Einstellungen.",open_energy_settings:"Energie-Einstellungen",no_sources:"Keine Quellen eingerichtet.",role_import:"Netz-Bezug",role_export:"Einspeisung",role_production:"Solar-Ertrag",role_discharge:"Batterie entladen",role_charge:"Batterie laden",role_gas:"Gas",role_water:"Wasser",devices:"Geräte",devices_hint:"Zieh ein Gerät auf ein anderes, um es dort unterzuordnen, oder nutze das ⋮-Menü.",home:"Zuhause",home_drop:"Hier ablegen für die oberste Ebene",no_devices:"Noch keine Geräte im Energie-Dashboard. Füge einen freien Sensor hinzu.",untracked:"Nicht einzeln erfasst",free_sensors:"Freie Sensoren",free_sensors_hint:"Energie-Zähler, die noch nicht im Energie-Dashboard sind.",search:"Suchen",no_candidates:"Keine freien Energie-Sensoren.",add:"Hinzufügen",add_title:"{name} hinzufügen unter …",with_power:"Leistungssensor: {entity}",actions:"Aktionen für {name}",move:"Verschieben nach …",move_title:"{name} verschieben nach …",top_level:"Oberste Ebene (Zuhause)",no_targets:"Für dieses Gerät gibt es keinen anderen Platz.",rename:"Umbenennen …",rename_title:"{name} umbenennen",name_label:"Name",name_hint:"Leer lassen, um den Namen der Entity zu verwenden.",remove:"Aus dem Energie-Dashboard entfernen",remove_hint:"Seine Geräte rutschen eine Ebene nach oben.",cancel:"Abbrechen",ok:"OK",close:"Schliessen",details:"Details",select_hint:"Wähle ein Gerät, um Details zu sehen.",detail_statistic:"Statistik",detail_power_sensor:"Leistungssensor",detail_device:"Gerät",detail_area:"Bereich",detail_power:"Leistung jetzt",detail_untracked:"Nicht von seinen Geräten erfasst",detail_issues:"Probleme",none:"–",change_one:"1 Änderung",change_other:"{count} Änderungen",discard:"Verwerfen",save:"Speichern",confirm_title:"Änderungen speichern?",confirm_errors:"Behebe zuerst diese Probleme:",confirm_warnings:"Bitte beachten:",checking:"Wird geprüft …",saving:"Wird gespeichert …",saved:"Gespeichert. Die vorherigen Einstellungen wurden gesichert.",nothing_to_save:"Es hat sich nichts geändert.",diff_added:"{name} hinzugefügt",diff_added_under:"{name} hinzugefügt unter {to}",diff_removed:"{name} entfernt",diff_moved:"{name} verschoben unter {to}",diff_moved_top:"{name} auf die oberste Ebene verschoben",diff_renamed:"{name} umbenannt in «{to}»",diff_renamed_reset:"{name} verwendet wieder den Namen der Entity",diff_rate:"Leistungssensor von {name} geändert",issue_cycle:"Teil einer Schleife von Geräten",issue_self_parent:"Sich selbst untergeordnet",issue_duplicate:"Mehrfach eingetragen",issue_missing_parent:"Das übergeordnete Gerät ist nicht im Energie-Dashboard",issue_source_and_device:"Wird auch als Quelle verwendet",issue_statistic_missing:"Statistik nicht gefunden",issue_not_energy_unit:"Die Einheit {unit} ist keine Energie-Einheit",issue_children_exceed_parent:"Seine Geräte verbrauchen mehr als dieses Gerät",backups_title:"Sicherungen",backups_empty:"Noch keine Sicherungen. Vor jedem Speichern wird eine angelegt.",backup_by:"von {user}",restore:"Wiederherstellen",restore_confirm:"Die Sicherung vom {date} wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",undo_confirm:"Die Einstellungen von vor dem letzten Speichern ({date}) wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",draft_lost:"Deine ungespeicherten Änderungen gehen dabei verloren.",restored:"Sicherung wiederhergestellt.",summary_added:"{count} hinzugefügt",summary_removed:"{count} entfernt",summary_moved:"{count} verschoben",summary_renamed:"{count} umbenannt",summary_rate:"{count} Leistungssensor geändert",summary_restored:"Sicherung wiederhergestellt",error_conflict:"Die Energie-Einstellungen wurden in der Zwischenzeit an anderer Stelle geändert. Sie wurden neu geladen; prüfe deine Änderungen und speichere noch einmal.",error_not_loaded:"Energy Flow Mapper ist nicht geladen.",error_unsupported_energy_api:"Die Energie-Einstellungen dieser Home-Assistant-Version werden nicht unterstützt. Zum Schutz deiner Einstellungen ist der Editor deaktiviert.",error_unknown:"Fehler: {message}"},en:yt};function xt(t){return t?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function kt(t,e,s={}){return(n=xt(t),wt[n]??wt[n.split("-")[0]]??yt)[e].replace(/\{(\w+)\}/g,(t,e)=>e in s?s[e]:t);var n}function At(t){return t in yt}const Et={comma_decimal:["en-US","en"],decimal_comma:["de","es","it"],quote_decimal:["de-CH"],space_comma:["fr","sv","cs"],system:void 0};function St(t,e,s=0){const n=t?.locale.number_format??"language",i=n in Et?Et[n]:"none"===n?["en-US"]:[xt(t)];try{return new Intl.NumberFormat(i,{useGrouping:"none"!==n,maximumFractionDigits:s}).format(e)}catch{return String(e)}}function Ct(t,e){return Math.abs(e)>=1e3?`${St(t,e/1e3,2)} kW`:`${St(t,e)} W`}function Tt(t,e){try{return new Intl.DateTimeFormat(xt(t),{dateStyle:"medium",timeStyle:"short"}).format(new Date(e))}catch{return e}}const Mt="energy-flow-mapper-panel",Ht="energy_flow_mapper",Pt=4e3,Dt="__home__";function Nt(t,e){const s=e??{},n=`error_${s.translation_key??""}`;return s.translation_key&&At(n)?kt(t,n):kt(t,"error_unknown",{message:s.message??String(e)})}class zt extends dt{static properties={hass:{attribute:!1},narrow:{type:Boolean},_snapshot:{state:!0},_loadError:{state:!0},_changes:{state:!0},_validation:{state:!0},_selected:{state:!0},_collapsed:{state:!0},_dragged:{state:!0},_dropTarget:{state:!0},_search:{state:!0},_dialog:{state:!0},_busy:{state:!0},_toast:{state:!0},_renameValue:{state:!0}};_loading=!1;_validateRequest=0;_toastTimer;constructor(){super(),this.narrow=!1,this._snapshot=null,this._loadError=null,this._changes=[],this._validation=null,this._selected=null,this._collapsed=new Set,this._dragged=null,this._dropTarget=null,this._search="",this._dialog=null,this._busy=!1,this._toast=null,this._renameValue=""}_t(t,e={}){return kt(this.hass,t,e)}willUpdate(t){!t.has("hass")||!this.hass||this._snapshot||this._loading||this._loadError||this._load()}async _load(){if(this.hass){this._loading=!0;try{this._snapshot=await this.hass.callWS({type:`${Ht}/get`}),this._loadError=null}catch(t){this._loadError=Nt(this.hass,t)}finally{this._loading=!1}await this._validate()}}get draft(){return function(t,e){const s=structuredClone(t);for(const t of e){const e=s.findIndex(e=>e.stat_consumption===t.stat);if("add"===t.type){if(-1!==e)continue;const n={stat_consumption:t.stat};ct(n,"stat_rate",t.stat_rate),ct(n,"name",t.name),ct(n,"included_in_stat",t.parent),s.push(n);continue}if(-1!==e)if("move"===t.type)ct(s[e],"included_in_stat",t.parent);else if("rename"===t.type)ct(s[e],"name",t.name);else{const[n]=s.splice(e,1);for(const e of s)e.included_in_stat===t.stat&&ct(e,"included_in_stat",n.included_in_stat)}}return s}(this._snapshot?.prefs.device_consumption??[],this._changes)}_name(t,e=this.draft){return function(t,e,s){const n=e.find(e=>e.stat_consumption===t);return n?.name||s[t]?.name||t}(t,e,{...this._snapshot?.stats,...Object.fromEntries((this._snapshot?.candidates??[]).map(t=>[t.stat,t]))})}_issues(){return this._validation?.issues??this._snapshot?.issues??[]}_issuesFor(t){return this._issues().filter(e=>e.stat===t)}_change(t){this._changes=[...this._changes,t],this._validate()}async _validate(){const t=++this._validateRequest;if(!this.hass||!this._snapshot||0===this._changes.length)return this._validation=null,null;try{const e=await this.hass.callWS({type:`${Ht}/validate`,base_hash:this._snapshot.hash,changes:this._changes});return t===this._validateRequest&&(this._validation=e),e}catch(t){return await this._handleError(t),null}}async _handleError(t){this._showToast(Nt(this.hass,t)),"conflict"===t?.translation_key&&(this._snapshot=null,await this._load())}_discard(){this._changes=[],this._validation=null}async _openConfirm(){this._dialog={kind:"confirm",result:null};const t=await this._validate();"confirm"===this._dialog?.kind&&(this._dialog=t?{kind:"confirm",result:t}:null)}async _save(){if(this.hass&&this._snapshot){this._busy=!0;try{const t=await this.hass.callWS({type:`${Ht}/save`,base_hash:this._snapshot.hash,changes:this._changes});this._dialog=null,this._discard(),this._showToast(this._t(t.backup_id?"saved":"nothing_to_save")),await this._load()}catch(t){this._dialog=null,await this._handleError(t)}finally{this._busy=!1}}}async _openBackups(t){if(this.hass)try{const{backups:e}=await this.hass.callWS({type:`${Ht}/backups`});t&&e.length>0?this._dialog={kind:"restore",backup:e[0],undo:!0}:this._dialog={kind:"backups",entries:e}}catch(t){await this._handleError(t)}}async _restore(t){if(this.hass&&this._snapshot){this._busy=!0;try{await this.hass.callWS({type:`${Ht}/restore`,backup_id:t.id,base_hash:this._snapshot.hash}),this._dialog=null,this._discard(),this._showToast(this._t("restored")),await this._load()}catch(t){this._dialog=null,await this._handleError(t)}finally{this._busy=!1}}}_showToast(t){this._toast=t,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},4e3)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this._toastTimer)}_canDrop(t){const e=this._dragged;if(null===e)return!1;const s=t===Dt?null:t;return"candidate"===e.kind||_t(this.draft,e.stat,s)}_drop(t){const e=this._dragged,s=this._canDrop(t);if(this._dragged=null,this._dropTarget=null,null===e||!s)return;const n=t===Dt?null:t;"candidate"===e.kind?this._addCandidate(e.stat,n):this._change({type:"move",stat:e.stat,parent:n})}_dragHandlers(t){return{over:e=>{this._canDrop(t)&&(e.preventDefault(),this._dropTarget=t)},leave:()=>{this._dropTarget===t&&(this._dropTarget=null)},drop:e=>{e.preventDefault(),this._drop(t)}}}_startDrag(t,e){t.dataTransfer?.setData("text/plain",e.stat),t.dataTransfer&&(t.dataTransfer.effectAllowed="move"),this._dragged=e}_addCandidate(t,e){const s=this._snapshot?.candidates.find(e=>e.stat===t);this._change({type:"add",stat:t,parent:e,stat_rate:s?.power??null}),this._selected=t}_freeCandidates(){const t=new Set(this.draft.map(t=>t.stat_consumption)),e=this._search.trim().toLowerCase();return(this._snapshot?.candidates??[]).filter(s=>!t.has(s.stat)&&(!e||[s.name,s.stat,s.area_name,s.device_name].some(t=>t?.toLowerCase().includes(e))))}updated(t){if(!t.has("_dialog"))return;const e=this.renderRoot.querySelector("dialog");e&&(this._dialog&&!e.open?e.showModal?.():!this._dialog&&e.open&&e.close?.())}_reload(){this._snapshot=null,this._loadError=null,this._load()}render(){return j`
      <div class="header">
        ${this.narrow?j`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${()=>this.dispatchEvent(new Event("hass-toggle-menu",{bubbles:!0,composed:!0}))}
            >
              ${bt("menu")}
            </button>`:G}
        <h1>${this._t("title")}</h1>
        ${this.narrow?j`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${()=>this._dialog={kind:"menu"}}
            >
              ${bt("dots")}
            </button>`:j`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
                ${bt("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
                ${bt("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${()=>this._reload()}
              >
                ${bt("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast?j`<div class="toast" role="status">${this._toast}</div>`:G}
    `}_renderBody(){return this._loadError?j`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`:this._snapshot?j`
      <div class="content ${this.narrow?"narrow":""}">
        ${this.narrow?G:j`<aside class="column">${this._renderCandidates()}</aside>`}
        <main class="column main">${this._renderSources()} ${this._renderTree()}</main>
        ${this.narrow?G:j`<aside class="column">${this._renderDetails()}</aside>`}
      </div>
    `:j`<div class="message">${this._t("loading")}</div>`}_renderSources(){const t=function(t){const e=[];for(const s of t){const[t,n]=$t[s.type]??["consumption",null];s.stat_energy_from&&e.push({type:s.type,role:t,stat:s.stat_energy_from,name:s.name}),null!==n&&s.stat_energy_to&&e.push({type:s.type,role:n,stat:s.stat_energy_to,name:s.name})}return e}(this._snapshot?.prefs.energy_sources??[]);return j`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${()=>{return t="/config/energy",history.pushState(null,"",t),void window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:!1}}));var t}}>
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
    `}_renderTree(){const t=this.draft,e=ht(t),s=new Map(t.map(t=>[t.stat_consumption,this.hass?mt(this.hass,t.stat_rate):null])),n=ft(e,s),i=this._dragHandlers(Dt);return j`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget===Dt?"drop":""}"
          @dragover=${i.over}
          @dragleave=${i.leave}
          @drop=${i.drop}
        >
          ${bt("home")}
          <span>${this._t("home")}</span>
          ${this._dragged?j`<span class="hint">${this._t("home_drop")}</span>`:G}
        </div>
        ${0===e.length?j`<p class="empty">${this._t("no_devices")}</p>`:j`<ul class="tree" role="tree">
              ${e.map(e=>this._renderNode(e,t,s,n))}
            </ul>`}
      </section>
    `}_renderNode(t,e,s,n){const i=this._name(t.stat,e),r=this._issuesFor(t.stat),a=r.some(t=>"error"===t.severity)||null!==t.problem,o=this._collapsed.has(t.stat),d=this._dragHandlers(t.stat),l=s.get(t.stat)??null,c=n.get(t.stat);return j`
      <li role="treeitem" aria-expanded=${t.children.length?String(!o):G}>
        <div
          class="node ${this._selected===t.stat?"selected":""} ${this._dropTarget===t.stat?"drop":""} ${a?"has-error":r.length?"has-warning":""}"
          draggable="true"
          data-stat=${t.stat}
          @dragstart=${e=>this._startDrag(e,{kind:"device",stat:t.stat})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
          @dragover=${d.over}
          @dragleave=${d.leave}
          @drop=${d.drop}
          @click=${()=>{this._selected=t.stat,this.narrow&&(this._dialog={kind:"details"})}}
        >
          ${t.children.length?j`<button
                class="icon toggle"
                aria-label=${i}
                @click=${e=>{e.stopPropagation();const s=new Set(this._collapsed);o?s.delete(t.stat):s.add(t.stat),this._collapsed=s}}
              >
                ${o?"▸":"▾"}
              </button>`:j`<span class="toggle"></span>`}
          <span class="node-name">${i}</span>
          ${r.length||t.problem?j`<span
                class="badge"
                title=${r.map(t=>this._issueText(t)).join("\n")}
                >!</span
              >`:G}
          <span class="node-power">${null===l?G:Ct(this.hass,l)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions",{name:i})}
            @click=${e=>{e.stopPropagation(),this._dialog={kind:"actions",stat:t.stat}}}
          >
            ${bt("dots")}
          </button>
        </div>
        ${t.children.length&&!o?j`<ul role="group">
              ${t.children.map(t=>this._renderNode(t,e,s,n))}
              ${void 0!==c?j`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power"
                      >${null===c?this._t("none"):Ct(this.hass,c)}</span
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
      </section>`;const n=this._snapshot?.stats[t]??this._snapshot?.candidates.find(e=>e.stat===t),i=this.hass?mt(this.hass,s.stat_rate):null,r=ht(e),a=new Map(e.map(t=>[t.stat_consumption,this.hass?mt(this.hass,t.stat_rate):null])),o=ft(r,a).get(t),d=this._issuesFor(t),l=(t,e)=>j`<dt>${this._t(t)}</dt>
        <dd>${e||this._t("none")}</dd>`;return j`
      <section class="card">
        <div class="card-header"><h2>${this._name(t,e)}</h2></div>
        <dl>
          ${l("detail_statistic",t)} ${l("detail_power_sensor",s.stat_rate)}
          ${l("detail_device",n?.device_name)} ${l("detail_area",n?.area_name)}
          ${l("detail_power",null===i?null:Ct(this.hass,i))}
          ${void 0!==o?l("detail_untracked",null===o?null:Ct(this.hass,o)):G}
        </dl>
        ${d.length?j`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${d.map(t=>j`<li class=${t.severity}>${this._issueText(t)}</li>`)}
              </ul>`:G}
      </section>
    `}_renderFooter(){if(0===this._changes.length)return G;const t=this._validation?.diff.length??this._changes.length;return j`<div class="footer">
      <span
        >${1===t?this._t("change_one"):this._t("change_other",{count:St(this.hass,t)})}</span
      >
      <button @click=${()=>this._discard()}>${this._t("discard")}</button>
      <button class="primary" @click=${()=>this._openConfirm()}>${this._t("save")}</button>
    </div>`}_issueText(t){const e=`issue_${t.code}`;return At(e)?this._t(e,{unit:String(t.details.unit??"")}):t.code}_diffText(t){const e=this._name(t.stat),s=t.to?this._name(t.to):"";switch(t.type){case"added":return t.parent?this._t("diff_added_under",{name:e,to:this._name(t.parent)}):this._t("diff_added",{name:e});case"removed":return this._t("diff_removed",{name:this._name(t.stat,this._snapshot?.prefs.device_consumption)});case"moved":return t.to?this._t("diff_moved",{name:e,to:s}):this._t("diff_moved_top",{name:e});case"renamed":return t.to?this._t("diff_renamed",{name:t.from||this._name(t.stat),to:t.to}):this._t("diff_renamed_reset",{name:e});default:return this._t("diff_rate",{name:e})}}_summaryText(t){return Object.entries(t).map(([t,e])=>{const s=`summary_${t}`;return At(s)?this._t(s,{count:String(e)}):`${t}: ${e}`}).join(", ")}_renderDialog(){return j`<dialog
      @close=${()=>{this._dialog=null}}
      @cancel=${()=>{this._dialog=null}}
    >
      ${this._dialog?this._renderDialogContent(this._dialog):G}
    </dialog>`}_close(){this._dialog=null}_targetList(t,e){return 0===t.length?j`<p class="empty">${this._t("no_targets")}</p>`:j`<ul class="targets">
      ${t.map(t=>j`<li>
          <button class="target" data-target=${t??Dt} @click=${()=>e(t)}>
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
          </div>`}case"move":{const s=this._name(t.stat,e),n=[..._t(e,t.stat,null)?[null]:[],...pt(e,t.stat)];return j`<h2>${this._t("move_title",{name:s})}</h2>
          ${this._targetList(n,e=>{this._close(),this._change({type:"move",stat:t.stat,parent:e})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"add":{const s=this._snapshot?.candidates.find(e=>e.stat===t.stat),n=s?.name||t.stat,i=[null,...e.map(t=>t.stat_consumption)];return j`<h2>${this._t("add_title",{name:n})}</h2>
          ${s?.power?j`<p class="hint">${this._t("with_power",{entity:s.power})}</p>`:G}
          ${this._targetList(i,e=>{this._close(),this._addCandidate(t.stat,e)})}
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
            <p>${this._t("checking")}</p>`;const s=e.issues.filter(t=>"error"===t.severity),n=e.issues.filter(t=>"warning"===t.severity),i=t=>j`<ul class="issues">
            ${t.map(t=>j`<li class=${t.severity}>${this._name(t.stat)}: ${this._issueText(t)}</li>`)}
          </ul>`;return j`<h2>${this._t("confirm_title")}</h2>
          <ul class="diff">
            ${e.diff.map(t=>j`<li>${this._diffText(t)}</li>`)}
          </ul>
          ${s.length?j`<p>${this._t("confirm_errors")}</p>${i(s)}`:G}
          ${n.length?j`<p>${this._t("confirm_warnings")}</p>${i(n)}`:G}
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
                      <span class="node-name">${Tt(this.hass,t.created)}</span>
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
          </div>`;case"restore":{const e=Tt(this.hass,t.backup.created);return j`<h2>${this._t(t.undo?"undo":"restore")}</h2>
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
            ${bt("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
            ${bt("history")} ${this._t("backups")}
          </button>
          <button
            @click=${()=>{this._close(),this._reload()}}
          >
            ${bt("refresh")} ${this._t("reload")}
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
  `}customElements.get(Mt)||customElements.define(Mt,zt);export{Ht as DOMAIN,zt as EnergyFlowMapperPanel,Mt as PANEL_TAG,Pt as TOAST_MS,Nt as errorText};
