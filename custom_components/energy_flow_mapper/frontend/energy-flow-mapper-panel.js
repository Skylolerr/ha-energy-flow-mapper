/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),r=new WeakMap;let n=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const s=this.t;if(t&&void 0===e){const t=void 0!==s&&1===s.length;t&&(e=r.get(s)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&r.set(s,e))}return e}toString(){return this.cssText}};const i=(e,...t)=>{const r=1===e.length?e[0]:t.reduce((t,s,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[r+1],e[0]);return new n(r,e,s)},a=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return(e=>new n("string"==typeof e?e:e+"",void 0,s))(t)})(e):e,{is:o,defineProperty:l,getOwnPropertyDescriptor:d,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:u}=Object,_=globalThis,p=_.trustedTypes,g=p?p.emptyScript:"",m=_.reactiveElementPolyfillSupport,f=(e,t)=>e,$={toAttribute(e,t){switch(t){case Boolean:e=e?g:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let s=e;switch(t){case Boolean:s=null!==e;break;case Number:s=null===e?null:Number(e);break;case Object:case Array:try{s=JSON.parse(e)}catch(e){s=null}}return s}},b=(e,t)=>!o(e,t),v={attribute:!0,type:String,converter:$,reflect:!1,useDefault:!1,hasChanged:b};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),_.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=v){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(e,s,t);void 0!==r&&l(this.prototype,e,r)}}static getPropertyDescriptor(e,t,s){const{get:r,set:n}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){const i=r?.call(this);n?.call(this,t),this.requestUpdate(e,i,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??v}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const e=this.properties,t=[...c(e),...h(e)];for(const s of t)this.createProperty(s,e[s])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,s]of t)this.elementProperties.set(e,s)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const s=this._$Eu(e,t);void 0!==s&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const e of s)t.unshift(a(e))}else void 0!==e&&t.push(a(e));return t}static _$Eu(e,t){const s=t.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,r)=>{if(t)s.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of r){const r=document.createElement("style"),n=e.litNonce;void 0!==n&&r.setAttribute("nonce",n),r.textContent=t.cssText,s.appendChild(r)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,s);if(void 0!==r&&!0===s.reflect){const n=(void 0!==s.converter?.toAttribute?s.converter:$).toAttribute(t,s.type);this._$Em=e,null==n?this.removeAttribute(r):this.setAttribute(r,n),this._$Em=null}}_$AK(e,t){const s=this.constructor,r=s._$Eh.get(e);if(void 0!==r&&this._$Em!==r){const e=s.getPropertyOptions(r),n="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:$;this._$Em=r;const i=n.fromAttribute(t,e.type);this[r]=i??this._$Ej?.get(r)??i,this._$Em=null}}requestUpdate(e,t,s,r=!1,n){if(void 0!==e){const i=this.constructor;if(!1===r&&(n=this[e]),s??=i.getPropertyOptions(e),!((s.hasChanged??b)(n,t)||s.useDefault&&s.reflect&&n===this._$Ej?.get(e)&&!this.hasAttribute(i._$Eu(e,s))))return;this.C(e,t,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:r,wrapped:n},i){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,i??t??this[e]),!0!==n||void 0!==i)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,s]of e){const{wrapped:e}=s,r=this[t];!0!==e||this._$AL.has(t)||void 0===r||this.C(t,void 0,s,r)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[f("elementProperties")]=new Map,y[f("finalized")]=new Map,m?.({ReactiveElement:y}),(_.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const x=globalThis,w=e=>e,k=x.trustedTypes,E=k?k.createPolicy("lit-html",{createHTML:e=>e}):void 0,A="$lit$",S=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+S,M=`<${C}>`,z=document,T=()=>z.createComment(""),D=e=>null===e||"object"!=typeof e&&"function"!=typeof e,P=Array.isArray,H="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,L=/-->/g,R=/>/g,U=RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),B=/'/g,O=/"/g,W=/^(?:script|style|textarea|title)$/i,V=e=>(t,...s)=>({_$litType$:e,strings:t,values:s}),I=V(1),j=V(2),F=Symbol.for("lit-noChange"),Z=Symbol.for("lit-nothing"),G=new WeakMap,q=z.createTreeWalker(z,129);function Q(e,t){if(!P(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==E?E.createHTML(t):t}const K=(e,t)=>{const s=e.length-1,r=[];let n,i=2===t?"<svg>":3===t?"<math>":"",a=N;for(let t=0;t<s;t++){const s=e[t];let o,l,d=-1,c=0;for(;c<s.length&&(a.lastIndex=c,l=a.exec(s),null!==l);)c=a.lastIndex,a===N?"!--"===l[1]?a=L:void 0!==l[1]?a=R:void 0!==l[2]?(W.test(l[2])&&(n=RegExp("</"+l[2],"g")),a=U):void 0!==l[3]&&(a=U):a===U?">"===l[0]?(a=n??N,d=-1):void 0===l[1]?d=-2:(d=a.lastIndex-l[2].length,o=l[1],a=void 0===l[3]?U:'"'===l[3]?O:B):a===O||a===B?a=U:a===L||a===R?a=N:(a=U,n=void 0);const h=a===U&&e[t+1].startsWith("/>")?" ":"";i+=a===N?s+M:d>=0?(r.push(o),s.slice(0,d)+A+s.slice(d)+S+h):s+S+(-2===d?t:h)}return[Q(e,i+(e[s]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),r]};class Y{constructor({strings:e,_$litType$:t},s){let r;this.parts=[];let n=0,i=0;const a=e.length-1,o=this.parts,[l,d]=K(e,t);if(this.el=Y.createElement(l,s),q.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(r=q.nextNode())&&o.length<a;){if(1===r.nodeType){if(r.hasAttributes())for(const e of r.getAttributeNames())if(e.endsWith(A)){const t=d[i++],s=r.getAttribute(e).split(S),a=/([.?@])?(.*)/.exec(t);o.push({type:1,index:n,name:a[2],strings:s,ctor:"."===a[1]?se:"?"===a[1]?re:"@"===a[1]?ne:te}),r.removeAttribute(e)}else e.startsWith(S)&&(o.push({type:6,index:n}),r.removeAttribute(e));if(W.test(r.tagName)){const e=r.textContent.split(S),t=e.length-1;if(t>0){r.textContent=k?k.emptyScript:"";for(let s=0;s<t;s++)r.append(e[s],T()),q.nextNode(),o.push({type:2,index:++n});r.append(e[t],T())}}}else if(8===r.nodeType)if(r.data===C)o.push({type:2,index:n});else{let e=-1;for(;-1!==(e=r.data.indexOf(S,e+1));)o.push({type:7,index:n}),e+=S.length-1}n++}}static createElement(e,t){const s=z.createElement("template");return s.innerHTML=e,s}}function J(e,t,s=e,r){if(t===F)return t;let n=void 0!==r?s._$Co?.[r]:s._$Cl;const i=D(t)?void 0:t._$litDirective$;return n?.constructor!==i&&(n?._$AO?.(!1),void 0===i?n=void 0:(n=new i(e),n._$AT(e,s,r)),void 0!==r?(s._$Co??=[])[r]=n:s._$Cl=n),void 0!==n&&(t=J(e,n._$AS(e,t.values),n,r)),t}class X{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,r=(e?.creationScope??z).importNode(t,!0);q.currentNode=r;let n=q.nextNode(),i=0,a=0,o=s[0];for(;void 0!==o;){if(i===o.index){let t;2===o.type?t=new ee(n,n.nextSibling,this,e):1===o.type?t=new o.ctor(n,o.name,o.strings,this,e):6===o.type&&(t=new ie(n,this,e)),this._$AV.push(t),o=s[++a]}i!==o?.index&&(n=q.nextNode(),i++)}return q.currentNode=z,r}p(e){let t=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class ee{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,r){this.type=2,this._$AH=Z,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=J(this,e,t),D(e)?e===Z||null==e||""===e?(this._$AH!==Z&&this._$AR(),this._$AH=Z):e!==this._$AH&&e!==F&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>P(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==Z&&D(this._$AH)?this._$AA.nextSibling.data=e:this.T(z.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,r="number"==typeof s?this._$AC(e):(void 0===s.el&&(s.el=Y.createElement(Q(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===r)this._$AH.p(t);else{const e=new X(r,this),s=e.u(this.options);e.p(t),this.T(s),this._$AH=e}}_$AC(e){let t=G.get(e.strings);return void 0===t&&G.set(e.strings,t=new Y(e)),t}k(e){P(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,r=0;for(const n of e)r===t.length?t.push(s=new ee(this.O(T()),this.O(T()),this,this.options)):s=t[r],s._$AI(n),r++;r<t.length&&(this._$AR(s&&s._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=w(e).nextSibling;w(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class te{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,r,n){this.type=1,this._$AH=Z,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=n,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=Z}_$AI(e,t=this,s,r){const n=this.strings;let i=!1;if(void 0===n)e=J(this,e,t,0),i=!D(e)||e!==this._$AH&&e!==F,i&&(this._$AH=e);else{const r=e;let a,o;for(e=n[0],a=0;a<n.length-1;a++)o=J(this,r[s+a],t,a),o===F&&(o=this._$AH[a]),i||=!D(o)||o!==this._$AH[a],o===Z?e=Z:e!==Z&&(e+=(o??"")+n[a+1]),this._$AH[a]=o}i&&!r&&this.j(e)}j(e){e===Z?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class se extends te{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===Z?void 0:e}}class re extends te{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==Z)}}class ne extends te{constructor(e,t,s,r,n){super(e,t,s,r,n),this.type=5}_$AI(e,t=this){if((e=J(this,e,t,0)??Z)===F)return;const s=this._$AH,r=e===Z&&s!==Z||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,n=e!==Z&&(s===Z||r);r&&this.element.removeEventListener(this.name,this,s),n&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class ie{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){J(this,e)}}const ae=x.litHtmlPolyfillSupport;ae?.(Y,ee),(x.litHtmlVersions??=[]).push("3.3.3");const oe=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class le extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,s)=>{const r=s?.renderBefore??t;let n=r._$litPart$;if(void 0===n){const e=s?.renderBefore??null;r._$litPart$=n=new ee(t.insertBefore(T(),e),e,void 0,s??{})}return n._$AI(e),n})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return F}}le._$litElement$=!0,le.finalized=!0,oe.litElementHydrateSupport?.({LitElement:le});const de=oe.litElementPolyfillSupport;de?.({LitElement:le}),(oe.litElementVersions??=[]).push("4.2.2");const ce={type:"grid",stat_energy_from:null,stat_energy_to:null,stat_cost:null,entity_energy_price:null,number_energy_price:null,stat_compensation:null,entity_energy_price_export:null,number_energy_price_export:null,cost_adjustment_day:0};function he(e,t,s){const r="string"==typeof s?s.trim():s;r?e[t]=r:delete e[t]}function ue(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,{stat:s.stat_consumption,device:s,children:[],problem:null});const s=function(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,s.included_in_stat??null);return t}(e),r=function(e){const t=new Set,s=new Set;for(const r of e.keys()){const n=[],i=new Map;let a=r;for(;null!==a&&e.has(a)&&!s.has(a);){const s=i.get(a);if(void 0!==s){n.slice(s).forEach(e=>t.add(e));break}i.set(a,n.length),n.push(a),a=e.get(a)??null}n.forEach(e=>s.add(e))}return t}(s),n=[];for(const[e,i]of t){const a=s.get(e)??null;r.has(e)?(i.problem="cycle",n.push(i)):null===a?n.push(i):t.has(a)?t.get(a).children.push(i):(i.problem="missing_parent",n.push(i))}return n}function _e(e){return e.flatMap(e=>[e,..._e(e.children)])}function pe(e,t,s){const r=e.find(e=>e.stat_consumption===t);return void 0!==r&&((r.included_in_stat??null)!==s&&(null===s||!function(e,t){const s=new Set([t]);let r=!0;for(;r;){r=!1;for(const t of e){const e=t.included_in_stat;e&&s.has(e)&&!s.has(t.stat_consumption)&&(s.add(t.stat_consumption),r=!0)}}return s}(e,t).has(s)))}function ge(e,t){return e.map(e=>e.stat_consumption).filter(s=>pe(e,t,s))}const me={mW:.001,W:1,kW:1e3,MW:1e6};function fe(e,t){const s=t?e.states[t]:void 0;if(void 0===s)return null;const r=Number.parseFloat(s.state),n=me[s.attributes.unit_of_measurement??"W"];return Number.isFinite(r)&&void 0!==n?r*n:null}function $e(e,t){const s=new Map;for(const r of _e(e)){if(0===r.children.length)continue;const e=t.get(r.stat)??null,n=r.children.map(e=>t.get(e.stat)??null);s.set(r.stat,null===e||n.some(e=>null===e)?null:e-n.reduce((e,t)=>e+(t??0),0))}return s}const be={grid:["import","export"],solar:["production",null],battery:["discharge","charge"],gas:["consumption",null],water:["consumption",null]};function ve(e){const t=[];for(const s of e){const[e,r]=be[s.type]??["consumption",null];s.stat_energy_from&&t.push({type:s.type,role:e,stat:s.stat_energy_from,name:s.name}),null!==r&&s.stat_energy_to&&t.push({type:s.type,role:r,stat:s.stat_energy_to,name:s.name})}return t}const ye=["stat_energy_from","stat_energy_to"];const xe={menu:"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",dots:"M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",refresh:"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",home:"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",undo:"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",history:"M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"};function we(e){return j`<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d=${xe[e]}></path></svg>`}const ke=220,Ee=72,Ae=160,Se=24,Ce=24,Me="home",ze=["import","production","battery","export"],Te=["import","production","discharge","consumption"];function De(e,t,s){return e.map(e=>{const r=0===e.children.length||s.has(e.stat)?[]:[...De(e.children,t,s),{id:(n=e.stat,`untracked:${n}`),kind:"untracked",stat:e.stat,children:[]}];var n;return{id:e.stat,kind:"device",stat:e.stat,node:e,children:r}})}function Pe(e){if(0===e.children.length)return ke;const t=e.children.reduce((e,t)=>e+Pe(t),0);return Math.max(ke,t+Se*(e.children.length-1))}function He(e,t,s,r,n=new Set){const i=[],a=[],o=new Set(t.map(e=>"battery"===e.type?"battery":e.role)),l=t.map((e,t)=>({id:`source:${t}`,kind:"source",x:0,y:Ce,w:Ae,h:Ee,stat:e.stat,role:e.role,source:e}));for(const e of ze)o.has(e)||l.push({id:`placeholder:${e}`,kind:"placeholder",x:0,y:Ce,w:Ae,h:Ee,role:e});const d=l.length*Ae+(l.length-1)*Se,c=De(e,r,n),h=c.length?c.reduce((e,t)=>e+Pe(t),0)+Se*(c.length-1):ke,u=Math.max(d,h,ke),_=Ce+u/2;let p=_-d/2;for(const e of l)e.x=p,p+=184,i.push(e);i.push({id:Me,kind:"home",x:_-110,y:152,w:ke,h:Ee});for(const e of l){if("source"!==e.kind)continue;const t=Te.includes(e.role);a.push({from:t?e.id:Me,to:t?Me:e.id,kind:"source",power:null})}let g=224;const m=(e,t,n,o)=>{const l=Pe(e),d=152+128*(n+1);g=Math.max(g,d+Ee),i.push({id:e.id,kind:e.kind,x:t+(l-ke)/2,y:d,w:ke,h:Ee,stat:e.stat,node:e.node}),a.push({from:o,to:e.id,kind:e.kind,power:"untracked"===e.kind?r.get(e.stat)??null:s.get(e.stat)??null});let c=t+(l-(e.children.reduce((e,t)=>e+Pe(t),0)+Se*(e.children.length-1)))/2;for(const t of e.children)m(t,c,n+1,e.id),c+=Pe(t)+Se};let f=_-h/2;for(const e of c)m(e,f,0,Me),f+=Pe(e)+Se;return{blocks:i,edges:a,width:u+48,height:g+Ce}}const Ne={title:"Energy Flow Mapper",menu:"Menu",more:"More",reload:"Reload",undo:"Undo last save",backups:"Backups",loading:"Loading…",load_failed:"The energy settings could not be loaded.",sources:"Sources",sources_hint:"Drag a free sensor onto a source, or tap a source. Change prices in the energy settings.",open_energy_settings:"Energy settings",no_sources:"No sources configured.",role_import:"Grid import",role_export:"Grid export",role_production:"Solar production",role_discharge:"Battery discharge",role_charge:"Battery charge",role_gas:"Gas",role_water:"Water",diagram:"Energy flow",zoom_hint:"Zoom with the mouse wheel or two fingers, drag an empty area to move.",zoom_in:"Zoom in",zoom_out:"Zoom out",fit:"Fit",role_battery:"Battery",home_measured:"{power} measured",period_label:"Period",period_now:"Now",period_today:"Today",period_week:"7 days",period_month:"30 days",energy_loading:"Loading consumption …",detail_energy:"Energy in period",devices:"Devices",devices_hint:"Drag a device onto another one to include it there, or use the ⋮ menu.",home:"Home",home_drop:"Drop here for the top level",no_devices:"No devices in the energy dashboard yet. Add a free sensor.",untracked:"Not tracked individually",free_sensors:"Free sensors",free_sensors_hint:"Energy meters that are not in the energy dashboard yet.",search:"Search",no_candidates:"No free energy sensors.",add:"Add",add_title:"Add {name} under …",with_power:"Power sensor: {entity}",actions:"Actions for {name}",move:"Move to …",move_title:"Move {name} to …",top_level:"Top level (Home)",no_targets:"There is no other place for this device.",rename:"Rename …",rename_title:"Rename {name}",name_label:"Name",name_hint:"Leave empty to use the entity name.",remove:"Remove from the energy dashboard",remove_hint:"Its devices move up one level.",cancel:"Cancel",ok:"OK",close:"Close",details:"Details",select_hint:"Select a device to see its details.",detail_statistic:"Statistic",detail_power_sensor:"Power sensor",detail_device:"Device",detail_area:"Area",detail_power:"Power now",detail_untracked:"Not tracked by its devices",detail_issues:"Problems",none:"–",change_one:"1 change",change_other:"{count} changes",discard:"Discard",save:"Save",confirm_title:"Save changes?",confirm_errors:"Fix these problems first:",confirm_warnings:"Please note:",checking:"Checking …",saving:"Saving …",saved:"Saved. A backup of the previous settings was created.",nothing_to_save:"Nothing changed.",diff_added:"{name} added",diff_added_under:"{name} added under {to}",diff_removed:"{name} removed",diff_moved:"{name} moved under {to}",diff_moved_top:"{name} moved to the top level",diff_renamed:"{name} renamed to “{to}”",diff_renamed_reset:"{name} uses the entity name again",diff_rate:"Power sensor of {name} changed",issue_cycle:"Part of a loop of devices",issue_self_parent:"Included in itself",issue_duplicate:"Listed more than once",issue_missing_parent:"Its parent device is not in the energy dashboard",issue_source_and_device:"Also used as a source",issue_statistic_missing:"Statistic not found",issue_not_energy_unit:"Unit {unit} is not an energy unit",issue_children_exceed_parent:"Its devices use more than this device",backups_title:"Backups",backups_empty:"No backups yet. One is created before every save.",backup_by:"by {user}",restore:"Restore",restore_confirm:"Restore the backup from {date}? The current settings are backed up first.",undo_confirm:"Restore the settings from before the last save ({date})? The current settings are backed up first.",draft_lost:"Your unsaved changes will be discarded.",restored:"Backup restored.",summary_added:"{count} added",summary_removed:"{count} removed",summary_moved:"{count} moved",summary_renamed:"{count} renamed",summary_rate:"{count} power sensor changed",summary_restored:"Restored a backup",error_conflict:"The energy settings were changed elsewhere in the meantime. They were reloaded; check your changes and save again.",error_not_loaded:"Energy Flow Mapper is not loaded.",error_unsupported_energy_api:"The energy settings of this Home Assistant release are not supported. The editor is disabled to protect your settings.",assign_title:"Assign {role}",assign_hint:"Pick a free energy meter.",battery_title:"Battery: charging meter",battery_hint:"{name} measures discharging. Pick the meter that measures charging.",source_assign:"Assign sensor …",source_replace:"Replace sensor …",source_remove:"Remove as source",power_only:"Power only",power_only_hint:"These power sensors have no energy meter. “Create meter” adds an integral helper right away; it stays even without Energy Flow Mapper.",create_meter:"Create meter",create_meter_title:"Create an energy meter for {name}?",create_meter_text:"The helper “{helper}” is created right away under Settings → Helpers. It is an ordinary Home Assistant helper and stays even if you remove Energy Flow Mapper. Its meter is then added to your draft.",creating:"Creating …",meter_created:"Meter “{name}” created and added to the draft.",energy_suffix:"Energy",external_statistic:"External statistic",created_by:"Created by Energy Flow Mapper",detail_helper:"Helper",diff_source_added:"{name} assigned as {role}",diff_source_removed:"{name} removed as {role}",summary_source_added:"{count} assigned as source",summary_source_removed:"{count} removed as source",issue_duplicate_source:"Used by more than one source",error_unknown_source:"This sensor is not a source in the energy dashboard.",error_not_a_power_candidate:"This sensor is not a power sensor without an energy meter.",error_integral_failed:"The energy meter helper could not be created.",error_unknown:"Error: {message}"},Le={de:{title:"Energy Flow Mapper",menu:"Menü",more:"Mehr",reload:"Neu laden",undo:"Letztes Speichern rückgängig machen",backups:"Sicherungen",loading:"Wird geladen …",load_failed:"Die Energie-Einstellungen konnten nicht geladen werden.",sources:"Quellen",sources_hint:"Zieh einen freien Sensor auf eine Quelle oder tippe eine Quelle an. Preise änderst du in den Energie-Einstellungen.",open_energy_settings:"Energie-Einstellungen",no_sources:"Keine Quellen eingerichtet.",role_import:"Netz-Bezug",role_export:"Einspeisung",role_production:"Solar-Ertrag",role_discharge:"Batterie entladen",role_charge:"Batterie laden",role_gas:"Gas",role_water:"Wasser",diagram:"Energiefluss",zoom_hint:"Zoomen mit dem Mausrad oder zwei Fingern, Ziehen auf freier Fläche verschiebt.",zoom_in:"Vergrössern",zoom_out:"Verkleinern",fit:"Einpassen",role_battery:"Batterie",home_measured:"{power} gemessen",period_label:"Zeitraum",period_now:"Jetzt",period_today:"Heute",period_week:"7 Tage",period_month:"30 Tage",energy_loading:"Verbrauch wird geladen …",detail_energy:"Energie im Zeitraum",devices:"Geräte",devices_hint:"Zieh ein Gerät auf ein anderes, um es dort unterzuordnen, oder nutze das ⋮-Menü.",home:"Zuhause",home_drop:"Hier ablegen für die oberste Ebene",no_devices:"Noch keine Geräte im Energie-Dashboard. Füge einen freien Sensor hinzu.",untracked:"Nicht einzeln erfasst",free_sensors:"Freie Sensoren",free_sensors_hint:"Energie-Zähler, die noch nicht im Energie-Dashboard sind.",search:"Suchen",no_candidates:"Keine freien Energie-Sensoren.",add:"Hinzufügen",add_title:"{name} hinzufügen unter …",with_power:"Leistungssensor: {entity}",actions:"Aktionen für {name}",move:"Verschieben nach …",move_title:"{name} verschieben nach …",top_level:"Oberste Ebene (Zuhause)",no_targets:"Für dieses Gerät gibt es keinen anderen Platz.",rename:"Umbenennen …",rename_title:"{name} umbenennen",name_label:"Name",name_hint:"Leer lassen, um den Namen der Entity zu verwenden.",remove:"Aus dem Energie-Dashboard entfernen",remove_hint:"Seine Geräte rutschen eine Ebene nach oben.",cancel:"Abbrechen",ok:"OK",close:"Schliessen",details:"Details",select_hint:"Wähle ein Gerät, um Details zu sehen.",detail_statistic:"Statistik",detail_power_sensor:"Leistungssensor",detail_device:"Gerät",detail_area:"Bereich",detail_power:"Leistung jetzt",detail_untracked:"Nicht von seinen Geräten erfasst",detail_issues:"Probleme",none:"–",change_one:"1 Änderung",change_other:"{count} Änderungen",discard:"Verwerfen",save:"Speichern",confirm_title:"Änderungen speichern?",confirm_errors:"Behebe zuerst diese Probleme:",confirm_warnings:"Bitte beachten:",checking:"Wird geprüft …",saving:"Wird gespeichert …",saved:"Gespeichert. Die vorherigen Einstellungen wurden gesichert.",nothing_to_save:"Es hat sich nichts geändert.",diff_added:"{name} hinzugefügt",diff_added_under:"{name} hinzugefügt unter {to}",diff_removed:"{name} entfernt",diff_moved:"{name} verschoben unter {to}",diff_moved_top:"{name} auf die oberste Ebene verschoben",diff_renamed:"{name} umbenannt in «{to}»",diff_renamed_reset:"{name} verwendet wieder den Namen der Entity",diff_rate:"Leistungssensor von {name} geändert",issue_cycle:"Teil einer Schleife von Geräten",issue_self_parent:"Sich selbst untergeordnet",issue_duplicate:"Mehrfach eingetragen",issue_missing_parent:"Das übergeordnete Gerät ist nicht im Energie-Dashboard",issue_source_and_device:"Wird auch als Quelle verwendet",issue_statistic_missing:"Statistik nicht gefunden",issue_not_energy_unit:"Die Einheit {unit} ist keine Energie-Einheit",issue_children_exceed_parent:"Seine Geräte verbrauchen mehr als dieses Gerät",backups_title:"Sicherungen",backups_empty:"Noch keine Sicherungen. Vor jedem Speichern wird eine angelegt.",backup_by:"von {user}",restore:"Wiederherstellen",restore_confirm:"Die Sicherung vom {date} wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",undo_confirm:"Die Einstellungen von vor dem letzten Speichern ({date}) wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",draft_lost:"Deine ungespeicherten Änderungen gehen dabei verloren.",restored:"Sicherung wiederhergestellt.",summary_added:"{count} hinzugefügt",summary_removed:"{count} entfernt",summary_moved:"{count} verschoben",summary_renamed:"{count} umbenannt",summary_rate:"{count} Leistungssensor geändert",summary_restored:"Sicherung wiederhergestellt",error_conflict:"Die Energie-Einstellungen wurden in der Zwischenzeit an anderer Stelle geändert. Sie wurden neu geladen; prüfe deine Änderungen und speichere noch einmal.",error_not_loaded:"Energy Flow Mapper ist nicht geladen.",error_unsupported_energy_api:"Die Energie-Einstellungen dieser Home-Assistant-Version werden nicht unterstützt. Zum Schutz deiner Einstellungen ist der Editor deaktiviert.",assign_title:"{role} zuweisen",assign_hint:"Wähle einen freien Energiezähler.",battery_title:"Batterie: Zähler fürs Laden",battery_hint:"{name} misst das Entladen. Wähle den Zähler, der das Laden misst.",source_assign:"Sensor zuweisen …",source_replace:"Sensor ersetzen …",source_remove:"Als Quelle entfernen",power_only:"Nur Leistung",power_only_hint:"Diese Leistungssensoren haben keinen Energiezähler. «Zähler anlegen» erstellt sofort einen Integral-Helfer; er bleibt auch ohne Energy Flow Mapper bestehen.",create_meter:"Zähler anlegen",create_meter_title:"Energiezähler für {name} anlegen?",create_meter_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt. Er ist ein normaler Home-Assistant-Helfer und bleibt auch bestehen, wenn du Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf.",creating:"Wird angelegt …",meter_created:"Zähler «{name}» angelegt und zum Entwurf hinzugefügt.",energy_suffix:"Energie",external_statistic:"Externe Statistik",created_by:"Von Energy Flow Mapper angelegt",detail_helper:"Helfer",diff_source_added:"{name} als {role} zugewiesen",diff_source_removed:"{name} als {role} entfernt",summary_source_added:"{count} als Quelle zugewiesen",summary_source_removed:"{count} als Quelle entfernt",issue_duplicate_source:"Von mehreren Quellen verwendet",error_unknown_source:"Dieser Sensor ist keine Quelle im Energie-Dashboard.",error_not_a_power_candidate:"Dieser Sensor ist kein Leistungssensor ohne Energiezähler.",error_integral_failed:"Der Helfer für den Energiezähler konnte nicht angelegt werden.",error_unknown:"Fehler: {message}"},en:Ne};function Re(e){return e?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function Ue(e,t,s={}){return(r=Re(e),Le[r]??Le[r.split("-")[0]]??Ne)[t].replace(/\{(\w+)\}/g,(e,t)=>t in s?s[t]:e);var r}function Be(e){return e in Ne}const Oe={comma_decimal:["en-US","en"],decimal_comma:["de","es","it"],quote_decimal:["de-CH"],space_comma:["fr","sv","cs"],system:void 0};function We(e,t,s=0){const r=e?.locale.number_format??"language",n=r in Oe?Oe[r]:"none"===r?["en-US"]:[Re(e)];try{return new Intl.NumberFormat(n,{useGrouping:"none"!==r,maximumFractionDigits:s}).format(t)}catch{return String(t)}}function Ve(e,t){return Math.abs(t)>=1e3?`${We(e,t/1e3,2)} kW`:`${We(e,t)} W`}function Ie(e,t){return Math.abs(t)<1?`${We(e,1e3*t)} Wh`:`${We(e,t,Math.abs(t)<100?2:0)} kWh`}function je(e,t){try{return new Intl.DateTimeFormat(Re(e),{dateStyle:"medium",timeStyle:"short"}).format(new Date(t))}catch{return t}}const Fe="energy-flow-mapper-panel",Ze="energy_flow_mapper",Ge=4e3,qe="__home__",Qe=.2,Ke=2.5,Ye=.8,Je=48,Xe={import:"var(--energy-grid-consumption-color, #488fc2)",export:"var(--energy-grid-return-color, #8353d1)",production:"var(--energy-solar-color, #ff9800)",battery:"var(--energy-battery-out-color, #4db6ac)",discharge:"var(--energy-battery-out-color, #4db6ac)",charge:"var(--energy-battery-in-color, #f06292)",consumption:"var(--energy-gas-color, #8e021b)"},et="src:";function tt(e){switch(e){case"import":case"export":case"production":case"battery":return e;case"discharge":case"charge":return"battery";default:return null}}function st(e,t){const s=t??{},r=`error_${s.translation_key??""}`;return s.translation_key&&Be(r)?Ue(e,r):Ue(e,"error_unknown",{message:s.message??String(t)})}function rt(e){history.pushState(null,"",e),window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:!1}}))}class nt extends le{static properties={hass:{attribute:!1},narrow:{type:Boolean},_snapshot:{state:!0},_loadError:{state:!0},_changes:{state:!0},_validation:{state:!0},_selected:{state:!0},_collapsed:{state:!0},_dragged:{state:!0},_dropTarget:{state:!0},_search:{state:!0},_dialog:{state:!0},_busy:{state:!0},_toast:{state:!0},_renameValue:{state:!0},_view:{state:!0},_zoom:{state:!0},_period:{state:!0},_energy:{state:!0}};_loading=!1;_validateRequest=0;_energyRequest=0;_toastTimer;_fitted=!1;_pointers=new Map;_pointerType="mouse";constructor(){super(),this.narrow=!1,this._snapshot=null,this._loadError=null,this._changes=[],this._validation=null,this._selected=null,this._collapsed=new Set,this._dragged=null,this._dropTarget=null,this._search="",this._dialog=null,this._busy=!1,this._toast=null,this._renameValue="",this._view="diagram",this._zoom={x:0,y:0,k:1},this._period="now",this._energy=null}_t(e,t={}){return Ue(this.hass,e,t)}willUpdate(e){!e.has("hass")||!this.hass||this._snapshot||this._loading||this._loadError||this._load()}async _load(){if(this.hass){this._loading=!0;try{this._snapshot=await this.hass.callWS({type:`${Ze}/get`}),this._loadError=null}catch(e){this._loadError=st(this.hass,e)}finally{this._loading=!1}await Promise.all([this._validate(),this._loadEnergy()])}}setPeriod(e){this._period=e,this._energy=null,this._loadEnergy()}async _loadEnergy(){const e=++this._energyRequest;if(this.hass&&this._snapshot&&"now"!==this._period)try{const t=await this.hass.callWS({type:`${Ze}/energy`,period:this._period,...this._changes.length?{base_hash:this._snapshot.hash,changes:this._changes}:{}});e===this._energyRequest&&(this._energy=t)}catch(t){e===this._energyRequest&&await this._handleError(t)}else this._energy=null}_values(e){if("now"===this._period)return this._powerMap(e);const t=this._energy?.energy??{};return new Map(e.map(e=>[e.stat_consumption,t[e.stat_consumption]??null]))}_formatValue(e){return"now"===this._period?Ve(this.hass,e):Ie(this.hass,e)}get draft(){return function(e,t){const s=structuredClone(e);for(const e of t){const t=s.findIndex(t=>t.stat_consumption===e.stat);if("add"===e.type){if(-1!==t)continue;const r={stat_consumption:e.stat};he(r,"stat_rate",e.stat_rate),he(r,"name",e.name),he(r,"included_in_stat",e.parent),s.push(r);continue}if(-1!==t)if("move"===e.type)he(s[t],"included_in_stat",e.parent);else if("rename"===e.type)he(s[t],"name",e.name);else{const[r]=s.splice(t,1);for(const t of s)t.included_in_stat===e.stat&&he(t,"included_in_stat",r.included_in_stat)}}return s}(this._snapshot?.prefs.device_consumption??[],this._changes)}get draftSources(){return function(e,t){const s=structuredClone(e);for(const e of t)if("assign_source"===e.type)if("import"===e.role||"export"===e.role){const t="import"===e.role?"stat_energy_from":"stat_energy_to";let r=s.find(e=>"grid"===e.type);void 0===r&&(r=structuredClone(ce),s.push(r)),r[t]=e.stat}else"production"===e.role?s.push({type:"solar",stat_energy_from:e.stat,config_entry_solar_forecast:null}):"battery"===e.role&&e.stat_to&&s.push({type:"battery",stat_energy_from:e.stat,stat_energy_to:e.stat_to});else if("unassign_source"===e.type){const t=s.findIndex(t=>ye.some(s=>t[s]===e.stat));if(-1===t)continue;const r=s[t];if("grid"!==r.type){s.splice(t,1);continue}for(const t of ye)r[t]===e.stat&&(r[t]=null);r.stat_energy_from||r.stat_energy_to||r.stat_rate||r.power_config||s.splice(t,1)}return s}(this._snapshot?.prefs.energy_sources??[],this._changes)}_info(e){return this._snapshot?.stats[e]??this._snapshot?.candidates.find(t=>t.stat===e)??this._snapshot?.power_candidates?.find(t=>t.stat===e)}_name(e,t=this.draft){return function(e,t,s){const r=t.find(t=>t.stat_consumption===e);return r?.name||s[e]?.name||e}(e,t,{...this._snapshot?.stats,...Object.fromEntries((this._snapshot?.candidates??[]).map(e=>[e.stat,e]))})}_issues(){const e=this._validation?.issues??this._snapshot?.issues??[];return"now"===this._period?e:[...e,...this._energy?.issues??[]]}_issuesFor(e){return this._issues().filter(t=>t.stat===e)}_change(e){this._changes=[...this._changes,e],this._validate(),this._loadEnergy()}async _validate(){const e=++this._validateRequest;if(!this.hass||!this._snapshot||0===this._changes.length)return this._validation=null,null;try{const t=await this.hass.callWS({type:`${Ze}/validate`,base_hash:this._snapshot.hash,changes:this._changes});return e===this._validateRequest&&(this._validation=t),t}catch(e){return await this._handleError(e),null}}async _handleError(e){this._showToast(st(this.hass,e)),"conflict"===e?.translation_key&&(this._snapshot=null,await this._load())}_discard(){this._changes=[],this._validation=null,this._loadEnergy()}async _openConfirm(){this._dialog={kind:"confirm",result:null};const e=await this._validate();"confirm"===this._dialog?.kind&&(this._dialog=e?{kind:"confirm",result:e}:null)}async _save(){if(this.hass&&this._snapshot){this._busy=!0;try{const e=await this.hass.callWS({type:`${Ze}/save`,base_hash:this._snapshot.hash,changes:this._changes});this._dialog=null,this._discard(),this._showToast(this._t(e.backup_id?"saved":"nothing_to_save")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}async _openBackups(e){if(this.hass)try{const{backups:t}=await this.hass.callWS({type:`${Ze}/backups`});e&&t.length>0?this._dialog={kind:"restore",backup:t[0],undo:!0}:this._dialog={kind:"backups",entries:t}}catch(e){await this._handleError(e)}}async _restore(e){if(this.hass&&this._snapshot){this._busy=!0;try{await this.hass.callWS({type:`${Ze}/restore`,backup_id:e.id,base_hash:this._snapshot.hash}),this._dialog=null,this._discard(),this._showToast(this._t("restored")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}_showToast(e){this._toast=e,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},4e3)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this._toastTimer)}_canDrop(e){const t=this._dragged;if(null===t)return!1;if(e.startsWith(et))return"candidate"===t.kind;const s=e===qe?null:e;return"candidate"===t.kind||pe(this.draft,t.stat,s)}_drop(e){const t=this._dragged,s=this._canDrop(e);if(this._dragged=null,this._dropTarget=null,null===t||!s)return;if(e.startsWith(et))return void this._assign(e.split(":")[1],t.stat);const r=e===qe?null:e;"candidate"===t.kind?this._addCandidate(t.stat,r):this._change({type:"move",stat:t.stat,parent:r})}_dragHandlers(e){return{over:t=>{this._canDrop(e)&&(t.preventDefault(),this._dropTarget=e)},leave:()=>{this._dropTarget===e&&(this._dropTarget=null)},drop:t=>{t.preventDefault(),this._drop(e)}}}_startDrag(e,t){e.dataTransfer?.setData("text/plain",t.stat),e.dataTransfer&&(e.dataTransfer.effectAllowed="move"),"device"===t.kind&&"diagram"===this._view&&this._setDragImage(e),this._dragged=t}_setDragImage(e){const t=e.currentTarget,s=e.dataTransfer;if(!t||!s?.setDragImage)return;const r="touch"===this._pointerType||"pen"===this._pointerType,n=r?Math.max(this._zoom.k,.8):this._zoom.k,i=t.offsetWidth*n,a=t.offsetHeight*n,o=document.createElement("div");o.className="drag-ghost",o.style.cssText=`position:fixed;left:0;top:-${Math.ceil(a)+100}px;width:${i}px;height:${a}px;overflow:hidden;pointer-events:none`;const l=t.cloneNode(!0);l.style.left="0",l.style.top="0",l.style.transform=`scale(${n})`,l.style.transformOrigin="0 0",o.append(l),this.renderRoot.append(o);const d=t.getBoundingClientRect();r?s.setDragImage(o,i/2,a+48):s.setDragImage(o,Math.min(i,Math.max(0,e.clientX-d.left)),Math.min(a,Math.max(0,e.clientY-d.top))),setTimeout(()=>o.remove(),0)}_addCandidate(e,t){const s=this._snapshot?.candidates.find(t=>t.stat===e);this._change({type:"add",stat:e,parent:t,stat_rate:s?.power??null}),this._selected=e}_assign(e,t){"battery"!==e?(this._dialog=null,this._change({type:"assign_source",role:e,stat:t})):this._dialog={kind:"battery",discharge:t}}_usedInDraft(){const e=new Set;for(const t of this.draft)e.add(t.stat_consumption),t.stat_rate&&e.add(t.stat_rate);for(const t of ve(this.draftSources))e.add(t.stat);return e}_freePowerSensors(){const e=this._usedInDraft();return(this._snapshot?.power_candidates??[]).filter(t=>!e.has(t.stat))}async _createMeter(e){if(!this.hass)return;const t=`${this._info(e)?.name||e} ${this._t("energy_suffix")}`;this._busy=!0;try{const s=await this.hass.callWS({type:`${Ze}/create_integral`,power_entity_id:e,name:t});this._dialog=null,await this._load(),this._change({type:"add",stat:s.entity_id,parent:null,stat_rate:s.stat_rate}),this._selected=s.entity_id,this._showToast(this._t("meter_created",{name:t}))}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}_freeCandidates(){const e=this._usedInDraft(),t=this._search.trim().toLowerCase();return(this._snapshot?.candidates??[]).filter(s=>!e.has(s.stat)&&(!t||[s.name,s.stat,s.area_name,s.device_name].some(e=>e?.toLowerCase().includes(t))))}updated(e){if(!this._fitted&&this._snapshot&&"diagram"===this._view&&(this._fitted=this.fit()),!e.has("_dialog"))return;const t=this.renderRoot.querySelector("dialog");t&&(this._dialog&&!t.open?t.showModal?.():!this._dialog&&t.open&&t.close?.())}_reload(){this._snapshot=null,this._loadError=null,this._load()}render(){return I`
      <div class="header">
        ${this.narrow?I`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${()=>this.dispatchEvent(new Event("hass-toggle-menu",{bubbles:!0,composed:!0}))}
            >
              ${we("menu")}
            </button>`:Z}
        <h1>${this._t("title")}</h1>
        ${this.narrow?I`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${()=>this._dialog={kind:"menu"}}
            >
              ${we("dots")}
            </button>`:I`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
                ${we("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
                ${we("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${()=>this._reload()}
              >
                ${we("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast?I`<div class="toast" role="status">${this._toast}</div>`:Z}
    `}_renderBody(){return this._loadError?I`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`:this._snapshot?I`
      <div class="content ${this.narrow?"narrow":""}">
        ${this.narrow?Z:I`<aside class="column">${this._renderCandidates()}</aside>`}
        <main class="column main">
          ${"list"===this._view?I`${this._renderSources()} ${this._renderTree()}`:this._renderDiagram()}
        </main>
        ${this.narrow?Z:I`<aside class="column">${this._renderDetails()}</aside>`}
      </div>
    `:I`<div class="message">${this._t("loading")}</div>`}_powerMap(e){return new Map(e.map(e=>[e.stat_consumption,this.hass?fe(this.hass,e.stat_rate):null]))}diagramLayout(){const e=this.draft,t=ue(e),s=this._values(e);return He(t,ve(this.draftSources),s,$e(t,s),this._collapsed)}_viewport(){return this.renderRoot.querySelector(".viewport")}fit(){const e=this._viewport(),t=e?.clientWidth??0,s=e?.clientHeight??0;if(!t||!s)return!1;const{width:r,height:n}=this.diagramLayout(),i=Math.min(1.4,Math.max(.2,Math.min(t/r,s/n)));return this._zoom={k:i,x:(t-r*i)/2,y:Math.max(0,(s-n*i)/2)},!0}zoomAt(e,t,s){const{x:r,y:n,k:i}=this._zoom,a=Math.min(2.5,Math.max(.2,i*s)),o=a/i;this._zoom={k:a,x:e-(e-r)*o,y:t-(t-n)*o}}_zoomCenter(e){const t=this._viewport();this.zoomAt((t?.clientWidth??0)/2,(t?.clientHeight??0)/2,e)}_local(e){const t=this._viewport()?.getBoundingClientRect();return{x:e.clientX-(t?.left??0),y:e.clientY-(t?.top??0)}}_onWheel(e){e.preventDefault();const{x:t,y:s}=this._local(e);this.zoomAt(t,s,Math.exp(.0015*-e.deltaY))}_onPointerDown(e){this._pointerType=e.pointerType||"mouse",e.target.closest?.(".block, button, a")||(e.currentTarget?.setPointerCapture?.(e.pointerId),this._pointers.set(e.pointerId,this._local(e)))}_onPointerMove(e){const t=this._pointers.get(e.pointerId);if(!t)return;const s=[...this._pointers.values()],r=this._local(e);if(this._pointers.set(e.pointerId,r),1===this._pointers.size)return void(this._zoom={...this._zoom,x:this._zoom.x+r.x-t.x,y:this._zoom.y+r.y-t.y});const n=[...this._pointers.values()],i=e=>Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y),a=e=>({x:(e[0].x+e[1].x)/2,y:(e[0].y+e[1].y)/2}),[o,l]=[a(s),a(n)];this._zoom={...this._zoom,x:this._zoom.x+l.x-o.x,y:this._zoom.y+l.y-o.y},i(s)>0&&this.zoomAt(l.x,l.y,i(n)/i(s))}_onPointerUp(e){this._pointers.delete(e.pointerId)}_renderDiagram(){const e=this.draft,t=this.diagramLayout(),s=new Map(t.blocks.map(e=>[e.id,e])),r=Math.max(0,...t.edges.map(e=>e.power??0)),n=this._values(e),i=$e(ue(e),n),a=ue(e).map(e=>n.get(e.stat)).filter(e=>null!=e),o=a.length?a.reduce((e,t)=>e+t,0):null,{x:l,y:d,k:c}=this._zoom;return I`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t("diagram")}</h2>
          <div class="periods" role="group" aria-label=${this._t("period_label")}>
            ${["now","today","week","month"].map(e=>I`<button
                class=${this._period===e?"active":""}
                aria-pressed=${String(this._period===e)}
                data-period=${e}
                @click=${()=>this.setPeriod(e)}
              >
                ${this._t(`period_${e}`)}
              </button>`)}
          </div>
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
        <p class="hint">
          ${this._t("devices_hint")} ${this._t("sources_hint")} ${this._t("zoom_hint")}
          ${"now"!==this._period&&null===this._energy?I`<span class="loading">${this._t("energy_loading")}</span>`:Z}
        </p>
        <div
          class="viewport ${this._dragged?"dragging":""}"
          @wheel=${e=>this._onWheel(e)}
          @pointerdown=${e=>this._onPointerDown(e)}
          @pointermove=${e=>this._onPointerMove(e)}
          @pointerup=${e=>this._onPointerUp(e)}
          @pointercancel=${e=>this._onPointerUp(e)}
        >
          <div
            class="canvas"
            style="width:${t.width}px;height:${t.height}px;transform:translate(${l}px, ${d}px) scale(${c})"
          >
            <svg class="edges" width=${t.width} height=${t.height} aria-hidden="true">
              ${t.edges.map(e=>this._renderEdge(e,s,r))}
            </svg>
            ${t.blocks.map(t=>this._renderBlock(t,e,o,i))}
          </div>
        </div>
      </section>
    `}_edgeColor(e,t){if("untracked"===e.kind)return"var(--secondary-text-color)";if("source"===e.kind){const s=t.get(e.from===Me?e.to:e.from);return Xe[s?.role??""]??"var(--secondary-text-color)"}return"var(--primary-color)"}_renderEdge(e,t,s){const r=t.get(e.from),n=t.get(e.to);if(!r||!n)return Z;const i=this._edgeColor(e,t),a="untracked"===e.kind||"device"===e.kind&&null===e.power;return j`<g class="edge edge-${e.kind}" data-from=${e.from} data-to=${e.to}>
      <path
        d=${function(e,t){const s=e.y<=t.y,r=e.x+e.w/2,n=s?e.y+e.h:e.y,i=t.x+t.w/2,a=s?t.y:t.y+t.h,o=(n+a)/2;return`M ${r} ${n} C ${r} ${o}, ${i} ${o}, ${i} ${a}`}(r,n)}
        fill="none"
        stroke=${i}
        stroke-width=${function(e,t){return null===e||t<=0?2:2+6*Math.min(1,Math.max(0,e)/t)}(e.power,s)}
        stroke-dasharray=${a?"4 4":"none"}
        stroke-linecap="round"
      ></path>
      <polygon points=${function(e,t,s=6){const r=e.y<=t.y,n=t.x+t.w/2,i=r?t.y:t.y+t.h,a=r?i-1.4*s:i+1.4*s;return`${n-s},${a} ${n+s},${a} ${n},${i}`}(r,n)} fill=${i}></polygon>
    </g>`}_blockStyle(e){return`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px`}_renderBlock(e,t,s,r){const n=this._blockStyle(e);switch(e.kind){case"home":{const e=this._dragHandlers(qe);return I`<div
          class="block home ${this._dropTarget===qe?"drop":""} ${this._dragged&&this._canDrop(qe)?"can-drop":""}"
          style=${n}
          @dragover=${e.over}
          @dragleave=${e.leave}
          @drop=${e.drop}
        >
          ${we("home")}
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${null===s?Z:I`<span class="sub"
                  >${this._t("home_measured",{power:this._formatValue(s)})}</span
                >`}
          </div>
        </div>`}case"source":case"placeholder":{const t=e.role??"import",s="consumption"===t?this._t(`role_${e.source?.type??"gas"}`):this._t(`role_${t}`),r=tt(t),i=r?`${et}${r}:${e.id}`:null,a=i?this._dragHandlers(i):null;return I`<button
          class="block source ${e.kind} ${i&&this._dropTarget===i?"drop":""} ${i&&this._dragged&&this._canDrop(i)?"can-drop":""}"
          style="${n};--source-color:${Xe[t]??"var(--divider-color)"}"
          title=${this._t("sources_hint")}
          data-role=${t}
          @dragover=${a?.over}
          @dragleave=${a?.leave}
          @drop=${a?.drop}
          @click=${()=>{"placeholder"===e.kind&&r?this._dialog={kind:"assign",role:r}:this._dialog={kind:"source",role:t,label:s,stat:e.stat??null}}}
        >
          <div class="block-text">
            <span class="node-name">${"placeholder"===e.kind?`+ ${s}`:s}</span>
            ${e.stat?I`<span class="sub">${e.source?.name||this._name(e.stat)}</span>`:Z}
          </div>
        </button>`}case"untracked":{const t=r.get(e.stat);return I`<div class="block untracked" style=${n} data-parent=${e.stat}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub">${null==t?this._t("none"):this._formatValue(t)}</span>
          </div>
        </div>`}default:return this._renderDeviceBlock(e,t)}}_renderDeviceBlock(e,t){const s=e.stat,r=e.node,n=this._name(s,t),i=this._issuesFor(s),a=i.some(e=>"error"===e.severity)||null!==r.problem,o=this._dragHandlers(s),l=t.find(e=>e.stat_consumption===s),d=l?this._values([l]).get(s)??null:null,c=this._snapshot?.stats[s]??this._snapshot?.candidates.find(e=>e.stat===s),h=[null===d?null:this._formatValue(d),c?.area_name].filter(Boolean).join(" · "),u=this._collapsed.has(s);return I`<div
      class="block device node ${this._selected===s?"selected":""} ${this._dropTarget===s?"drop":""} ${a?"has-error":i.length?"has-warning":""} ${this._dragged?.stat===s?"dragged":this._dragged&&this._canDrop(s)?"can-drop":""}"
      style=${this._blockStyle(e)}
      draggable="true"
      data-stat=${s}
      @dragstart=${e=>this._startDrag(e,{kind:"device",stat:s})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @dragover=${o.over}
      @dragleave=${o.leave}
      @drop=${o.drop}
      @click=${()=>{this._selected=s,this.narrow&&(this._dialog={kind:"details"})}}
    >
      ${r.children.length?I`<button
            class="icon toggle"
            aria-label=${n}
            aria-expanded=${String(!u)}
            @click=${e=>{e.stopPropagation(),this._toggle(s)}}
          >
            ${u?"▸":"▾"}
          </button>`:Z}
      <div class="block-text">
        <span class="node-name" title=${n}>${n}</span>
        ${h?I`<span class="sub">${h}</span>`:Z}
      </div>
      ${i.length||r.problem?I`<span class="badge" title=${i.map(e=>this._issueText(e)).join("\n")}
            >!</span
          >`:Z}
      <button
        class="icon"
        aria-label=${this._t("actions",{name:n})}
        @click=${e=>{e.stopPropagation(),this._dialog={kind:"actions",stat:s}}}
      >
        ${we("dots")}
      </button>
    </div>`}_toggle(e){const t=new Set(this._collapsed);t.has(e)?t.delete(e):t.add(e),this._collapsed=t}_renderSources(){const e=ve(this.draftSources);return I`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${()=>rt("/config/energy")}>
            ${this._t("open_energy_settings")}
          </button>
        </div>
        <p class="hint">${this._t("sources_hint")}</p>
        ${0===e.length?I`<p class="empty">${this._t("no_sources")}</p>`:I`<div class="sources">
              ${e.map(e=>I`<div class="source">
                  <span class="source-role"
                    >${this._t("consumption"===e.role?`role_${e.type}`:`role_${e.role}`)}</span
                  >
                  <span class="source-name">${e.name||this._name(e.stat)}</span>
                </div>`)}
            </div>`}
      </section>
    `}_renderTree(){const e=this.draft,t=ue(e),s=new Map(e.map(e=>[e.stat_consumption,this.hass?fe(this.hass,e.stat_rate):null])),r=$e(t,s),n=this._dragHandlers(qe);return I`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget===qe?"drop":""}"
          @dragover=${n.over}
          @dragleave=${n.leave}
          @drop=${n.drop}
        >
          ${we("home")}
          <span>${this._t("home")}</span>
          ${this._dragged?I`<span class="hint">${this._t("home_drop")}</span>`:Z}
        </div>
        ${0===t.length?I`<p class="empty">${this._t("no_devices")}</p>`:I`<ul class="tree" role="tree">
              ${t.map(t=>this._renderNode(t,e,s,r))}
            </ul>`}
      </section>
    `}_renderNode(e,t,s,r){const n=this._name(e.stat,t),i=this._issuesFor(e.stat),a=i.some(e=>"error"===e.severity)||null!==e.problem,o=this._collapsed.has(e.stat),l=this._dragHandlers(e.stat),d=s.get(e.stat)??null,c=r.get(e.stat);return I`
      <li role="treeitem" aria-expanded=${e.children.length?String(!o):Z}>
        <div
          class="node ${this._selected===e.stat?"selected":""} ${this._dropTarget===e.stat?"drop":""} ${a?"has-error":i.length?"has-warning":""}"
          draggable="true"
          data-stat=${e.stat}
          @dragstart=${t=>this._startDrag(t,{kind:"device",stat:e.stat})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
          @dragover=${l.over}
          @dragleave=${l.leave}
          @drop=${l.drop}
          @click=${()=>{this._selected=e.stat,this.narrow&&(this._dialog={kind:"details"})}}
        >
          ${e.children.length?I`<button
                class="icon toggle"
                aria-label=${n}
                @click=${t=>{t.stopPropagation();const s=new Set(this._collapsed);o?s.delete(e.stat):s.add(e.stat),this._collapsed=s}}
              >
                ${o?"▸":"▾"}
              </button>`:I`<span class="toggle"></span>`}
          <span class="node-name">${n}</span>
          ${i.length||e.problem?I`<span
                class="badge"
                title=${i.map(e=>this._issueText(e)).join("\n")}
                >!</span
              >`:Z}
          <span class="node-power">${null===d?Z:Ve(this.hass,d)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions",{name:n})}
            @click=${t=>{t.stopPropagation(),this._dialog={kind:"actions",stat:e.stat}}}
          >
            ${we("dots")}
          </button>
        </div>
        ${e.children.length&&!o?I`<ul role="group">
              ${e.children.map(e=>this._renderNode(e,t,s,r))}
              ${void 0!==c?I`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power"
                      >${null===c?this._t("none"):Ve(this.hass,c)}</span
                    >
                  </li>`:Z}
            </ul>`:Z}
      </li>
    `}_renderCandidates(){const e=this._freeCandidates();return I`
      <section class="card">
        <div class="card-header"><h2>${this._t("free_sensors")}</h2></div>
        <p class="hint">${this._t("free_sensors_hint")}</p>
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${e=>this._search=e.target.value}
        />
        ${0===e.length?I`<p class="empty">${this._t("no_candidates")}</p>`:I`<ul class="candidates">
              ${e.map(e=>I`<li
                  class="candidate"
                  draggable="true"
                  data-stat=${e.stat}
                  @dragstart=${t=>this._startDrag(t,{kind:"candidate",stat:e.stat})}
                  @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
                >
                  <div class="candidate-text">
                    <span class="node-name">${e.name||e.stat}</span>
                    <span class="sub"
                      >${[e.external?this._t("external_statistic"):null,e.area_name,e.device_name,e.created_helper?this._t("created_by"):null].filter(Boolean).join(" · ")||e.stat}</span
                    >
                  </div>
                  <button @click=${()=>this._dialog={kind:"add",stat:e.stat}}>
                    ${this._t("add")}
                  </button>
                </li>`)}
            </ul>`}
        ${this._renderPowerSensors()}
      </section>
    `}_renderPowerSensors(){const e=this._freePowerSensors();return 0===e.length?Z:I`<h3>${this._t("power_only")}</h3>
      <p class="hint">${this._t("power_only_hint")}</p>
      <ul class="candidates power-only">
        ${e.map(e=>I`<li data-stat=${e.stat}>
            <div class="candidate-text">
              <span class="node-name">${e.name||e.stat}</span>
              <span class="sub">${[e.area_name,e.device_name].filter(Boolean).join(" · ")||e.stat}</span>
            </div>
            <button @click=${()=>this._dialog={kind:"integral",stat:e.stat}}>
              ${this._t("create_meter")}
            </button>
          </li>`)}
      </ul>`}_renderDetails(){const e=this._selected,t=this.draft,s=t.find(t=>t.stat_consumption===e);if(!e||!s)return I`<section class="card">
        <div class="card-header"><h2>${this._t("details")}</h2></div>
        <p class="empty">${this._t("select_hint")}</p>
      </section>`;const r=this._snapshot?.stats[e]??this._snapshot?.candidates.find(t=>t.stat===e),n=this.hass?fe(this.hass,s.stat_rate):null,i=ue(t),a=this._values(t),o=$e(i,a).get(e),l="now"===this._period?void 0:a.get(e)??null,d=this._issuesFor(e),c=(e,t)=>I`<dt>${this._t(e)}</dt>
        <dd>${t||this._t("none")}</dd>`;return I`
      <section class="card">
        <div class="card-header"><h2>${this._name(e,t)}</h2></div>
        <dl>
          ${c("detail_statistic",e)} ${c("detail_power_sensor",s.stat_rate)}
          ${c("detail_device",r?.device_name)} ${c("detail_area",r?.area_name)}
          ${c("detail_power",null===n?null:Ve(this.hass,n))}
          ${void 0!==l?c("detail_energy",null===l?null:Ie(this.hass,l)):Z}
          ${r?.created_helper?c("detail_helper",this._t("created_by")):Z}
          ${void 0!==o?c("detail_untracked",null===o?null:this._formatValue(o)):Z}
        </dl>
        ${d.length?I`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${d.map(e=>I`<li class=${e.severity}>${this._issueText(e)}</li>`)}
              </ul>`:Z}
      </section>
    `}_renderFooter(){if(0===this._changes.length)return Z;const e=this._validation?.diff.length??this._changes.length;return I`<div class="footer">
      <span
        >${1===e?this._t("change_one"):this._t("change_other",{count:We(this.hass,e)})}</span
      >
      <button @click=${()=>this._discard()}>${this._t("discard")}</button>
      <button class="primary" @click=${()=>this._openConfirm()}>${this._t("save")}</button>
    </div>`}_issueText(e){const t=`issue_${e.code}`;return Be(t)?this._t(t,{unit:String(e.details.unit??"")}):e.code}_diffText(e){const t=this._name(e.stat),s=e.to?this._name(e.to):"";switch(e.type){case"added":return e.parent?this._t("diff_added_under",{name:t,to:this._name(e.parent)}):this._t("diff_added",{name:t});case"removed":return this._t("diff_removed",{name:this._name(e.stat,this._snapshot?.prefs.device_consumption)});case"moved":return e.to?this._t("diff_moved",{name:t,to:s}):this._t("diff_moved_top",{name:t});case"renamed":return e.to?this._t("diff_renamed",{name:e.from||this._name(e.stat),to:e.to}):this._t("diff_renamed_reset",{name:t});case"source_added":case"source_removed":return this._t("source_added"===e.type?"diff_source_added":"diff_source_removed",{name:t,role:this._roleLabel(e.role)});default:return this._t("diff_rate",{name:t})}}_roleLabel(e){const t=`role_${e??""}`;return Be(t)?this._t(t):e??""}_sensorList(e,t){const s=this._freeCandidates().filter(t=>!e.includes(t.stat));return 0===s.length?I`<p class="empty">${this._t("no_candidates")}</p>`:I`<ul class="targets">
      ${s.map(e=>I`<li>
          <button class="target" data-target=${e.stat} @click=${()=>t(e.stat)}>
            ${e.name||e.stat}
          </button>
        </li>`)}
    </ul>`}_summaryText(e){return Object.entries(e).map(([e,t])=>{const s=`summary_${e}`;return Be(s)?this._t(s,{count:String(t)}):`${e}: ${t}`}).join(", ")}_renderDialog(){return I`<dialog
      @close=${()=>{this._dialog=null}}
      @cancel=${()=>{this._dialog=null}}
    >
      ${this._dialog?this._renderDialogContent(this._dialog):Z}
    </dialog>`}_close(){this._dialog=null}_targetList(e,t){return 0===e.length?I`<p class="empty">${this._t("no_targets")}</p>`:I`<ul class="targets">
      ${e.map(e=>I`<li>
          <button class="target" data-target=${e??qe} @click=${()=>t(e)}>
            ${null===e?this._t("top_level"):this._name(e)}
          </button>
        </li>`)}
    </ul>`}_renderDialogContent(e){const t=this.draft;switch(e.kind){case"actions":{const s=this._name(e.stat,t);return I`<h2>${s}</h2>
          <div class="dialog-actions column-actions">
            <button @click=${()=>this._dialog={kind:"move",stat:e.stat}}>
              ${this._t("move")}
            </button>
            <button
              @click=${()=>{this._renameValue=t.find(t=>t.stat_consumption===e.stat)?.name??"",this._dialog={kind:"rename",stat:e.stat}}}
            >
              ${this._t("rename")}
            </button>
            <button
              class="danger"
              @click=${()=>{this._close(),this._selected===e.stat&&(this._selected=null),this._change({type:"remove",stat:e.stat})}}
            >
              ${this._t("remove")}
            </button>
            ${t.some(t=>t.included_in_stat===e.stat)?I`<p class="hint">${this._t("remove_hint")}</p>`:Z}
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"move":{const s=this._name(e.stat,t),r=[...pe(t,e.stat,null)?[null]:[],...ge(t,e.stat)];return I`<h2>${this._t("move_title",{name:s})}</h2>
          ${this._targetList(r,t=>{this._close(),this._change({type:"move",stat:e.stat,parent:t})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"add":{const s=this._snapshot?.candidates.find(t=>t.stat===e.stat),r=s?.name||e.stat,n=[null,...t.map(e=>e.stat_consumption)];return I`<h2>${this._t("add_title",{name:r})}</h2>
          ${s?.power?I`<p class="hint">${this._t("with_power",{entity:s.power})}</p>`:Z}
          ${this._targetList(n,t=>{this._close(),this._addCandidate(e.stat,t)})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"rename":{const s=this._name(e.stat,t);return I`<h2>${this._t("rename_title",{name:s})}</h2>
          <label
            >${this._t("name_label")}
            <input
              type="text"
              .value=${this._renameValue}
              placeholder=${this._snapshot?.stats[e.stat]?.name??""}
              @input=${e=>this._renameValue=e.target.value}
            />
          </label>
          <p class="hint">${this._t("name_hint")}</p>
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              @click=${()=>{this._close(),this._change({type:"rename",stat:e.stat,name:this._renameValue.trim()||null})}}
            >
              ${this._t("ok")}
            </button>
          </div>`}case"confirm":{const t=e.result;if(null===t)return I`<h2>${this._t("confirm_title")}</h2>
            <p>${this._t("checking")}</p>`;const s=t.issues.filter(e=>"error"===e.severity),r=t.issues.filter(e=>"warning"===e.severity),n=e=>I`<ul class="issues">
            ${e.map(e=>I`<li class=${e.severity}>${this._name(e.stat)}: ${this._issueText(e)}</li>`)}
          </ul>`;return I`<h2>${this._t("confirm_title")}</h2>
          <ul class="diff">
            ${t.diff.map(e=>I`<li>${this._diffText(e)}</li>`)}
          </ul>
          ${s.length?I`<p>${this._t("confirm_errors")}</p>${n(s)}`:Z}
          ${r.length?I`<p>${this._t("confirm_warnings")}</p>${n(r)}`:Z}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!t.valid||this._busy}
              @click=${()=>this._save()}
            >
              ${this._busy?this._t("saving"):this._t("save")}
            </button>
          </div>`}case"backups":return I`<h2>${this._t("backups_title")}</h2>
          ${0===e.entries.length?I`<p class="empty">${this._t("backups_empty")}</p>`:I`<ul class="backups">
                ${e.entries.map(e=>I`<li>
                    <div class="candidate-text">
                      <span class="node-name">${je(this.hass,e.created)}</span>
                      <span class="sub"
                        >${this._summaryText(e.summary)}${e.user_name?` · ${this._t("backup_by",{user:e.user_name})}`:""}</span
                      >
                    </div>
                    <button
                      @click=${()=>this._dialog={kind:"restore",backup:e,undo:!1}}
                    >
                      ${this._t("restore")}
                    </button>
                  </li>`)}
              </ul>`}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"restore":{const t=je(this.hass,e.backup.created);return I`<h2>${this._t(e.undo?"undo":"restore")}</h2>
          <p>${this._t(e.undo?"undo_confirm":"restore_confirm",{date:t})}</p>
          ${this._changes.length?I`<p class="warning">${this._t("draft_lost")}</p>`:Z}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._restore(e.backup)}
            >
              ${this._t("restore")}
            </button>
          </div>`}case"source":{const t=tt(e.role);return I`<h2>${e.label}</h2>
          ${e.stat?I`<p>${this._name(e.stat)}</p>`:Z}
          <div class="dialog-actions column-actions">
            ${t?I`<button @click=${()=>this._dialog={kind:"assign",role:t}}>
                  ${this._t(e.stat&&"production"!==t&&"battery"!==t?"source_replace":"source_assign")}
                </button>`:Z}
            ${e.stat?I`<button
                  class="danger"
                  @click=${()=>{this._close(),this._change({type:"unassign_source",stat:e.stat})}}
                >
                  ${this._t("source_remove")}
                </button>`:Z}
            <button
              @click=${()=>{this._close(),rt("/config/energy")}}
            >
              ${this._t("open_energy_settings")}
            </button>
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"assign":return I`<h2>${this._t("assign_title",{role:this._roleLabel(e.role)})}</h2>
          <p class="hint">${this._t("assign_hint")}</p>
          ${this._sensorList([],t=>this._assign(e.role,t))}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"battery":return I`<h2>${this._t("battery_title")}</h2>
          <p class="hint">${this._t("battery_hint",{name:this._name(e.discharge)})}</p>
          ${this._sensorList([e.discharge],t=>{this._close(),this._change({type:"assign_source",role:"battery",stat:e.discharge,stat_to:t})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"integral":{const t=this._info(e.stat)?.name||e.stat;return I`<h2>${this._t("create_meter_title",{name:t})}</h2>
          <p>${this._t("create_meter_text",{helper:`${t} ${this._t("energy_suffix")}`})}</p>
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._createMeter(e.stat)}
            >
              ${this._busy?this._t("creating"):this._t("create_meter")}
            </button>
          </div>`}case"menu":return I`<div class="dialog-actions column-actions">
          <button ?disabled=${!this._snapshot} @click=${()=>this._dialog={kind:"candidates"}}>
            ${this._t("free_sensors")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
            ${we("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
            ${we("history")} ${this._t("backups")}
          </button>
          <button
            @click=${()=>{this._close(),this._reload()}}
          >
            ${we("refresh")} ${this._t("reload")}
          </button>
          <button @click=${()=>this._close()}>${this._t("close")}</button>
        </div>`;case"candidates":return I`${this._renderCandidates()}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"details":return I`${this._renderDetails()}
          <div class="dialog-actions">
            ${this._selected?I`<button
                  @click=${()=>this._dialog={kind:"actions",stat:this._selected}}
                >
                  ${this._t("actions",{name:this._name(this._selected)})}
                </button>`:Z}
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`}}static styles=i`
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
    .candidate-text .node-name,
    .candidate-text .sub {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    .diagram-card .card-header {
      flex-wrap: wrap;
    }
    .periods {
      display: flex;
      margin-left: auto;
    }
    .periods button {
      border-radius: 0;
      margin-left: -1px;
      padding: 4px 10px;
      color: var(--primary-text-color);
    }
    .periods button:first-child {
      border-radius: 8px 0 0 8px;
    }
    .periods button:last-child {
      border-radius: 0 8px 8px 0;
    }
    .periods button.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .hint .loading {
      font-style: italic;
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
  `}customElements.get(Fe)||customElements.define(Fe,nt);export{Ze as DOMAIN,nt as EnergyFlowMapperPanel,Ke as MAX_ZOOM,Qe as MIN_ZOOM,Fe as PANEL_TAG,Ge as TOAST_MS,Je as TOUCH_DRAG_LIFT,Ye as TOUCH_DRAG_SCALE,tt as assignRole,st as errorText};
