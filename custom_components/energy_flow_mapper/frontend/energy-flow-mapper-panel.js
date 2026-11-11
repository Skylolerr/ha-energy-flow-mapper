/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),i=new WeakMap;let r=class{constructor(e,t,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const s=this.t;if(t&&void 0===e){const t=void 0!==s&&1===s.length;t&&(e=i.get(s)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&i.set(s,e))}return e}toString(){return this.cssText}};const n=(e,...t)=>{const i=1===e.length?e[0]:t.reduce((t,s,i)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[i+1],e[0]);return new r(i,e,s)},a=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return(e=>new r("string"==typeof e?e:e+"",void 0,s))(t)})(e):e,{is:o,defineProperty:l,getOwnPropertyDescriptor:d,getOwnPropertyNames:c,getOwnPropertySymbols:h,getPrototypeOf:u}=Object,_=globalThis,p=_.trustedTypes,g=p?p.emptyScript:"",m=_.reactiveElementPolyfillSupport,f=(e,t)=>e,b={toAttribute(e,t){switch(t){case Boolean:e=e?g:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let s=e;switch(t){case Boolean:s=null!==e;break;case Number:s=null===e?null:Number(e);break;case Object:case Array:try{s=JSON.parse(e)}catch(e){s=null}}return s}},v=(e,t)=>!o(e,t),y={attribute:!0,type:String,converter:b,reflect:!1,useDefault:!1,hasChanged:v};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),_.litPropertyMetadata??=new WeakMap;let $=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=y){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),i=this.getPropertyDescriptor(e,s,t);void 0!==i&&l(this.prototype,e,i)}}static getPropertyDescriptor(e,t,s){const{get:i,set:r}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:i,set(t){const n=i?.call(this);r?.call(this,t),this.requestUpdate(e,n,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??y}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const e=u(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const e=this.properties,t=[...c(e),...h(e)];for(const s of t)this.createProperty(s,e[s])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,s]of t)this.elementProperties.set(e,s)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const s=this._$Eu(e,t);void 0!==s&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const e of s)t.unshift(a(e))}else void 0!==e&&t.push(a(e));return t}static _$Eu(e,t){const s=t.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,i)=>{if(t)s.adoptedStyleSheets=i.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of i){const i=document.createElement("style"),r=e.litNonce;void 0!==r&&i.setAttribute("nonce",r),i.textContent=t.cssText,s.appendChild(i)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,s);if(void 0!==i&&!0===s.reflect){const r=(void 0!==s.converter?.toAttribute?s.converter:b).toAttribute(t,s.type);this._$Em=e,null==r?this.removeAttribute(i):this.setAttribute(i,r),this._$Em=null}}_$AK(e,t){const s=this.constructor,i=s._$Eh.get(e);if(void 0!==i&&this._$Em!==i){const e=s.getPropertyOptions(i),r="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:b;this._$Em=i;const n=r.fromAttribute(t,e.type);this[i]=n??this._$Ej?.get(i)??n,this._$Em=null}}requestUpdate(e,t,s,i=!1,r){if(void 0!==e){const n=this.constructor;if(!1===i&&(r=this[e]),s??=n.getPropertyOptions(e),!((s.hasChanged??v)(r,t)||s.useDefault&&s.reflect&&r===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,s))))return;this.C(e,t,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:i,wrapped:r},n){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,n??t??this[e]),!0!==r||void 0!==n)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),!0===i&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,s]of e){const{wrapped:e}=s,i=this[t];!0!==e||this._$AL.has(t)||void 0===i||this.C(t,void 0,s,i)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[f("elementProperties")]=new Map,$[f("finalized")]=new Map,m?.({ReactiveElement:$}),(_.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const w=globalThis,x=e=>e,k=w.trustedTypes,A=k?k.createPolicy("lit-html",{createHTML:e=>e}):void 0,E="$lit$",S=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+S,z=`<${C}>`,M=document,T=()=>M.createComment(""),D=e=>null===e||"object"!=typeof e&&"function"!=typeof e,H=Array.isArray,L="[ \t\n\f\r]",I=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,P=/-->/g,F=/>/g,N=RegExp(`>|${L}(?:([^\\s"'>=/]+)(${L}*=${L}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),R=/'/g,U=/"/g,j=/^(?:script|style|textarea|title)$/i,O=e=>(t,...s)=>({_$litType$:e,strings:t,values:s}),W=O(1),V=O(2),B=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),G=new WeakMap,Z=M.createTreeWalker(M,129);function K(e,t){if(!H(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(t):t}const Q=(e,t)=>{const s=e.length-1,i=[];let r,n=2===t?"<svg>":3===t?"<math>":"",a=I;for(let t=0;t<s;t++){const s=e[t];let o,l,d=-1,c=0;for(;c<s.length&&(a.lastIndex=c,l=a.exec(s),null!==l);)c=a.lastIndex,a===I?"!--"===l[1]?a=P:void 0!==l[1]?a=F:void 0!==l[2]?(j.test(l[2])&&(r=RegExp("</"+l[2],"g")),a=N):void 0!==l[3]&&(a=N):a===N?">"===l[0]?(a=r??I,d=-1):void 0===l[1]?d=-2:(d=a.lastIndex-l[2].length,o=l[1],a=void 0===l[3]?N:'"'===l[3]?U:R):a===U||a===R?a=N:a===P||a===F?a=I:(a=N,r=void 0);const h=a===N&&e[t+1].startsWith("/>")?" ":"";n+=a===I?s+z:d>=0?(i.push(o),s.slice(0,d)+E+s.slice(d)+S+h):s+S+(-2===d?t:h)}return[K(e,n+(e[s]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),i]};class J{constructor({strings:e,_$litType$:t},s){let i;this.parts=[];let r=0,n=0;const a=e.length-1,o=this.parts,[l,d]=Q(e,t);if(this.el=J.createElement(l,s),Z.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(i=Z.nextNode())&&o.length<a;){if(1===i.nodeType){if(i.hasAttributes())for(const e of i.getAttributeNames())if(e.endsWith(E)){const t=d[n++],s=i.getAttribute(e).split(S),a=/([.?@])?(.*)/.exec(t);o.push({type:1,index:r,name:a[2],strings:s,ctor:"."===a[1]?se:"?"===a[1]?ie:"@"===a[1]?re:te}),i.removeAttribute(e)}else e.startsWith(S)&&(o.push({type:6,index:r}),i.removeAttribute(e));if(j.test(i.tagName)){const e=i.textContent.split(S),t=e.length-1;if(t>0){i.textContent=k?k.emptyScript:"";for(let s=0;s<t;s++)i.append(e[s],T()),Z.nextNode(),o.push({type:2,index:++r});i.append(e[t],T())}}}else if(8===i.nodeType)if(i.data===C)o.push({type:2,index:r});else{let e=-1;for(;-1!==(e=i.data.indexOf(S,e+1));)o.push({type:7,index:r}),e+=S.length-1}r++}}static createElement(e,t){const s=M.createElement("template");return s.innerHTML=e,s}}function Y(e,t,s=e,i){if(t===B)return t;let r=void 0!==i?s._$Co?.[i]:s._$Cl;const n=D(t)?void 0:t._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),void 0===n?r=void 0:(r=new n(e),r._$AT(e,s,i)),void 0!==i?(s._$Co??=[])[i]=r:s._$Cl=r),void 0!==r&&(t=Y(e,r._$AS(e,t.values),r,i)),t}class X{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,i=(e?.creationScope??M).importNode(t,!0);Z.currentNode=i;let r=Z.nextNode(),n=0,a=0,o=s[0];for(;void 0!==o;){if(n===o.index){let t;2===o.type?t=new ee(r,r.nextSibling,this,e):1===o.type?t=new o.ctor(r,o.name,o.strings,this,e):6===o.type&&(t=new ne(r,this,e)),this._$AV.push(t),o=s[++a]}n!==o?.index&&(r=Z.nextNode(),n++)}return Z.currentNode=M,i}p(e){let t=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class ee{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,i){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=Y(this,e,t),D(e)?e===q||null==e||""===e?(this._$AH!==q&&this._$AR(),this._$AH=q):e!==this._$AH&&e!==B&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>H(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==q&&D(this._$AH)?this._$AA.nextSibling.data=e:this.T(M.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,i="number"==typeof s?this._$AC(e):(void 0===s.el&&(s.el=J.createElement(K(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===i)this._$AH.p(t);else{const e=new X(i,this),s=e.u(this.options);e.p(t),this.T(s),this._$AH=e}}_$AC(e){let t=G.get(e.strings);return void 0===t&&G.set(e.strings,t=new J(e)),t}k(e){H(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,i=0;for(const r of e)i===t.length?t.push(s=new ee(this.O(T()),this.O(T()),this,this.options)):s=t[i],s._$AI(r),i++;i<t.length&&(this._$AR(s&&s._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=x(e).nextSibling;x(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class te{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,i,r){this.type=1,this._$AH=q,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=r,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=q}_$AI(e,t=this,s,i){const r=this.strings;let n=!1;if(void 0===r)e=Y(this,e,t,0),n=!D(e)||e!==this._$AH&&e!==B,n&&(this._$AH=e);else{const i=e;let a,o;for(e=r[0],a=0;a<r.length-1;a++)o=Y(this,i[s+a],t,a),o===B&&(o=this._$AH[a]),n||=!D(o)||o!==this._$AH[a],o===q?e=q:e!==q&&(e+=(o??"")+r[a+1]),this._$AH[a]=o}n&&!i&&this.j(e)}j(e){e===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class se extends te{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===q?void 0:e}}class ie extends te{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==q)}}class re extends te{constructor(e,t,s,i,r){super(e,t,s,i,r),this.type=5}_$AI(e,t=this){if((e=Y(this,e,t,0)??q)===B)return;const s=this._$AH,i=e===q&&s!==q||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,r=e!==q&&(s===q||i);i&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class ne{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){Y(this,e)}}const ae=w.litHtmlPolyfillSupport;ae?.(J,ee),(w.litHtmlVersions??=[]).push("3.3.3");const oe=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class le extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,s)=>{const i=s?.renderBefore??t;let r=i._$litPart$;if(void 0===r){const e=s?.renderBefore??null;i._$litPart$=r=new ee(t.insertBefore(T(),e),e,void 0,s??{})}return r._$AI(e),r})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return B}}le._$litElement$=!0,le.finalized=!0,oe.litElementHydrateSupport?.({LitElement:le});const de=oe.litElementPolyfillSupport;de?.({LitElement:le}),(oe.litElementVersions??=[]).push("4.2.2");const ce={type:"grid",stat_energy_from:null,stat_energy_to:null,stat_cost:null,entity_energy_price:null,number_energy_price:null,stat_compensation:null,entity_energy_price_export:null,number_energy_price_export:null,cost_adjustment_day:0},he={type:"water",stat_energy_from:null,stat_cost:null,entity_energy_price:null,number_energy_price:null};function ue(e,t,s){const i="string"==typeof s?s.trim():s;i?e[t]=i:delete e[t]}function _e(e){return"assign_source"===e.type||"unassign_source"===e.type?null:"use_as_home_meter"===e.type?"electricity":e.kind??"electricity"}function pe(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,{stat:s.stat_consumption,device:s,children:[],problem:null});const s=function(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,s.included_in_stat??null);return t}(e),i=function(e){const t=new Set,s=new Set;for(const i of e.keys()){const r=[],n=new Map;let a=i;for(;null!==a&&e.has(a)&&!s.has(a);){const s=n.get(a);if(void 0!==s){r.slice(s).forEach(e=>t.add(e));break}n.set(a,r.length),r.push(a),a=e.get(a)??null}r.forEach(e=>s.add(e))}return t}(s),r=[];for(const[e,n]of t){const a=s.get(e)??null;i.has(e)?(n.problem="cycle",r.push(n)):null===a?r.push(n):t.has(a)?t.get(a).children.push(n):(n.problem="missing_parent",r.push(n))}return r}function ge(e){return e.flatMap(e=>[e,...ge(e.children)])}function me(e,t){const s=new Set([t]);let i=!0;for(;i;){i=!1;for(const t of e){const e=t.included_in_stat;e&&s.has(e)&&!s.has(t.stat_consumption)&&(s.add(t.stat_consumption),i=!0)}}return s}function fe(e,t,s){const i=e.find(e=>e.stat_consumption===t);return void 0!==i&&((i.included_in_stat??null)!==s&&(null===s||!me(e,t).has(s)))}function be(e,t,s,i){const r=new Set(e.map(e=>e.stat_consumption));return t.filter(t=>t.kind===i&&!(e=>s.some(t=>t.kind===e.kind&&t.stat===e.stat&&t.parent===e.parent))(t)&&r.has(t.stat)&&r.has(t.parent)&&!me(e,t.parent).has(t.stat)&&fe(e,t.stat,t.parent))}function ve(e,t){return e.map(e=>e.stat_consumption).filter(s=>fe(e,t,s))}const ye={mW:.001,W:1,kW:1e3,MW:1e6},$e=3.785411784,we={"mL/s":.06,"L/s":60,"L/min":1,"L/h":1/60,"m³/s":6e4,"m³/min":1e3,"m³/h":1e3/60,"ft³/min":28.316846592,"gal/min":$e,"gal/h":$e/60,"gal/d":$e/1440};function xe(e,t,s,i){const r=t?e.states[t]:void 0;if(void 0===r)return null;const n=Number.parseFloat(r.state),a=s[r.attributes.unit_of_measurement??i];return Number.isFinite(n)&&void 0!==a?n*a:null}function ke(e,t){return xe(e,t,ye,"W")}function Ae(e,t,s){return"water"===s?function(e,t){return xe(e,t,we,"L/min")}(e,t):ke(e,t)}function Ee(e,t){const s=new Map;for(const i of ge(e)){if(0===i.children.length)continue;const e=t.get(i.stat)??null,r=i.children.map(e=>t.get(e.stat)??null);s.set(i.stat,null===e||r.some(e=>null===e)?null:e-r.reduce((e,t)=>e+(t??0),0))}return s}const Se={grid:["import","export"],solar:["production",null],battery:["discharge","charge"],gas:["gas",null],water:["water",null],home:["home","home"]};function Ce(e){return"water"===e.type||"gas"===e.type?e.type:"electricity"}const ze=["stat_rate","stat_rate_inverted","stat_rate_from","stat_rate_to"];function Me(e,t){const s=[];for(const i of e){if(void 0!==t&&Ce(i)!==t)continue;const[e,r]=Se[i.type]??["consumption",null];i.stat_energy_from&&s.push({type:i.type,role:e,stat:i.stat_energy_from,name:i.name}),null!==r&&i.stat_energy_to&&s.push({type:i.type,role:r,stat:i.stat_energy_to,name:i.name})}return s}const Te=["stat_energy_from","stat_energy_to"],De=["grid","solar","battery","gas","water","home"];const He="Roboto, Noto, system-ui, sans-serif";function Le(e){return e.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function Ie(e){const t=e.dashed?` stroke-dasharray="${2*e.width} ${1.5*e.width}"`:"";return`<path d="${Le(e.d)}" fill="none" stroke="${e.color}" stroke-width="${e.width}"${t}/>`+(e.head?`<polygon points="${Le(e.head)}" fill="${e.color}"/>`:"")}function Pe(e,t,s,i){const r=Math.max(e.width,Math.ceil(48+7*i.footer.length)),n=e.height+40;return[`<svg xmlns="http://www.w3.org/2000/svg" width="${r}" height="${n}" viewBox="0 0 ${r} ${n}">`,`<rect width="100%" height="100%" fill="${i.theme.background}"/>`,...s.map(Ie),...t.map((e,t)=>function(e,t,s){const{x:i,y:r,w:n,h:a}=e.block,{theme:o}=s,l=(e.sub??"").split("\n").filter(Boolean);e.area&&(l[0]=l.length?`${l[0]} · ${e.area}`:e.area);const d=r+a/2+5-10*l.length,c="untracked"===e.block.kind||"placeholder"===e.block.kind;return[`<clipPath id="c${t}"><rect x="${i+10}" y="${r}" width="${n-20}" height="${a}"/></clipPath>`,`<rect x="${i}" y="${r}" width="${n}" height="${a}" rx="10" fill="${o.card}" stroke="${e.warn?"#ffa600":o.divider}" stroke-width="${e.warn?2:1}"${c?' stroke-dasharray="6 4"':""}/>`,`<rect x="${i}" y="${r+8}" width="4" height="${a-16}" rx="2" fill="${e.color}"/>`,`<g clip-path="url(#c${t})">`,`<text x="${i+14}" y="${d}" font-family="${He}" font-size="14" font-weight="500" fill="${o.text}">${Le(e.title)}</text>`,...l.map((e,t)=>`<text x="${i+14}" y="${d+19+15*t}" font-family="${He}" font-size="12" fill="${o.secondary}">${Le(e)}</text>`),"</g>",e.hidden?`<text x="${i+n-10}" y="${r+a-8}" text-anchor="end" font-family="${He}" font-size="11" fill="${o.secondary}">▸ +${e.hidden}</text>`:"",e.warn?`<circle cx="${i+n-14}" cy="${r+14}" r="8" fill="#ffa600"/><text x="${i+n-14}" y="${r+18}" text-anchor="middle" font-family="${He}" font-size="12" font-weight="700" fill="#ffffff">!</text>`:""].join("")}(e,t,i)),`<text x="24" y="${e.height+20+4}" font-family="${He}" font-size="12" fill="${i.theme.secondary}">${Le(i.footer)}</text>`,"</svg>"].join("")}async function Fe(e,t,s,i=2){const r=function(e,t,s=2){const i=Math.max(e,1),r=Math.max(t,1);return Math.min(s,16384/i,16384/r,.999*Math.sqrt(16777216/(i*r)))}(t,s,i),n=URL.createObjectURL(new Blob([e],{type:"image/svg+xml"}));try{const e=new Image;await new Promise((t,s)=>{e.onload=()=>t(),e.onerror=()=>s(new Error("The diagram could not be drawn")),e.src=n});const i=document.createElement("canvas");i.width=Math.round(t*r),i.height=Math.round(s*r);const a=i.getContext("2d");if(!a)throw new Error("The diagram could not be drawn");return a.scale(r,r),a.drawImage(e,0,0),await new Promise((e,t)=>i.toBlob(s=>s?e(s):t(new Error("The diagram could not be drawn")),"image/png"))}finally{URL.revokeObjectURL(n)}}const Ne={menu:"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",dots:"M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",refresh:"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",home:"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",lightbulb:"M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z",flash:"M7,2V13H10V22L17,10H13L17,2H7Z",fire:"M17.66,11.2C17.43,10.9 17.15,10.64 16.89,10.38C16.22,9.78 15.46,9.35 14.82,8.72C13.33,7.26 13,4.85 13.95,3C13,3.23 12.17,3.75 11.46,4.32C8.87,6.4 7.85,10.07 9.07,13.22C9.11,13.32 9.15,13.42 9.15,13.55C9.15,13.77 9,13.97 8.8,14.05C8.57,14.15 8.33,14.09 8.14,13.93C8.08,13.88 8.04,13.83 8,13.76C6.87,12.33 6.69,10.28 7.45,8.64C5.78,10 4.87,12.3 5,14.47C5.06,14.97 5.12,15.47 5.29,15.97C5.43,16.57 5.7,17.17 6,17.7C7.08,19.43 8.95,20.67 10.96,20.92C13.1,21.19 15.39,20.8 17.03,19.32C18.86,17.66 19.5,15 18.56,12.72L18.43,12.46C18.22,12 17.66,11.2 17.66,11.2M14.5,17.5C14.22,17.74 13.76,18 13.4,18.1C12.28,18.5 11.16,17.94 10.5,17.28C11.69,17 12.4,16.12 12.61,15.23C12.78,14.43 12.46,13.77 12.33,13C12.21,12.26 12.23,11.63 12.5,10.94C12.69,11.32 12.89,11.7 13.13,12C13.9,13 15.11,13.44 15.37,14.8C15.41,14.94 15.43,15.08 15.43,15.23C15.46,16.05 15.1,16.95 14.5,17.5H14.5Z",alert:"M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",water:"M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",undo:"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",history:"M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"};function Re(e){return V`<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d=${Ne[e]}></path></svg>`}const Ue=220,je=72,Oe=160,We="home",Ve={import:"var(--energy-grid-consumption-color, #488fc2)",export:"var(--energy-grid-return-color, #8353d1)",production:"var(--energy-solar-color, #ff9800)",battery:"var(--energy-battery-out-color, #4db6ac)",discharge:"var(--energy-battery-out-color, #4db6ac)",charge:"var(--energy-battery-in-color, #f06292)",gas:"var(--energy-gas-color, #8e021b)",water:"var(--energy-water-color, #00bcd4)",consumption:"var(--energy-gas-color, #8e021b)",home:"var(--secondary-text-color)"},Be=["import","production","battery","export"],qe=["water"],Ge=["gas"],Ze=[...Be,"home"],Ke=["import","production","discharge","gas","water","consumption","home"];function Qe(e){return`untracked:${e}`}function Je(e,t,s){return e.map(e=>{const i=0===e.children.length||t.has(e.stat)?[]:[...Je(e.children,t,s),...s?[{id:Qe(e.stat),kind:"untracked",stat:e.stat,children:[]}]:[]];return{id:e.stat,kind:"device",stat:e.stat,node:e,children:i}})}function Ye(e,t,s){if(0===e.children.length)return t;const i=e.children.reduce((e,i)=>e+Ye(i,t,s),0);return Math.max(t,i+s*(e.children.length-1))}function Xe(e,t,s,i,r=new Set,n=Be,a=!0,o="horizontal",l=!1){const d=[],c=[],h="vertical"===o,u=h?Ue:je,_=h?je:Ue,p=h?Oe:je,g=h?je:Oe,m=h?80:56,f=h?12:24,b=(e,t)=>h?{x:e,y:t}:{x:t,y:e},v=new Set(t.map(e=>"battery"===e.type?"battery":e.role)),y=t.map((e,t)=>({id:`source:${t}`,kind:"source",x:0,y:0,w:Oe,h:je,stat:e.stat,role:e.role,source:e}));for(const e of n)v.has(e)||y.push({id:`placeholder:${e}`,kind:"placeholder",x:0,y:0,w:Oe,h:je,role:e});const $=y.length*g+(y.length-1)*f,w=Je(e,r,a);a&&l&&w.push({id:Qe(We),kind:"untracked",stat:We,children:[]});const x=w.length?w.reduce((e,t)=>e+Ye(t,_,f),0)+f*(w.length-1):_,k=Math.max($,x,_),A=24+k/2;let E=A-$/2;for(const e of y)Object.assign(e,b(24,E)),E+=g+f,d.push(e);const S=24+p+m;d.push({id:We,kind:"home",...b(S,A-_/2),w:Ue,h:je});for(const e of y){if("source"!==e.kind)continue;const t=Ke.includes(e.role);c.push({from:t?e.id:We,to:t?We:e.id,kind:"source",power:null})}let C=S+u;const z=(e,t,r,n)=>{const a=Ye(e,_,f),o=S+(r+1)*(u+m);C=Math.max(C,o+u),d.push({id:e.id,kind:e.kind,...b(o,t+(a-_)/2),w:Ue,h:je,stat:e.stat,node:e.node}),c.push({from:n,to:e.id,kind:e.kind,power:"untracked"===e.kind?i.get(e.stat)??null:s.get(e.stat)??null});let l=t+(a-(e.children.reduce((e,t)=>e+Ye(t,_,f),0)+f*(e.children.length-1)))/2;for(const t of e.children)z(t,l,r+1,e.id),l+=Ye(t,_,f)+f};let M=A-x/2;for(const e of w)z(e,M,0,We),M+=Ye(e,_,f)+f;const T=k+48,D=C+24;return{blocks:d,edges:c,width:h?D:T,height:h?T:D}}function et(e,t){return null===e||t<=0?2:2+6*Math.min(1,Math.max(0,e)/t)}function tt(e,t,s=0,i="horizontal"){if("vertical"===i){const i=e.x<=t.x,r=i?e.x+e.w:e.x,n=e.y+e.h/2,a=i?t.x-s:t.x+t.w+s,o=t.y+t.h/2,l=(r+a)/2;return`M ${r} ${n} C ${l} ${n}, ${l} ${o}, ${a} ${o}`}const r=e.y<=t.y,n=e.x+e.w/2,a=r?e.y+e.h:e.y,o=t.x+t.w/2,l=r?t.y-s:t.y+t.h+s,d=(a+l)/2;return`M ${n} ${a} C ${n} ${d}, ${o} ${d}, ${o} ${l}`}function st(e){const t=Math.max(5,.9*e+2.5);return{half:t,length:1.3*t}}function it(e,t,s=6,i=1.4*s,r="horizontal"){if("vertical"===r){const r=e.x<=t.x,n=r?t.x:t.x+t.w,a=t.y+t.h/2,o=r?n-i:n+i;return`${o},${a-s} ${o},${a+s} ${n},${a}`}const n=e.y<=t.y,a=t.x+t.w/2,o=n?t.y:t.y+t.h,l=n?o-i:o+i;return`${a-s},${l} ${a+s},${l} ${a},${o}`}const rt={title:"Energy Flow Mapper",menu:"Menu",more:"More",reload:"Reload",undo:"Undo last save",backups:"Backups",loading:"Loading…",load_failed:"The energy settings could not be loaded.",sources:"Sources",sources_hint:"Drag a free sensor onto a source, or tap a source. Change prices in the energy settings.",open_energy_settings:"Energy settings",no_sources:"No sources configured.",role_import:"Grid import",role_export:"Grid export",role_production:"Solar production",role_discharge:"Battery discharge",role_charge:"Battery charge",role_gas:"Gas",role_water:"Water",role_home:"Home meter",diagram:"Energy flow",zoom_hint:"Zoom with the mouse wheel or two fingers, drag an empty area to move.",zoom_in:"Zoom in",zoom_out:"Zoom out",fit:"Fit",orientation_label:"Orientation",orientation_horizontal:"Horizontal",orientation_vertical:"Vertical",role_battery:"Battery",home_measured:"{power} measured",home_stale:"{name}: data not recent enough",home_calculated:"{power} calculated",period_label:"Period",period_now:"Now",period_today:"Today",period_week:"7 days",period_month:"30 days",energy_loading:"Loading consumption …",detail_energy:"Energy in period",devices:"Devices",devices_hint:"Drag a device onto another one to include it there, or use the ⋮ menu.",home:"Home",home_drop:"Drop here for the top level",no_devices:"No devices in the energy dashboard yet. Add a free sensor.",untracked:"Untracked consumption",free_sensors:"Free sensors",free_sensors_hint:"Energy meters that are not in the energy dashboard yet.",search:"Search",no_candidates:"No free energy sensors.",add:"Add",add_title:"Add {name} under …",with_power:"Power sensor: {entity}",actions:"Actions for {name}",move:"Move to …",move_title:"Move {name} to …",top_level:"Top level (Home)",no_targets:"There is no other place for this device.",rename:"Rename …",rename_title:"Rename {name}",name_label:"Name",name_hint:"Leave empty to use the entity name.",remove:"Remove from the energy dashboard",use_as_home_meter:"Use as home meter",remove_hint:"Its child devices move up one level.",cancel:"Cancel",ok:"OK",close:"Close",details:"Details",select_hint:"Select a device to see its details.",detail_statistic:"Statistic",detail_power_sensor:"Power sensor",detail_device:"Device",detail_area:"Area",detail_power:"Power now",detail_untracked:"Untracked by its child devices",detail_issues:"Problems",none:"–",change_one:"1 change",change_other:"{count} changes",discard:"Discard",save:"Save",confirm_title:"Save changes?",confirm_errors:"Fix these problems first:",confirm_warnings:"Please note:",checking:"Checking …",saving:"Saving …",saved:"Saved. A backup of the previous settings was created.",nothing_to_save:"Nothing changed.",diff_added:"{name} added",diff_added_under:"{name} added under {to}",diff_removed:"{name} removed",diff_moved:"{name} moved under {to}",diff_moved_top:"{name} moved to the top level",diff_renamed:"{name} renamed to “{to}”",diff_renamed_reset:"{name} uses the entity name again",diff_rate:"Power sensor of {name} changed",issue_cycle:"Part of a loop of devices",issue_self_parent:"Included in itself",issue_duplicate:"Listed more than once",issue_missing_parent:"Its upstream device is not in the energy dashboard",issue_source_and_device:"Also used as a source",issue_statistic_missing:"Statistic not found",issue_not_energy_unit:"Unit {unit} is not an energy unit",issue_children_exceed_parent:"Its child devices use more than this device",issue_devices_exceed_home:"The devices use more than the home",ha_reports:"Home Assistant reports",coverage_toggle:"Coverage",coverage_percent:"{percent}% covered by devices",coverage_over:"over 100% covered by devices",coverage_below_one:"< 1% covered by devices",suggestion_text:"Suggestion: included in {parent}",suggestion_apply:"Apply",suggestion_ignore:"Ignore",suggestion_apply_all:"Apply all suggestions",suggestion_show_ignored:"Show ignored suggestions again",export_image:"Save as image",export_title:"Save diagram as image",export_hide_names:"Hide names",export_hide_hint:"Devices become Device 1, 2, …; areas and sensor names are left out.",export_save:"Save",export_device:"Device {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Draft, not saved",export_failed:"The image could not be created.",backups_title:"Backups",backups_empty:"No backups yet. One is created before every save.",backup_by:"by {user}",restore:"Restore",restore_confirm:"Restore the backup from {date}? The current settings are backed up first.",undo_confirm:"Restore the settings from before the last save ({date})? The current settings are backed up first.",draft_lost:"Your unsaved changes will be discarded.",restored:"Backup restored.",summary_added:"{count} added",summary_removed:"{count} removed",summary_moved:"{count} moved",summary_renamed:"{count} renamed",summary_rate:"{count} with new power sensor",summary_restored:"Restored a backup",error_conflict:"The energy settings were changed elsewhere in the meantime. They were reloaded; check your changes and save again.",error_not_loaded:"Energy Flow Mapper is not loaded.",error_unsupported_energy_api:"The energy settings of this Home Assistant release are not supported. The editor is disabled to protect your settings.",assign_title:"Assign {role}",assign_hint:"Pick a free energy meter.",battery_title:"Battery: charging meter",battery_hint:"{name} measures discharging. Pick the meter that measures charging.",source_assign:"Assign sensor …",source_replace:"Replace sensor …",source_remove:"Remove as source",power_only:"Power only",power_only_hint:"These power sensors have no energy meter. “Create meter” adds an integral helper right away; it stays even without Energy Flow Mapper.",create_meter:"Create meter",create_meter_title:"Create an energy meter for {name}?",create_meter_text:"The helper “{helper}” is created right away under Settings → Helpers. It is an ordinary Home Assistant helper and stays even if you remove Energy Flow Mapper. Its meter is then added to your draft.",creating:"Creating …",meter_created:"Meter “{name}” created and added to the draft.",energy_suffix:"Energy",external_statistic:"External statistic",created_by:"Created by Energy Flow Mapper",detail_helper:"Helper",diff_source_added:"{name} assigned as {role}",diff_source_removed:"{name} removed as {role}",summary_source_added:"{count} assigned as source",summary_source_removed:"{count} removed as source",issue_duplicate_source:"Used by more than one source",error_unknown_source:"This sensor is not a source in the energy dashboard.",error_home_exists:"There is already a home meter.",error_home_not_supported:"This Home Assistant release has no home meter; it needs 2026.11 or newer.",error_not_a_power_candidate:"This sensor is not a power or flow sensor without a meter.",error_integral_failed:"The helper for the meter could not be created.",confirm_rejected:"Home Assistant does not accept these settings:",source_last_meter:"This is the last meter of this grid connection. Removing it removes the connection with its prices.",error_invalid_changes:"The draft has errors and was not saved.",error_device_exists:"This device is already in the energy dashboard.",error_unknown_device:"A device of your draft is no longer in the energy dashboard. Discard the draft and try again.",error_unknown_change:"This change is not supported.",error_backup_not_found:"This backup no longer exists.",error_rejected_by_home_assistant:"Home Assistant rejected the settings: {error}",backups_hint:"Kept in the Home Assistant configuration folder, so every Home Assistant backup includes them. Export a file to keep a copy elsewhere.",export_current:"Export current settings",import_file:"Import from file …",export:"Export",import_title:"Import {file}",import:"Import",import_unchanged:"This file holds your current settings. There is nothing to import.",import_invalid_file:"This file could not be read. Pick a file exported by Energy Flow Mapper.",imported:"Imported. The previous settings were backed up.",summary_imported:"Imported a file",error_invalid_import:"This file is not an Energy Flow Mapper export.",error_unknown:"Error: {message}",tabs_label:"Energy dashboard part",tab_electricity:"Electricity",tab_gas:"Gas",diagram_gas:"Gas meters",free_sensors_hint_gas:"Gas meters that are not in the energy dashboard yet. Home Assistant has no gas devices, only gas meters.",no_candidates_gas:"No free gas meters.",assign_hint_gas:"Pick a free gas meter.",tab_water:"Water",diagram_water:"Water flow",free_sensors_hint_water:"Water meters that are not in the energy dashboard yet.",no_candidates_water:"No free water meters.",assign_hint_water:"Pick a free water meter.",with_flow:"Flow sensor: {entity}",detail_flow_sensor:"Flow sensor",detail_flow:"Flow now",detail_volume:"Water in period",issue_not_water_unit:"Unit {unit} is not a water unit",diff_water:"Water: {text}",diff_rate_water:"Flow sensor of {name} changed",undo_change:"Undo change",undo_change_hint:"Take back the last change of the draft (Ctrl+Z)",draft_restored:"Your unsaved changes were restored.",draft_outdated:"Your unsaved changes could not be restored because the energy settings were changed meanwhile.",blocked_one:"1 problem prevents saving",blocked_other:"{count} problems prevent saving",blocked_hint:"Click Save to see the problems.",issue_saved:"already in the saved settings",show_block:"Show",change_undone:"Last change taken back.",flow_only:"Flow only",flow_only_hint:"These flow sensors have no water meter. “Create meter” adds an integral helper right away; it stays even without Energy Flow Mapper.",create_water_meter_title:"Create a water meter for {name}?",create_water_meter_text:"The helper “{helper}” is created right away under Settings → Helpers. It adds up the flow to water (L/min to litres, m³/h to m³) and is shown as water. It is an ordinary Home Assistant helper and stays even if you remove Energy Flow Mapper. Its meter is then added to your draft.",water_suffix:"Water",find_device:"Find device",find_none:"No match",find_count:"{index} of {count}",find_next:"Next",card_empty:"No devices in the energy dashboard yet.",card_root_missing:"This device is no longer in the energy dashboard. Pick another one in the card settings.",card_root_all:"Whole home",card_field_title:"Title (empty: no title)",card_field_kind:"Show",card_field_root:"Start at device",card_field_show_sources:"Show sources",card_field_show_untracked:"Show untracked consumption",card_field_show_coverage:"Show how much the devices cover"},nt={de:{title:"Energy Flow Mapper",menu:"Menü",more:"Mehr",reload:"Neu laden",undo:"Letztes Speichern rückgängig machen",backups:"Sicherungen",loading:"Wird geladen …",load_failed:"Die Energie-Einstellungen konnten nicht geladen werden.",sources:"Quellen",sources_hint:"Zieh einen freien Sensor auf eine Quelle oder tippe eine Quelle an. Preise änderst du in den Energie-Einstellungen.",open_energy_settings:"Energie-Einstellungen",no_sources:"Keine Quellen eingerichtet.",role_import:"Netz-Bezug",role_export:"Einspeisung",role_production:"Solar-Ertrag",role_discharge:"Batterie entladen",role_charge:"Batterie laden",role_gas:"Gas",role_water:"Wasser",role_home:"Hauszähler",diagram:"Energiefluss",zoom_hint:"Zoomen mit dem Mausrad oder zwei Fingern, Ziehen auf freier Fläche verschiebt.",zoom_in:"Vergrössern",zoom_out:"Verkleinern",fit:"Einpassen",orientation_label:"Ausrichtung",orientation_horizontal:"Horizontal",orientation_vertical:"Vertikal",role_battery:"Batterie",home_measured:"{power} gemessen",home_stale:"{name}: Daten nicht aktuell genug",home_calculated:"{power} berechnet",period_label:"Zeitraum",period_now:"Jetzt",period_today:"Heute",period_week:"7 Tage",period_month:"30 Tage",energy_loading:"Verbrauch wird geladen …",detail_energy:"Energie im Zeitraum",devices:"Geräte",devices_hint:"Zieh ein Gerät auf ein anderes, um es dort unterzuordnen, oder nutze das ⋮-Menü.",home:"Zuhause",home_drop:"Hier ablegen für die oberste Ebene",no_devices:"Noch keine Geräte im Energie-Dashboard. Füge einen freien Sensor hinzu.",untracked:"Nicht erfasster Verbrauch",free_sensors:"Freie Sensoren",free_sensors_hint:"Energiezähler, die noch nicht im Energie-Dashboard sind.",search:"Suchen",no_candidates:"Keine freien Energie-Sensoren.",add:"Hinzufügen",add_title:"{name} hinzufügen unter …",with_power:"Leistungssensor: {entity}",actions:"Aktionen für {name}",move:"Verschieben nach …",move_title:"{name} verschieben nach …",top_level:"Oberste Ebene (Zuhause)",no_targets:"Für dieses Gerät gibt es keinen anderen Platz.",rename:"Umbenennen …",rename_title:"{name} umbenennen",name_label:"Name",name_hint:"Leer lassen, um den Namen der Entity zu verwenden.",remove:"Aus dem Energie-Dashboard entfernen",use_as_home_meter:"Als Hauszähler verwenden",remove_hint:"Seine Untergeräte rücken eine Ebene nach oben.",cancel:"Abbrechen",ok:"OK",close:"Schliessen",details:"Details",select_hint:"Wähle ein Gerät, um Details zu sehen.",detail_statistic:"Statistik",detail_power_sensor:"Leistungssensor",detail_device:"Gerät",detail_area:"Bereich",detail_power:"Leistung jetzt",detail_untracked:"Von den Untergeräten nicht erfasst",detail_issues:"Probleme",none:"–",change_one:"1 Änderung",change_other:"{count} Änderungen",discard:"Verwerfen",save:"Speichern",confirm_title:"Änderungen speichern?",confirm_errors:"Behebe zuerst diese Probleme:",confirm_warnings:"Bitte beachten:",checking:"Wird geprüft …",saving:"Wird gespeichert …",saved:"Gespeichert. Die vorherigen Einstellungen wurden gesichert.",nothing_to_save:"Es hat sich nichts geändert.",diff_added:"{name} hinzugefügt",diff_added_under:"{name} hinzugefügt unter {to}",diff_removed:"{name} entfernt",diff_moved:"{name} verschoben unter {to}",diff_moved_top:"{name} auf die oberste Ebene verschoben",diff_renamed:"{name} umbenannt in «{to}»",diff_renamed_reset:"{name} verwendet wieder den Namen der Entity",diff_rate:"Leistungssensor von {name} geändert",issue_cycle:"Teil einer Schleife von Geräten",issue_self_parent:"Sich selbst untergeordnet",issue_duplicate:"Mehrfach eingetragen",issue_missing_parent:"Sein vorgelagertes Gerät ist nicht im Energie-Dashboard",issue_source_and_device:"Wird auch als Quelle verwendet",issue_statistic_missing:"Statistik nicht gefunden",issue_not_energy_unit:"Die Einheit {unit} ist keine Energie-Einheit",issue_children_exceed_parent:"Seine Untergeräte verbrauchen mehr als dieses Gerät",issue_devices_exceed_home:"Die Geräte verbrauchen mehr als das Zuhause",ha_reports:"Meldungen von Home Assistant",coverage_toggle:"Abdeckung",coverage_percent:"{percent} % von Geräten erfasst",coverage_over:"über 100 % von Geräten erfasst",coverage_below_one:"< 1 % von Geräten erfasst",suggestion_text:"Vorschlag: enthalten in {parent}",suggestion_apply:"Übernehmen",suggestion_ignore:"Ignorieren",suggestion_apply_all:"Alle Vorschläge übernehmen",suggestion_show_ignored:"Ignorierte Vorschläge wieder zeigen",export_image:"Als Bild speichern",export_title:"Diagramm als Bild speichern",export_hide_names:"Namen ausblenden",export_hide_hint:"Geräte heissen dann Gerät 1, 2, …; Bereiche und Sensornamen fehlen.",export_save:"Speichern",export_device:"Gerät {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Entwurf, nicht gespeichert",export_failed:"Das Bild konnte nicht erstellt werden.",backups_title:"Sicherungen",backups_empty:"Noch keine Sicherungen. Vor jedem Speichern wird eine angelegt.",backup_by:"von {user}",restore:"Wiederherstellen",restore_confirm:"Die Sicherung vom {date} wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",undo_confirm:"Die Einstellungen von vor dem letzten Speichern ({date}) wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",draft_lost:"Deine ungespeicherten Änderungen gehen dabei verloren.",restored:"Sicherung wiederhergestellt.",summary_added:"{count} hinzugefügt",summary_removed:"{count} entfernt",summary_moved:"{count} verschoben",summary_renamed:"{count} umbenannt",summary_rate:"{count} mit neuem Leistungssensor",summary_restored:"Sicherung wiederhergestellt",error_conflict:"Die Energie-Einstellungen wurden in der Zwischenzeit an anderer Stelle geändert. Sie wurden neu geladen; prüfe deine Änderungen und speichere noch einmal.",error_not_loaded:"Energy Flow Mapper ist nicht geladen.",error_unsupported_energy_api:"Die Energie-Einstellungen dieser Home-Assistant-Version werden nicht unterstützt. Zum Schutz deiner Einstellungen ist der Editor deaktiviert.",assign_title:"{role} zuweisen",assign_hint:"Wähle einen freien Energiezähler.",battery_title:"Batterie: Zähler fürs Laden",battery_hint:"{name} misst das Entladen. Wähle den Zähler, der das Laden misst.",source_assign:"Sensor zuweisen …",source_replace:"Sensor ersetzen …",source_remove:"Als Quelle entfernen",power_only:"Nur Leistung",power_only_hint:"Diese Leistungssensoren haben keinen Energiezähler. «Zähler anlegen» erstellt sofort einen Integral-Helfer; er bleibt auch ohne Energy Flow Mapper bestehen.",create_meter:"Zähler anlegen",create_meter_title:"Energiezähler für {name} anlegen?",create_meter_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt. Er ist ein normaler Home-Assistant-Helfer und bleibt auch bestehen, wenn du Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf.",creating:"Wird angelegt …",meter_created:"Zähler «{name}» angelegt und zum Entwurf hinzugefügt.",energy_suffix:"Energie",external_statistic:"Externe Statistik",created_by:"Von Energy Flow Mapper angelegt",detail_helper:"Helfer",diff_source_added:"{name} als {role} zugewiesen",diff_source_removed:"{name} als {role} entfernt",summary_source_added:"{count} als Quelle zugewiesen",summary_source_removed:"{count} als Quelle entfernt",issue_duplicate_source:"Von mehreren Quellen verwendet",error_unknown_source:"Dieser Sensor ist keine Quelle im Energie-Dashboard.",error_home_exists:"Es gibt schon einen Hauszähler.",error_home_not_supported:"Diese Home-Assistant-Version kennt keinen Hauszähler; dafür braucht es 2026.11 oder neuer.",error_not_a_power_candidate:"Dieser Sensor ist kein Leistungs- oder Durchflusssensor ohne Zähler.",error_integral_failed:"Der Helfer für den Zähler konnte nicht angelegt werden.",confirm_rejected:"Home Assistant akzeptiert diese Einstellungen nicht:",source_last_meter:"Das ist der letzte Zähler dieses Netzanschlusses. Entfernst du ihn, wird der Anschluss mit seinen Preisen entfernt.",error_invalid_changes:"Der Entwurf hat Fehler und wurde nicht gespeichert.",error_device_exists:"Dieses Gerät ist bereits im Energie-Dashboard.",error_unknown_device:"Ein Gerät aus deinem Entwurf ist nicht mehr im Energie-Dashboard. Verwirf den Entwurf und versuche es noch einmal.",error_unknown_change:"Diese Änderung wird nicht unterstützt.",error_backup_not_found:"Diese Sicherung gibt es nicht mehr.",error_rejected_by_home_assistant:"Home Assistant hat die Einstellungen abgelehnt: {error}",backups_hint:"Gespeichert im Konfigurationsordner von Home Assistant und damit in jedem Home-Assistant-Backup enthalten. Exportiere eine Datei, um eine Kopie woanders aufzubewahren.",export_current:"Aktuelle Einstellungen exportieren",import_file:"Aus Datei importieren …",export:"Exportieren",import_title:"{file} importieren",import:"Importieren",import_unchanged:"Diese Datei enthält deine aktuellen Einstellungen. Es gibt nichts zu importieren.",import_invalid_file:"Diese Datei konnte nicht gelesen werden. Wähle eine Datei, die Energy Flow Mapper exportiert hat.",imported:"Importiert. Die bisherigen Einstellungen wurden gesichert.",summary_imported:"Datei importiert",error_invalid_import:"Diese Datei ist kein Export von Energy Flow Mapper.",error_unknown:"Fehler: {message}",tabs_label:"Teil des Energie-Dashboards",tab_electricity:"Strom",tab_gas:"Gas",diagram_gas:"Gaszähler",free_sensors_hint_gas:"Gaszähler, die noch nicht im Energie-Dashboard sind. Home Assistant kennt keine Gas-Geräte, nur Gaszähler.",no_candidates_gas:"Keine freien Gaszähler.",assign_hint_gas:"Wähle einen freien Gaszähler.",tab_water:"Wasser",diagram_water:"Wasserfluss",free_sensors_hint_water:"Wasserzähler, die noch nicht im Energie-Dashboard sind.",no_candidates_water:"Keine freien Wasserzähler.",assign_hint_water:"Wähle einen freien Wasserzähler.",with_flow:"Durchflusssensor: {entity}",detail_flow_sensor:"Durchflusssensor",detail_flow:"Durchfluss jetzt",detail_volume:"Wasser im Zeitraum",issue_not_water_unit:"Die Einheit {unit} ist keine Wasser-Einheit",diff_water:"Wasser: {text}",diff_rate_water:"Durchflusssensor von {name} geändert",undo_change:"Änderung zurücknehmen",undo_change_hint:"Die letzte Änderung des Entwurfs zurücknehmen (Strg+Z)",draft_restored:"Deine ungespeicherten Änderungen wurden wiederhergestellt.",draft_outdated:"Deine ungespeicherten Änderungen konnten nicht wiederhergestellt werden, weil die Energie-Einstellungen inzwischen geändert wurden.",blocked_one:"1 Problem verhindert das Speichern",blocked_other:"{count} Probleme verhindern das Speichern",blocked_hint:"Auf «Speichern» klicken, um die Probleme zu sehen.",issue_saved:"schon in den gespeicherten Einstellungen",show_block:"Zeigen",change_undone:"Letzte Änderung zurückgenommen.",flow_only:"Nur Durchfluss",flow_only_hint:"Diese Durchflusssensoren haben keinen Wasserzähler. «Zähler anlegen» erstellt sofort einen Integral-Helfer; er bleibt auch ohne Energy Flow Mapper bestehen.",create_water_meter_title:"Wasserzähler für {name} anlegen?",create_water_meter_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt. Er zählt den Durchfluss zu Wasser zusammen (L/min zu Litern, m³/h zu m³) und wird als Wasser angezeigt. Er ist ein normaler Home-Assistant-Helfer und bleibt auch, wenn du Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf.",water_suffix:"Wasser",find_device:"Gerät suchen",find_none:"Kein Treffer",find_count:"{index} von {count}",find_next:"Weiter",card_empty:"Noch keine Geräte im Energie-Dashboard.",card_root_missing:"Dieses Gerät ist nicht mehr im Energie-Dashboard. Wähle in den Karten-Einstellungen ein anderes.",card_root_all:"Ganzes Zuhause",card_field_title:"Titel (leer: kein Titel)",card_field_kind:"Anzeigen",card_field_root:"Ab Gerät",card_field_show_sources:"Quellen anzeigen",card_field_show_untracked:"Nicht erfassten Verbrauch anzeigen",card_field_show_coverage:"Anzeigen, wie viel die Geräte erfassen"},en:rt,fr:{title:"Energy Flow Mapper",menu:"Menu",more:"Plus",reload:"Recharger",undo:"Annuler le dernier enregistrement",backups:"Sauvegardes",loading:"Chargement …",load_failed:"Les réglages d’énergie n’ont pas pu être chargés.",sources:"Sources",sources_hint:"Glisse un capteur libre sur une source ou touche une source. Les prix se modifient dans les réglages d’énergie.",open_energy_settings:"Réglages d’énergie",no_sources:"Aucune source configurée.",role_import:"Consommation réseau",role_export:"Injection réseau",role_production:"Production solaire",role_discharge:"Décharge batterie",role_charge:"Charge batterie",role_gas:"Gaz",role_water:"Eau",role_home:"Compteur de la maison",diagram:"Flux d’énergie",zoom_hint:"Zoome avec la molette ou deux doigts, glisse sur une zone vide pour déplacer.",zoom_in:"Agrandir",zoom_out:"Réduire",fit:"Ajuster",orientation_label:"Orientation",orientation_horizontal:"Horizontale",orientation_vertical:"Verticale",role_battery:"Batterie",home_measured:"{power} mesurés",home_stale:"{name} : données pas assez récentes",home_calculated:"{power} calculés",period_label:"Période",period_now:"Maintenant",period_today:"Aujourd’hui",period_week:"7 jours",period_month:"30 jours",energy_loading:"Chargement de la consommation …",detail_energy:"Énergie sur la période",devices:"Appareils",devices_hint:"Glisse un appareil sur un autre pour l’y inclure, ou utilise le menu ⋮.",home:"Maison",home_drop:"Dépose ici pour le niveau supérieur",no_devices:"Aucun appareil dans le tableau de bord énergie. Ajoute un capteur libre.",untracked:"Consommation non suivie",free_sensors:"Capteurs libres",free_sensors_hint:"Compteurs d’énergie qui ne sont pas encore dans le tableau de bord énergie.",search:"Rechercher",no_candidates:"Aucun capteur d’énergie libre.",add:"Ajouter",add_title:"Ajouter {name} sous …",with_power:"Capteur de puissance : {entity}",actions:"Actions pour {name}",move:"Déplacer vers …",move_title:"Déplacer {name} vers …",top_level:"Niveau supérieur (Maison)",no_targets:"Il n’y a pas d’autre place pour cet appareil.",rename:"Renommer …",rename_title:"Renommer {name}",name_label:"Nom",name_hint:"Laisse vide pour utiliser le nom de l’entité.",remove:"Retirer du tableau de bord énergie",use_as_home_meter:"Utiliser comme compteur de la maison",remove_hint:"Ses appareils enfant remontent d’un niveau.",cancel:"Annuler",ok:"OK",close:"Fermer",details:"Détails",select_hint:"Sélectionne un appareil pour voir ses détails.",detail_statistic:"Statistique",detail_power_sensor:"Capteur de puissance",detail_device:"Appareil",detail_area:"Pièce",detail_power:"Puissance actuelle",detail_untracked:"Non suivi par ses appareils enfant",detail_issues:"Problèmes",none:"–",change_one:"1 modification",change_other:"{count} modifications",discard:"Abandonner",save:"Enregistrer",confirm_title:"Enregistrer les modifications ?",confirm_errors:"Corrige d’abord ces problèmes :",confirm_warnings:"À noter :",checking:"Vérification …",saving:"Enregistrement …",saved:"Enregistré. Une sauvegarde des réglages précédents a été créée.",nothing_to_save:"Rien n’a changé.",diff_added:"{name} ajouté",diff_added_under:"{name} ajouté sous {to}",diff_removed:"{name} retiré",diff_moved:"{name} déplacé sous {to}",diff_moved_top:"{name} déplacé au niveau supérieur",diff_renamed:"{name} renommé en « {to} »",diff_renamed_reset:"{name} utilise à nouveau le nom de l’entité",diff_rate:"Capteur de puissance de {name} modifié",issue_cycle:"Fait partie d’une boucle d’appareils",issue_self_parent:"Inclus en lui-même",issue_duplicate:"Présent plusieurs fois",issue_missing_parent:"Son appareil en amont n’est pas dans le tableau de bord énergie",issue_source_and_device:"Utilisé aussi comme source",issue_statistic_missing:"Statistique introuvable",issue_not_energy_unit:"L’unité {unit} n’est pas une unité d’énergie",issue_children_exceed_parent:"Ses appareils enfant consomment plus que lui",issue_devices_exceed_home:"Les appareils consomment plus que la maison",ha_reports:"Signalé par Home Assistant",coverage_toggle:"Couverture",coverage_percent:"{percent} % couvert par les appareils",coverage_over:"plus de 100 % couvert par les appareils",coverage_below_one:"< 1 % couvert par les appareils",suggestion_text:"Suggestion : inclus dans {parent}",suggestion_apply:"Appliquer",suggestion_ignore:"Ignorer",suggestion_apply_all:"Appliquer toutes les suggestions",suggestion_show_ignored:"Afficher à nouveau les suggestions ignorées",export_image:"Enregistrer en image",export_title:"Enregistrer le diagramme en image",export_hide_names:"Masquer les noms",export_hide_hint:"Les appareils deviennent Appareil 1, 2, … ; les pièces et noms de capteurs sont omis.",export_save:"Enregistrer",export_device:"Appareil {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Brouillon, non enregistré",export_failed:"L'image n'a pas pu être créée.",backups_title:"Sauvegardes",backups_empty:"Aucune sauvegarde pour l’instant. Une sauvegarde est créée avant chaque enregistrement.",backup_by:"par {user}",restore:"Restaurer",restore_confirm:"Restaurer la sauvegarde du {date} ? Les réglages actuels sont sauvegardés d’abord.",undo_confirm:"Restaurer les réglages d’avant le dernier enregistrement ({date}) ? Les réglages actuels sont sauvegardés d’abord.",draft_lost:"Tes modifications non enregistrées seront perdues.",restored:"Sauvegarde restaurée.",summary_added:"{count} ajouté(s)",summary_removed:"{count} retiré(s)",summary_moved:"{count} déplacé(s)",summary_renamed:"{count} renommé(s)",summary_rate:"{count} avec nouveau capteur de puissance",summary_restored:"Sauvegarde restaurée",error_conflict:"Les réglages d’énergie ont été modifiés ailleurs entre-temps. Ils ont été rechargés ; vérifie tes modifications et enregistre à nouveau.",error_not_loaded:"Energy Flow Mapper n’est pas chargé.",error_unsupported_energy_api:"Les réglages d’énergie de cette version de Home Assistant ne sont pas pris en charge. L’éditeur est désactivé pour protéger tes réglages.",assign_title:"Attribuer : {role}",assign_hint:"Choisis un compteur d’énergie libre.",battery_title:"Batterie : compteur de charge",battery_hint:"{name} mesure la décharge. Choisis le compteur qui mesure la charge.",source_assign:"Attribuer un capteur …",source_replace:"Remplacer le capteur …",source_remove:"Retirer comme source",power_only:"Puissance seulement",power_only_hint:"Ces capteurs de puissance n’ont pas de compteur d’énergie. « Créer un compteur » ajoute tout de suite une entrée d’aide intégrale ; elle reste même sans Energy Flow Mapper.",create_meter:"Créer un compteur",create_meter_title:"Créer un compteur d’énergie pour {name} ?",create_meter_text:"L’entrée d’aide « {helper} » est créée tout de suite sous Paramètres → Entrées. C’est une entrée normale de Home Assistant qui reste même si tu retires Energy Flow Mapper. Son compteur est ensuite ajouté à ton brouillon.",creating:"Création …",meter_created:"Compteur « {name} » créé et ajouté au brouillon.",energy_suffix:"Énergie",external_statistic:"Statistique externe",created_by:"Créé par Energy Flow Mapper",detail_helper:"Entrée d’aide",diff_source_added:"{name} attribué comme {role}",diff_source_removed:"{name} retiré comme {role}",summary_source_added:"{count} attribué(s) comme source",summary_source_removed:"{count} retiré(s) comme source",issue_duplicate_source:"Utilisé par plusieurs sources",error_unknown_source:"Ce capteur n’est pas une source du tableau de bord énergie.",error_home_exists:"Il y a déjà un compteur de la maison.",error_home_not_supported:"Cette version de Home Assistant n’a pas de compteur de la maison ; il faut la 2026.11 ou plus récente.",error_not_a_power_candidate:"Ce capteur n’est pas un capteur de puissance ou de débit sans compteur.",error_integral_failed:"L’assistant du compteur n’a pas pu être créé.",confirm_rejected:"Home Assistant n’accepte pas ces réglages :",source_last_meter:"C’est le dernier compteur de ce raccordement au réseau. Le retirer retire le raccordement avec ses prix.",error_invalid_changes:"Le brouillon contient des erreurs et n’a pas été enregistré.",error_device_exists:"Cet appareil est déjà dans le tableau de bord énergie.",error_unknown_device:"Un appareil de ton brouillon n’est plus dans le tableau de bord énergie. Abandonne le brouillon et réessaie.",error_unknown_change:"Cette modification n’est pas prise en charge.",error_backup_not_found:"Cette sauvegarde n’existe plus.",error_rejected_by_home_assistant:"Home Assistant a refusé les réglages : {error}",backups_hint:"Conservées dans le dossier de configuration de Home Assistant, elles font donc partie de chaque sauvegarde de Home Assistant. Exporte un fichier pour en garder une copie ailleurs.",export_current:"Exporter les réglages actuels",import_file:"Importer depuis un fichier …",export:"Exporter",import_title:"Importer {file}",import:"Importer",import_unchanged:"Ce fichier contient tes réglages actuels. Il n’y a rien à importer.",import_invalid_file:"Ce fichier n’a pas pu être lu. Choisis un fichier exporté par Energy Flow Mapper.",imported:"Importé. Les réglages précédents ont été sauvegardés.",summary_imported:"Fichier importé",error_invalid_import:"Ce fichier n’est pas un export d’Energy Flow Mapper.",error_unknown:"Erreur : {message}",tabs_label:"Partie du tableau de bord énergie",tab_electricity:"Électricité",tab_gas:"Gaz",diagram_gas:"Compteurs de gaz",free_sensors_hint_gas:"Compteurs de gaz qui ne sont pas encore dans le tableau de bord énergie. Home Assistant n’a pas d’appareils au gaz, seulement des compteurs de gaz.",no_candidates_gas:"Aucun compteur de gaz libre.",assign_hint_gas:"Choisis un compteur de gaz libre.",tab_water:"Eau",diagram_water:"Flux d’eau",free_sensors_hint_water:"Compteurs d’eau qui ne sont pas encore dans le tableau de bord énergie.",no_candidates_water:"Aucun compteur d’eau libre.",assign_hint_water:"Choisis un compteur d’eau libre.",with_flow:"Capteur de débit : {entity}",detail_flow_sensor:"Capteur de débit",detail_flow:"Débit actuel",detail_volume:"Eau sur la période",issue_not_water_unit:"L’unité {unit} n’est pas une unité d’eau",diff_water:"Eau : {text}",diff_rate_water:"Capteur de débit de {name} modifié",undo_change:"Annuler la modification",undo_change_hint:"Annuler la dernière modification du brouillon (Ctrl+Z)",draft_restored:"Vos modifications non enregistrées ont été restaurées.",draft_outdated:"Vos modifications non enregistrées n'ont pas pu être restaurées, car les paramètres d'énergie ont été modifiés entre-temps.",blocked_one:"1 problème empêche l'enregistrement",blocked_other:"{count} problèmes empêchent l'enregistrement",blocked_hint:"Cliquez sur Enregistrer pour voir les problèmes.",issue_saved:"déjà dans les paramètres enregistrés",show_block:"Afficher",change_undone:"Dernière modification annulée.",flow_only:"Débit uniquement",flow_only_hint:"Ces capteurs de débit n’ont pas de compteur d’eau. « Créer un compteur » ajoute tout de suite un assistant d’intégrale ; il reste même sans Energy Flow Mapper.",create_water_meter_title:"Créer un compteur d’eau pour {name} ?",create_water_meter_text:"L’assistant « {helper} » est créé tout de suite sous Paramètres → Entrées. Il additionne le débit en eau (L/min en litres, m³/h en m³) et s’affiche comme eau. C’est un assistant Home Assistant ordinaire qui reste même si tu retires Energy Flow Mapper. Son compteur est ensuite ajouté à ton brouillon.",water_suffix:"Eau",find_device:"Chercher un appareil",find_none:"Aucun résultat",find_count:"{index} sur {count}",find_next:"Suivant",card_empty:"Aucun appareil dans le tableau de bord énergie pour l’instant.",card_root_missing:"Cet appareil n’est plus dans le tableau de bord énergie. Choisis-en un autre dans les réglages de la carte.",card_root_all:"Toute la maison",card_field_title:"Titre (vide : sans titre)",card_field_kind:"Afficher",card_field_root:"À partir de l’appareil",card_field_show_sources:"Afficher les sources",card_field_show_untracked:"Afficher la consommation non suivie",card_field_show_coverage:"Afficher la part couverte par les appareils"},it:{title:"Energy Flow Mapper",menu:"Menu",more:"Altro",reload:"Ricarica",undo:"Annulla l’ultimo salvataggio",backups:"Backup",loading:"Caricamento …",load_failed:"Non è stato possibile caricare le impostazioni energetiche.",sources:"Fonti",sources_hint:"Trascina un sensore libero su una fonte o tocca una fonte. I prezzi si modificano nelle impostazioni energetiche.",open_energy_settings:"Impostazioni energetiche",no_sources:"Nessuna fonte configurata.",role_import:"Prelievo dalla rete",role_export:"Immissione in rete",role_production:"Produzione solare",role_discharge:"Scarica batteria",role_charge:"Carica batteria",role_gas:"Gas",role_water:"Acqua",role_home:"Contatore della casa",diagram:"Flusso di energia",zoom_hint:"Zooma con la rotella o con due dita, trascina su un’area vuota per spostare.",zoom_in:"Ingrandisci",zoom_out:"Riduci",fit:"Adatta",orientation_label:"Orientamento",orientation_horizontal:"Orizzontale",orientation_vertical:"Verticale",role_battery:"Batteria",home_measured:"{power} misurati",home_stale:"{name}: dati non abbastanza recenti",home_calculated:"{power} calcolati",period_label:"Periodo",period_now:"Ora",period_today:"Oggi",period_week:"7 giorni",period_month:"30 giorni",energy_loading:"Caricamento dei consumi …",detail_energy:"Energia nel periodo",devices:"Dispositivi",devices_hint:"Trascina un dispositivo su un altro per includerlo lì, oppure usa il menu ⋮.",home:"Casa",home_drop:"Rilascia qui per il livello superiore",no_devices:"Ancora nessun dispositivo nella dashboard energia. Aggiungi un sensore libero.",untracked:"Consumo non monitorato",free_sensors:"Sensori liberi",free_sensors_hint:"Contatori di energia che non sono ancora nella dashboard energia.",search:"Cerca",no_candidates:"Nessun sensore di energia libero.",add:"Aggiungi",add_title:"Aggiungi {name} sotto …",with_power:"Sensore di potenza: {entity}",actions:"Azioni per {name}",move:"Sposta in …",move_title:"Sposta {name} in …",top_level:"Livello superiore (Casa)",no_targets:"Non c’è un altro posto per questo dispositivo.",rename:"Rinomina …",rename_title:"Rinomina {name}",name_label:"Nome",name_hint:"Lascia vuoto per usare il nome dell’entità.",remove:"Rimuovi dalla dashboard energia",use_as_home_meter:"Usa come contatore della casa",remove_hint:"I suoi dispositivi figli salgono di un livello.",cancel:"Annulla",ok:"OK",close:"Chiudi",details:"Dettagli",select_hint:"Seleziona un dispositivo per vederne i dettagli.",detail_statistic:"Statistica",detail_power_sensor:"Sensore di potenza",detail_device:"Dispositivo",detail_area:"Area",detail_power:"Potenza attuale",detail_untracked:"Non monitorato dai dispositivi figli",detail_issues:"Problemi",none:"–",change_one:"1 modifica",change_other:"{count} modifiche",discard:"Scarta",save:"Salva",confirm_title:"Salvare le modifiche?",confirm_errors:"Risolvi prima questi problemi:",confirm_warnings:"Da notare:",checking:"Verifica …",saving:"Salvataggio …",saved:"Salvato. È stato creato un backup delle impostazioni precedenti.",nothing_to_save:"Non è cambiato nulla.",diff_added:"{name} aggiunto",diff_added_under:"{name} aggiunto sotto {to}",diff_removed:"{name} rimosso",diff_moved:"{name} spostato sotto {to}",diff_moved_top:"{name} spostato al livello superiore",diff_renamed:"{name} rinominato in «{to}»",diff_renamed_reset:"{name} usa di nuovo il nome dell’entità",diff_rate:"Sensore di potenza di {name} modificato",issue_cycle:"Fa parte di un ciclo di dispositivi",issue_self_parent:"Incluso in sé stesso",issue_duplicate:"Presente più volte",issue_missing_parent:"Il suo dispositivo a monte non è nella dashboard energia",issue_source_and_device:"Usato anche come fonte",issue_statistic_missing:"Statistica non trovata",issue_not_energy_unit:"L’unità {unit} non è un’unità di energia",issue_children_exceed_parent:"I suoi dispositivi figli consumano più di lui",issue_devices_exceed_home:"I dispositivi consumano più della casa",ha_reports:"Segnalazioni di Home Assistant",coverage_toggle:"Copertura",coverage_percent:"{percent}% coperto dai dispositivi",coverage_over:"oltre il 100% coperto dai dispositivi",coverage_below_one:"< 1% coperto dai dispositivi",suggestion_text:"Suggerimento: incluso in {parent}",suggestion_apply:"Applica",suggestion_ignore:"Ignora",suggestion_apply_all:"Applica tutti i suggerimenti",suggestion_show_ignored:"Mostra di nuovo i suggerimenti ignorati",export_image:"Salva come immagine",export_title:"Salva il diagramma come immagine",export_hide_names:"Nascondi i nomi",export_hide_hint:"I dispositivi diventano Dispositivo 1, 2, …; aree e nomi dei sensori vengono omessi.",export_save:"Salva",export_device:"Dispositivo {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Bozza, non salvata",export_failed:"Impossibile creare l'immagine.",backups_title:"Backup",backups_empty:"Ancora nessun backup. Ne viene creato uno prima di ogni salvataggio.",backup_by:"di {user}",restore:"Ripristina",restore_confirm:"Ripristinare il backup del {date}? Le impostazioni attuali vengono salvate prima.",undo_confirm:"Ripristinare le impostazioni di prima dell’ultimo salvataggio ({date})? Le impostazioni attuali vengono salvate prima.",draft_lost:"Le modifiche non salvate andranno perse.",restored:"Backup ripristinato.",summary_added:"{count} aggiunti",summary_removed:"{count} rimossi",summary_moved:"{count} spostati",summary_renamed:"{count} rinominati",summary_rate:"{count} con nuovo sensore di potenza",summary_restored:"Backup ripristinato",error_conflict:"Le impostazioni energetiche sono state modificate altrove nel frattempo. Sono state ricaricate; controlla le modifiche e salva di nuovo.",error_not_loaded:"Energy Flow Mapper non è caricato.",error_unsupported_energy_api:"Le impostazioni energetiche di questa versione di Home Assistant non sono supportate. L’editor è disattivato per proteggere le tue impostazioni.",assign_title:"Assegna: {role}",assign_hint:"Scegli un contatore di energia libero.",battery_title:"Batteria: contatore di carica",battery_hint:"{name} misura la scarica. Scegli il contatore che misura la carica.",source_assign:"Assegna sensore …",source_replace:"Sostituisci sensore …",source_remove:"Rimuovi come fonte",power_only:"Solo potenza",power_only_hint:"Questi sensori di potenza non hanno un contatore di energia. «Crea contatore» aggiunge subito un aiutante integrale; resta anche senza Energy Flow Mapper.",create_meter:"Crea contatore",create_meter_title:"Creare un contatore di energia per {name}?",create_meter_text:"L’aiutante «{helper}» viene creato subito in Impostazioni → Aiutanti. È un normale aiutante di Home Assistant e resta anche se rimuovi Energy Flow Mapper. Il suo contatore viene poi aggiunto alla tua bozza.",creating:"Creazione …",meter_created:"Contatore «{name}» creato e aggiunto alla bozza.",energy_suffix:"Energia",external_statistic:"Statistica esterna",created_by:"Creato da Energy Flow Mapper",detail_helper:"Aiutante",diff_source_added:"{name} assegnato come {role}",diff_source_removed:"{name} rimosso come {role}",summary_source_added:"{count} assegnati come fonte",summary_source_removed:"{count} rimossi come fonte",issue_duplicate_source:"Usato da più fonti",error_unknown_source:"Questo sensore non è una fonte nella dashboard energia.",error_home_exists:"C’è già un contatore della casa.",error_home_not_supported:"Questa versione di Home Assistant non ha il contatore della casa; serve la 2026.11 o successiva.",error_not_a_power_candidate:"Questo sensore non è un sensore di potenza o di portata senza contatore.",error_integral_failed:"Non è stato possibile creare l’helper del contatore.",confirm_rejected:"Home Assistant non accetta queste impostazioni:",source_last_meter:"È l’ultimo contatore di questo allacciamento alla rete. Rimuoverlo rimuove l’allacciamento con i suoi prezzi.",error_invalid_changes:"La bozza contiene errori e non è stata salvata.",error_device_exists:"Questo dispositivo è già nella dashboard energia.",error_unknown_device:"Un dispositivo della tua bozza non è più nella dashboard energia. Annulla la bozza e riprova.",error_unknown_change:"Questa modifica non è supportata.",error_backup_not_found:"Questo backup non esiste più.",error_rejected_by_home_assistant:"Home Assistant ha rifiutato le impostazioni: {error}",backups_hint:"Conservati nella cartella di configurazione di Home Assistant, quindi fanno parte di ogni backup di Home Assistant. Esporta un file per tenerne una copia altrove.",export_current:"Esporta impostazioni attuali",import_file:"Importa da file …",export:"Esporta",import_title:"Importa {file}",import:"Importa",import_unchanged:"Questo file contiene le tue impostazioni attuali. Non c’è nulla da importare.",import_invalid_file:"Impossibile leggere questo file. Scegli un file esportato da Energy Flow Mapper.",imported:"Importato. Le impostazioni precedenti sono state salvate.",summary_imported:"File importato",error_invalid_import:"Questo file non è un’esportazione di Energy Flow Mapper.",error_unknown:"Errore: {message}",tabs_label:"Parte della dashboard energia",tab_electricity:"Elettricità",tab_gas:"Gas",diagram_gas:"Contatori del gas",free_sensors_hint_gas:"Contatori del gas che non sono ancora nella dashboard energia. Home Assistant non ha dispositivi a gas, solo contatori del gas.",no_candidates_gas:"Nessun contatore del gas libero.",assign_hint_gas:"Scegli un contatore del gas libero.",tab_water:"Acqua",diagram_water:"Flusso d’acqua",free_sensors_hint_water:"Contatori d’acqua che non sono ancora nella dashboard energia.",no_candidates_water:"Nessun contatore d’acqua libero.",assign_hint_water:"Scegli un contatore d’acqua libero.",with_flow:"Sensore di portata: {entity}",detail_flow_sensor:"Sensore di portata",detail_flow:"Portata attuale",detail_volume:"Acqua nel periodo",issue_not_water_unit:"L’unità {unit} non è un’unità d’acqua",diff_water:"Acqua: {text}",diff_rate_water:"Sensore di portata di {name} modificato",undo_change:"Annulla modifica",undo_change_hint:"Annulla l’ultima modifica della bozza (Ctrl+Z)",draft_restored:"Le modifiche non salvate sono state ripristinate.",draft_outdated:"Le modifiche non salvate non possono essere ripristinate, perché nel frattempo le impostazioni energetiche sono cambiate.",blocked_one:"1 problema impedisce il salvataggio",blocked_other:"{count} problemi impediscono il salvataggio",blocked_hint:"Fai clic su Salva per vedere i problemi.",issue_saved:"già nelle impostazioni salvate",show_block:"Mostra",change_undone:"Ultima modifica annullata.",flow_only:"Solo portata",flow_only_hint:"Questi sensori di portata non hanno un contatore d’acqua. «Crea contatore» aggiunge subito un helper integrale; resta anche senza Energy Flow Mapper.",create_water_meter_title:"Creare un contatore d’acqua per {name}?",create_water_meter_text:"L’helper «{helper}» viene creato subito in Impostazioni → Helper. Somma la portata in acqua (L/min in litri, m³/h in m³) e viene mostrato come acqua. È un normale helper di Home Assistant e resta anche se rimuovi Energy Flow Mapper. Il suo contatore viene poi aggiunto alla tua bozza.",water_suffix:"Acqua",find_device:"Cerca dispositivo",find_none:"Nessun risultato",find_count:"{index} di {count}",find_next:"Avanti",card_empty:"Ancora nessun dispositivo nella dashboard energia.",card_root_missing:"Questo dispositivo non è più nella dashboard energia. Scegline un altro nelle impostazioni della scheda.",card_root_all:"Tutta la casa",card_field_title:"Titolo (vuoto: nessun titolo)",card_field_kind:"Mostra",card_field_root:"A partire dal dispositivo",card_field_show_sources:"Mostra le fonti",card_field_show_untracked:"Mostra il consumo non monitorato",card_field_show_coverage:"Mostra quanto coprono i dispositivi"}};function at(e){return e?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function ot(e,t,s={}){return(i=at(e),nt[i]??nt[i.split("-")[0]]??rt)[t].replace(/\{(\w+)\}/g,(e,t)=>t in s?s[t]:e);var i}function lt(e){return e in rt}const dt={comma_decimal:["en-US","en"],decimal_comma:["de","es","it"],quote_decimal:["de-CH"],space_comma:["fr","sv","cs"],system:void 0};function ct(e,t,s=0){const i=e?.locale.number_format??"language",r=i in dt?dt[i]:"none"===i?["en-US"]:[at(e)];try{return new Intl.NumberFormat(r,{useGrouping:"none"!==i,maximumFractionDigits:s}).format(t)}catch{return String(t)}}function ht(e,t){return Math.abs(t)>=1e3?`${ct(e,t/1e3,2)} kW`:`${ct(e,t)} W`}function ut(e,t){const s=Math.abs(t);return s<1?`${ct(e,1e3*t)} Wh`:`${ct(e,t,s<10?2:s<100?1:0)} kWh`}function _t(e,t,s){return"L"===s&&Math.abs(t)>=1e3?`${ct(e,t/1e3,gt(t/1e3))} m³`:`${ct(e,t,gt(t))} ${s}`}function pt(e,t,s){const i="gal"===s?t/3.785411784:t;return`${ct(e,i,gt(i))} ${s}/min`}function gt(e){const t=Math.abs(e);return t<10?2:t<100?1:0}function mt(e,t){try{return new Intl.DateTimeFormat(at(e),{dateStyle:"medium",timeStyle:"short"}).format(new Date(t))}catch{return t}}function ft(e,t){const s=t??{},i=`error_${s.translation_key??""}`;if(s.translation_key&&lt(i)){const t=Object.fromEntries(Object.entries(s.translation_placeholders??{}).map(([e,t])=>[e,String(t)]));return ot(e,i,t)}return ot(e,"error_unknown",{message:s.message??String(t)})}function bt(e,t,s){const i=e?.localize?.(`component.energy.issues.${t.type}.title`,t.placeholders??void 0)||t.type,r=t.entities.filter(([e])=>e!==s).map(([e,t])=>null==t?e:`${e} (${String(t)})`);return r.length?`${i}: ${r.join(", ")}`:i}const vt="energy-flow-mapper-panel",yt="energy_flow_mapper",$t=4e3,wt="__home__",xt=.1,kt=2.5,At=.9,Et=.8,St=48,Ct="energy_flow_mapper.orientation",zt="energy_flow_mapper.coverage",Mt="energy_flow_mapper.draft",Tt=["electricity","water","gas"],Dt="src:",Ht=["mWh","Wh","kWh","MWh","GWh","TWh","J","kJ","MJ","GJ","cal","kcal","Mcal","Gcal"];function Lt(e){switch(e){case"import":case"export":case"production":case"battery":case"water":case"gas":case"home":return e;case"discharge":case"charge":return"battery";default:return null}}function It(e){const t=new Date(e),s=e=>String(e).padStart(2,"0");return[t.getFullYear(),s(t.getMonth()+1),s(t.getDate()),s(t.getHours()),s(t.getMinutes()),s(t.getSeconds())].join("-")}function Pt(e,t){Ft(e,new Blob([JSON.stringify(t,null,2)],{type:"application/json"}))}function Ft(e,t){const s=URL.createObjectURL(t),i=document.createElement("a");i.href=s,i.download=e,i.click(),setTimeout(()=>URL.revokeObjectURL(s),0)}function Nt(e,t){try{t.length?localStorage.setItem(Mt,JSON.stringify({hash:e,changes:t})):localStorage.removeItem(Mt)}catch{}}function Rt(e){history.pushState(null,"",e),window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:!1}}))}class Ut extends le{static properties={hass:{attribute:!1},narrow:{type:Boolean},_snapshot:{state:!0},_loadError:{state:!0},_changes:{state:!0},_validation:{state:!0},_selected:{state:!0},_collapsed:{state:!0},_dragged:{state:!0},_dropTarget:{state:!0},_search:{state:!0},_dialog:{state:!0},_busy:{state:!0},_toast:{state:!0},_renameValue:{state:!0},_view:{state:!0},_zoom:{state:!0},_period:{state:!0},_orientation:{state:!0},_coverage:{state:!0},_ignored:{state:!0},_energy:{state:!0},_tab:{state:!0},_find:{state:!0},_findIndex:{state:!0}};_haTexts=!1;_exporting=!1;_suggestionMemo=null;_toPng=Fe;_loading=!1;_draftChecked=!1;_validateRequest=0;_energyRequest=0;_toastTimer;_fitted=!1;_autoFit=!0;_resizeObserver;_observed=null;_pointers=new Map;_pointerType="mouse";constructor(){super(),this.narrow=!1,this._snapshot=null,this._loadError=null,this._changes=[],this._validation=null,this._selected=null,this._collapsed=new Set,this._dragged=null,this._dropTarget=null,this._search="",this._dialog=null,this._busy=!1,this._toast=null,this._renameValue="",this._view="diagram",this._zoom={x:0,y:0,k:1},this._period="now",this._orientation=function(){try{return"vertical"===localStorage.getItem(Ct)?"vertical":"horizontal"}catch{return"horizontal"}}(),this._coverage=function(){try{return"off"!==localStorage.getItem(zt)}catch{return!0}}(),this._ignored=[],this._energy=null,this._tab="electricity",this._find="",this._findIndex=0}_onKeyDown=e=>{const t=e.composedPath()[0];!e.ctrlKey&&!e.metaKey||e.shiftKey||"z"!==e.key.toLowerCase()||this._dialog||!(this._changes.length>0)||t&&["INPUT","TEXTAREA"].includes(t.tagName)||(e.preventDefault(),this._undoChange())};connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._onKeyDown)}_t(e,t={}){return ot(this.hass,e,t)}willUpdate(e){!e.has("hass")||!this.hass||this._snapshot||this._loading||this._loadError||this._load()}async _load(){if(this.hass){this._loading=!0;try{this._snapshot=await this.hass.callWS({type:`${yt}/get`}),this._loadError=null,this._ignored=this._snapshot.ignored_suggestions??[],this._restoreDraft(this._snapshot.hash),this._loadHaTexts()}catch(e){this._loadError=ft(this.hass,e)}finally{this._loading=!1}await Promise.all([this._validate(),this._loadEnergy()])}}_restoreDraft(e){if(this._draftChecked)return;this._draftChecked=!0;const t=function(){try{const e=JSON.parse(localStorage.getItem(Mt)??"null");return e&&"string"==typeof e.hash&&Array.isArray(e.changes)?e:null}catch{return null}}();t&&!this._changes.length&&(t.hash===e?(this._changes=t.changes,this._showToast(this._t("draft_restored"))):(Nt(e,[]),this._showToast(this._t("draft_outdated"))))}_loadHaTexts(){!this._haTexts&&this.hass?.loadBackendTranslation&&(this._haTexts=!0,this.hass.loadBackendTranslation("issues","energy").then(()=>this.requestUpdate()).catch(()=>{this._haTexts=!1}))}setPeriod(e){this._period=e,this._energy=null,this._loadEnergy()}async _loadEnergy(){const e=++this._energyRequest;if(this.hass&&this._snapshot&&"now"!==this._period)try{const t=await this.hass.callWS({type:`${yt}/energy`,period:this._period,...this._changes.length?{base_hash:this._snapshot.hash,changes:this._changes}:{}});e===this._energyRequest&&(this._energy=t)}catch(t){e===this._energyRequest&&await this._handleError(t)}else this._energy=null}setTab(e){e!==this._tab&&(this._tab=e,this._selected=null,this._find="",this._findIndex=0,this._autoFit=!0,this._fitted=!1)}_values(e){if("now"===this._period)return this._rateMap(e);const t=this._energy?.energy??{};return new Map(e.map(e=>[e.stat_consumption,t[e.stat_consumption]??null]))}_waterUnit(){return this._energy?.water_unit??("gal"===this.hass?.config?.unit_system?.volume?"gal":"L")}_formatValue(e){return"water"===this._tab?"now"===this._period?pt(this.hass,e,this._waterUnit()):_t(this.hass,e,this._waterUnit()):"now"===this._period?ht(this.hass,e):ut(this.hass,e)}draftOf(e){const t=this._snapshot?.prefs;return function(e,t,s="electricity"){const i=structuredClone(e);for(const e of t){if(_e(e)!==s)continue;const t=i.findIndex(t=>t.stat_consumption===e.stat);if("add"===e.type){if(-1!==t)continue;const s={stat_consumption:e.stat};ue(s,"stat_rate",e.stat_rate),ue(s,"name",e.name),ue(s,"included_in_stat",e.parent),i.push(s);continue}if(-1!==t)if("move"===e.type)ue(i[t],"included_in_stat",e.parent);else if("rename"===e.type)ue(i[t],"name",e.name);else if("remove"===e.type||"use_as_home_meter"===e.type){const[s]=i.splice(t,1);for(const t of i)t.included_in_stat===e.stat&&ue(t,"included_in_stat",s.included_in_stat)}}return i}(("water"===e?t?.device_consumption_water:t?.device_consumption)??[],this._changes,e)}get draft(){return"gas"===this._tab?[]:this.draftOf(this._tab)}_deviceKind(){return"water"===this._tab?"water":"electricity"}_kind(){return"water"===this._tab?{kind:"water"}:{}}_candidates(e=this._tab){const t=this._snapshot;return{electricity:t?.candidates,water:t?.water_candidates,gas:t?.gas_candidates}[e]??[]}_allCandidates(){return[...this._candidates("electricity"),...this._candidates("water"),...this._candidates("gas")]}get draftSources(){const e=this._snapshot?.prefs;return function(e,t,s=[]){const i=structuredClone(e);for(const e of t)if("use_as_home_meter"===e.type){if(!i.some(e=>"home"===e.type)){const t=s.find(t=>t.stat_consumption===e.stat);i.push({type:"home",stat_energy_to:e.stat,...t?.stat_rate?{stat_rate:t.stat_rate}:{},...t?.name?{name:t.name}:{}})}}else if("assign_source"===e.type){if("home"===e.role){const t=i.find(e=>"home"===e.type);t?t.stat_energy_to=e.stat:i.push({type:"home",stat_energy_to:e.stat})}else if("import"===e.role||"export"===e.role){const t="import"===e.role?"stat_energy_from":"stat_energy_to",s=i.filter(e=>"grid"===e.type);let r=e.replace?s.find(s=>s[t]===e.replace):s[0];if(void 0===r){if(e.replace)continue;r=structuredClone(ce),i.push(r)}r[t]=e.stat}else if("production"===e.role)i.push({type:"solar",stat_energy_from:e.stat,config_entry_solar_forecast:null});else if("battery"===e.role&&e.stat_to)i.push({type:"battery",stat_energy_from:e.stat,stat_energy_to:e.stat_to});else if("water"===e.role||"gas"===e.role){const t=e.role;let s=e.replace?i.find(s=>s.type===t&&s.stat_energy_from===e.replace):void 0;if(void 0===s){if(e.replace)continue;s={...structuredClone(he),type:t},i.push(s)}s.stat_energy_from=e.stat}}else if("unassign_source"===e.type){const t=i.findIndex(t=>De.includes(t.type)&&Te.some(s=>t[s]===e.stat));if(-1===t)continue;const s=i[t];if("grid"!==s.type){i.splice(t,1);continue}for(const t of Te)s[t]===e.stat&&(s[t]=null);s.stat_energy_from||s.stat_energy_to||s.stat_rate||s.power_config||i.splice(t,1)}return i}(e?.energy_sources??[],this._changes,e?.device_consumption??[])}_canUseHomeMeter(e){const t=void 0===e||!this.draft.find(t=>t.stat_consumption===e)?.included_in_stat;return t&&!0===this._snapshot?.home_supported&&"electricity"===this._tab&&!this.draftSources.some(e=>"home"===e.type)}_home(){if("electricity"!==this._tab)return null;if("now"!==this._period)return this._energy?.home??null;const e=this.hass?function(e,t){const s=t.find(e=>"home"===e.type)?.stat_rate;return"string"==typeof s?ke(e,s):null}(this.hass,this.draftSources):null;if(null===e)return null;const t=this.draft,s=this._values(t),i=pe(t).map(e=>s.get(e.stat)??null),r=i.some(e=>null===e)?null:e-i.reduce((e,t)=>e+(t??0),0);return{value:e,basis:"measured",stale:null,untracked:r}}_info(e){return this._snapshot?.stats[e]??this._allCandidates().find(t=>t.stat===e)??this._snapshot?.power_candidates?.find(t=>t.stat===e)??this._snapshot?.flow_candidates?.find(t=>t.stat===e)}_name(e,t=("water"===this._tab?[...this.draftOf("water"),...this.draftOf("electricity")]:[...this.draftOf("electricity"),...this.draftOf("water")])){const s=this._allCandidates();return function(e,t,s){const i=t.find(t=>t.stat_consumption===e);return i?.name||s[e]?.energy_name||s[e]?.name||e}(e,t,{...this._snapshot?.stats,...Object.fromEntries(s.map(e=>[e.stat,e]))})}_issues(){const e=this._validation?.issues??this._snapshot?.issues??[];return"now"===this._period?e:[...e,...this._energy?.issues??[]]}_suggestions(){const e=[this._snapshot,this._changes,this._ignored,this._tab],t=this._suggestionMemo;if(t&&t.key.every((t,s)=>t===e[s]))return t.value;const s=be(this.draft,this._snapshot?.child_pairs??[],this._ignored,this._deviceKind());return this._suggestionMemo={key:e,value:s},s}_suggestionFor(e){return this._suggestions().find(t=>t.stat===e)}_applySuggestion(e){this._change(this._suggestionChange(e))}_suggestionChange(e){return{type:"move",stat:e.stat,parent:e.parent,...this._kind()}}_applyAllSuggestions(){const e=this._changes.length;for(const e of this._suggestions())be(this.draft,[e],this._ignored,this._deviceKind()).length&&(this._changes=[...this._changes,this._suggestionChange(e)]);this._changes.length>e&&(this._validate(),this._loadEnergy())}async _ignoreSuggestion(e){if(this.hass)try{const t=await this.hass.callWS({type:`${yt}/ignore_suggestion`,kind:e.kind,stat:e.stat,parent:e.parent});this._ignored=t.ignored}catch(e){this._showToast(ft(this.hass,e))}}async _clearIgnored(){if(this.hass)try{const e=await this.hass.callWS({type:`${yt}/clear_suggestions`,kind:this._deviceKind()});this._ignored=e.ignored}catch(e){this._showToast(ft(this.hass,e))}}_haIssuesFor(e){return(this._snapshot?.ha_issues??[]).filter(t=>t.stat===e&&t.kind===this._tab)}_powerOnlyGridStats(){return this.draftSources.filter(e=>"grid"===e.type&&!e.stat_energy_from&&!e.stat_energy_to).flatMap(e=>function(e){const t=e.power_config;return[e.stat_rate,...ze.map(e=>t?.[e])].filter(e=>"string"==typeof e)}(e))}_badgeTitle(e,t){return[...t.map(e=>this._issueText(e)),...this._haIssuesFor(e).map(t=>bt(this.hass,t,e))].join("\n")}_issuesFor(e){return this._issues().filter(t=>t.stat===e&&(t.kind??"electricity")===this._tab)}_change(e){this._changes=[...this._changes,e],this._validate(),this._loadEnergy()}async _validate(){const e=++this._validateRequest;if(!this.hass||!this._snapshot||0===this._changes.length)return this._validation=null,null;try{const t=await this.hass.callWS({type:`${yt}/validate`,base_hash:this._snapshot.hash,changes:this._changes});return e===this._validateRequest&&(this._validation=t),t}catch(e){return await this._handleError(e),null}}async _handleError(e){this._showToast(ft(this.hass,e)),"conflict"===e?.translation_key&&(this._snapshot=null,await this._load())}_undoChange(){0!==this._changes.length&&(this._changes=this._changes.slice(0,-1),this._showToast(this._t("change_undone")),this._validate(),this._loadEnergy())}_discard(){this._changes=[],this._validation=null,this._loadEnergy()}async _openConfirm(){this._dialog={kind:"confirm",result:null};const e=await this._validate();"confirm"===this._dialog?.kind&&(this._dialog=e?{kind:"confirm",result:e}:null)}async _save(){if(this.hass&&this._snapshot){this._busy=!0;try{const e=await this.hass.callWS({type:`${yt}/save`,base_hash:this._snapshot.hash,changes:this._changes});this._dialog=null,this._discard(),this._showToast(this._t(e.backup_id?"saved":"nothing_to_save")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}async _openBackups(e){if(this.hass)try{const{backups:t}=await this.hass.callWS({type:`${yt}/backups`});e&&t.length>0?this._dialog={kind:"restore",backup:t[0],undo:!0}:this._dialog={kind:"backups",entries:t}}catch(e){await this._handleError(e)}}async _restore(e){if(this.hass&&this._snapshot){this._busy=!0;try{await this.hass.callWS({type:`${yt}/restore`,backup_id:e.id,base_hash:this._snapshot.hash}),this._dialog=null,this._discard(),this._showToast(this._t("restored")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}async _export(e){if(this.hass)try{const t=await this.hass.callWS({type:`${yt}/export`,...e?{backup_id:e.id}:{}});Pt(`energy-flow-mapper-${e?"backup":"settings"}-${It(e?.created??t.exported)}.json`,t)}catch(e){await this._handleError(e)}}_pickImportFile(){const e=document.createElement("input");e.type="file",e.accept=".json,application/json",e.addEventListener("change",()=>{const t=e.files?.[0];t&&this._readImport(t)}),e.click()}async _readImport(e){if(!this.hass||!this._snapshot)return;let t;try{t=JSON.parse(await e.text())}catch{return void this._showToast(this._t("import_invalid_file"))}this._dialog={kind:"import",file:e.name,document:t,result:null};try{const e=await this.hass.callWS({type:`${yt}/import_check`,base_hash:this._snapshot.hash,document:t});"import"===this._dialog?.kind&&(this._dialog={...this._dialog,result:e})}catch(e){this._dialog=null,await this._handleError(e)}}async _import(e){if(this.hass&&this._snapshot){this._busy=!0;try{const t=await this.hass.callWS({type:`${yt}/import`,base_hash:this._snapshot.hash,document:e});this._dialog=null,this._discard(),this._showToast(this._t(t.backup_id?"imported":"nothing_to_save")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}_showToast(e){this._toast=e,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},4e3)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this._onKeyDown),clearTimeout(this._toastTimer),this._resizeObserver?.disconnect(),this._observed=null}_onViewportResize(){this._autoFit&&this.fit()}_observeViewport(){const e=this._viewport();e!==this._observed&&"undefined"!=typeof ResizeObserver&&(this._resizeObserver??=new ResizeObserver(()=>this._onViewportResize()),this._resizeObserver.disconnect(),e&&this._resizeObserver.observe(e),this._observed=e)}_canDrop(e){const t=this._dragged;if(null===t)return!1;if(e.startsWith(Dt))return"device"!==t.kind||e.startsWith(`${Dt}home:`)&&this._canUseHomeMeter(t.stat);const s=e===wt?null:e;return"candidate"===t.kind?"gas"!==this._tab:fe(this.draft,t.stat,s)}_drop(e){const t=this._dragged,s=this._canDrop(e);if(this._dragged=null,this._dropTarget=null,null===t||!s)return;if(e.startsWith(Dt)){const s=e.slice(4),i=s.indexOf(":"),r=s.slice(i+1);if("device"===t.kind)return void this._change({type:"use_as_home_meter",stat:t.stat});const n=this.diagramLayout().blocks.find(e=>e.id===r&&"source"===e.kind);return void this._assign(s.slice(0,i),t.stat,n?.stat??null)}const i=e===wt?null:e;"candidate"===t.kind?this._addCandidate(t.stat,i):this._change({type:"move",stat:t.stat,parent:i,...this._kind()})}_dragHandlers(e){return{over:t=>{this._canDrop(e)&&(t.preventDefault(),this._dropTarget=e)},leave:()=>{this._dropTarget===e&&(this._dropTarget=null)},drop:t=>{t.preventDefault(),this._drop(e)}}}_startDrag(e,t){e.dataTransfer?.setData("text/plain",t.stat),e.dataTransfer&&(e.dataTransfer.effectAllowed="move"),"device"===t.kind&&"diagram"===this._view&&this._setDragImage(e),this._dragged=t}_setDragImage(e){const t=e.currentTarget,s=e.dataTransfer;if(!t||!s?.setDragImage)return;const i="touch"===this._pointerType||"pen"===this._pointerType,r=i?Math.max(this._zoom.k,.8):this._zoom.k,n=t.offsetWidth*r,a=t.offsetHeight*r,o=document.createElement("div");o.className="drag-ghost",o.style.cssText=`position:fixed;left:0;top:-${Math.ceil(a)+100}px;width:${n}px;height:${a}px;overflow:hidden;pointer-events:none`;const l=t.cloneNode(!0);l.style.left="0",l.style.top="0",l.style.transform=`scale(${r})`,l.style.transformOrigin="0 0",o.append(l),this.renderRoot.append(o);const d=t.getBoundingClientRect();i?s.setDragImage(o,n/2,a+48):s.setDragImage(o,Math.min(n,Math.max(0,e.clientX-d.left)),Math.min(a,Math.max(0,e.clientY-d.top))),setTimeout(()=>o.remove(),0)}_addCandidate(e,t){const s=this._candidates().find(t=>t.stat===e);this._change({type:"add",stat:e,parent:t,stat_rate:s?.power??null,...this._kind()}),this._selected=e}_assign(e,t,s=null){if("battery"===e)return void(this._dialog={kind:"battery",discharge:t});this._dialog=null;const i="import"===e||"export"===e||"water"===e||"gas"===e;this._change({type:"assign_source",role:e,stat:t,...i&&s?{replace:s}:{}})}_usedInDraft(){const e=new Set;for(const t of[...this.draftOf("electricity"),...this.draftOf("water")])e.add(t.stat_consumption),t.stat_rate&&e.add(t.stat_rate);for(const t of Me(this.draftSources))e.add(t.stat);return e}_freePowerSensors(){const e=this._usedInDraft();return("gas"===this._tab?[]:("water"===this._tab?this._snapshot?.flow_candidates:this._snapshot?.power_candidates)??[]).filter(t=>!e.has(t.stat))}_meterName(e){return`${this._info(e)?.name||e} ${this._t("water"===this._tab?"water_suffix":"energy_suffix")}`}async _createMeter(e){if(!this.hass)return;const t=this._meterName(e);this._busy=!0;try{const s=await this.hass.callWS({type:`${yt}/create_integral`,power_entity_id:e,name:t});this._dialog=null,await this._load(),this._change({type:"add",stat:s.entity_id,parent:null,stat_rate:s.stat_rate,..."water"===s.kind?{kind:"water"}:{}}),this._selected=s.entity_id,this._showToast(this._t("meter_created",{name:t}))}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}_freeCandidates(e=this._search){const t=this._usedInDraft();return e=e.trim().toLowerCase(),this._candidates().filter(s=>!t.has(s.stat)&&(!e||[s.name,s.stat,s.area_name,s.device_name].some(t=>t?.toLowerCase().includes(e))))}updated(e){if(e.has("_changes")&&this._draftChecked&&this._snapshot&&Nt(this._snapshot.hash,this._changes),!this._fitted&&this._autoFit&&this._snapshot&&"diagram"===this._view&&(this._fitted=this.fit()),this._observeViewport(),!e.has("_dialog"))return;const t=this.renderRoot.querySelector("dialog");t&&(this._dialog&&!t.open?t.showModal?.():!this._dialog&&t.open&&t.close?.())}_reload(){this._snapshot=null,this._loadError=null,this._load()}render(){return W`
      <div class="header">
        ${this.narrow?W`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${()=>this.dispatchEvent(new Event("hass-toggle-menu",{bubbles:!0,composed:!0}))}
            >
              ${Re("menu")}
            </button>`:q}
        <h1>${this._t("title")}</h1>
        ${this.narrow?W`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${()=>this._dialog={kind:"menu"}}
            >
              ${Re("dots")}
            </button>`:W`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
                ${Re("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
                ${Re("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${()=>this._reload()}
              >
                ${Re("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast?W`<div class="toast" role="status">${this._toast}</div>`:q}
    `}_renderBody(){return this._loadError?W`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`:this._snapshot?W`
      <div class="tabs" role="tablist" aria-label=${this._t("tabs_label")}>
        ${Tt.map(e=>W`<button
            role="tab"
            class=${this._tab===e?"active":""}
            aria-selected=${String(this._tab===e)}
            data-tab=${e}
            @click=${()=>this.setTab(e)}
          >
            ${Re("water"===e?"water":"gas"===e?"fire":"flash")} ${this._t(`tab_${e}`)}
          </button>`)}
      </div>
      <div class="content ${this.narrow?"narrow":""}">
        ${this.narrow?q:W`<aside class="column free">${this._renderCandidates()}</aside>`}
        <main class="column main">
          ${"list"===this._view?W`${this._renderSources()} ${this._renderTree()}`:this._renderDiagram()}
        </main>
        ${this.narrow?q:W`<aside class="column details">${this._renderDetails()}</aside>`}
      </div>
    `:W`<div class="message">${this._t("loading")}</div>`}_rateMap(e){return new Map(e.map(e=>[e.stat_consumption,this.hass?Ae(this.hass,e.stat_rate,this._deviceKind()):null]))}diagramLayout(){const e=this.draft,t=pe(e),s=this._values(e),i=Ee(t,s),r=this._home();return null!=r?.value&&i.set(We,r.untracked),Xe(t,Me(this.draftSources,this._tab),s,i,this._collapsed,"water"===this._tab?qe:"gas"===this._tab?Ge:this._snapshot?.home_supported?Ze:Be,!0,this._orientation,null!=r?.value)}_cssColor(e,t="#888888"){const s=/^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/.exec(e.trim());if(!s)return e;return getComputedStyle(this).getPropertyValue(s[1]).trim()||s[2]?.trim()||t}_exportBlock(e,t,s){const i=t?.querySelector(".node-name")?.textContent?.trim()??"",r=[...t?.querySelectorAll(".sub")??[]].map(e=>e.textContent?.trim()??"").filter(Boolean),n=Boolean(t?.querySelector(".badge"));if("device"===e.kind){const t=e.stat,i=s.find(e=>e.stat_consumption===t),r=i?this._values([i]).get(t)??null:null;return{block:e,title:this._name(t,s),sub:null===r?null:this._formatValue(r),area:this._info(t)?.area_name??null,color:this._cssColor("var(--primary-color, #03a9f4)"),warn:n,hidden:this._collapsed.has(t)?e.node?.children.length??0:0}}const a="source"===e.kind||"placeholder"===e.kind?Ve[e.role??""]??"var(--divider-color, #e0e0e0)":"var(--secondary-text-color, #727272)",o="home"===e.kind&&null!=this._home()?.stale;return{block:e,title:i,sub:r.join("\n")||null,area:null,color:this._cssColor(a),warn:n,named:o}}async _saveImage(e){if(!this._exporting){this._exporting=!0;try{await this._writeImage(e)}finally{this._exporting=!1}}}async _writeImage(e){const t=this.diagramLayout(),s=new Map(t.blocks.map(e=>[e.id,e])),i=this.draft,r=[...this.shadowRoot?.querySelectorAll(".canvas > .block")??[]];let n=t.blocks.map((e,t)=>this._exportBlock(e,r[t],i));e&&(n=function(e,t){const s=e.filter(e=>"device"===e.block.kind).sort((e,t)=>e.block.y-t.block.y||e.block.x-t.block.x),i=new Map(s.map((e,t)=>[e,t+1]));return e.map(e=>{const s=i.get(e);return void 0!==s?{...e,title:t(s),area:null}:"source"===e.block.kind||e.named?{...e,sub:null,area:null}:{...e,area:null}})}(n,e=>this._t("export_device",{n:String(e)})));const a=Math.max(0,...t.edges.map(e=>e.power??0)),o=t.edges.flatMap(e=>{const t=s.get(e.from),i=s.get(e.to);if(!t||!i)return[];const r=et(e.power,a),n=st(r);return[{d:tt(t,i,n.length-1,this._orientation),color:this._cssColor(this._edgeColor(e,s),"#727272"),width:r,dashed:"untracked"===e.kind||"device"===e.kind&&null===e.power||"source"===e.kind&&"home"===t.role,head:it(t,i,n.half,n.length,this._orientation)}]}),l=(new Date).toISOString(),d=[this._t("export_footer",{tab:this._t(`tab_${this._tab}`),period:this._t(`period_${this._period}`),time:mt(this.hass,l)}),...this._changes.length?[this._t("export_draft")]:[]].join(" · "),c=Pe(t,n,o,{theme:{background:this._cssColor("var(--primary-background-color, #fafafa)"),text:this._cssColor("var(--primary-text-color, #212121)"),secondary:this._cssColor("var(--secondary-text-color, #727272)"),card:this._cssColor("var(--card-background-color, #ffffff)"),divider:this._cssColor("var(--divider-color, #e0e0e0)")},footer:d});try{const e=await this._toPng(c,t.width,t.height+40);Ft(`energy-flow-mapper-${this._tab}-${It(l).slice(0,10)}.png`,e),this._close()}catch{this._close(),this._showToast(this._t("export_failed"))}}setCoverage(e){this._coverage=e;try{localStorage.setItem(zt,e?"on":"off")}catch{}}setOrientation(e){this._orientation=e;try{localStorage.setItem(Ct,e)}catch{}this._autoFit=!0,this.fit()}_viewport(){return this.renderRoot.querySelector(".viewport")}findMatches(e=this._find){const t=e.trim().toLowerCase();if(!t)return[];const s=this.draft;return s.map(e=>e.stat_consumption).filter(e=>[this._name(e,s),e.slice(e.indexOf(".")+1),this._info(e)?.area_name].some(e=>e?.toLowerCase().includes(t)))}setFind(e){this._find=e,this._findIndex=0,this._showMatch()}nextMatch(){const e=this.findMatches().length;e>0&&(this._findIndex=(this._findIndex+1)%e,this._showMatch())}_showMatch(){const e=this.findMatches()[this._findIndex];void 0!==e&&this._reveal(e)}_reveal(e){const t=this.draft,s=new Set(this._collapsed);let i=t.find(t=>t.stat_consumption===e)?.included_in_stat;const r=new Set;for(;i&&!r.has(i);)r.add(i),s.delete(i),i=t.find(e=>e.stat_consumption===i)?.included_in_stat;this._collapsed=s,this._selected=e;const n=this.diagramLayout().blocks,a=n.find(t=>"device"===t.kind&&t.stat===e)??n.find(t=>"source"===t.kind&&t.stat===e),o=this._viewport();if(!a||!o?.clientWidth)return;this._autoFit=!1;const l=Math.min(2.5,Math.max(this._zoom.k,.9));this._zoom={k:l,x:o.clientWidth/2-(a.x+a.w/2)*l,y:o.clientHeight/2-(a.y+a.h/2)*l}}_findClass(e){if(!this._find.trim())return"";const t=this.findMatches();return t.includes(e)?t[this._findIndex]===e?"match current":"match":"dim"}fit(){const e=this._viewport(),t=e?.clientWidth??0,s=e?.clientHeight??0;if(!t||!s)return!1;const{width:i,height:r}=this.diagramLayout(),n=Math.min(1.4,Math.max(.1,Math.min(t/i,s/r)));return this._zoom={k:n,x:(t-i*n)/2,y:Math.max(0,(s-r*n)/2)},!0}zoomAt(e,t,s){const{x:i,y:r,k:n}=this._zoom,a=Math.min(2.5,Math.max(.1,n*s)),o=a/n;this._zoom={k:a,x:e-(e-i)*o,y:t-(t-r)*o}}_zoomCenter(e){this._autoFit=!1;const t=this._viewport();this.zoomAt((t?.clientWidth??0)/2,(t?.clientHeight??0)/2,e)}_local(e){const t=this._viewport()?.getBoundingClientRect();return{x:e.clientX-(t?.left??0),y:e.clientY-(t?.top??0)}}_onWheel(e){e.preventDefault(),this._autoFit=!1;const{x:t,y:s}=this._local(e);this.zoomAt(t,s,Math.exp(.0015*-e.deltaY))}_onPointerDown(e){this._pointerType=e.pointerType||"mouse",e.target.closest?.(".block, button, a")||(e.currentTarget?.setPointerCapture?.(e.pointerId),this._pointers.set(e.pointerId,this._local(e)))}_onPointerMove(e){const t=this._pointers.get(e.pointerId);if(!t)return;this._autoFit=!1;const s=[...this._pointers.values()],i=this._local(e);if(this._pointers.set(e.pointerId,i),1===this._pointers.size)return void(this._zoom={...this._zoom,x:this._zoom.x+i.x-t.x,y:this._zoom.y+i.y-t.y});const r=[...this._pointers.values()],n=e=>Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y),a=e=>({x:(e[0].x+e[1].x)/2,y:(e[0].y+e[1].y)/2}),[o,l]=[a(s),a(r)];this._zoom={...this._zoom,x:this._zoom.x+l.x-o.x,y:this._zoom.y+l.y-o.y},n(s)>0&&this.zoomAt(l.x,l.y,n(r)/n(s))}_onPointerUp(e){this._pointers.delete(e.pointerId)}_renderDiagram(){const e=this.draft,t=this.diagramLayout(),s=new Map(t.blocks.map(e=>[e.id,e])),i=Math.max(0,...t.edges.map(e=>e.power??0)),r=this._values(e),n=Ee(pe(e),r),a=this._home();null!=a?.value&&n.set(We,a.untracked);const o=pe(e).map(e=>r.get(e.stat)).filter(e=>null!=e),l=o.reduce((e,t)=>e+t,0),d=o.length&&l>=0?l:null,{x:c,y:h,k:u}=this._zoom;return W`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t("electricity"===this._tab?"diagram":`diagram_${this._tab}`)}</h2>
          <div class="periods" role="group" aria-label=${this._t("period_label")}>
            ${["now","today","week","month"].map(e=>W`<button
                class=${this._period===e?"active":""}
                aria-pressed=${String(this._period===e)}
                data-period=${e}
                @click=${()=>this.setPeriod(e)}
              >
                ${this._t(`period_${e}`)}
              </button>`)}
          </div>
          <div class="toolbar">
            ${this._suggestions().length>=2?W`<button class="apply-all" @click=${()=>this._applyAllSuggestions()}>
                  ${Re("lightbulb")} ${this._t("suggestion_apply_all")}
                </button>`:q}
            ${"electricity"!==this._tab||null===this._coverageRatio()&&!this._energyLoading()?q:W`<button
                  class="coverage-toggle ${this._coverage?"active":""}"
                  aria-pressed=${String(this._coverage)}
                  @click=${()=>this.setCoverage(!this._coverage)}
                >
                  ${this._t("coverage_toggle")}
                </button>`}
            <div class="orientation" role="group" aria-label=${this._t("orientation_label")}>
              ${["horizontal","vertical"].map(e=>W`<button
                  class=${this._orientation===e?"active":""}
                  aria-pressed=${String(this._orientation===e)}
                  @click=${()=>this.setOrientation(e)}
                >
                  ${this._t(`orientation_${e}`)}
                </button>`)}
            </div>
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
            <button
              @click=${()=>{this._autoFit=!0,this.fit()}}
            >
              ${this._t("fit")}
            </button>
            <button class="export-image" @click=${()=>this._dialog={kind:"export",hideNames:!1}}>
              ${this._t("export_image")}
            </button>
          </div>
        </div>
        <p class="hint">
          ${this._ignored.some(e=>e.kind===this._tab)?W`<button class="link" @click=${()=>{this._clearIgnored()}}>
                ${this._t("suggestion_show_ignored")}
              </button>`:q}
          ${this._t("devices_hint")} ${this._t("sources_hint")} ${this._t("zoom_hint")}
          ${this._energyLoading()?W`<span class="loading">${this._t("energy_loading")}</span>`:q}
        </p>
        ${this._renderFind()}
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
            style="width:${t.width}px;height:${t.height}px;transform:translate(${c}px, ${h}px) scale(${u})"
          >
            <svg class="edges" width=${t.width} height=${t.height} aria-hidden="true">
              ${t.edges.map(e=>this._renderEdge(e,s,i))}
            </svg>
            ${t.blocks.map(t=>this._renderBlock(t,e,d,n))}
          </div>
        </div>
      </section>
    `}_renderFind(){const e=this.findMatches(),t=""!==this._find.trim();return W`<div class="find">
      <input
        type="search"
        placeholder=${this._t("find_device")}
        aria-label=${this._t("find_device")}
        .value=${this._find}
        @input=${e=>this.setFind(e.target.value)}
        @keydown=${e=>{"Enter"===e.key&&(e.preventDefault(),this.nextMatch())}}
      />
      ${t?W`<span class="find-count" role="status">
              ${0===e.length?this._t("find_none"):this._t("find_count",{index:ct(this.hass,this._findIndex+1),count:ct(this.hass,e.length)})}
            </span>
            ${e.length>1?W`<button class="find-next" @click=${()=>this.nextMatch()}>${this._t("find_next")}</button>`:q}`:q}
    </div>`}_edgeColor(e,t){if("untracked"===e.kind)return"var(--secondary-text-color)";if("source"===e.kind){const s=t.get(e.from===We?e.to:e.from);return Ve[s?.role??""]??"var(--secondary-text-color)"}return"var(--primary-color)"}_renderEdge(e,t,s){const i=t.get(e.from),r=t.get(e.to);if(!i||!r)return q;const n=this._edgeColor(e,t),a="untracked"===e.kind||"device"===e.kind&&null===e.power||"source"===e.kind&&"home"===i.role,o=et(e.power,s),l=st(o);return V`<g class="edge edge-${e.kind}" data-from=${e.from} data-to=${e.to}>
      <path
        d=${tt(i,r,l.length-1,this._orientation)}
        fill="none"
        stroke=${n}
        stroke-width=${o}
        stroke-dasharray=${a?(d=o,`${Math.max(4,2*d)} ${Math.max(4,1.25*d)}`):"none"}
        stroke-linecap="butt"
      ></path>
      <polygon points=${it(i,r,l.half,l.length,this._orientation)} fill=${n}></polygon>
    </g>`;var d}_homeText(e){const t=this._home();if(t?.stale)return W`<span class="sub">${this._t("home_stale",{name:this._name(t.stale)})}</span>`;if(null==t?.value&&"electricity"===this._tab&&this.draftSources.some(e=>"home"===e.type))return q;const[s,i]=null!=t?.value?["calculated"===t.basis?"home_calculated":"home_measured",t.value]:["home_measured",e];if(null===i)return q;const r=this._coverage?this._coverageRatio():null;return W`<span class="sub">${this._t(s,{power:this._formatValue(i)})}</span>${null===r?q:W`<span class="sub coverage">${function(e,t){return t>1?ot(e,"coverage_over"):t>0&&t<.01?ot(e,"coverage_below_one"):ot(e,"coverage_percent",{percent:ct(e,Math.round(100*t))})}(this.hass,r)}</span>`}`}_coverageRatio(){const e=this._home();return null==e?.value||e.stale?null:function(e,t){return null===e||e<=0||t.some(e=>null===e||e<0)?null:t.reduce((e,t)=>e+(t??0),0)/e}(e.value,this._tops())}_energyLoading(){return"now"!==this._period&&null===this._energy}_tops(){const e=this.draft,t=this._values(e);return pe(e).map(e=>t.get(e.stat)??null)}_blockStyle(e){return`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px`}_renderBlock(e,t,s,i){const r=this._blockStyle(e);switch(e.kind){case"home":{const e=this._dragHandlers(wt);return W`<div
          class="block home ${this._dropTarget===wt?"drop":""} ${this._dragged&&this._canDrop(wt)?"can-drop":""}"
          style=${r}
          @dragover=${e.over}
          @dragleave=${e.leave}
          @drop=${e.drop}
        >
          ${Re("home")}
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${this._homeText(s)}
          </div>
          ${this._issuesFor(We).length?W`<span class="badge" title=${this._issuesFor(We).map(e=>this._issueText(e)).join("\n")}
                >!</span
              >`:q}
        </div>`}case"source":case"placeholder":{const t=e.role??"import",s="consumption"===t?this._t(`role_${e.source?.type??"gas"}`):this._t(`role_${t}`),i=Lt(t),n=i?`${Dt}${i}:${e.id}`:null,a=e.stat?[e.stat]:"placeholder"===e.kind&&"import"===t?this._powerOnlyGridStats():[],o=n?this._dragHandlers(n):null;return W`<button
          class="block source ${e.kind} ${n&&this._dropTarget===n?"drop":""} ${n&&this._dragged&&this._canDrop(n)?"can-drop":""}"
          style="${r};--source-color:${Ve[t]??"var(--divider-color)"}"
          title=${this._t("sources_hint")}
          data-role=${t}
          @dragover=${o?.over}
          @dragleave=${o?.leave}
          @drop=${o?.drop}
          @click=${()=>{"placeholder"===e.kind&&i?this._dialog={kind:"assign",role:i}:this._dialog={kind:"source",role:t,label:s,stat:e.stat??null}}}
        >
          <div class="block-text">
            <span class="node-name">${"placeholder"===e.kind?`+ ${s}`:s}</span>
            ${e.stat?W`<span class="sub">${e.source?.name||this._name(e.stat)}</span>`:q}
            ${e.stat&&"gas"===t?this._renderGasValue(e.stat):q}
          </div>
          ${a.some(e=>this._haIssuesFor(e).length)?W`<span class="badge" title=${a.map(e=>this._badgeTitle(e,[])).filter(Boolean).join("\n")}
                >!</span
              >`:q}
        </button>`}case"untracked":{const t=i.get(e.stat);return W`<div class="block untracked" style=${r} data-parent=${e.stat}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub">${null==t?this._t("none"):this._formatValue(t)}</span>
          </div>
        </div>`}default:return this._renderDeviceBlock(e,t)}}_renderGasValue(e){let t=null;if("now"===this._period){const s=this.draftSources.find(t=>"gas"===t.type&&t.stat_energy_from===e)?.stat_rate,i="string"==typeof s?this.hass?.states[s]:void 0,r=i?Number(i.state):NaN;i&&""!==i.state&&Number.isFinite(r)&&(t=`${ct(this.hass,r,2)} ${i.attributes.unit_of_measurement??""}`.trim())}else{const s=this._energy?.energy[e];if(null!=s){const i=this._info(e)?.unit;t=i&&Ht.includes(i)?ut(this.hass,s):_t(this.hass,s,this._energy?.gas_unit??"m³")}}return null===t?q:W`<span class="sub value">${t}</span>`}_renderDeviceBlock(e,t){const s=e.stat,i=e.node,r=this._name(s,t),n=this._issuesFor(s),a=n.length>0||this._haIssuesFor(s).length>0,o=this._suggestionFor(s),l=n.some(e=>"error"===e.severity)||null!==i.problem,d=this._dragHandlers(s),c=t.find(e=>e.stat_consumption===s),h=c?this._values([c]).get(s)??null:null,u=this._info(s),_=[null===h?null:this._formatValue(h),u?.area_name].filter(Boolean).join(" · "),p=this._collapsed.has(s);return W`<div
      class="block device node ${o?"suggested":""} ${this._findClass(s)} ${this._selected===s?"selected":""} ${this._dropTarget===s?"drop":""} ${l?"has-error":a?"has-warning":""} ${this._dragged?.stat===s?"dragged":this._dragged&&this._canDrop(s)?"can-drop":""}"
      style=${this._blockStyle(e)}
      draggable="true"
      data-stat=${s}
      @dragstart=${e=>this._startDrag(e,{kind:"device",stat:s})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @dragover=${d.over}
      @dragleave=${d.leave}
      @drop=${d.drop}
      @click=${()=>{this._selected=s,this.narrow&&(this._dialog={kind:"details"})}}
    >
      ${i.children.length?W`<button
            class="icon toggle"
            aria-label=${r}
            aria-expanded=${String(!p)}
            @click=${e=>{e.stopPropagation(),this._toggle(s)}}
          >
            ${p?"▸":"▾"}
          </button>`:q}
      <div class="block-text">
        <span class="node-name" title=${r}>${r}</span>
        ${_?W`<span class="sub">${_}</span>`:q}
      </div>
      ${a||i.problem?W`<span class="badge" title=${this._badgeTitle(s,n)}>!</span>`:q}
      ${o?W`<span class="suggestion" title=${this._t("suggestion_text",{parent:this._name(o.parent,t)})}
            >${Re("lightbulb")}</span
          >`:q}
      <button
        class="icon"
        aria-label=${this._t("actions",{name:r})}
        @click=${e=>{e.stopPropagation(),this._dialog={kind:"actions",stat:s}}}
      >
        ${Re("dots")}
      </button>
    </div>`}_toggle(e){const t=new Set(this._collapsed);t.has(e)?t.delete(e):t.add(e),this._collapsed=t}_renderSources(){const e=Me(this.draftSources,this._tab);return W`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${()=>Rt("/config/energy")}>
            ${this._t("open_energy_settings")}
          </button>
        </div>
        <p class="hint">${this._t("sources_hint")}</p>
        ${0===e.length?W`<p class="empty">${this._t("no_sources")}</p>`:W`<div class="sources">
              ${e.map(e=>W`<div class="source">
                  <span class="source-role"
                    >${this._t("consumption"===e.role?`role_${e.type}`:`role_${e.role}`)}</span
                  >
                  <span class="source-name">${e.name||this._name(e.stat)}</span>
                </div>`)}
            </div>`}
      </section>
    `}_renderTree(){const e=this.draft,t=pe(e),s=this._rateMap(e),i=Ee(t,s),r=this._dragHandlers(wt);return W`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget===wt?"drop":""}"
          @dragover=${r.over}
          @dragleave=${r.leave}
          @drop=${r.drop}
        >
          ${Re("home")}
          <span>${this._t("home")}</span>
          ${this._dragged?W`<span class="hint">${this._t("home_drop")}</span>`:q}
        </div>
        ${0===t.length?W`<p class="empty">${this._t("no_devices")}</p>`:W`<ul class="tree" role="tree">
              ${t.map(t=>this._renderNode(t,e,s,i))}
            </ul>`}
      </section>
    `}_renderNode(e,t,s,i){const r=this._name(e.stat,t),n=this._issuesFor(e.stat),a=n.length>0||this._haIssuesFor(e.stat).length>0,o=n.some(e=>"error"===e.severity)||null!==e.problem,l=this._collapsed.has(e.stat),d=this._dragHandlers(e.stat),c=s.get(e.stat)??null,h=i.get(e.stat);return W`
      <li role="treeitem" aria-expanded=${e.children.length?String(!l):q}>
        <div
          class="node ${this._selected===e.stat?"selected":""} ${this._dropTarget===e.stat?"drop":""} ${o?"has-error":a?"has-warning":""}"
          draggable="true"
          data-stat=${e.stat}
          @dragstart=${t=>this._startDrag(t,{kind:"device",stat:e.stat})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
          @dragover=${d.over}
          @dragleave=${d.leave}
          @drop=${d.drop}
          @click=${()=>{this._selected=e.stat,this.narrow&&(this._dialog={kind:"details"})}}
        >
          ${e.children.length?W`<button
                class="icon toggle"
                aria-label=${r}
                @click=${t=>{t.stopPropagation();const s=new Set(this._collapsed);l?s.delete(e.stat):s.add(e.stat),this._collapsed=s}}
              >
                ${l?"▸":"▾"}
              </button>`:W`<span class="toggle"></span>`}
          <span class="node-name">${r}</span>
          ${a||e.problem?W`<span class="badge" title=${this._badgeTitle(e.stat,n)}>!</span>`:q}
          <span class="node-power">${null===c?q:this._formatValue(c)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions",{name:r})}
            @click=${t=>{t.stopPropagation(),this._dialog={kind:"actions",stat:e.stat}}}
          >
            ${Re("dots")}
          </button>
        </div>
        ${e.children.length&&!l?W`<ul role="group">
              ${e.children.map(e=>this._renderNode(e,t,s,i))}
              ${void 0!==h?W`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power"
                      >${null===h?this._t("none"):this._formatValue(h)}</span
                    >
                  </li>`:q}
            </ul>`:q}
      </li>
    `}_renderCandidates(){const e=this._freeCandidates();return W`
      <section class="card">
        <div class="card-header"><h2>${this._t("free_sensors")}</h2></div>
        <p class="hint">${this._t(this._tabKey("free_sensors_hint"))}</p>
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${e=>this._search=e.target.value}
        />
        ${0===e.length?W`<p class="empty">${this._t(this._tabKey("no_candidates"))}</p>`:W`<ul class="candidates">
              ${e.map(e=>W`<li
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
                  <button
                    @click=${()=>"gas"===this._tab?this._assign("gas",e.stat):this._dialog={kind:"add",stat:e.stat}}
                  >
                    ${this._t("add")}
                  </button>
                </li>`)}
            </ul>`}
        ${this._renderPowerSensors()}
      </section>
    `}_renderPowerSensors(){const e=this._freePowerSensors();if(0===e.length)return q;const t="water"===this._tab;return W`<h3>${this._t(t?"flow_only":"power_only")}</h3>
      <p class="hint">${this._t(t?"flow_only_hint":"power_only_hint")}</p>
      <ul class="candidates power-only">
        ${e.map(e=>W`<li data-stat=${e.stat}>
            <div class="candidate-text">
              <span class="node-name">${e.name||e.stat}</span>
              <span class="sub">${[e.area_name,e.device_name].filter(Boolean).join(" · ")||e.stat}</span>
            </div>
            <button @click=${()=>this._dialog={kind:"integral",stat:e.stat}}>
              ${this._t("create_meter")}
            </button>
          </li>`)}
      </ul>`}_renderDetails(){const e=this._selected,t=this.draft,s=t.find(t=>t.stat_consumption===e);if(!e||!s)return W`<section class="card">
        <div class="card-header"><h2>${this._t("details")}</h2></div>
        <p class="empty">${this._t("select_hint")}</p>
      </section>`;const i=this._info(e),r="water"===this._tab,n=this.hass?Ae(this.hass,s.stat_rate,this._deviceKind()):null,a=null===n?null:r?pt(this.hass,n,this._waterUnit()):ht(this.hass,n),o=pe(t),l=this._values(t),d=Ee(o,l).get(e),c="now"===this._period?void 0:l.get(e)??null,h=this._issuesFor(e),u=(e,t)=>W`<dt>${this._t(e)}</dt>
        <dd>${t||this._t("none")}</dd>`;return W`
      <section class="card">
        <div class="card-header"><h2>${this._name(e,t)}</h2></div>
        <dl>
          ${u("detail_statistic",e)}
          ${u(r?"detail_flow_sensor":"detail_power_sensor",s.stat_rate)}
          ${u("detail_device",i?.device_name)} ${u("detail_area",i?.area_name)}
          ${u(r?"detail_flow":"detail_power",a)}
          ${void 0!==c?u(r?"detail_volume":"detail_energy",null===c?null:this._formatValue(c)):q}
          ${i?.created_helper?u("detail_helper",this._t("created_by")):q}
          ${void 0!==d?u("detail_untracked",null===d?null:this._formatValue(d)):q}
        </dl>
        ${h.length?W`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${h.map(e=>W`<li class=${e.severity}>${this._issueText(e)}</li>`)}
              </ul>`:q}
        ${this._renderHaIssues(e)} ${this._renderSuggestion(e,t)}
      </section>
    `}_renderFooter(){if(0===this._changes.length)return q;const e=this._validation?.diff.length??this._changes.length,t=this._validation?.issues.filter(e=>"error"===e.severity).length??0;return W`<div class="footer">
      <span
        >${1===e?this._t("change_one"):this._t("change_other",{count:ct(this.hass,e)})}</span
      >
      ${t?W`<span class="blocked" title=${this._t("blocked_hint")}
            >${Re("alert")}
            ${1===t?this._t("blocked_one"):this._t("blocked_other",{count:ct(this.hass,t)})}</span
          >`:q}
      <button class="undo-change" title=${this._t("undo_change_hint")} @click=${()=>this._undoChange()}>
        ${Re("undo")} ${this._t("undo_change")}
      </button>
      <button @click=${()=>this._discard()}>${this._t("discard")}</button>
      <button class="primary" @click=${()=>this._openConfirm()}>${this._t("save")}</button>
    </div>`}_renderSuggestion(e,t){const s=this._suggestionFor(e);return s?W`<div class="suggestion-line">
      <p>${Re("lightbulb")} ${this._t("suggestion_text",{parent:this._name(s.parent,t)})}</p>
      <div class="dialog-actions">
        <button class="primary" @click=${()=>this._applySuggestion(s)}>${this._t("suggestion_apply")}</button>
        <button @click=${()=>{this._ignoreSuggestion(s)}}>${this._t("suggestion_ignore")}</button>
      </div>
    </div>`:q}_renderHaIssues(e){const t=this._haIssuesFor(e);return t.length?W`<h3>${this._t("ha_reports")}</h3>
          <ul class="issues ha-issues">
            ${t.map(t=>W`<li class="warning">${bt(this.hass,t,e)}</li>`)}
          </ul>`:q}_issueText(e){const t=`issue_${e.code}`;return lt(t)?this._t(t,{unit:String(e.details.unit??"")}):e.code}_diffText(e){const t=this._diffLine(e);return"water"===e.kind?this._t("diff_water",{text:t}):t}_diffLine(e){const t=e.kind??"electricity",s=this.draftOf(t),i=("water"===t?this._snapshot?.prefs.device_consumption_water:this._snapshot?.prefs.device_consumption)??[],r=this._name(e.stat,e.kind?s:void 0),n=e.to?this._name(e.to,s):"";switch(e.type){case"added":return e.parent?this._t("diff_added_under",{name:r,to:this._name(e.parent,s)}):this._t("diff_added",{name:r});case"removed":return this._t("diff_removed",{name:this._name(e.stat,i)});case"moved":return e.to?this._t("diff_moved",{name:r,to:n}):this._t("diff_moved_top",{name:r});case"renamed":{const t=e.from||this._name(e.stat,i);return e.to?this._t("diff_renamed",{name:t,to:e.to}):this._t("diff_renamed_reset",{name:t})}case"source_added":case"source_removed":return this._t("source_added"===e.type?"diff_source_added":"diff_source_removed",{name:r,role:this._roleLabel(e.role)});default:return this._t("water"===t?"diff_rate_water":"diff_rate",{name:r})}}_roleLabel(e){const t=`role_${e??""}`;return lt(t)?this._t(t):e??""}_sensorList(e,t){const s=this._freeCandidates("").filter(t=>!e.includes(t.stat));return 0===s.length?W`<p class="empty">${this._t("no_candidates")}</p>`:W`<ul class="targets">
      ${s.map(e=>W`<li>
          <button class="target" data-target=${e.stat} @click=${()=>t(e.stat)}>
            ${e.name||e.stat}
          </button>
        </li>`)}
    </ul>`}_renderCheck(e){const t=e.issues.filter(e=>"error"===e.severity),s=e.issues.filter(e=>"warning"===e.severity),i=this._snapshot?.issues??[],r=e=>e.kind??"electricity",n=e=>W`<ul class="issues">
        ${e.map(e=>W`<li class=${e.severity}>
              ${this._name(e.stat)}: ${this._issueText(e)}
              ${"error"===e.severity&&(e=>i.some(t=>t.code===e.code&&t.stat===e.stat&&r(t)===r(e)))(e)?W`<span class="saved-issue">(${this._t("issue_saved")})</span>`:q}
              <button class="link" @click=${()=>this._showIssue(e)}>${this._t("show_block")}</button>
            </li>`)}
      </ul>`;return W`<ul class="diff">
        ${e.diff.map(e=>W`<li>${this._diffText(e)}</li>`)}
      </ul>
      ${t.length?W`<p>${this._t("confirm_errors")}</p>${n(t)}`:q}
      ${s.length?W`<p>${this._t("confirm_warnings")}</p>${n(s)}`:q}
      ${e.rejected?W`<p>${this._t("confirm_rejected")}</p>
            <p class="rejected">${e.rejected}</p>`:q}`}_tabKey(e){return"electricity"===this._tab?e:`${e}_${this._tab}`}_showIssue(e){this._close(),this.setTab(e.kind??"electricity"),this._reveal(e.stat)}_summaryText(e){return Object.entries(e).map(([e,t])=>{const s=`summary_${e}`;return lt(s)?this._t(s,{count:String(t)}):`${e}: ${t}`}).join(", ")}_renderDialog(){return W`<dialog
      @close=${e=>{e.target.open||(this._dialog=null)}}
      @cancel=${()=>{this._dialog=null}}
    >
      ${this._dialog?this._renderDialogContent(this._dialog):q}
    </dialog>`}_close(){this._dialog=null}_targetList(e,t){return 0===e.length?W`<p class="empty">${this._t("no_targets")}</p>`:W`<ul class="targets">
      ${e.map(e=>W`<li>
          <button class="target" data-target=${e??wt} @click=${()=>t(e)}>
            ${null===e?this._t("top_level"):this._name(e)}
          </button>
        </li>`)}
    </ul>`}_renderDialogContent(e){const t=this.draft;switch(e.kind){case"actions":{const s=this._name(e.stat,t);return W`<h2>${s}</h2>
          <div class="dialog-actions column-actions">
            <button @click=${()=>this._dialog={kind:"move",stat:e.stat}}>
              ${this._t("move")}
            </button>
            <button
              @click=${()=>{this._renameValue=t.find(t=>t.stat_consumption===e.stat)?.name??"",this._dialog={kind:"rename",stat:e.stat}}}
            >
              ${this._t("rename")}
            </button>
            ${this._canUseHomeMeter(e.stat)?W`<button
                  @click=${()=>{this._close(),this._change({type:"use_as_home_meter",stat:e.stat})}}
                >
                  ${this._t("use_as_home_meter")}
                </button>`:q}
            <button
              class="danger"
              @click=${()=>{this._close(),this._selected===e.stat&&(this._selected=null),this._change({type:"remove",stat:e.stat,...this._kind()})}}
            >
              ${this._t("remove")}
            </button>
            ${t.some(t=>t.included_in_stat===e.stat)?W`<p class="hint">${this._t("remove_hint")}</p>`:q}
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"move":{const s=this._name(e.stat,t),i=[...fe(t,e.stat,null)?[null]:[],...ve(t,e.stat)];return W`<h2>${this._t("move_title",{name:s})}</h2>
          ${this._targetList(i,t=>{this._close(),this._change({type:"move",stat:e.stat,parent:t,...this._kind()})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"add":{const s=this._candidates().find(t=>t.stat===e.stat),i=s?.name||e.stat,r=[null,...t.map(e=>e.stat_consumption)];return W`<h2>${this._t("add_title",{name:i})}</h2>
          ${s?.power?W`<p class="hint">
                ${this._t("water"===this._tab?"with_flow":"with_power",{entity:s.power})}
              </p>`:q}
          ${this._targetList(r,t=>{this._close(),this._addCandidate(e.stat,t)})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"rename":{const s=this._name(e.stat,t);return W`<h2>${this._t("rename_title",{name:s})}</h2>
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
              @click=${()=>{this._close(),this._change({type:"rename",stat:e.stat,name:this._renameValue.trim()||null,...this._kind()})}}
            >
              ${this._t("ok")}
            </button>
          </div>`}case"confirm":{const t=e.result;return null===t?W`<h2>${this._t("confirm_title")}</h2>
            <p>${this._t("checking")}</p>`:W`<h2>${this._t("confirm_title")}</h2>
          ${this._renderCheck(t)}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!t.valid||this._busy}
              @click=${()=>this._save()}
            >
              ${this._busy?this._t("saving"):this._t("save")}
            </button>
          </div>`}case"backups":return W`<h2>${this._t("backups_title")}</h2>
          <p class="hint">${this._t("backups_hint")}</p>
          <div class="dialog-actions transfer-actions">
            <button @click=${()=>this._export()}>${this._t("export_current")}</button>
            <button @click=${()=>this._pickImportFile()}>${this._t("import_file")}</button>
          </div>
          ${0===e.entries.length?W`<p class="empty">${this._t("backups_empty")}</p>`:W`<ul class="backups">
                ${e.entries.map(e=>W`<li>
                    <div class="candidate-text">
                      <span class="node-name">${mt(this.hass,e.created)}</span>
                      <span class="sub"
                        >${this._summaryText(e.summary)}${e.user_name?` · ${this._t("backup_by",{user:e.user_name})}`:""}</span
                      >
                    </div>
                    <div class="backup-actions">
                      <button @click=${()=>this._export(e)}>${this._t("export")}</button>
                      <button
                        @click=${()=>this._dialog={kind:"restore",backup:e,undo:!1}}
                      >
                        ${this._t("restore")}
                      </button>
                    </div>
                  </li>`)}
              </ul>`}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"restore":{const t=mt(this.hass,e.backup.created);return W`<h2>${this._t(e.undo?"undo":"restore")}</h2>
          <p>${this._t(e.undo?"undo_confirm":"restore_confirm",{date:t})}</p>
          ${this._changes.length?W`<p class="warning">${this._t("draft_lost")}</p>`:q}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._restore(e.backup)}
            >
              ${this._t("restore")}
            </button>
          </div>`}case"import":{const t=e.result,s=W`<h2>${this._t("import_title",{file:e.file})}</h2>`;return null===t?W`${s}
            <p>${this._t("checking")}</p>`:W`${s}
          ${t.changed?this._renderCheck(t):W`<p>${this._t("import_unchanged")}</p>`}
          ${t.changed&&this._changes.length?W`<p class="warning">${this._t("draft_lost")}</p>`:q}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!t.valid||!t.changed||this._busy}
              @click=${()=>this._import(e.document)}
            >
              ${this._t("import")}
            </button>
          </div>`}case"source":{const t=Lt(e.role),s="import"===t||"export"===t||"water"===t||"gas"===t,i=this.draftSources.find(t=>t.stat_energy_from===e.stat||t.stat_energy_to===e.stat),r=!("grid"!==i?.type||i.stat_energy_from&&i.stat_energy_to||i.stat_rate||i.power_config);return W`<h2>${e.label}</h2>
          ${e.stat?W`<p>${this._name(e.stat)}</p>`:q}
          ${e.stat?this._renderHaIssues(e.stat):q}
          ${e.stat&&t&&r?W`<p class="hint">${this._t("source_last_meter")}</p>`:q}
          <div class="dialog-actions column-actions">
            ${t?W`<button
                  @click=${()=>this._dialog={kind:"assign",role:t,replace:s?e.stat:null}}
                >
                  ${this._t(e.stat&&"production"!==t&&"battery"!==t?"source_replace":"source_assign")}
                </button>`:q}
            ${e.stat&&t?W`<button
                  class="danger"
                  @click=${()=>{this._close(),this._change({type:"unassign_source",stat:e.stat})}}
                >
                  ${this._t("source_remove")}
                </button>`:q}
            <button
              @click=${()=>{this._close(),Rt("/config/energy")}}
            >
              ${this._t("open_energy_settings")}
            </button>
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"assign":return W`<h2>${this._t("assign_title",{role:this._roleLabel(e.role)})}</h2>
          <p class="hint">
            ${this._t("water"===e.role?"assign_hint_water":"gas"===e.role?"assign_hint_gas":"assign_hint")}
          </p>
          ${"import"===e.role?this._powerOnlyGridStats().map(e=>this._renderHaIssues(e)):q}
          ${this._sensorList([],t=>this._assign(e.role,t,e.replace??null))}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"battery":return W`<h2>${this._t("battery_title")}</h2>
          <p class="hint">${this._t("battery_hint",{name:this._name(e.discharge)})}</p>
          ${this._sensorList([e.discharge],t=>{this._close(),this._change({type:"assign_source",role:"battery",stat:e.discharge,stat_to:t})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"integral":{const t=this._info(e.stat)?.name||e.stat,s="water"===this._tab;return W`<h2>${this._t(s?"create_water_meter_title":"create_meter_title",{name:t})}</h2>
          <p>
            ${this._t(s?"create_water_meter_text":"create_meter_text",{helper:this._meterName(e.stat)})}
          </p>
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._createMeter(e.stat)}
            >
              ${this._busy?this._t("creating"):this._t("create_meter")}
            </button>
          </div>`}case"menu":return W`<div class="dialog-actions column-actions">
          <button ?disabled=${!this._snapshot} @click=${()=>this._dialog={kind:"candidates"}}>
            ${this._t("free_sensors")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
            ${Re("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
            ${Re("history")} ${this._t("backups")}
          </button>
          <button
            @click=${()=>{this._close(),this._reload()}}
          >
            ${Re("refresh")} ${this._t("reload")}
          </button>
          <button @click=${()=>this._close()}>${this._t("close")}</button>
        </div>`;case"candidates":return W`${this._renderCandidates()}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"export":return W`<h2>${this._t("export_title")}</h2>
          <label class="check">
            <input
              type="checkbox"
              .checked=${e.hideNames}
              @change=${e=>this._dialog={kind:"export",hideNames:e.target.checked}}
            />
            ${this._t("export_hide_names")}
          </label>
          <p class="hint">${this._t("export_hide_hint")}</p>
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button class="primary" @click=${()=>{this._saveImage(e.hideNames)}}>
              ${this._t("export_save")}
            </button>
          </div>`;case"details":return W`${this._renderDetails()}
          <div class="dialog-actions">
            ${this._selected?W`<button
                  @click=${()=>this._dialog={kind:"actions",stat:this._selected}}
                >
                  ${this._t("actions",{name:this._name(this._selected)})}
                </button>`:q}
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`}}static styles=n`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      box-sizing: border-box;
      container: panel / inline-size;
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
    .tabs {
      display: flex;
      gap: 4px;
      padding: 12px 16px 0;
    }
    .tabs button {
      border: none;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: var(--secondary-text-color);
      padding: 8px 12px;
    }
    .tabs button.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }
    .content {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(360px, 3fr) minmax(240px, 1fr);
      grid-template-areas: "free main details";
      gap: 16px;
      padding: 16px;
      align-items: start;
    }
    .content > .free {
      grid-area: free;
    }
    .content > .main {
      grid-area: main;
    }
    .content > .details {
      grid-area: details;
    }
    /* Not enough room for three columns: details go below the free sensors. */
    @container panel (max-width: 960px) {
      .content {
        grid-template-columns: minmax(220px, 1fr) minmax(0, 2.5fr);
        grid-template-areas:
          "free main"
          "details main";
      }
    }
    .content.narrow {
      grid-template-columns: 1fr;
      grid-template-areas: "main";
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
    .backup-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }
    /* Two long buttons: they wrap on phones instead of overflowing. */
    .transfer-actions {
      flex-wrap: wrap;
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
    /* Names wrap in narrow columns; the line below them is cut. */
    .candidate-text .node-name {
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .candidate-text .sub {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    dl {
      display: grid;
      /* Long labels wrap instead of squeezing the values to one letter. */
      grid-template-columns: fit-content(45%) minmax(0, 1fr);
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
      flex-wrap: wrap;
      gap: 4px;
    }
    .diagram-card .card-header {
      flex-wrap: wrap;
    }
    .periods,
    .orientation {
      display: flex;
    }
    .periods {
      margin-left: auto;
    }
    .orientation {
      margin-right: 4px;
    }
    .periods button,
    .orientation button {
      border-radius: 0;
      margin-left: -1px;
      padding: 4px 10px;
      color: var(--primary-text-color);
    }
    .periods button:first-child,
    .orientation button:first-child {
      border-radius: 8px 0 0 8px;
    }
    .periods button:last-child,
    .orientation button:last-child {
      border-radius: 0 8px 8px 0;
    }
    .block .suggestion {
      position: absolute;
      top: 4px;
      right: 36px;
      color: var(--warning-color, #ffa600);
    }
    .block .suggestion .mdi,
    .suggestion-line .mdi,
    .apply-all .mdi {
      width: 16px;
      height: 16px;
      vertical-align: -3px;
      fill: currentColor;
    }
    .block.suggested {
      border-style: dashed;
    }
    label.check {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 8px 0;
    }
    .periods button.active,
    .coverage-toggle.active,
    .orientation button.active {
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
      /* Window height minus header, tabs, card header, hint and search. */
      height: calc(100vh - 365px);
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
      height: calc(100vh - 290px);
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
    .block.dim {
      opacity: 0.35;
    }
    .block.match {
      outline: 2px solid var(--primary-color);
      outline-offset: 3px;
    }
    .block.match.current {
      outline-width: 4px;
    }
    .find {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .find input {
      flex: 0 1 260px;
      min-width: 0;
    }
    .find-count {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    /* Sticks to the bottom of the panel, next to (not under) the sidebar. */
    .footer {
      position: sticky;
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
    .footer > span:first-child {
      flex: 1;
    }
    .footer .blocked {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--error-color);
    }
    .saved-issue {
      color: var(--secondary-text-color);
    }
    ul.issues button.link {
      margin-left: 4px;
    }
    dialog label {
      display: block;
      margin-top: 12px;
    }
    .rejected {
      color: var(--error-color);
      overflow-wrap: anywhere;
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
  `}customElements.get(vt)||customElements.define(vt,Ut);export{yt as DOMAIN,Ut as EnergyFlowMapperPanel,At as FIND_ZOOM,kt as MAX_ZOOM,xt as MIN_ZOOM,vt as PANEL_TAG,Tt as TABS,$t as TOAST_MS,St as TOUCH_DRAG_LIFT,Et as TOUCH_DRAG_SCALE,Lt as assignRole,Ft as downloadBlob,Pt as downloadJson,ft as errorText,It as fileStamp};
