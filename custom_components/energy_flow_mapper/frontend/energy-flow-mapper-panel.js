/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const e=globalThis,t=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),r=new WeakMap;let i=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o;const s=this.t;if(t&&void 0===e){const t=void 0!==s&&1===s.length;t&&(e=r.get(s)),void 0===e&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&r.set(s,e))}return e}toString(){return this.cssText}};const n=(e,...t)=>{const r=1===e.length?e[0]:t.reduce((t,s,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if("number"==typeof e)return e;throw Error("Value passed to 'css' function must be a 'css' function result: "+e+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[r+1],e[0]);return new i(r,e,s)},o=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t="";for(const s of e.cssRules)t+=s.cssText;return(e=>new i("string"==typeof e?e:e+"",void 0,s))(t)})(e):e,{is:a,defineProperty:l,getOwnPropertyDescriptor:u,getOwnPropertyNames:d,getOwnPropertySymbols:c,getPrototypeOf:_}=Object,h=globalThis,p=h.trustedTypes,m=p?p.emptyScript:"",g=h.reactiveElementPolyfillSupport,f=(e,t)=>e,v={toAttribute(e,t){switch(t){case Boolean:e=e?m:null;break;case Object:case Array:e=null==e?e:JSON.stringify(e)}return e},fromAttribute(e,t){let s=e;switch(t){case Boolean:s=null!==e;break;case Number:s=null===e?null:Number(e);break;case Object:case Array:try{s=JSON.parse(e)}catch(e){s=null}}return s}},b=(e,t)=>!a(e,t),w={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),h.litPropertyMetadata??=new WeakMap;let y=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=w){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){const s=Symbol(),r=this.getPropertyDescriptor(e,s,t);void 0!==r&&l(this.prototype,e,r)}}static getPropertyDescriptor(e,t,s){const{get:r,set:i}=u(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){const n=r?.call(this);i?.call(this,t),this.requestUpdate(e,n,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??w}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const e=_(this);e.finalize(),void 0!==e.l&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const e=this.properties,t=[...d(e),...c(e)];for(const s of t)this.createProperty(s,e[s])}const e=this[Symbol.metadata];if(null!==e){const t=litPropertyMetadata.get(e);if(void 0!==t)for(const[e,s]of t)this.elementProperties.set(e,s)}this._$Eh=new Map;for(const[e,t]of this.elementProperties){const s=this._$Eu(e,t);void 0!==s&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const t=[];if(Array.isArray(e)){const s=new Set(e.flat(1/0).reverse());for(const e of s)t.unshift(o(e))}else void 0!==e&&t.push(o(e));return t}static _$Eu(e,t){const s=t.attribute;return!1===s?void 0:"string"==typeof s?s:"string"==typeof e?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),void 0!==this.renderRoot&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){const e=new Map,t=this.constructor.elementProperties;for(const s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const s=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((s,r)=>{if(t)s.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const t of r){const r=document.createElement("style"),i=e.litNonce;void 0!==i&&r.setAttribute("nonce",i),r.textContent=t.cssText,s.appendChild(r)}})(s,this.constructor.elementStyles),s}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){const s=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,s);if(void 0!==r&&!0===s.reflect){const i=(void 0!==s.converter?.toAttribute?s.converter:v).toAttribute(t,s.type);this._$Em=e,null==i?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(e,t){const s=this.constructor,r=s._$Eh.get(e);if(void 0!==r&&this._$Em!==r){const e=s.getPropertyOptions(r),i="function"==typeof e.converter?{fromAttribute:e.converter}:void 0!==e.converter?.fromAttribute?e.converter:v;this._$Em=r;const n=i.fromAttribute(t,e.type);this[r]=n??this._$Ej?.get(r)??n,this._$Em=null}}requestUpdate(e,t,s,r=!1,i){if(void 0!==e){const n=this.constructor;if(!1===r&&(i=this[e]),s??=n.getPropertyOptions(e),!((s.hasChanged??b)(i,t)||s.useDefault&&s.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(n._$Eu(e,s))))return;this.C(e,t,s)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:r,wrapped:i},n){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,n??t??this[e]),!0!==i||void 0!==n)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const e=this.scheduleUpdate();return null!=e&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}const e=this.constructor.elementProperties;if(e.size>0)for(const[t,s]of e){const{wrapped:e}=s,r=this[t];!0!==e||this._$AL.has(t)||void 0===r||this.C(t,void 0,s,r)}}let e=!1;const t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[f("elementProperties")]=new Map,y[f("finalized")]=new Map,g?.({ReactiveElement:y}),(h.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const k=globalThis,$=e=>e,x=k.trustedTypes,S=x?x.createPolicy("lit-html",{createHTML:e=>e}):void 0,z="$lit$",E=`lit$${Math.random().toFixed(9).slice(2)}$`,A="?"+E,C=`<${A}>`,M=document,T=()=>M.createComment(""),D=e=>null===e||"object"!=typeof e&&"function"!=typeof e,L=Array.isArray,H="[ \t\n\f\r]",q=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,P=/-->/g,N=/>/g,I=RegExp(`>|${H}(?:([^\\s"'>=/]+)(${H}*=${H}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,R=/"/g,F=/^(?:script|style|textarea|title)$/i,G=e=>(t,...s)=>({_$litType$:e,strings:t,values:s}),O=G(1),Z=G(2),B=Symbol.for("lit-noChange"),W=Symbol.for("lit-nothing"),U=new WeakMap,V=M.createTreeWalker(M,129);function K(e,t){if(!L(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(t):t}const Q=(e,t)=>{const s=e.length-1,r=[];let i,n=2===t?"<svg>":3===t?"<math>":"",o=q;for(let t=0;t<s;t++){const s=e[t];let a,l,u=-1,d=0;for(;d<s.length&&(o.lastIndex=d,l=o.exec(s),null!==l);)d=o.lastIndex,o===q?"!--"===l[1]?o=P:void 0!==l[1]?o=N:void 0!==l[2]?(F.test(l[2])&&(i=RegExp("</"+l[2],"g")),o=I):void 0!==l[3]&&(o=I):o===I?">"===l[0]?(o=i??q,u=-1):void 0===l[1]?u=-2:(u=o.lastIndex-l[2].length,a=l[1],o=void 0===l[3]?I:'"'===l[3]?R:j):o===R||o===j?o=I:o===P||o===N?o=q:(o=I,i=void 0);const c=o===I&&e[t+1].startsWith("/>")?" ":"";n+=o===q?s+C:u>=0?(r.push(a),s.slice(0,u)+z+s.slice(u)+E+c):s+E+(-2===u?t:c)}return[K(e,n+(e[s]||"<?>")+(2===t?"</svg>":3===t?"</math>":"")),r]};class J{constructor({strings:e,_$litType$:t},s){let r;this.parts=[];let i=0,n=0;const o=e.length-1,a=this.parts,[l,u]=Q(e,t);if(this.el=J.createElement(l,s),V.currentNode=this.el.content,2===t||3===t){const e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;null!==(r=V.nextNode())&&a.length<o;){if(1===r.nodeType){if(r.hasAttributes())for(const e of r.getAttributeNames())if(e.endsWith(z)){const t=u[n++],s=r.getAttribute(e).split(E),o=/([.?@])?(.*)/.exec(t);a.push({type:1,index:i,name:o[2],strings:s,ctor:"."===o[1]?se:"?"===o[1]?re:"@"===o[1]?ie:te}),r.removeAttribute(e)}else e.startsWith(E)&&(a.push({type:6,index:i}),r.removeAttribute(e));if(F.test(r.tagName)){const e=r.textContent.split(E),t=e.length-1;if(t>0){r.textContent=x?x.emptyScript:"";for(let s=0;s<t;s++)r.append(e[s],T()),V.nextNode(),a.push({type:2,index:++i});r.append(e[t],T())}}}else if(8===r.nodeType)if(r.data===A)a.push({type:2,index:i});else{let e=-1;for(;-1!==(e=r.data.indexOf(E,e+1));)a.push({type:7,index:i}),e+=E.length-1}i++}}static createElement(e,t){const s=M.createElement("template");return s.innerHTML=e,s}}function Y(e,t,s=e,r){if(t===B)return t;let i=void 0!==r?s._$Co?.[r]:s._$Cl;const n=D(t)?void 0:t._$litDirective$;return i?.constructor!==n&&(i?._$AO?.(!1),void 0===n?i=void 0:(i=new n(e),i._$AT(e,s,r)),void 0!==r?(s._$Co??=[])[r]=i:s._$Cl=i),void 0!==i&&(t=Y(e,i._$AS(e,t.values),i,r)),t}class X{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:t},parts:s}=this._$AD,r=(e?.creationScope??M).importNode(t,!0);V.currentNode=r;let i=V.nextNode(),n=0,o=0,a=s[0];for(;void 0!==a;){if(n===a.index){let t;2===a.type?t=new ee(i,i.nextSibling,this,e):1===a.type?t=new a.ctor(i,a.name,a.strings,this,e):6===a.type&&(t=new ne(i,this,e)),this._$AV.push(t),a=s[++o]}n!==a?.index&&(i=V.nextNode(),n++)}return V.currentNode=M,r}p(e){let t=0;for(const s of this._$AV)void 0!==s&&(void 0!==s.strings?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}}class ee{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,r){this.type=2,this._$AH=W,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const t=this._$AM;return void 0!==t&&11===e?.nodeType&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=Y(this,e,t),D(e)?e===W||null==e||""===e?(this._$AH!==W&&this._$AR(),this._$AH=W):e!==this._$AH&&e!==B&&this._(e):void 0!==e._$litType$?this.$(e):void 0!==e.nodeType?this.T(e):(e=>L(e)||"function"==typeof e?.[Symbol.iterator])(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==W&&D(this._$AH)?this._$AA.nextSibling.data=e:this.T(M.createTextNode(e)),this._$AH=e}$(e){const{values:t,_$litType$:s}=e,r="number"==typeof s?this._$AC(e):(void 0===s.el&&(s.el=J.createElement(K(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===r)this._$AH.p(t);else{const e=new X(r,this),s=e.u(this.options);e.p(t),this.T(s),this._$AH=e}}_$AC(e){let t=U.get(e.strings);return void 0===t&&U.set(e.strings,t=new J(e)),t}k(e){L(this._$AH)||(this._$AH=[],this._$AR());const t=this._$AH;let s,r=0;for(const i of e)r===t.length?t.push(s=new ee(this.O(T()),this.O(T()),this,this.options)):s=t[r],s._$AI(i),r++;r<t.length&&(this._$AR(s&&s._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){const t=$(e).nextSibling;$(e).remove(),e=t}}setConnected(e){void 0===this._$AM&&(this._$Cv=e,this._$AP?.(e))}}class te{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,r,i){this.type=1,this._$AH=W,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=i,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=W}_$AI(e,t=this,s,r){const i=this.strings;let n=!1;if(void 0===i)e=Y(this,e,t,0),n=!D(e)||e!==this._$AH&&e!==B,n&&(this._$AH=e);else{const r=e;let o,a;for(e=i[0],o=0;o<i.length-1;o++)a=Y(this,r[s+o],t,o),a===B&&(a=this._$AH[o]),n||=!D(a)||a!==this._$AH[o],a===W?e=W:e!==W&&(e+=(a??"")+i[o+1]),this._$AH[o]=a}n&&!r&&this.j(e)}j(e){e===W?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class se extends te{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===W?void 0:e}}class re extends te{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==W)}}class ie extends te{constructor(e,t,s,r,i){super(e,t,s,r,i),this.type=5}_$AI(e,t=this){if((e=Y(this,e,t,0)??W)===B)return;const s=this._$AH,r=e===W&&s!==W||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,i=e!==W&&(s===W||r);r&&this.element.removeEventListener(this.name,this,s),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}}class ne{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){Y(this,e)}}const oe=k.litHtmlPolyfillSupport;oe?.(J,ee),(k.litHtmlVersions??=[]).push("3.3.3");const ae=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */let le=class extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){const t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=((e,t,s)=>{const r=s?.renderBefore??t;let i=r._$litPart$;if(void 0===i){const e=s?.renderBefore??null;r._$litPart$=i=new ee(t.insertBefore(T(),e),e,void 0,s??{})}return i._$AI(e),i})(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return B}};le._$litElement$=!0,le.finalized=!0,ae.litElementHydrateSupport?.({LitElement:le});const ue=ae.litElementPolyfillSupport;ue?.({LitElement:le}),(ae.litElementVersions??=[]).push("4.2.2");let de=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,s){this._$Ct=e,this._$AM=t,this._$Ci=s}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ce={},_e=(e=>(...t)=>({_$litDirective$:e,values:t}))(class extends de{constructor(){super(...arguments),this.key=W}render(e,t){return this.key=e,t}update(e,[t,s]){return t!==this.key&&(((e,t=ce)=>{e._$AH=t;
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */})(e),this.key=t),s}}),he={type:"grid",stat_energy_from:null,stat_energy_to:null,stat_cost:null,entity_energy_price:null,number_energy_price:null,stat_compensation:null,entity_energy_price_export:null,number_energy_price_export:null,cost_adjustment_day:0},pe={type:"water",stat_energy_from:null,stat_cost:null,entity_energy_price:null,number_energy_price:null};function me(e,t,s){const r="string"==typeof s?s.trim():s;r?e[t]=r:delete e[t]}const ge=new Set(["create_group","rename_group","set_group","dissolve_group","move_group"]);function fe(e){return"assign_source"===e.type||"unassign_source"===e.type||"set_source_rate"===e.type}function ve(e){return fe(e)?null:"use_as_home_meter"===e.type?"electricity":e.kind??"electricity"}function be(e,t,s,r="electricity"){const i=structuredClone(e),n=structuredClone(t);for(const e of s){if(fe(e)){Ke(n,e);continue}if(ve(e)!==r||ge.has(e.type))continue;if(!("stat"in e))continue;const t=i.findIndex(t=>t.stat_consumption===e.stat);if("add"===e.type){if(-1!==t)continue;const s={stat_consumption:e.stat};me(s,"stat_rate",e.stat_rate),me(s,"name",e.name),me(s,"included_in_stat",e.parent),i.push(s);continue}if(-1!==t)if("move"===e.type)me(i[t],"included_in_stat",e.parent);else if("rename"===e.type)me(i[t],"name",e.name);else if("set_rate"===e.type)me(i[t],"stat_rate",e.stat_rate);else if("remove"===e.type||"use_as_home_meter"===e.type){if("use_as_home_meter"===e.type){if(n.some(e=>"home"===e.type))continue;const s=i[t];n.push({type:"home",stat_energy_to:e.stat,...s.stat_rate?{stat_rate:s.stat_rate}:{},...s.name?{name:s.name}:{}})}const[s]=i.splice(t,1),r=new Set(i.map(e=>e.stat_consumption));for(const t of i)if(t.included_in_stat===e.stat){const e=s.included_in_stat;me(t,"included_in_stat",void 0!==e&&r.has(e)&&e!==t.stat_consumption?e:void 0)}}}return{devices:i,sources:n}}function we(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,{stat:s.stat_consumption,device:s,children:[],problem:null});const s=function(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,s.included_in_stat??null);return t}(e),r=function(e){const t=new Set,s=new Set;for(const r of e.keys()){const i=[],n=new Map;let o=r;for(;null!==o&&e.has(o)&&!s.has(o);){const s=n.get(o);if(void 0!==s){i.slice(s).forEach(e=>t.add(e));break}n.set(o,i.length),i.push(o),o=e.get(o)??null}i.forEach(e=>s.add(e))}return t}(s),i=[];for(const[e,n]of t){const o=s.get(e)??null;r.has(e)?(n.problem="cycle",i.push(n)):null===o?i.push(n):t.has(o)?t.get(o).children.push(n):(n.problem="missing_parent",i.push(n))}return i}function ye(e){return e.flatMap(e=>[e,...ye(e.children)])}function ke(e,t){const s=new Set([t]);let r=!0;for(;r;){r=!1;for(const t of e){const e=t.included_in_stat;e&&s.has(e)&&!s.has(t.stat_consumption)&&(s.add(t.stat_consumption),r=!0)}}return s}function $e(e,t,s){const r=e.find(e=>e.stat_consumption===t);return void 0!==r&&((r.included_in_stat??null)!==s&&(null===s||!ke(e,t).has(s)))}function xe(e,t,s,r){const i=new Set(e.map(e=>e.stat_consumption));return t.filter(t=>t.kind===r&&!(e=>s.some(t=>t.kind===e.kind&&t.stat===e.stat&&t.parent===e.parent))(t)&&i.has(t.stat)&&i.has(t.parent)&&!ke(e,t.parent).has(t.stat)&&$e(e,t.stat,t.parent))}function Se(e,t){return e.map(e=>e.stat_consumption).filter(s=>$e(e,t,s))}function ze(e,t){const s=new Map,r=new Set;for(const i of e){const e=i.stat_consumption,n=t[e],o=i.name||(n?.energy_entity_name?n.energy_name:null);if(!o)continue;i.name&&r.add(e);const a=s.get(o)??new Set;a.add(e),s.set(o,a)}const i=new Set;for(const e of s.values())if(e.size>1)for(const t of e)r.has(t)||i.add(t);return i}const Ee={mW:.001,W:1,kW:1e3,MW:1e6,GW:1e9,TW:1e12},Ae=3.785411784,Ce={"mL/s":.06,"L/s":60,"L/min":1,"L/h":1/60,"m³/s":6e4,"m³/min":1e3,"m³/h":1e3/60,"ft³/min":28.316846592,"gal/min":Ae,"gal/h":Ae/60,"gal/d":Ae/1440};function Me(e,t,s,r){const i=t?e.states[t]:void 0;if(void 0===i)return null;const n=Number.parseFloat(i.state),o=s[i.attributes.unit_of_measurement??r];return Number.isFinite(n)&&void 0!==o?n*o:null}function Te(e,t){return Me(e,t,Ee,"W")}function De(e,t,s){return"water"===s?function(e,t){return Me(e,t,Ce,"L/min")}(e,t):Te(e,t)}function Le(e){return"string"==typeof e&&e?e:void 0}function He(e,t,s){const r=t?function(e,t,s="electricity"){const r=Le(t.stat_rate);if(void 0!==r)return De(e,r,s);const i=t.power_config??{},n=Le(i.stat_rate);if(void 0!==n)return De(e,n,s);const o=Le(i.stat_rate_inverted);if(void 0!==o){const t=De(e,o,s);return null===t||0===t?t:-t}const a=De(e,Le(i.stat_rate_from),s),l=De(e,Le(i.stat_rate_to),s);return null===a||null===l?null:a-l}(e,t,"water"===s?"water":"electricity"):null;if(null===r)return null;switch(s){case"import":case"discharge":case"production":return Math.max(r,0);case"export":case"charge":return Math.max(-r,0);case"home":case"water":return 0===r?0:r;default:return null}}function qe(e,t){const s=new Map;for(const r of ye(e)){if(0===r.children.length)continue;const e=t.get(r.stat)??null;s.set(r.stat,null===e?null:e-r.children.reduce((e,s)=>e+(t.get(s.stat)??0),0))}return s}const Pe={grid:["import","export"],solar:["production",null],battery:["discharge","charge"],gas:["gas",null],water:["water",null],home:["home","home"]};function Ne(e){return"water"===e.type||"gas"===e.type?e.type:"electricity"}const Ie=["stat_rate","stat_rate_inverted","stat_rate_from","stat_rate_to"];function je(e){const t=e.power_config;return[e.stat_rate,...Ie.map(e=>t?.[e])].filter(e=>"string"==typeof e)}function Re(e,t){const s=[];for(const r of e){if(void 0!==t&&Ne(r)!==t)continue;const[e,i]=Pe[r.type]??["consumption",null],n=Ue(r.power_config),o={..."string"==typeof r.stat_rate?{stat_rate:r.stat_rate}:{},...null===n?{}:{power_config:n}};r.stat_energy_from&&s.push({type:r.type,role:e,stat:r.stat_energy_from,name:r.name,...o}),null!==i&&r.stat_energy_to&&s.push({type:r.type,role:i,stat:r.stat_energy_to,name:r.name,...o})}return s}const Fe=["stat_energy_from","stat_energy_to"],Ge=["grid","solar","battery","gas","water","home"],Oe=["stat_energy_from","stat_energy_to","stat_rate","power_config"];function Ze(e,t,s){if(void 0===s)return!0;if("home"===e.type)return"home"===s;const[r,i]=Pe[e.type]??[null,null];return("stat_energy_from"===t?r:i)===s}const Be=[["stat_rate"],["stat_rate_inverted"],["stat_rate_from","stat_rate_to"]];function We(e){if("object"!=typeof e||null===e||Array.isArray(e))return!1;const t=Object.keys(e);return Be.some(e=>e.length===t.length&&e.every(e=>t.includes(e)))&&Object.values(e).every(e=>"string"==typeof e&&""!==e)}function Ue(e){return We(e)?{...e}:null}function Ve(e){return"water"===e?"water":"electricity"}function Ke(e,t){if("set_source_rate"===t.type)return void function(e,t){const s=e.find(e=>Ge.includes(e.type)&&Fe.some(s=>e[s]===t.stat&&Ze(e,s,t.role)));if(void 0===s)return;const r=t.power_config??null;if("grid"===s.type||"battery"===s.type){if(t.stat_rate||null!==r&&!We(r))return;return delete s.stat_rate,void(null===r?delete s.power_config:s.power_config=structuredClone(r))}if(null!==r)return;const i=t.stat_rate?.trim();i?s.stat_rate=i:delete s.stat_rate}(e,t);if("assign_source"===t.type){if("home"===t.role){const s=e.find(e=>"home"===e.type);s?s.stat_energy_to=t.stat:e.push({type:"home",stat_energy_to:t.stat})}else if("import"===t.role||"export"===t.role){const s="import"===t.role?"stat_energy_from":"stat_energy_to",r=e.filter(e=>"grid"===e.type);let i=t.replace?r.find(e=>e[s]===t.replace):r[0];if(void 0===i){if(t.replace)return;i=structuredClone(he),e.push(i)}i[s]=t.stat}else if("production"===t.role)e.push({type:"solar",stat_energy_from:t.stat,config_entry_solar_forecast:null});else if("battery"===t.role&&t.stat_to)e.push({type:"battery",stat_energy_from:t.stat,stat_energy_to:t.stat_to});else if("water"===t.role||"gas"===t.role){const s=t.role;let r=t.replace?e.find(e=>e.type===s&&e.stat_energy_from===t.replace):void 0;if(void 0===r){if(t.replace)return;r={...structuredClone(pe),type:s},e.push(r)}r.stat_energy_from=t.stat}return}const s=e.map((e,s)=>({index:s,keys:Ge.includes(e.type)?Fe.filter(s=>e[s]===t.stat&&Ze(e,s,t.role)):[]})).filter(e=>e.keys.length>0),r=s.find(t=>"home"!==e[t.index].type)??s[0];if(void 0===r)return;const i=e[r.index];if("grid"===i.type){for(const e of r.keys)i[e]=null;Oe.every(e=>{return!(t=i[e])||"object"==typeof t&&0===Object.keys(t).length;var t})&&e.splice(r.index,1)}else e.splice(r.index,1)}function Qe(e,t,s=[]){return be(s,e,t,"electricity").sources}function Je(e){return e.filter(e=>"solar"===e.type&&"string"==typeof e.stat_energy_from).map(e=>e.stat_energy_from)}function Ye(e,t,s){const r=new Set(t.map(e=>e.stat_consumption)),i=new Map;for(const t of Je(e)){const e=s[t];void 0!==e&&r.has(e)&&i.set(e,[...i.get(e)??[],t])}return i}const Xe="Roboto, Noto, system-ui, sans-serif";function et(e){return e.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}const tt="#039be5";function st(e){const t=e.dashed?` stroke-dasharray="${2*e.width} ${1.5*e.width}"`:"";return`<path d="${et(e.d)}" fill="none" stroke="${e.color}" stroke-width="${e.width}"${t}/>`+(e.head?`<polygon points="${et(e.head)}" fill="${e.color}"/>`:"")}function rt(e,t){return{width:Math.max(e.width,Math.ceil(48+7*t.length)),height:e.height+40}}function it(e,t,s,r){const{width:i,height:n}=rt(e,r.footer);return[`<svg xmlns="http://www.w3.org/2000/svg" width="${i}" height="${n}" viewBox="0 0 ${i} ${n}">`,`<rect width="100%" height="100%" fill="${r.theme.background}"/>`,...e.frames.map(e=>function(e,t){const s=t.theme.group??t.theme.secondary;return`<rect class="frame" x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="14" fill="${s}" fill-opacity="0.05" stroke="${s}" stroke-width="1.5" stroke-dasharray="6 4"/>`}(e,r)),...s.map(st),...t.map((e,t)=>function(e,t,s){const{x:r,y:i,w:n,h:o}=e.block,{theme:a}=s,l=(e.sub??"").split("\n").filter(Boolean);e.area&&(l[0]=l.length?`${l[0]} · ${e.area}`:e.area);const u=i+o/2+5-10*l.length,d="untracked"===e.block.kind||"placeholder"===e.block.kind||"group"===e.block.kind;return[`<clipPath id="c${t}"><rect x="${r+10}" y="${i}" width="${n-20}" height="${o}"/></clipPath>`,`<rect x="${r}" y="${i}" width="${n}" height="${o}" rx="10" fill="${a.card}" stroke="${e.warn?"#ffa600":a.divider}" stroke-width="${e.warn?2:1}"${d?' stroke-dasharray="6 4"':""}/>`,`<rect x="${r}" y="${i+8}" width="4" height="${o-16}" rx="2" fill="${e.color}"/>`,`<g clip-path="url(#c${t})">`,`<text x="${r+14}" y="${u}" font-family="${Xe}" font-size="14" font-weight="500" fill="${a.text}">${et(e.title)}</text>`,...l.map((e,t)=>`<text x="${r+14}" y="${u+19+15*t}" font-family="${Xe}" font-size="12" fill="${a.secondary}">${et(e)}</text>`),"</g>",e.mark?`<path d="${et(e.mark)}" transform="translate(${r+6} ${i+4}) scale(0.5833)" fill="none" stroke="${a.secondary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`:"",e.hidden?`<text x="${r+n-10}" y="${i+o-8}" text-anchor="end" font-family="${Xe}" font-size="11" fill="${a.secondary}">▸ +${e.hidden}</text>`:"",e.warn?`<circle cx="${r+n-14}" cy="${i+14}" r="8" fill="#ffa600"/><text x="${r+n-14}" y="${i+18}" text-anchor="middle" font-family="${Xe}" font-size="12" font-weight="700" fill="#ffffff">!</text>`:"",e.info?(c=r+n-(e.warn?34:14),_=i+14,`<circle class="info" cx="${c}" cy="${_}" r="8" fill="none" stroke="${tt}" stroke-width="1.5"/><text x="${c}" y="${_+4}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="12" font-style="italic" font-weight="700" fill="${tt}">i</text>`):""].join("");var c,_}(e,t,r)),`<text x="24" y="${e.height+20+4}" font-family="${Xe}" font-size="12" fill="${r.theme.secondary}">${et(r.footer)}</text>`,"</svg>"].join("")}function nt(e,t){const s=e.filter(e=>e.block.kind===t).sort((e,t)=>e.block.y-t.block.y||e.block.x-t.block.x);return new Map(s.map((e,t)=>[e,t+1]))}async function ot(e,t,s,r=2){const i=function(e,t,s=2){const r=Math.max(e,1),i=Math.max(t,1);return Math.min(s,16384/r,16384/i,.999*Math.sqrt(16777216/(r*i)))}(t,s,r),n=URL.createObjectURL(new Blob([e],{type:"image/svg+xml"}));try{const e=new Image;await new Promise((t,s)=>{e.onload=()=>t(),e.onerror=()=>s(new Error("The diagram could not be drawn")),e.src=n});const r=document.createElement("canvas");r.width=Math.round(t*i),r.height=Math.round(s*i);const o=r.getContext("2d");if(!o)throw new Error("The diagram could not be drawn");return o.scale(i,i),o.drawImage(e,0,0),await new Promise((e,t)=>r.toBlob(s=>s?e(s):t(new Error("The diagram could not be drawn")),"image/png"))}finally{URL.revokeObjectURL(n)}}const at="group:";function lt(e){return`${at}${e}`}function ut(){const e=crypto.getRandomValues(new Uint8Array(16));return e[6]=15&e[6]|64,e[8]=63&e[8]|128,Array.from(e,e=>e.toString(16).padStart(2,"0")).join("")}const dt=new Set(["create_group","rename_group","set_group","dissolve_group","move_group"]);class ct extends Error{}function _t(e){const t=new Map;for(const s of e)t.has(s.stat_consumption)||t.set(s.stat_consumption,s.included_in_stat??null);return t}function ht(e,t){const s=[],r=new Set,i=t=>{if(!r.has(t)){r.add(t);for(const r of e)r.id===t&&s.push(...r.members);for(const s of e)s.group===t&&i(s.id)}};return i(t),s}function pt(e,t){const s=new Map(e.map(e=>[e.id,e])),r=new Set;let i=t.group;for(;null!==i&&s.has(i)&&!r.has(i);){if(i===t.id)return!0;r.add(i),i=s.get(i).group}return!1}const mt=/ \([0-9]+\)$/;function gt(e,t){let s=2;for(;t.has(`${e} (${s})`);)s++;return`${e} (${s})`}function ft(e,t,s=new Set){const r=_t(t),i=new Set(s),n=function(e){const t=new Set,s=[];for(const r of e)r.name=r.name.trim(),!t.has(r.id)&&r.name&&(t.add(r.id),s.push(r));return s}(structuredClone(e)),o=new Set;for(const e of n)e.members=e.members.filter(e=>!(!r.has(e)||o.has(e))&&(o.add(e),!0));for(const e of n){const t=new Set(ht(n,e.id).map(e=>r.get(e)??null));t.has(e.parent)||1!==t.size||(e.parent=[...t][0],i.add(e.id))}for(const e of n)e.members=e.members.filter(t=>(r.get(t)??null)===e.parent);const a=new Map(n.map(e=>[e.id,e]));for(const e of n){if(null===e.group)continue;const t=a.get(e.group);(void 0===t||t.parent!==e.parent||pt(n,e))&&(e.group=null)}const l=n.filter(e=>ht(n,e.id).length>0);return function(e,t){const s=new Set;for(const r of e){if(!t.has(r.id))continue;const i=new Set(e.filter(e=>e.parent===r.parent&&e.id!==r.id&&(!t.has(e.id)||s.has(e.id))).map(e=>e.name));s.add(r.id),i.has(r.name)&&(r.name=gt(r.name.replace(mt,""),i))}}(l,i),function(e){e.forEach((t,s)=>{if(!e.slice(0,s).some(e=>e.parent===t.parent&&e.name===t.name))return;const r=new Set(e.filter(e=>e.parent===t.parent&&e.id!==t.id).map(e=>e.name));t.name=gt(t.name.replace(mt,""),r)})}(l),l}function vt(e,t){const s=e.find(e=>e.id===t);if(void 0===s)throw new ct("unknown_group");return s}function bt(e,t){const s=new Set([t]);let r=!0;for(;r;){r=!1;for(const t of e)null!==t.group&&s.has(t.group)&&!s.has(t.id)&&(s.add(t.id),r=!0)}return s}function wt(e,t,s,r){const i=t.trim();if(!i)throw new ct("group_name_empty");if(e.some(e=>e.name.trim()===i&&e.parent===s&&e.id!==r))throw new ct("group_name_taken");return i}function yt(e,t){for(const s of e)s.members=s.members.filter(e=>e!==t)}function kt(e,t,s,r){const i=vt(t,r.id),n=r.parent??null,o=ht(t,i.id);if(null!==n){if(function(e,t){const s=_t(e),r=new Set(t);let i=!0;for(;i;){i=!1;for(const[e,t]of s)null!==t&&r.has(t)&&!r.has(e)&&(r.add(e),i=!0)}return r}(e,o).has(n))throw new ct("group_loop");if(!e.some(e=>e.stat_consumption===n))throw new ct("unknown_device")}const a=r.group??null,l=bt(t,i.id);for(const e of t)l.has(e.id)&&wt(t,e.name,n,e.id);if(null!==a){const e=vt(t,a);if(l.has(a))throw new ct("group_loop");if(e.parent!==n)throw new ct("group_parents_differ")}const u=function(e,t,s="electricity",r=[]){return be(e,r,t,s).devices}(e,o.map(e=>({type:"move",stat:e,parent:n,kind:s})),s);for(const e of t)l.has(e.id)&&(e.parent=n);return i.group=a,u}function $t(e,t,s,r){const i=_t(e);if("create_group"===r.type)!function(e,t,s){const r=s.parent??null;if(e.some(e=>e.id===s.id))throw new ct("group_exists");const i=wt(e,s.name??"",r,null),n=[...s.members];for(const e of n)if(!t.has(e)||t.get(e)!==r)throw new ct("unknown_device_or_parents_differ");const o=(s.groups??[]).map(t=>vt(e,t));for(const e of o)if(e.parent!==r)throw new ct("group_parents_differ");const a=s.group??null;if(null!==a){if(vt(e,a).parent!==r)throw new ct("group_parents_differ");if(o.some(t=>bt(e,t.id).has(a)))throw new ct("group_loop")}for(const t of n)yt(e,t);for(const e of o)e.group=s.id;e.push({id:s.id,name:i,parent:r,group:a,members:n})}(t,i,r);else if("rename_group"===r.type){const e=vt(t,r.id);e.name=wt(t,r.name??"",e.parent,e.id)}else if("set_group"===r.type)!function(e,t,s){const r=s.stat??null,i=s.group_id??null;if(null===r==(null===i))throw new ct("unknown_change");const n=s.group??null,o=null!==n?vt(e,n):null;if(null!==r){if(!t.has(r))throw new ct("unknown_device");if(null!==o&&o.parent!==t.get(r))throw new ct("group_parents_differ");return yt(e,r),void o?.members.push(r)}const a=vt(e,i);if(null!==o){if(o.parent!==a.parent)throw new ct("group_parents_differ");if(bt(e,a.id).has(o.id))throw new ct("group_loop")}a.group=n}(t,i,r);else if("dissolve_group"===r.type)!function(e,t){const s=vt(e,t),r=s.group;null!==r&&vt(e,r).members.push(...s.members);for(const s of e)s.group===t&&(s.group=r);e.splice(e.indexOf(s),1)}(t,r.id);else if("move_group"===r.type)return kt(e,t,s,r);return e}function xt(e,t,s){const r=new Set,i=e.find(e=>e.stat_consumption===s);if(void 0===i)return r;for(const e of t)e.parent===s&&(e.parent=i.included_in_stat??null,r.add(e.id));return r}function St(e,t,s){const r=s?.trim()||null;for(const s of e)if(s.members.includes(t)&&s.parent!==r)return void yt(e,t)}function zt(e,t,s){const r=new Map(e.map((e,t)=>[e.stat,t])),i=s.filter(e=>e.parent===t),n=new Set(i.map(e=>e.id)),o=new Set,a=new Set,l=e=>({node:{type:"device",node:e,children:zt(e.children,e.stat,s)},order:r.get(e.stat)}),u=t=>{if(a.has(t.id))return null;a.add(t.id);const s=[];for(const i of t.members){const t=r.get(i);void 0===t||o.has(i)||(o.add(i),s.push(l(e[t])))}for(const e of i.filter(e=>e.group===t.id)){const t=u(e);null!==t&&s.push(t)}return a.delete(t.id),0===s.length?null:(s.sort((e,t)=>e.order-t.order),{node:{type:"group",group:t,children:s.map(e=>e.node)},order:s[0].order})},d=[];for(const e of i)if(null===e.group||!n.has(e.group)){const t=u(e);null!==t&&d.push(t)}for(const t of e)o.has(t.stat)||d.push(l(t));return d.sort((e,t)=>e.order-t.order),d.map(e=>e.node)}function Et(e,t){return zt(e,null,t)}function At(e,t){if("device"===e.type)return t.get(e.node.stat)??null;const s=e.children.map(e=>At(e,t)).filter(e=>null!==e);return 0===s.length?null:s.reduce((e,t)=>e+t,0)}function Ct(e,t,s){if(0===s.length)return!1;const r=_t(e),i=new Set;for(const e of s)if(e.startsWith(at)){const s=t.find(t=>t.id===e.slice(6));if(void 0===s)return!1;i.add(s.parent)}else{if(!r.has(e))return!1;i.add(r.get(e))}return 1===i.size}const Mt={menu:"M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",dots:"M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z",refresh:"M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",home:"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",sun:"M3.55,18.54L4.96,19.95L6.76,18.16L5.34,16.74M11,22.45C11.32,22.45 13,22.45 13,22.45V19.5H11M12,5.5A6,6 0 0,0 6,11.5A6,6 0 0,0 12,17.5A6,6 0 0,0 18,11.5C18,8.18 15.31,5.5 12,5.5M20,12.5H23V10.5H20M17.24,18.16L19.04,19.95L20.45,18.54L18.66,16.74M20.45,4.46L19.04,3.05L17.24,4.84L18.66,6.26M13,0.55H11V3.5H13M4,10.5H1V12.5H4M6.76,4.84L4.96,3.05L3.55,4.46L5.34,6.26L6.76,4.84Z",chevronLeft:"M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",chevronRight:"M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",lightbulb:"M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z",flash:"M7,2V13H10V22L17,10H13L17,2H7Z",fire:"M17.66,11.2C17.43,10.9 17.15,10.64 16.89,10.38C16.22,9.78 15.46,9.35 14.82,8.72C13.33,7.26 13,4.85 13.95,3C13,3.23 12.17,3.75 11.46,4.32C8.87,6.4 7.85,10.07 9.07,13.22C9.11,13.32 9.15,13.42 9.15,13.55C9.15,13.77 9,13.97 8.8,14.05C8.57,14.15 8.33,14.09 8.14,13.93C8.08,13.88 8.04,13.83 8,13.76C6.87,12.33 6.69,10.28 7.45,8.64C5.78,10 4.87,12.3 5,14.47C5.06,14.97 5.12,15.47 5.29,15.97C5.43,16.57 5.7,17.17 6,17.7C7.08,19.43 8.95,20.67 10.96,20.92C13.1,21.19 15.39,20.8 17.03,19.32C18.86,17.66 19.5,15 18.56,12.72L18.43,12.46C18.22,12 17.66,11.2 17.66,11.2M14.5,17.5C14.22,17.74 13.76,18 13.4,18.1C12.28,18.5 11.16,17.94 10.5,17.28C11.69,17 12.4,16.12 12.61,15.23C12.78,14.43 12.46,13.77 12.33,13C12.21,12.26 12.23,11.63 12.5,10.94C12.69,11.32 12.89,11.7 13.13,12C13.9,13 15.11,13.44 15.37,14.8C15.41,14.94 15.43,15.08 15.43,15.23C15.46,16.05 15.1,16.95 14.5,17.5H14.5Z",alert:"M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",water:"M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z",undo:"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z",history:"M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"},Tt={integral:"M16 3.5c-2.4-1-4.5 0-4.5 3.2v10.6c0 3.2-2.1 4.2-4.5 3.2",group:"M17 4.5H7l6 7.5-6 7.5h10",template:"M9 4C7 4 6.5 5 6.5 7v2.5C6.5 11 5.5 12 4 12c1.5 0 2.5 1 2.5 2.5V17c0 2 .5 3 2.5 3M15 4c2 0 2.5 1 2.5 3v2.5c0 1.5 1 2.5 2.5 2.5-1.5 0-2.5 1-2.5 2.5V17c0 2-.5 3-2.5 3",utility_meter:"M4 7h16v10H4zM10 7v10M14 7v10",helper:"M15.5 4c-2 0-3 1-3.5 3l-2.5 10c-.5 2-1.5 3-3.5 3M8.5 10.5h7",external:"M7 18.5a4 4 0 0 1-.6-7.96 5.5 5.5 0 0 1 10.6-1.3A4.6 4.6 0 0 1 17.4 18.5Z"};function Dt(e){return Z`<svg class="mdi" viewBox="0 0 24 24" aria-hidden="true"><path d=${Mt[e]}></path></svg>`}const Lt={title:"Energy Flow Mapper",menu:"Menu",more:"More",reload:"Reload",undo:"Undo last save",backups:"Backups",loading:"Loading…",load_failed:"The energy settings could not be loaded.",sources:"Sources",sources_hint:"Drag a free sensor onto a source, or tap a source. Change prices in the energy settings.",open_energy_settings:"Energy settings",no_sources:"No sources configured.",role_import:"Grid import",role_export:"Grid export",role_production:"Solar production",role_discharge:"Battery discharge",role_charge:"Battery charge",role_gas:"Gas",role_water:"Water",role_home:"Home meter",diagram:"Energy flow",zoom_hint:"Zoom with the mouse wheel or two fingers, drag an empty area to move.",zoom_in:"Zoom in",zoom_out:"Zoom out",fit:"Fit",orientation_label:"Orientation",orientation_horizontal:"Horizontal",orientation_vertical:"Vertical",role_battery:"Battery",home_measured:"{power} measured",home_stale:"{name}: data not recent enough",home_calculated:"{power} calculated",period_label:"Period",period_now:"Now",period_today:"Today",period_week:"7 days",period_month:"30 days",energy_loading:"Loading consumption …",detail_energy:"Energy in period",devices:"Devices",devices_hint:"Drag a device onto another one to include it there, or use the ⋮ menu.",home:"Home",home_drop:"Drop here for the top level",no_devices:"No devices in the energy dashboard yet. Add a free sensor.",untracked:"Untracked consumption",untracked_without_one:"without {name}",untracked_without_many:"without {count} devices",untracked_missing_title:"No value: {names}",free_sensors:"Free sensors",free_collapse:"Hide free sensors",free_expand:"Show free sensors",free_sensors_hint:"Energy meters that are not in the energy dashboard yet.",free_contained:"Contained in meters",free_contained_hint:"These sensors are already part of a meter in your energy settings. Check that before you add one as well.",free_contained_in:"Part of {meter}",search:"Search",no_candidates:"No free energy sensors.",add:"Add",add_title:"Add {name} under …",with_power:"Power sensor: {entity}",actions:"Actions for {name}",move:"Move to …",move_title:"Move {name} to …",top_level:"Top level (Home)",no_targets:"There is no other place for this device.",rename:"Rename …",rename_title:"Rename {name}",replace_with:"Replace with …",replace_title:"Replace {name} with …",replace_hint:"Takes over place, child devices, group and the name you set.",replace_none:"No free sensors",name_label:"Name",name_hint:"Leave empty to use the entity name.",remove:"Remove from the energy dashboard",use_as_home_meter:"Use as home meter",remove_hint:"Its child devices move up one level.",cancel:"Cancel",ok:"OK",close:"Close",details:"Details",select_hint:"Select a device to see its details.",detail_statistic:"Statistic",detail_power_sensor:"Power sensor",detail_device:"Device",detail_area:"Area",detail_power:"Power now",detail_untracked:"Untracked by its child devices",detail_issues:"Problems",none:"–",change_one:"1 change",change_other:"{count} changes",discard:"Discard",save:"Save",confirm_title:"Save changes?",confirm_errors:"Fix these problems first:",confirm_kept:"These problems were already in your energy settings. They stay as they are and don't prevent saving:",confirm_kept_rejected:"These problems were already in your energy settings:",confirm_warnings:"Please note:",checking:"Checking …",saving:"Saving …",saved:"Saved. A backup of the previous settings was created.",nothing_to_save:"Nothing changed.",diff_added:"{name} added",diff_added_under:"{name} added under {to}",diff_removed:"{name} removed",diff_moved:"{name} moved under {to}",diff_moved_top:"{name} moved to the top level",diff_renamed:"{name} renamed to “{to}”",diff_renamed_reset:"{name} uses the entity name again",diff_rate:"Power sensor of {name} changed",issue_cycle:"Part of a loop of devices",issue_self_parent:"Included in itself",issue_duplicate:"Listed more than once",issue_missing_parent:"Its upstream device is not in the energy dashboard",issue_source_and_device:"Also used as a source",issue_statistic_missing:"Statistic not found",issue_not_energy_unit:"Unit {unit} is not an energy unit",issue_children_exceed_parent:"Its child devices use more than this device",issue_devices_exceed_home:"The devices use more than the home",issue_counted_twice:"Also counted in the meter of another device, but not placed below it",issue_counted_twice_in:"Already counted in {meter}, but not placed below it",ha_reports:"Home Assistant reports",coverage_toggle:"Coverage",types_toggle:"Mark helpers",type_sensor:"Sensor",type_helper:"Helper",type_helper_kind:"Helper: {kind}",type_integral:"integral",type_group:"group",type_template:"template",type_utility_meter:"utility meter",type_external:"External statistic",detail_type:"Type",coverage_percent:"{percent}% covered by devices",coverage_over:"over 100% covered by devices",coverage_below_one:"< 1% covered by devices",suggestion_text:"Suggestion: included in {parent}",suggestion_apply:"Apply",suggestion_ignore:"Ignore",suggestion_apply_all:"Apply all suggestions",suggestion_show_ignored:"Show ignored suggestions again",export_image:"Save as image",export_title:"Save diagram as image",export_hide_names:"Hide names",export_hide_hint:"Devices become Device 1, 2, …; areas and sensor names are left out.",export_save:"Save",export_device:"Device {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Draft, not saved",export_failed:"The image could not be created.",backups_title:"Backups",backups_empty:"No backups yet. One is created before every save.",backup_by:"by {user}",restore:"Restore",restore_confirm:"Restore the backup from {date}? The current settings are backed up first.",undo_confirm:"Restore the settings from before the last save ({date})? The current settings are backed up first.",draft_lost:"Your unsaved changes will be discarded.",restored:"Backup restored.",summary_added:"{count} added",summary_removed:"{count} removed",summary_moved:"{count} moved",summary_renamed:"{count} renamed",summary_rate:"{count} with new power or flow sensor",summary_restored:"Restored a backup",error_conflict:"The energy settings or groups were changed elsewhere in the meantime. They were reloaded; check your changes and save again.",error_not_loaded:"Energy Flow Mapper is not loaded.",error_unsupported_energy_api:"The energy settings of this Home Assistant release are not supported. The editor is disabled to protect your settings.",assign_title:"Assign {role}",assign_hint:"Pick a free energy meter.",battery_title:"Battery: charging meter",battery_hint:"{name} measures discharging. Pick the meter that measures charging.",source_assign:"Assign sensor …",source_replace:"Replace sensor …",source_remove:"Remove as source",power_only:"Power only",power_only_hint:"These power sensors have no energy meter. “Create meter” adds an integral helper right away; it stays even without Energy Flow Mapper.",create_meter:"Create meter",create_meter_title:"Create an energy meter for {name}?",create_meter_text:"The helper “{helper}” is created right away under Settings → Helpers. It is an ordinary Home Assistant helper and stays even if you remove Energy Flow Mapper. Its meter is then added to your draft.",creating:"Creating …",meter_created:"Meter “{name}” created and added to the draft.",energy_suffix:"Energy",external_statistic:"External statistic",created_by:"Created by Energy Flow Mapper",detail_helper:"Helper",diff_source_added:"{name} assigned as {role}",diff_source_removed:"{name} removed as {role}",summary_source_added:"{count} assigned as source",summary_source_removed:"{count} removed as source",diff_source_rate:"Power sensor of {name} ({role}) changed",diff_source_rate_flow:"Flow sensor of {name} ({role}) changed",summary_source_rate:"{count} source(s) with new power or flow sensor",issue_duplicate_source:"Used by more than one source",error_unknown_source:"This sensor is not a source in the energy dashboard.",error_invalid_power_config:"This power sensor does not fit this source.",error_home_exists:"There is already a home meter.",error_home_not_supported:"This Home Assistant release has no home meter; it needs 2026.11 or newer.",error_not_a_power_candidate:"This sensor is not a power or flow sensor without a meter.",error_integral_failed:"The helper for the meter could not be created.",confirm_rejected:"Home Assistant does not accept these settings:",source_last_meter:"This is the last meter of this grid connection. Removing it removes the connection with its prices.",error_invalid_changes:"The draft has errors and was not saved.",error_restore_invalid:"This backup cannot be restored: together with the current energy settings it would cause errors ({issues}). Nothing was changed.",error_device_exists:"This device is already in the energy dashboard.",error_unknown_device:"A device of your draft is no longer in the energy dashboard. Discard the draft and try again.",error_unknown_change:"This change is not supported.",error_backup_not_found:"This backup no longer exists.",error_rejected_by_home_assistant:"Home Assistant rejected the settings: {error}",backups_hint:"Kept in the Home Assistant configuration folder, so every Home Assistant backup includes them. Export a file to keep a copy elsewhere.",export_current:"Export current settings",import_file:"Import from file …",export:"Export",import_title:"Import {file}",import:"Import",import_unchanged:"This file holds your current settings. There is nothing to import.",import_invalid_file:"This file could not be read. Pick a file exported by Energy Flow Mapper.",imported:"Imported. The previous settings were backed up.",summary_imported:"Imported a file",error_invalid_import:"This file is not an Energy Flow Mapper export.",error_unknown:"Error: {message}",tabs_label:"Energy dashboard part",tab_electricity:"Electricity",tab_gas:"Gas",diagram_gas:"Gas meters",free_sensors_hint_gas:"Gas meters that are not in the energy dashboard yet. Home Assistant has no gas devices, only gas meters.",no_candidates_gas:"No free gas meters.",assign_hint_gas:"Pick a free gas meter.",tab_water:"Water",diagram_water:"Water flow",free_sensors_hint_water:"Water meters that are not in the energy dashboard yet.",no_candidates_water:"No free water meters.",assign_hint_water:"Pick a free water meter.",with_flow:"Flow sensor: {entity}",detail_flow_sensor:"Flow sensor",detail_flow:"Flow now",detail_volume:"Water in period",issue_not_water_unit:"Unit {unit} is not a water unit",diff_water:"Water: {text}",diff_rate_water:"Flow sensor of {name} changed",undo_change:"Undo change",undo_change_hint:"Take back the last change of the draft (Ctrl+Z)",draft_restored:"Your unsaved changes were restored.",draft_outdated:"Your unsaved changes could not be restored because the energy settings were changed meanwhile.",blocked_one:"1 problem prevents saving",blocked_other:"{count} problems prevent saving",blocked_hint:"Click Save to see the problems.",show_block:"Show",change_undone:"Last change taken back.",flow_only:"Flow only",flow_only_hint:"These flow sensors have no water meter. “Create meter” adds an integral helper right away; it stays even without Energy Flow Mapper.",create_water_meter_title:"Create a water meter for {name}?",create_water_meter_text:"The helper “{helper}” is created right away under Settings → Helpers. It adds up the flow to water (L/min to litres, m³/h to m³) and is shown as water. It is an ordinary Home Assistant helper and stays even if you remove Energy Flow Mapper. Its meter is then added to your draft.",water_suffix:"Water",find_device:"Find device",find_none:"No match",find_count:"{index} of {count}",find_next:"Next",card_empty:"No devices in the energy dashboard yet.",card_root_missing:"This device is no longer in the energy dashboard. Pick another one in the card settings.",card_root_group_missing:"This group no longer exists. Pick another start in the card settings.",card_root_all:"Whole home",card_root_group:"Group: {name}",card_root_group_in:"Group: {name} (in {parent})",card_stale:"Could not refresh, showing the last values.",card_field_title:"Title (empty: no title)",card_field_kind:"Show",card_field_root:"Start at",card_field_show_sources:"Show sources",card_field_show_untracked:"Show untracked consumption",card_field_show_coverage:"Show how much the devices cover",card_field_show_types:"Mark helpers and external statistics",select_mode:"Select",select_done:"Done",select_mode_hint:"Tap blocks to select them for grouping. Ctrl+click works too.",selected_count:"{count} selected",group_selection:"Group",clear_selection:"Clear selection",group_parents_hint:"Only devices with the same parent",group_name_title:"Name the new group",group_devices_one:"1 device",group_devices_other:"{count} devices",group_actions:"Actions for group {name}",diff_group_created:"Group “{name}” created ({devices})",diff_group_renamed:"Group “{from}” renamed to “{to}”",diff_group_dissolved:"Group “{name}” dissolved",diff_group_changed:"Group “{name}” changed ({devices})",summary_group_created:"{count} group(s) created",summary_group_renamed:"{count} group(s) renamed",summary_group_dissolved:"{count} group(s) dissolved",summary_group_changed:"{count} group(s) changed",export_group:"Group {n}",error_unknown_group:"{stat} is not a group.",error_group_parents_differ:"{stat} does not belong below the same device as this group.",error_group_loop:"A group cannot be moved into itself or below one of its own devices ({stat}).",error_group_name_empty:"A group needs a name.",error_group_name_taken:"There is already a group called {stat} here.",error_group_exists:"The group {stat} already exists.",group_dissolve:"Dissolve group",suggest_groups:"Suggest groups from areas",suggest_groups_none:"No groups to suggest: no two ungrouped devices below the same parent share an area.",sum_create:"Create sum meter",sum_create_button:"Create",sum_members:"Sensors in the sum",sum_fixed_hint:"Every device of the group is in the sum; you can add more sensors.",sum_add:"Add sensor",sum_remove:"Remove {name} from the sum",sum_no_sensors:"No other sensor can be added.",sum_blocked:"The marked sensors cannot be summed, so the sum meter cannot be created.",sum_text:"The helper “{helper}” is created right away under Settings → Helpers and adds up these sensors. It is an ordinary Home Assistant helper and stays even if you undo the change or remove Energy Flow Mapper. Its meter is then added to your draft; every device in the sum moves below it, sources stay sources.",sum_text_replace:"The helper “{helper}” is created right away under Settings → Helpers and adds up these sensors. It is an ordinary Home Assistant helper and stays even if you undo the change or remove Energy Flow Mapper. Its meter then takes the place of {name} in your draft, with its children; sources stay sources.",sum_rate_hint:"Every meter of the sum has a power sensor, so a second helper “{helper}” adds up their power.",sum_rate_hint_water:"Every meter of the sum has a flow sensor, so a second helper “{helper}” adds up their flow.",sum_rate_missing:"No power sum, because these have no power sensor: {names}.",sum_rate_missing_water:"No flow sum, because these have no flow sensor: {names}.",sum_rate_source_sign:"No power sum: the power of grid and battery cannot be added up, because its sign depends on the direction.",sum_rate_source_water:"No flow sum: the flow of a water source cannot be added to a flow sum.",sum_replace:"Replace {name}",sum_replace_reason:"It is already part of the sum; below the new meter it would count twice.",sum_created:"Sum meter “{name}” created and added to the draft.",sum_solar_use_setup:"A sum meter with a solar needs the guided setup “Solar feeds in here…”: only it checks how your circuit meter counts, so that nothing is counted twice or wrongly. So this sum is not created.",sum_member_unchecked:"Not checked: too few statistics to tell whether it starts again at 0",sum_periodic_solar:"For a solar in a circuit, “Solar feeds in here…” builds the gross meter instead.",sum_periodic_way:"What to do: use the device's lifetime total sensor instead, or create a meter from its power sensor (an integral helper under Settings → Devices & services → Helpers).",sum_mixed_total:"A meter that counts total (a gross or net meter, which may also fall) cannot be summed with meters that only rise (total_increasing): Home Assistant would not take the sum as a meter. Instead, keep these devices separate in the tree.",sum_state_class_list:"State classes: {list}.",sum_solar_save_first:"{names}: a solar changed in your draft only (added, removed or with another power sensor). Save first, then create the sum.",sum_solar_no_device:"The sum has no device the solar could feed into. Remove the solar from the sum.",sum_solar_is:"A solar or part of one: {names}.",sum_solar_open_setup:"Set up the solar for {name}",sum_solar_one_device:"The setup builds the gross meter of the device the solar feeds into; its gross meter then stays a device of its own. Sum the other devices without the solar.",sum_solar_holders:"Already hold a solar: {names}. If one is a gross meter already (consumption with its own solar), mark it below; otherwise remove it from the sum.",sum_solar_holders_group:"Already hold a solar: {names}. If one is a gross meter already (consumption with its own solar), mark it below; otherwise move it out of the group first: every device of a group is in its sum.",sum_solar_no_device_group:"The sum has no device the solar could feed into. Move the solar out of the group first: every device of a group is in its sum.",sum_solar_one_device_group:"The setup builds the gross meter of the device the solar feeds into; its gross meter then stays a device of its own. Move the solar out of the group first, then sum the group.",sum_solar_group_move:"Move the solar out of the group first: every device of a group is in its sum.",sum_gross_ok:"{name} is already a gross meter (consumption with solar) – sum anyway",sum_periodic:"These meters start again at 0 now and then (daily, for example), so the sum cannot be created: with them it would fall at each of their resets, and Home Assistant would count the whole sum again. Remove them from the sum.",sum_periodic_member:"{name}: {evidence}",sum_check_unknown:"Not checked: whether a meter starts again at 0 every day could not be checked (the recorder did not answer). You can still create the sum.",sum_check_retry:"Check again",sum_checking:"Checking whether a meter starts again at 0 every day …",sum_need_name:"Give the helper a name.",sum_need_member:"Add at least one sensor.",evidence_utility_meter:"a utility meter helper that resets in a cycle",evidence_last_reset:"its start time (last_reset) changes",evidence_drop:"fell on {date} at {time} from {before} to {after}",evidence_statistics:"its statistics show it starting again at 0",sum_reason_external:"External statistic: a helper cannot add it up",sum_reason_not_sensor:"Not a sensor",sum_reason_unavailable:"Not found in Home Assistant",sum_reason_device_class:"Device class is not {device_class}",sum_reason_state_class:"State class is not total or total increasing",power_suffix:"Power",flow_suffix:"Flow",error_sum_not_possible:"{entity} cannot be summed: it needs to be a sensor with the right device class and a total or total-increasing state class.",error_sum_state_classes_differ:"The sensors do not all have the same state class (total or total increasing), so their sum would not be accepted as a meter.",error_sum_failed:"The sum meter could not be created.",error_sum_with_solar:"{entity} is a solar meter or holds one. A sum meter with a solar needs the guided setup “Solar feeds in here…” instead.",error_template_failed:"The template helper for the meter could not be created.",error_returned_disabled:"The returned energy sensor {entity_id} is disabled. Enable it in its entity settings in Home Assistant first.",error_daily_without_power:"{entity_id} starts again at 0 every day, so only “From power” could build the gross meter, and it needs a power sensor for the circuit and one for the solar.",error_solar_already_in_meter:"{entity_id} already adds up the solar, so a gross meter would count the solar twice. Use it as it is, or remove the solar from the sum first.",error_unsupported_input:"{entity_id} cannot be used in the gross meter: it needs to be a sensor with an energy or power unit.",error_daily_check_failed:"The check whether the meters of {entity_id} start again at 0 every day could not run: the recorder did not answer in time. Try again in a moment.",error_input_not_ready:"{entity_id} has no value right now, so the starting value of the gross meter cannot be set. Try again when it reports one.",discard_title:"Discard the draft?",discard_confirm:"All {count} changes of the draft will be lost. This cannot be undone.",tools:"Tools",help:"Help",sum_name_exists:"An entity named “{name}” already exists. The new helper would get the same name; choose another one to tell them apart.",power_sensor:"Power sensor …",flow_sensor:"Flow sensor …",power_variant_single:"Standard",power_variant_inverted:"Inverted",power_variant_two:"Two sensors",power_none:"None",power_same_device:"Same device",power_sensor_label:"Power sensor",flow_sensor_label:"Flow sensor",power_variant_single_grid:"One sensor: positive while drawing from the grid, negative while returning to it.",power_variant_inverted_grid:"One sensor with the opposite sign: positive while returning to the grid, negative while drawing from it.",power_variant_two_grid:"One sensor for import power and one for export power, each positive.",power_variant_single_battery:"One sensor: positive while discharging, negative while charging.",power_variant_inverted_battery:"One sensor with the opposite sign: positive while charging, negative while discharging.",power_variant_two_battery:"One sensor for discharge power and one for charge power, each positive.",hints:"Hints",hint_returned_energy:"Its device also counts returned energy ({entity}). If a solar feeds into this circuit, this meter only sees what the circuit draws from the house, not what the solar produces in it.",hint_returned_energy_disabled:"Its device also has a returned energy sensor ({entity}), which is disabled, and this circuit fed energy back lately (its power went below 0). If a solar feeds into this circuit, this meter only sees what the circuit draws from the house, not what the solar produces in it.",hint_daily_in_sum:"This sum mixes meters that start again at 0 every day with meters that do not: {names}. The sum then drops once a day, and Home Assistant counts the whole sum again. In the helper, use a meter that does not reset instead (for a solar, an integral of its power).",hint_power_available:"Its device has a power sensor that is not set: {entity}.",hint_flow_available:"Its device has a flow sensor that is not set: {entity}.",hint_set_power:"Set power sensor",hint_set_flow:"Set flow sensor",hint_open_helper:"Open helper settings",hint_dismiss:"Dismiss",hint_dismiss_title:"Hide this hint for good. “Show ignored suggestions again” brings it back.",hint_dismiss_event_title:"Hide this hint for this event only. A new one shows again.",hint_children_solar:"Maybe a solar feeds into this circuit: its meter then misses what the solar produces in it, so the children seem to use more.",hint_readme:"More in the README",hint_show_sensor:"Show sensor",hint_minutes:"{count} min",hint_hours:"{count} h",hint_gross_off_down:"{meter} went down by {drop} in the hour from {time} on {date}.",hint_gross_off_down_power:"{meter} went down by {drop} in the hour from {time} on {date}; its gross power gave {power}.",hint_gross_off_less:"{meter} counted {change} in the hour from {time} on {date}, clearly less than its gross power gave ({power}).",hint_gross_off_more:"{meter} counted {change} in the hour from {time} on {date}, clearly more than its gross power gave ({power}).",hint_gross_off_counted:"{meter} counted {change} in the hour from {time} on {date}.",hint_gross_off_input:"The meter {input} was probably reset or replaced: it fell to less than half in that hour, and the gross meter keeps that step. You can take the step out of the statistics in Developer tools → Statistics (see the README).",hint_gross_off_input_net:"The meter {input} was probably reset or replaced: it fell to less than half in that hour, and the gross meter keeps that step. A meter that counts both ways also goes down while the circuit exports, but rarely this far. You can take the step out of the statistics in Developer tools → Statistics (see the README).",hint_gross_off_solar_term:"Its helper for the solar’s energy counted clearly less than the solar itself in that hour: the solar’s power had no value (unknown, or unavailable for more than 10 minutes), or Home Assistant was not running. That solar energy is missing from the gross meter; there is nothing to fix.",hint_gross_off_sign:"The meter counts with energy counters, so it is probably right; its gross power is what differs. Either the power’s sign is wrong, or the meter stood still for a while and then caught up: such a one-off step leaves the hint by itself after 7 days. If the gross power shows the wrong sign, set the device’s power sensor to “None”: the meter keeps counting, only its live value goes. After saving, the hint goes away.",hint_gross_off_sign_power:"This gross meter counts its gross power, and that power went below 0. If the circuit’s power has the wrong sign, the meter counts wrong as well: build the gross meter again with the circuit’s power turned around. If a battery or something else feeds into the circuit, there is no fix: a gross meter cannot count that.",hint_gross_off_below_zero:"A gross consumption meter must not go below 0. Either something other than the solar feeds into the circuit (a battery, a second inverter), or its inputs are mixed up (drawn and returned swapped, or a Net meter that counts the other way). Build the gross meter again with the right method. A gross meter cannot count a battery that feeds in: then put the circuit’s own meter back with ⋮ → “Replace with …”.",hint_gross_off_unclear:"The statistics do not show why.",hint_gross_unknown:"{meter} had no value for {length} from {time} on {date}.",hint_gross_unknown_power:"{meter} could not count for {length} from {time} on {date}.",hint_gross_unknown_input:"{input} had no value then either, and the gross meter needs all of its sensors. Check that sensor.",hint_gross_unknown_inputs:"The gross meter needs all of its sensors; check the ones it is made of.",hint_solar_term_short:"On {date}, the helper {term} counted {term_energy} of this solar’s energy, clearly less than the solar itself ({source_energy}). The solar’s power had no value (unknown, or unavailable for more than 10 minutes), or Home Assistant was not running; the gross meters that use the helper miss that energy. There is nothing to fix; if it happens often, check the solar’s power sensor.",hint_solar_term_high:"On {date}, the helper {term} counted {term_energy} of this solar’s energy, clearly more than the solar itself ({source_energy}). The solar’s power may keep a number while nothing is produced (a value stuck overnight), it may measure something else (the DC or battery side), or the solar’s own energy counter booked part of the day late, across midnight. Check the solar’s power sensor.",solar_setup:"Solar feeds in here…",solar_setup_title:"Solar feeds into {name}",solar_setup_intro:"The solar feeds into this circuit, and the devices on it use its energy before it reaches the meter. So the meter shows less than they use, or even goes negative. The setup builds a gross meter: what the devices on this circuit really use.",solar_setup_no_solar:"The setup needs a solar source in the energy dashboard. Add one first, then start the setup again.",solar_setup_source:"Solar",solar_setup_set_solar_power:"Set power sensor of the solar",solar_setup_open_settings:"Open its settings",solar_setup_preview:"What is created",solar_setup_energy:"A template helper for the gross energy, {formula}:",solar_setup_offset:"The {offset} kWh are added so the gross meter starts above 0: Home Assistant’s energy settings flag a meter whose state is below 0. They do not change what it counts.",solar_setup_power:"A template helper for the gross power, {formula}:",solar_setup_text:"The helpers are created right away under Settings → Helpers. They are ordinary Home Assistant helpers and stay even if you undo the change or remove Energy Flow Mapper. The gross meter then takes the place of {name} in your draft, with its children and group, and the name you gave {name}, if any. It gets the gross power as its power sensor. Save as usual.",solar_setup_text_no_power:"The helpers are created right away under Settings → Helpers. They are ordinary Home Assistant helpers and stay even if you undo the change or remove Energy Flow Mapper. The gross meter then takes the place of {name} in your draft, with its children and group, and the name you gave {name}, if any. Save as usual.",solar_setup_button:"Set up",solar_setup_done:"Gross meter “{name}” created; it takes the place of {old} in the draft.",solar_setup_created_only:"Gross meter “{name}” created. It could not take the place of {old} in the draft; put it there with “Replace with …”.",solar_gross_name:"{name} gross",solar_gross_power_name:"{name} gross power",solar_setup_method:"How should the gross meter be built?",solar_method_em:"EM meter: gross = drawn − returned + solar",solar_method_em_hint:"For a meter that counts what the circuit draws and what it returns apart, like a Shelly Pro EM.",solar_method_plug:"Plug or switch: gross = energy − 2 × returned + solar",solar_method_plug_hint:"For a Shelly plug or switch whose “Energy” counts both directions.",solar_method_net:"Net meter: gross = meter + solar",solar_method_net_hint:"For a meter that counts backwards while the circuit feeds in.",solar_method_power:"From power: gross = integral of (circuit power + solar power)",solar_method_power_hint:"Right for every device whose circuit power has a sign; the energy is an estimate from power.",solar_method_suggested:"Suggested",reason_rule_shelly_em:"fits your device ({device})",reason_rule_shelly_plug:"fits your device ({device}): its “Energy” counts both directions",reason_rule_shelly_consumed:"fits your device ({device}): “Energy consumed” counts only what it draws",reason_rule_net_negative:"fits your meter: it went below 0 in the last days",reason_power_signed:"checked: its power went below 0 in the last days, so it has a sign",reason_unverified_against_rule:"not verified – this is not how the rule for your device counts, or not with the returned sensor it trusts; only pick this if you know your meter counts this way",reason_unverified_may_reset:"not verified – this counter may start again at 0 after a power cut",reason_unverified_net:"not verified – only pick this if your meter counts backwards while feeding in; it never went below 0 in the last days",reason_unverified_no_data:"not verified – a meter of it has no statistics in the last days; say below whether it starts again at 0 every day",reason_unverified_power_unsigned:"not verified – the circuit never fed in during the last days, so it is unclear whether its power has a sign",reason_net_needs_signed_meter:"not offered – the meter only counts up (total increasing), so Home Assistant would read each fall as a reset",reason_no_returned_sensor:"not offered – its device has no returned energy sensor",reason_daily_input:"not offered – a meter of it starts again at 0 every day",reason_unsupported_input:"not offered – a meter of it has no energy unit that can be read",reason_no_power:"not offered – it needs a power sensor for the circuit and one for the solar",reason_unusable_power:"not offered – the circuit’s power sensor is disabled or has no power unit that can be read",solar_setup_drawn:"Meter of what the circuit draws",solar_setup_returned:"Returned energy sensor",solar_setup_choose:"Choose …",solar_setup_disabled_option:"{entity} (disabled in Home Assistant)",solar_setup_disabled_sensor:"{entity} is disabled in Home Assistant. The setup does not enable it for you.",solar_setup_inputs:"Meters and their statistics",solar_setup_daily:"Starts again at 0 every day (periodic)",solar_setup_lifetime:"Keeps counting (never starts again at 0)",solar_setup_daily_locked:"Fixed: {evidence}.",solar_setup_daily_hint:"Preselected from the statistics; change it if you know better.",evidence_lifetime:"rose in the last days without starting again at 0",evidence_no_data:"no statistics in the last days",solar_setup_power_title:"Power",solar_setup_circuit_power:"Circuit: {entity} ({from})",solar_setup_solar_power:"Solar: {entity} ({from})",solar_setup_circuit_none:"Circuit: no power sensor",solar_setup_solar_none:"Solar: no power sensor",solar_setup_from_draft:"from your draft",solar_setup_from_saved:"saved",solar_setup_from_paired:"found on its device",solar_setup_live:"Now: circuit {circuit} + solar {solar} = {gross}",solar_setup_live_hint:"Check that this fits what is running right now: while the circuit feeds in, its power is negative.",solar_setup_invert:"Turn the circuit’s power around",solar_setup_invert_hint:"For a power sensor that is positive while the circuit feeds in.",solar_setup_power_history:"The new gross energy starts at 0 and has no history; it is an estimate from power.",solar_setup_counter_night:"{solar} has no power sensor, so its counter is used as it is. At night the gross meter may pause, and the night’s consumption then lands in the morning; the totals stay right.",solar_setup_hold:"While the solar is “unavailable”, its last power is held for up to 10 minutes, then it counts as 0. An “unknown” state and one restored after a restart count as 0 at once.",solar_setup_reuse:"Uses the existing solar energy helper {entity}.",solar_setup_role_solar_power:"A template helper for the solar’s power, 0 while it is offline:",solar_setup_role_solar_energy:"An integral helper for the solar’s energy, from that power:",solar_setup_role_energy_power:"An integral helper for the gross energy, from the gross power:",solar_term_power_name:"{name} (0 when offline)",solar_setup_retry:"Try again",solar_setup_check_again:"Check again",solar_setup_why_solar:"Choose a solar.",solar_setup_why_checking:"Still checking …",solar_setup_why_failed:"The check failed; try again.",solar_setup_why_method:"Choose how the gross meter is built.",solar_setup_why_blocked:"Solve the problem above first.",solar_setup_why_names:"Give every helper a name.",solar_setup_conflict:"Your energy settings changed meanwhile. The check was run again on them: look at it, then set up again.",error_solar_needs_power:"{entity_id} has no power sensor, and its counter may start again at 0. This solar needs a power sensor.",error_solar_needs_data:"{entity_id} has no power sensor, and its statistics do not show yet that its counter never starts again at 0 (it has to rise on two days). Set the solar’s power sensor, or wait a day or two.",error_no_safe_method:"No method fits {entity_id}: it needs a returned energy sensor on its device, a meter that counts backwards while feeding in, or power sensors for the circuit and the solar.",error_not_offered:"{entity_id} is not offered here (any more). The check was run again.",error_choose_returned:"Choose the returned energy sensor above.",error_input_disabled:"{entity_id} is disabled in Home Assistant. Enable it in its settings first; the setup does not enable it for you.",error_values_changed:"The values of {entity_id} changed meanwhile, so the starting value is no longer right. The check was run again: look at it, then set up again.",reason_gross_power_needs_signed:"No live power: the circuit’s power never went below 0 in the last days, so its sign is unclear",solar_setup_method_gone:"The chosen way is no longer possible – choose another one above.",solar_setup_power_refused_used:"{entity}, the power sensor of {owner} in your draft, is already used elsewhere in the energy dashboard or is a meter of this setup, so the setup cannot use it.",solar_setup_power_refused_not_power:"{entity}, the power sensor of {owner} in your draft, is not a power sensor (it needs the device class power and a unit like W or kW), so the setup cannot use it.",solar_setup_power_refused_ours:"{entity}, the power sensor of {owner} in your draft, is a gross power this setup made, so it would count the solar twice.",solar_setup_set_circuit_power:"Set power sensor of {name}",solar_setup_why_power:"Choose another power sensor first.",solar_setup_missing_power:"{name} has no power sensor.",evidence_unchecked:"not checked – the statistics could not be read",solar_setup_daily_question:"{name}: does it start again at 0 every day?",solar_term_energy_name:"{name} energy",solar_setup_power_not_kept:"The current power of {device} is not kept, because it is net. A live power cannot be added later; if you want one, set this up only once the circuit has fed in.",solar_setup_unusable_power:"{entity}, the power sensor of {name}, is disabled or has no power unit that can be read.",solar_block_free:"{solar}: where does it feed in?",solar_block_free_hint:"Drag it onto the circuit the solar feeds into.",solar_block_strip:"A solar is not placed yet",solar_block_placed_title:"Drag it onto another circuit to move it; click for more.",solar_block_placed:"{solar} is placed at {device}.",solar_block_removed:"{solar} is no longer placed.",solar_place_text:"{solar} feeds into {device}. This is shown in the diagram only; the energy settings do not change.",solar_place_move:"To move it, drag the solar block onto another circuit.",solar_place_replace_hint:"The meter of {device} counts the solar. To go back to the real meter, replace it.",solar_place_remove:"Remove placement",solar_setup_place_only:"My meter already counts the solar: only place it here",hint_solar_elsewhere:"{solar} is placed at {device}, but this meter still counts it, so it is counted twice. Replace this meter with the real one.",solar_block_pick:"Choose circuit…",solar_block_move:"Move to another circuit…",solar_pick_title:"Where does {solar} feed in?"},Ht={de:{title:"Energy Flow Mapper",menu:"Menü",more:"Mehr",reload:"Neu laden",undo:"Letztes Speichern rückgängig machen",backups:"Sicherungen",loading:"Wird geladen …",load_failed:"Die Energie-Einstellungen konnten nicht geladen werden.",sources:"Quellen",sources_hint:"Zieh einen freien Sensor auf eine Quelle oder tippe eine Quelle an. Preise änderst du in den Energie-Einstellungen.",open_energy_settings:"Energie-Einstellungen",no_sources:"Keine Quellen eingerichtet.",role_import:"Netz-Bezug",role_export:"Einspeisung",role_production:"Solar-Ertrag",role_discharge:"Batterie entladen",role_charge:"Batterie laden",role_gas:"Gas",role_water:"Wasser",role_home:"Hauszähler",diagram:"Energiefluss",zoom_hint:"Zoomen mit dem Mausrad oder zwei Fingern, Ziehen auf freier Fläche verschiebt.",zoom_in:"Vergrössern",zoom_out:"Verkleinern",fit:"Einpassen",orientation_label:"Ausrichtung",orientation_horizontal:"Horizontal",orientation_vertical:"Vertikal",role_battery:"Batterie",home_measured:"{power} gemessen",home_stale:"{name}: Daten nicht aktuell genug",home_calculated:"{power} berechnet",period_label:"Zeitraum",period_now:"Jetzt",period_today:"Heute",period_week:"7 Tage",period_month:"30 Tage",energy_loading:"Verbrauch wird geladen …",detail_energy:"Energie im Zeitraum",devices:"Geräte",devices_hint:"Zieh ein Gerät auf ein anderes, um es dort unterzuordnen, oder nutze das ⋮-Menü.",home:"Zuhause",home_drop:"Hier ablegen für die oberste Ebene",no_devices:"Noch keine Geräte im Energie-Dashboard. Füge einen freien Sensor hinzu.",untracked:"Nicht erfasster Verbrauch",untracked_without_one:"ohne {name}",untracked_without_many:"ohne {count} Geräte",untracked_missing_title:"Ohne Wert: {names}",free_sensors:"Freie Sensoren",free_collapse:"Freie Sensoren einklappen",free_expand:"Freie Sensoren ausklappen",free_sensors_hint:"Energiezähler, die noch nicht im Energie-Dashboard sind.",free_contained:"In Zählern enthalten",free_contained_hint:"Diese Sensoren stecken schon in einem Zähler deiner Energie-Einstellungen. Prüfe das, bevor du einen davon auch hinzufügst.",free_contained_in:"steckt in {meter}",search:"Suchen",no_candidates:"Keine freien Energie-Sensoren.",add:"Hinzufügen",add_title:"{name} hinzufügen unter …",with_power:"Leistungssensor: {entity}",actions:"Aktionen für {name}",move:"Verschieben nach …",move_title:"{name} verschieben nach …",top_level:"Oberste Ebene (Zuhause)",no_targets:"Für dieses Gerät gibt es keinen anderen Platz.",rename:"Umbenennen …",rename_title:"{name} umbenennen",replace_with:"Ersetzen durch …",replace_title:"{name} ersetzen durch …",replace_hint:"Übernimmt Platz, Untergeräte, Gruppe und den Namen, den du gesetzt hast.",replace_none:"Keine freien Sensoren",name_label:"Name",name_hint:"Leer lassen, um den Namen der Entity zu verwenden.",remove:"Aus dem Energie-Dashboard entfernen",use_as_home_meter:"Als Hauszähler verwenden",remove_hint:"Seine Untergeräte rücken eine Ebene nach oben.",cancel:"Abbrechen",ok:"OK",close:"Schliessen",details:"Details",select_hint:"Wähle ein Gerät, um Details zu sehen.",detail_statistic:"Statistik",detail_power_sensor:"Leistungssensor",detail_device:"Gerät",detail_area:"Bereich",detail_power:"Leistung jetzt",detail_untracked:"Von den Untergeräten nicht erfasst",detail_issues:"Probleme",none:"–",change_one:"1 Änderung",change_other:"{count} Änderungen",discard:"Verwerfen",save:"Speichern",confirm_title:"Änderungen speichern?",confirm_errors:"Behebe zuerst diese Probleme:",confirm_kept:"Diese Probleme waren schon vorher in deinen Energie-Einstellungen. Sie bleiben, wie sie sind, und verhindern das Speichern nicht:",confirm_kept_rejected:"Diese Probleme waren schon vorher in deinen Energie-Einstellungen:",confirm_warnings:"Bitte beachten:",checking:"Wird geprüft …",saving:"Wird gespeichert …",saved:"Gespeichert. Die vorherigen Einstellungen wurden gesichert.",nothing_to_save:"Es hat sich nichts geändert.",diff_added:"{name} hinzugefügt",diff_added_under:"{name} hinzugefügt unter {to}",diff_removed:"{name} entfernt",diff_moved:"{name} verschoben unter {to}",diff_moved_top:"{name} auf die oberste Ebene verschoben",diff_renamed:"{name} umbenannt in «{to}»",diff_renamed_reset:"{name} verwendet wieder den Namen der Entity",diff_rate:"Leistungssensor von {name} geändert",issue_cycle:"Teil einer Schleife von Geräten",issue_self_parent:"Sich selbst untergeordnet",issue_duplicate:"Mehrfach eingetragen",issue_missing_parent:"Sein vorgelagertes Gerät ist nicht im Energie-Dashboard",issue_source_and_device:"Wird auch als Quelle verwendet",issue_statistic_missing:"Statistik nicht gefunden",issue_not_energy_unit:"Die Einheit {unit} ist keine Energie-Einheit",issue_children_exceed_parent:"Seine Untergeräte verbrauchen mehr als dieses Gerät",issue_devices_exceed_home:"Die Geräte verbrauchen mehr als das Zuhause",issue_counted_twice:"Steckt auch im Zähler eines anderen Geräts, ist aber nicht darunter eingeordnet",issue_counted_twice_in:"Steckt schon in {meter}, ist aber nicht darunter eingeordnet",ha_reports:"Meldungen von Home Assistant",coverage_toggle:"Abdeckung",types_toggle:"Helfer markieren",type_sensor:"Sensor",type_helper:"Helfer",type_helper_kind:"Helfer: {kind}",type_integral:"Integral",type_group:"Gruppe",type_template:"Template",type_utility_meter:"Verbrauchszähler",type_external:"Externe Statistik",detail_type:"Art",coverage_percent:"{percent} % von Geräten erfasst",coverage_over:"über 100 % von Geräten erfasst",coverage_below_one:"< 1 % von Geräten erfasst",suggestion_text:"Vorschlag: enthalten in {parent}",suggestion_apply:"Übernehmen",suggestion_ignore:"Ignorieren",suggestion_apply_all:"Alle Vorschläge übernehmen",suggestion_show_ignored:"Ignorierte Vorschläge wieder zeigen",export_image:"Als Bild speichern",export_title:"Diagramm als Bild speichern",export_hide_names:"Namen ausblenden",export_hide_hint:"Geräte heissen dann Gerät 1, 2, …; Bereiche und Sensornamen fehlen.",export_save:"Speichern",export_device:"Gerät {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Entwurf, nicht gespeichert",export_failed:"Das Bild konnte nicht erstellt werden.",backups_title:"Sicherungen",backups_empty:"Noch keine Sicherungen. Vor jedem Speichern wird eine angelegt.",backup_by:"von {user}",restore:"Wiederherstellen",restore_confirm:"Die Sicherung vom {date} wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",undo_confirm:"Die Einstellungen von vor dem letzten Speichern ({date}) wiederherstellen? Die aktuellen Einstellungen werden vorher gesichert.",draft_lost:"Deine ungespeicherten Änderungen gehen dabei verloren.",restored:"Sicherung wiederhergestellt.",summary_added:"{count} hinzugefügt",summary_removed:"{count} entfernt",summary_moved:"{count} verschoben",summary_renamed:"{count} umbenannt",summary_rate:"{count} mit neuem Leistungs- oder Durchflusssensor",summary_restored:"Sicherung wiederhergestellt",error_conflict:"Die Energie-Einstellungen oder Gruppen wurden in der Zwischenzeit an anderer Stelle geändert. Sie wurden neu geladen; prüfe deine Änderungen und speichere noch einmal.",error_not_loaded:"Energy Flow Mapper ist nicht geladen.",error_unsupported_energy_api:"Die Energie-Einstellungen dieser Home-Assistant-Version werden nicht unterstützt. Zum Schutz deiner Einstellungen ist der Editor deaktiviert.",assign_title:"{role} zuweisen",assign_hint:"Wähle einen freien Energiezähler.",battery_title:"Batterie: Zähler fürs Laden",battery_hint:"{name} misst das Entladen. Wähle den Zähler, der das Laden misst.",source_assign:"Sensor zuweisen …",source_replace:"Sensor ersetzen …",source_remove:"Als Quelle entfernen",power_only:"Nur Leistung",power_only_hint:"Diese Leistungssensoren haben keinen Energiezähler. «Zähler anlegen» erstellt sofort einen Integral-Helfer; er bleibt auch ohne Energy Flow Mapper bestehen.",create_meter:"Zähler anlegen",create_meter_title:"Energiezähler für {name} anlegen?",create_meter_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt. Er ist ein normaler Home-Assistant-Helfer und bleibt auch bestehen, wenn du Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf.",creating:"Wird angelegt …",meter_created:"Zähler «{name}» angelegt und zum Entwurf hinzugefügt.",energy_suffix:"Energie",external_statistic:"Externe Statistik",created_by:"Von Energy Flow Mapper angelegt",detail_helper:"Helfer",diff_source_added:"{name} als {role} zugewiesen",diff_source_removed:"{name} als {role} entfernt",summary_source_added:"{count} als Quelle zugewiesen",summary_source_removed:"{count} als Quelle entfernt",diff_source_rate:"Leistungssensor von {name} ({role}) geändert",diff_source_rate_flow:"Durchflusssensor von {name} ({role}) geändert",summary_source_rate:"{count} Quelle(n) mit neuem Leistungs- oder Durchflusssensor",issue_duplicate_source:"Von mehreren Quellen verwendet",error_unknown_source:"Dieser Sensor ist keine Quelle im Energie-Dashboard.",error_invalid_power_config:"Dieser Leistungssensor passt nicht zu dieser Quelle.",error_home_exists:"Es gibt schon einen Hauszähler.",error_home_not_supported:"Diese Home-Assistant-Version kennt keinen Hauszähler; dafür braucht es 2026.11 oder neuer.",error_not_a_power_candidate:"Dieser Sensor ist kein Leistungs- oder Durchflusssensor ohne Zähler.",error_integral_failed:"Der Helfer für den Zähler konnte nicht angelegt werden.",confirm_rejected:"Home Assistant akzeptiert diese Einstellungen nicht:",source_last_meter:"Das ist der letzte Zähler dieses Netzanschlusses. Entfernst du ihn, wird der Anschluss mit seinen Preisen entfernt.",error_invalid_changes:"Der Entwurf hat Fehler und wurde nicht gespeichert.",error_restore_invalid:"Diese Sicherung kann nicht wiederhergestellt werden: Zusammen mit den aktuellen Energie-Einstellungen gäbe es Fehler ({issues}). Es wurde nichts geändert.",error_device_exists:"Dieses Gerät ist bereits im Energie-Dashboard.",error_unknown_device:"Ein Gerät aus deinem Entwurf ist nicht mehr im Energie-Dashboard. Verwirf den Entwurf und versuche es noch einmal.",error_unknown_change:"Diese Änderung wird nicht unterstützt.",error_backup_not_found:"Diese Sicherung gibt es nicht mehr.",error_rejected_by_home_assistant:"Home Assistant hat die Einstellungen abgelehnt: {error}",backups_hint:"Gespeichert im Konfigurationsordner von Home Assistant und damit in jedem Home-Assistant-Backup enthalten. Exportiere eine Datei, um eine Kopie woanders aufzubewahren.",export_current:"Aktuelle Einstellungen exportieren",import_file:"Aus Datei importieren …",export:"Exportieren",import_title:"{file} importieren",import:"Importieren",import_unchanged:"Diese Datei enthält deine aktuellen Einstellungen. Es gibt nichts zu importieren.",import_invalid_file:"Diese Datei konnte nicht gelesen werden. Wähle eine Datei, die Energy Flow Mapper exportiert hat.",imported:"Importiert. Die bisherigen Einstellungen wurden gesichert.",summary_imported:"Datei importiert",error_invalid_import:"Diese Datei ist kein Export von Energy Flow Mapper.",error_unknown:"Fehler: {message}",tabs_label:"Teil des Energie-Dashboards",tab_electricity:"Strom",tab_gas:"Gas",diagram_gas:"Gaszähler",free_sensors_hint_gas:"Gaszähler, die noch nicht im Energie-Dashboard sind. Home Assistant kennt keine Gas-Geräte, nur Gaszähler.",no_candidates_gas:"Keine freien Gaszähler.",assign_hint_gas:"Wähle einen freien Gaszähler.",tab_water:"Wasser",diagram_water:"Wasserfluss",free_sensors_hint_water:"Wasserzähler, die noch nicht im Energie-Dashboard sind.",no_candidates_water:"Keine freien Wasserzähler.",assign_hint_water:"Wähle einen freien Wasserzähler.",with_flow:"Durchflusssensor: {entity}",detail_flow_sensor:"Durchflusssensor",detail_flow:"Durchfluss jetzt",detail_volume:"Wasser im Zeitraum",issue_not_water_unit:"Die Einheit {unit} ist keine Wasser-Einheit",diff_water:"Wasser: {text}",diff_rate_water:"Durchflusssensor von {name} geändert",undo_change:"Änderung zurücknehmen",undo_change_hint:"Die letzte Änderung des Entwurfs zurücknehmen (Strg+Z)",draft_restored:"Deine ungespeicherten Änderungen wurden wiederhergestellt.",draft_outdated:"Deine ungespeicherten Änderungen konnten nicht wiederhergestellt werden, weil die Energie-Einstellungen inzwischen geändert wurden.",blocked_one:"1 Problem verhindert das Speichern",blocked_other:"{count} Probleme verhindern das Speichern",blocked_hint:"Auf «Speichern» klicken, um die Probleme zu sehen.",show_block:"Zeigen",change_undone:"Letzte Änderung zurückgenommen.",flow_only:"Nur Durchfluss",flow_only_hint:"Diese Durchflusssensoren haben keinen Wasserzähler. «Zähler anlegen» erstellt sofort einen Integral-Helfer; er bleibt auch ohne Energy Flow Mapper bestehen.",create_water_meter_title:"Wasserzähler für {name} anlegen?",create_water_meter_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt. Er zählt den Durchfluss zu Wasser zusammen (L/min zu Litern, m³/h zu m³) und wird als Wasser angezeigt. Er ist ein normaler Home-Assistant-Helfer und bleibt auch, wenn du Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf.",water_suffix:"Wasser",find_device:"Gerät suchen",find_none:"Kein Treffer",find_count:"{index} von {count}",find_next:"Weiter",card_empty:"Noch keine Geräte im Energie-Dashboard.",card_root_missing:"Dieses Gerät ist nicht mehr im Energie-Dashboard. Wähle in den Karten-Einstellungen ein anderes.",card_root_group_missing:"Diese Gruppe gibt es nicht mehr. Wähle in den Karten-Einstellungen einen anderen Start.",card_root_all:"Ganzes Zuhause",card_root_group:"Gruppe: {name}",card_root_group_in:"Gruppe: {name} (in {parent})",card_stale:"Aktualisieren fehlgeschlagen, die letzten Werte werden angezeigt.",card_field_title:"Titel (leer: kein Titel)",card_field_kind:"Anzeigen",card_field_root:"Start bei",card_field_show_sources:"Quellen anzeigen",card_field_show_untracked:"Nicht erfassten Verbrauch anzeigen",card_field_show_coverage:"Anzeigen, wie viel die Geräte erfassen",card_field_show_types:"Helfer und externe Statistiken markieren",select_mode:"Auswählen",select_done:"Fertig",select_mode_hint:"Tippe Blöcke an, um sie zum Gruppieren auszuwählen. Strg+Klick geht auch.",selected_count:"{count} ausgewählt",group_selection:"Gruppieren",clear_selection:"Auswahl aufheben",group_parents_hint:"Nur Geräte mit demselben Elternteil",group_name_title:"Neue Gruppe benennen",group_devices_one:"1 Gerät",group_devices_other:"{count} Geräte",group_actions:"Aktionen für Gruppe {name}",diff_group_created:"Gruppe «{name}» erstellt ({devices})",diff_group_renamed:"Gruppe «{from}» umbenannt in «{to}»",diff_group_dissolved:"Gruppe «{name}» aufgelöst",diff_group_changed:"Gruppe «{name}» geändert ({devices})",summary_group_created:"{count} Gruppe(n) erstellt",summary_group_renamed:"{count} Gruppe(n) umbenannt",summary_group_dissolved:"{count} Gruppe(n) aufgelöst",summary_group_changed:"{count} Gruppe(n) geändert",export_group:"Gruppe {n}",error_unknown_group:"{stat} ist keine Gruppe.",error_group_parents_differ:"{stat} gehört nicht unter dasselbe Gerät wie diese Gruppe.",error_group_loop:"Eine Gruppe kann nicht in sich selbst oder unter eines ihrer eigenen Geräte verschoben werden ({stat}).",error_group_name_empty:"Eine Gruppe braucht einen Namen.",error_group_name_taken:"Hier gibt es schon eine Gruppe mit dem Namen {stat}.",error_group_exists:"Die Gruppe {stat} gibt es schon.",group_dissolve:"Gruppe auflösen",suggest_groups:"Gruppen aus Bereichen vorschlagen",suggest_groups_none:"Keine Gruppen vorzuschlagen: Keine zwei ungruppierten Geräte unter demselben Elternteil liegen im selben Bereich.",sum_create:"Summen-Zähler erstellen",sum_create_button:"Erstellen",sum_members:"Sensoren in der Summe",sum_fixed_hint:"Alle Geräte der Gruppe sind in der Summe; weitere Sensoren kannst du hinzufügen.",sum_add:"Sensor hinzufügen",sum_remove:"{name} aus der Summe entfernen",sum_no_sensors:"Es kann kein weiterer Sensor hinzugefügt werden.",sum_blocked:"Die markierten Sensoren können nicht summiert werden, darum kann der Summen-Zähler nicht erstellt werden.",sum_text:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt und zählt diese Sensoren zusammen. Er ist ein normaler Home-Assistant-Helfer und bleibt auch bestehen, wenn du die Änderung zurücknimmst oder Energy Flow Mapper entfernst. Sein Zähler kommt danach in deinen Entwurf; alle Geräte der Summe kommen unter ihn, Quellen bleiben Quellen.",sum_text_replace:"Der Helfer «{helper}» wird sofort unter Einstellungen → Helfer angelegt und zählt diese Sensoren zusammen. Er ist ein normaler Home-Assistant-Helfer und bleibt auch bestehen, wenn du die Änderung zurücknimmst oder Energy Flow Mapper entfernst. Sein Zähler tritt danach in deinem Entwurf an die Stelle von {name}, mit dessen Unterzählern; Quellen bleiben Quellen.",sum_rate_hint:"Alle Zähler der Summe haben einen Leistungssensor, darum zählt ein zweiter Helfer «{helper}» ihre Leistung zusammen.",sum_rate_hint_water:"Alle Zähler der Summe haben einen Durchflusssensor, darum zählt ein zweiter Helfer «{helper}» ihren Durchfluss zusammen.",sum_rate_missing:"Keine Leistungssumme, weil diese keinen Leistungssensor haben: {names}.",sum_rate_missing_water:"Keine Durchflusssumme, weil diese keinen Durchflusssensor haben: {names}.",sum_rate_source_sign:"Keine Leistungssumme: Die Leistung von Netz und Batterie lässt sich nicht zusammenzählen, weil ihr Vorzeichen von der Richtung abhängt.",sum_rate_source_water:"Keine Durchflusssumme: Der Durchfluss einer Wasser-Quelle lässt sich nicht zu einer Durchflusssumme zusammenzählen.",sum_replace:"{name} ersetzen",sum_replace_reason:"Er ist schon Teil der Summe; unter dem neuen Zähler würde er doppelt gezählt.",sum_created:"Summen-Zähler «{name}» erstellt und zum Entwurf hinzugefügt.",sum_solar_use_setup:"Ein Summen-Zähler mit einer Solaranlage braucht die geführte Einrichtung «Solar speist hier ein…»: Nur sie prüft, wie dein Stromkreis-Zähler zählt, damit nichts doppelt oder falsch gezählt wird. Darum wird diese Summe nicht erstellt.",sum_member_unchecked:"Nicht geprüft: zu wenig Statistiken, um zu sehen, ob er wieder bei 0 beginnt",sum_periodic_solar:"Für eine Solaranlage in einem Stromkreis baut «Solar speist hier ein…» stattdessen den Brutto-Zähler.",sum_periodic_way:"Was du tun kannst: Nimm stattdessen den Gesamtzähler des Geräts (seit Inbetriebnahme), oder erstelle einen Zähler aus seinem Leistungssensor (ein Integral-Helfer unter Einstellungen → Geräte & Dienste → Helfer).",sum_mixed_total:"Ein Zähler mit total (ein Brutto- oder Netto-Zähler, der auch fallen kann) lässt sich nicht mit Zählern summieren, die nur steigen (total_increasing): Home Assistant nähme die Summe nicht als Zähler an. Lass diese Geräte stattdessen einzeln im Baum.",sum_state_class_list:"Zustandsklassen: {list}.",sum_solar_save_first:"{names}: Eine Solaranlage wurde nur in deinem Entwurf geändert (hinzugefügt, entfernt oder mit einem anderen Leistungssensor). Speichere zuerst, dann erstelle die Summe.",sum_solar_no_device:"Die Summe hat kein Gerät, in das die Solaranlage einspeisen könnte. Entferne die Solaranlage aus der Summe.",sum_solar_is:"Eine Solaranlage oder ein Teil davon: {names}.",sum_solar_open_setup:"Solaranlage für {name} einrichten",sum_solar_one_device:"Die Einrichtung baut den Brutto-Zähler des Geräts, in das die Solaranlage einspeist; er bleibt danach ein eigenes Gerät. Summiere die anderen Geräte ohne die Solaranlage.",sum_solar_holders:"Enthalten schon eine Solaranlage: {names}. Ist einer davon schon ein Brutto-Zähler (Verbrauch mit seiner eigenen Solaranlage), markiere ihn unten; sonst entferne ihn aus der Summe.",sum_solar_holders_group:"Enthalten schon eine Solaranlage: {names}. Ist einer davon schon ein Brutto-Zähler (Verbrauch mit seiner eigenen Solaranlage), markiere ihn unten; sonst nimm ihn zuerst aus der Gruppe: Jedes Gerät einer Gruppe ist in ihrer Summe.",sum_solar_no_device_group:"Die Summe hat kein Gerät, in das die Solaranlage einspeisen könnte. Nimm die Solaranlage zuerst aus der Gruppe: Jedes Gerät einer Gruppe ist in ihrer Summe.",sum_solar_one_device_group:"Die Einrichtung baut den Brutto-Zähler des Geräts, in das die Solaranlage einspeist; er bleibt danach ein eigenes Gerät. Nimm die Solaranlage zuerst aus der Gruppe und summiere dann die Gruppe.",sum_solar_group_move:"Nimm die Solaranlage zuerst aus der Gruppe: Jedes Gerät einer Gruppe ist in ihrer Summe.",sum_gross_ok:"{name} ist schon ein Brutto-Zähler (Verbrauch mit Solar) – trotzdem summieren",sum_periodic:"Diese Zähler beginnen ab und zu (zum Beispiel täglich) wieder bei 0, darum kann die Summe nicht erstellt werden: Mit ihnen fiele sie bei jedem ihrer Neustarts, und Home Assistant würde die ganze Summe nochmals zählen. Entferne sie aus der Summe.",sum_periodic_member:"{name}: {evidence}",sum_check_unknown:"Nicht geprüft: Ob ein Zähler täglich wieder bei 0 beginnt, liess sich nicht prüfen (der Recorder hat nicht geantwortet). Du kannst die Summe trotzdem erstellen.",sum_check_retry:"Erneut prüfen",sum_checking:"Wird geprüft, ob ein Zähler täglich wieder bei 0 beginnt …",sum_need_name:"Gib dem Helfer einen Namen.",sum_need_member:"Füge mindestens einen Sensor hinzu.",evidence_utility_meter:"ein Verbrauchszähler-Helfer, der periodisch zurückgesetzt wird",evidence_last_reset:"sein Startzeitpunkt (last_reset) wechselt",evidence_drop:"fiel am {date} um {time} von {before} auf {after}",evidence_statistics:"seine Statistiken zeigen, dass er wieder bei 0 beginnt",sum_reason_external:"Externe Statistik: Ein Helfer kann sie nicht summieren",sum_reason_not_sensor:"Kein Sensor",sum_reason_unavailable:"In Home Assistant nicht gefunden",sum_reason_device_class:"Geräteklasse ist nicht {device_class}",sum_reason_state_class:"Zustandsklasse ist nicht total oder total_increasing",power_suffix:"Leistung",flow_suffix:"Durchfluss",error_sum_not_possible:"{entity} kann nicht summiert werden: Es muss ein Sensor mit der passenden Geräteklasse und der Zustandsklasse total oder total_increasing sein.",error_sum_state_classes_differ:"Die Sensoren haben nicht alle dieselbe Zustandsklasse (total oder total_increasing), darum würde ihre Summe nicht als Zähler akzeptiert.",error_sum_failed:"Der Summen-Zähler konnte nicht erstellt werden.",error_sum_with_solar:"{entity} ist ein Solarzähler oder enthält einen. Ein Summen-Zähler mit einer Solaranlage braucht stattdessen die geführte Einrichtung «Solar speist hier ein…».",error_template_failed:"Der Template-Helfer für den Zähler konnte nicht erstellt werden.",error_returned_disabled:"Der Sensor für zurückgespeiste Energie {entity_id} ist deaktiviert. Aktiviere ihn zuerst in seinen Entitätseinstellungen in Home Assistant.",error_daily_without_power:"{entity_id} fängt jeden Tag wieder bei 0 an; darum könnte nur «Aus der Leistung» den Brutto-Zähler bauen, und das braucht einen Leistungssensor für den Kreis und einen für die Solaranlage.",error_solar_already_in_meter:"{entity_id} zählt die Solaranlage schon mit, ein Brutto-Zähler würde sie also doppelt zählen. Verwende ihn so, wie er ist, oder nimm die Solaranlage zuerst aus der Summe.",error_unsupported_input:"{entity_id} kann nicht im Brutto-Zähler verwendet werden: Es braucht einen Sensor mit einer Energie- oder Leistungseinheit.",error_daily_check_failed:"Die Prüfung, ob die Zähler von {entity_id} jeden Tag wieder bei 0 beginnen, konnte nicht laufen: Der Recorder hat nicht rechtzeitig geantwortet. Versuche es gleich noch einmal.",error_input_not_ready:"{entity_id} hat gerade keinen Wert, darum kann der Startwert des Brutto-Zählers nicht festgelegt werden. Versuche es wieder, wenn er einen Wert meldet.",discard_title:"Entwurf verwerfen?",discard_confirm:"Alle {count} Änderungen des Entwurfs gehen verloren. Das lässt sich nicht rückgängig machen.",tools:"Werkzeuge",help:"Hilfe",sum_name_exists:"Es gibt schon eine Entität namens «{name}». Der neue Helfer bekäme denselben Namen; wähle einen anderen, damit du sie unterscheiden kannst.",power_sensor:"Leistungssensor …",flow_sensor:"Durchflusssensor …",power_variant_single:"Standard",power_variant_inverted:"Invertiert",power_variant_two:"Zwei Sensoren",power_none:"Keiner",power_same_device:"Gleiches Gerät",power_sensor_label:"Leistungssensor",flow_sensor_label:"Durchflusssensor",power_variant_single_grid:"Ein Sensor: positiv bei Netzbezug, negativ bei Einspeisung.",power_variant_inverted_grid:"Ein Sensor mit umgekehrtem Vorzeichen: positiv bei Einspeisung, negativ bei Netzbezug.",power_variant_two_grid:"Je ein Sensor für Bezugs- und Einspeiseleistung, beide positiv.",power_variant_single_battery:"Ein Sensor: positiv beim Entladen, negativ beim Laden.",power_variant_inverted_battery:"Ein Sensor mit umgekehrtem Vorzeichen: positiv beim Laden, negativ beim Entladen.",power_variant_two_battery:"Je ein Sensor für Entlade- und Ladeleistung, beide positiv.",hints:"Hinweise",hint_returned_energy:"Sein Gerät zählt auch zurückgespeiste Energie ({entity}). Wenn eine Solaranlage in diesen Stromkreis einspeist, sieht dieser Zähler nur, was der Stromkreis vom Haus bezieht, nicht was die Solaranlage darin produziert.",hint_returned_energy_disabled:"Sein Gerät hat auch einen Sensor für zurückgespeiste Energie ({entity}), der deaktiviert ist, und dieser Stromkreis hat in letzter Zeit Energie zurückgespeist (seine Leistung war unter 0). Wenn eine Solaranlage in diesen Stromkreis einspeist, sieht dieser Zähler nur, was der Stromkreis vom Haus bezieht, nicht was die Solaranlage darin produziert.",hint_daily_in_sum:"Diese Summe mischt Zähler, die jeden Tag wieder bei 0 beginnen, mit Zählern, die das nicht tun: {names}. Die Summe fällt dann einmal am Tag, und Home Assistant zählt die ganze Summe noch einmal. Verwende im Helfer stattdessen einen Zähler, der nicht zurückgesetzt wird (für eine Solaranlage ein Integral ihrer Leistung).",hint_power_available:"Sein Gerät hat einen Leistungssensor, der nicht gesetzt ist: {entity}.",hint_flow_available:"Sein Gerät hat einen Durchflusssensor, der nicht gesetzt ist: {entity}.",hint_set_power:"Leistungssensor setzen",hint_set_flow:"Durchflusssensor setzen",hint_open_helper:"Helfer-Einstellungen öffnen",hint_dismiss:"Ausblenden",hint_dismiss_title:"Diesen Hinweis dauerhaft ausblenden. «Ignorierte Vorschläge wieder zeigen» bringt ihn zurück.",hint_dismiss_event_title:"Diesen Hinweis nur für dieses Ereignis ausblenden. Ein neues wird wieder gezeigt.",hint_children_solar:"Vielleicht speist eine Solaranlage in diesen Stromkreis ein: Dann fehlt seinem Zähler, was die Solaranlage darin produziert, und die untergeordneten Geräte scheinen mehr zu verbrauchen.",hint_readme:"Mehr dazu im README",hint_show_sensor:"Sensor anzeigen",hint_minutes:"{count} min",hint_hours:"{count} h",hint_gross_off_down:"{meter} ging in der Stunde ab {time} am {date} um {drop} zurück.",hint_gross_off_down_power:"{meter} ging in der Stunde ab {time} am {date} um {drop} zurück; seine Brutto-Leistung ergab {power}.",hint_gross_off_less:"{meter} zählte in der Stunde ab {time} am {date} {change}, deutlich weniger, als seine Brutto-Leistung ergab ({power}).",hint_gross_off_more:"{meter} zählte in der Stunde ab {time} am {date} {change}, deutlich mehr, als seine Brutto-Leistung ergab ({power}).",hint_gross_off_counted:"{meter} zählte in der Stunde ab {time} am {date} {change}.",hint_gross_off_input:"Wahrscheinlich wurde der Zähler {input} zurückgesetzt oder ersetzt: Er fiel in dieser Stunde auf weniger als die Hälfte, und der Brutto-Zähler behält diese Stufe. Du kannst die Stufe in Entwicklerwerkzeuge → Statistiken aus der Statistik nehmen (siehe README).",hint_gross_off_input_net:"Wahrscheinlich wurde der Zähler {input} zurückgesetzt oder ersetzt: Er fiel in dieser Stunde auf weniger als die Hälfte, und der Brutto-Zähler behält diese Stufe. Ein Zähler, der in beide Richtungen zählt, geht zwar auch zurück, während der Kreis einspeist, aber selten so weit. Du kannst die Stufe in Entwicklerwerkzeuge → Statistiken aus der Statistik nehmen (siehe README).",hint_gross_off_solar_term:"Sein Helfer für die Energie der Solaranlage zählte in dieser Stunde deutlich weniger als die Solaranlage selbst: Ihre Leistung hatte keinen Wert (unbekannt oder länger als 10 Minuten nicht verfügbar), oder Home Assistant lief nicht. Diese Solarenergie fehlt im Brutto-Zähler; zu beheben gibt es nichts.",hint_gross_off_sign:"Der Zähler zählt mit Energiezählern und stimmt darum wahrscheinlich; abweichend ist seine Brutto-Leistung. Entweder ist ihr Vorzeichen falsch, oder der Zähler stand eine Weile still und holte dann auf: Eine solche einmalige Stufe verschwindet nach 7 Tagen von selbst aus dem Hinweis. Zeigt die Brutto-Leistung das falsche Vorzeichen, setze den Leistungssensor des Geräts auf «Keiner»: Der Zähler zählt weiter, nur sein aktueller Wert fällt weg. Nach dem Speichern verschwindet der Hinweis.",hint_gross_off_sign_power:"Dieser Brutto-Zähler zählt seine Brutto-Leistung, und diese Leistung ging unter 0. Hat die Leistung des Kreises das falsche Vorzeichen, zählt auch der Zähler falsch: Richte den Brutto-Zähler neu ein, mit umgekehrter Leistung des Kreises. Speist eine Batterie oder etwas anderes in den Kreis ein, gibt es keine Lösung: Das kann ein Brutto-Zähler nicht zählen.",hint_gross_off_below_zero:"Ein Brutto-Verbrauchszähler darf nicht unter 0 gehen. Entweder speist ausser der Solaranlage noch etwas in den Kreis ein (eine Batterie, ein zweiter Wechselrichter), oder seine Eingänge sind vertauscht (Bezug und Rücklieferung vertauscht, oder ein Netto-Zähler, der andersherum zählt). Richte den Brutto-Zähler mit der richtigen Art neu ein. Eine Batterie, die einspeist, kann ein Brutto-Zähler nicht zählen: Setze dann den eigenen Zähler des Kreises mit ⋮ → «Ersetzen durch …» wieder ein.",hint_gross_off_unclear:"Die Statistik zeigt nicht, warum.",hint_gross_unknown:"{meter} hatte ab {time} am {date} {length} lang keinen Wert.",hint_gross_unknown_power:"{meter} konnte ab {time} am {date} {length} lang nicht zählen.",hint_gross_unknown_input:"Auch {input} hatte in dieser Zeit keinen Wert, und der Brutto-Zähler braucht alle seine Sensoren. Prüfe diesen Sensor.",hint_gross_unknown_inputs:"Der Brutto-Zähler braucht alle seine Sensoren; prüfe die, aus denen er besteht.",hint_solar_term_short:"Am {date} zählte der Helfer {term} {term_energy} Energie dieser Solaranlage, deutlich weniger als die Solaranlage selbst ({source_energy}). Ihre Leistung hatte keinen Wert (unbekannt oder länger als 10 Minuten nicht verfügbar), oder Home Assistant lief nicht; den Brutto-Zählern, die den Helfer verwenden, fehlt diese Energie. Zu beheben gibt es nichts; kommt es oft vor, prüfe den Leistungssensor der Solaranlage.",hint_solar_term_high:"Am {date} zählte der Helfer {term} {term_energy} Energie dieser Solaranlage, deutlich mehr als die Solaranlage selbst ({source_energy}). Vielleicht behält ihre Leistung einen Wert, während nichts produziert wird (ein über Nacht hängender Wert), sie misst etwas anderes (die Gleichstrom- oder Batterieseite), oder der eigene Energiezähler der Solaranlage bucht einen Teil des Tages verspätet, über Mitternacht. Prüfe den Leistungssensor der Solaranlage.",solar_setup:"Solar speist hier ein…",solar_setup_title:"Solar speist in {name} ein",solar_setup_intro:"Die Solaranlage speist in diesen Stromkreis ein, und die Geräte daran verbrauchen ihre Energie, bevor sie den Zähler erreicht. Der Zähler zeigt darum weniger, als sie verbrauchen, oder wird sogar negativ. Die Einrichtung baut einen Brutto-Zähler: was die Geräte an diesem Stromkreis wirklich verbrauchen.",solar_setup_no_solar:"Die Einrichtung braucht eine Solar-Quelle im Energie-Dashboard. Füge zuerst eine hinzu und starte die Einrichtung dann noch einmal.",solar_setup_source:"Solaranlage",solar_setup_set_solar_power:"Leistungssensor der Solaranlage setzen",solar_setup_open_settings:"Einstellungen öffnen",solar_setup_preview:"Was angelegt wird",solar_setup_energy:"Ein Template-Helfer für die Brutto-Energie, {formula}:",solar_setup_offset:"Die {offset} kWh werden addiert, damit der Brutto-Zähler über 0 beginnt: Die Energie-Einstellungen von Home Assistant melden einen Zähler, dessen Zustand unter 0 ist. Sie ändern nichts daran, was er zählt.",solar_setup_power:"Ein Template-Helfer für die Brutto-Leistung, {formula}:",solar_setup_text:"Die Helfer werden sofort unter Einstellungen → Helfer angelegt. Sie sind normale Home-Assistant-Helfer und bleiben auch bestehen, wenn du die Änderung zurücknimmst oder Energy Flow Mapper entfernst. Der Brutto-Zähler nimmt danach in deinem Entwurf den Platz von {name} ein, mit seinen untergeordneten Geräten und seiner Gruppe, und mit dem Namen, den du {name} gegeben hast, falls vorhanden. Er bekommt die Brutto-Leistung als Leistungssensor. Speichere wie gewohnt.",solar_setup_text_no_power:"Die Helfer werden sofort unter Einstellungen → Helfer angelegt. Sie sind normale Home-Assistant-Helfer und bleiben auch bestehen, wenn du die Änderung zurücknimmst oder Energy Flow Mapper entfernst. Der Brutto-Zähler nimmt danach in deinem Entwurf den Platz von {name} ein, mit seinen untergeordneten Geräten und seiner Gruppe, und mit dem Namen, den du {name} gegeben hast, falls vorhanden. Speichere wie gewohnt.",solar_setup_button:"Einrichten",solar_setup_done:"Brutto-Zähler «{name}» angelegt; er nimmt im Entwurf den Platz von {old} ein.",solar_setup_created_only:"Brutto-Zähler «{name}» angelegt. Er konnte im Entwurf nicht den Platz von {old} einnehmen; setze ihn dort mit «Ersetzen durch …» ein.",solar_gross_name:"{name} Brutto",solar_gross_power_name:"{name} Brutto-Leistung",solar_setup_method:"Wie soll der Brutto-Zähler gebaut werden?",solar_method_em:"EM-Zähler: brutto = Bezug − Rückspeisung + Solar",solar_method_em_hint:"Für einen Zähler, der Bezug und Rückspeisung des Kreises getrennt zählt, wie ein Shelly Pro EM.",solar_method_plug:"Stecker oder Schalter: brutto = Energie − 2 × Rückspeisung + Solar",solar_method_plug_hint:"Für einen Shelly-Stecker oder -Schalter, dessen «Energie» beide Richtungen zählt.",solar_method_net:"Netto-Zähler: brutto = Zähler + Solar",solar_method_net_hint:"Für einen Zähler, der rückwärts zählt, während der Kreis einspeist.",solar_method_power:"Aus der Leistung: brutto = Integral von (Leistung des Kreises + Solar-Leistung)",solar_method_power_hint:"Stimmt für jedes Gerät, dessen Leistung des Kreises ein Vorzeichen hat; die Energie ist eine Schätzung aus der Leistung.",solar_method_suggested:"Vorschlag",reason_rule_shelly_em:"passt zu deinem Gerät ({device})",reason_rule_shelly_plug:"passt zu deinem Gerät ({device}): seine «Energie» zählt beide Richtungen",reason_rule_shelly_consumed:"passt zu deinem Gerät ({device}): «Verbrauchte Energie» zählt nur den Bezug",reason_rule_net_negative:"passt zu deinem Zähler: er ging in den letzten Tagen unter 0",reason_power_signed:"geprüft: seine Leistung ging in den letzten Tagen unter 0, sie hat also ein Vorzeichen",reason_unverified_against_rule:"nicht geprüft – das ist nicht die Regel deines Geräts oder nicht der Sensor für zurückgespeiste Energie, dem sie vertraut; nur wählen, wenn du weisst, dass dein Zähler so zählt",reason_unverified_may_reset:"nicht geprüft – dieser Zähler fängt nach einem Stromausfall vielleicht wieder bei 0 an",reason_unverified_net:"nicht geprüft – nur wählen, wenn dein Zähler beim Einspeisen rückwärts zählt; er ging in den letzten Tagen nie unter 0",reason_unverified_no_data:"nicht geprüft – ein Zähler davon hat in den letzten Tagen keine Statistik; gib unten an, ob er täglich wieder bei 0 anfängt",reason_unverified_power_unsigned:"nicht geprüft – der Kreis hat in den letzten Tagen nie eingespeist, darum ist unklar, ob seine Leistung ein Vorzeichen hat",reason_net_needs_signed_meter:"nicht angeboten – der Zähler zählt nur aufwärts (total increasing), Home Assistant würde also jedes Sinken als Zurücksetzen lesen",reason_no_returned_sensor:"nicht angeboten – sein Gerät hat keinen Sensor für zurückgespeiste Energie",reason_daily_input:"nicht angeboten – ein Zähler davon fängt täglich wieder bei 0 an",reason_unsupported_input:"nicht angeboten – ein Zähler davon hat keine lesbare Energieeinheit",reason_no_power:"nicht angeboten – es braucht einen Leistungssensor für den Kreis und einen für die Solaranlage",reason_unusable_power:"nicht angeboten – der Leistungssensor des Kreises ist deaktiviert oder hat keine lesbare Leistungseinheit",solar_setup_drawn:"Zähler für den Bezug des Kreises",solar_setup_returned:"Sensor für zurückgespeiste Energie",solar_setup_choose:"Wählen …",solar_setup_disabled_option:"{entity} (in Home Assistant deaktiviert)",solar_setup_disabled_sensor:"{entity} ist in Home Assistant deaktiviert. Die Einrichtung aktiviert ihn nicht für dich.",solar_setup_inputs:"Zähler und ihre Statistik",solar_setup_daily:"Fängt täglich (periodisch) wieder bei 0 an",solar_setup_lifetime:"Zählt immer weiter (fängt nie wieder bei 0 an)",solar_setup_daily_locked:"Fest: {evidence}.",solar_setup_daily_hint:"Aus der Statistik vorgewählt; ändere es, wenn du es besser weisst.",evidence_lifetime:"stieg in den letzten Tagen, ohne wieder bei 0 anzufangen",evidence_no_data:"keine Statistik in den letzten Tagen",solar_setup_power_title:"Leistung",solar_setup_circuit_power:"Kreis: {entity} ({from})",solar_setup_solar_power:"Solar: {entity} ({from})",solar_setup_circuit_none:"Kreis: kein Leistungssensor",solar_setup_solar_none:"Solar: kein Leistungssensor",solar_setup_from_draft:"aus deinem Entwurf",solar_setup_from_saved:"gespeichert",solar_setup_from_paired:"auf seinem Gerät gefunden",solar_setup_live:"Jetzt: Kreis {circuit} + Solar {solar} = {gross}",solar_setup_live_hint:"Prüfe, ob das zu dem passt, was gerade läuft: Während der Kreis einspeist, ist seine Leistung negativ.",solar_setup_invert:"Leistung des Kreises umkehren",solar_setup_invert_hint:"Für einen Leistungssensor, der positiv ist, während der Kreis einspeist.",solar_setup_power_history:"Die neue Brutto-Energie beginnt bei 0 und hat keine Vorgeschichte; sie ist eine Schätzung aus der Leistung.",solar_setup_counter_night:"{solar} hat keinen Leistungssensor, darum wird sein Zähler direkt verwendet. Nachts kann der Brutto-Zähler pausieren, und der Verbrauch der Nacht landet dann am Morgen; die Summen stimmen trotzdem.",solar_setup_hold:"Ist die Solaranlage «nicht verfügbar», wird ihre letzte Leistung bis zu 10 Minuten gehalten, danach zählt sie als 0. «Unbekannt» und ein nach einem Neustart wiederhergestellter Zustand zählen sofort als 0.",solar_setup_reuse:"Verwendet den vorhandenen Solar-Energie-Helfer {entity}.",solar_setup_role_solar_power:"Ein Template-Helfer für die Leistung der Solaranlage, 0, solange sie aus ist:",solar_setup_role_solar_energy:"Ein Integral-Helfer für die Energie der Solaranlage, aus dieser Leistung:",solar_setup_role_energy_power:"Ein Integral-Helfer für die Brutto-Energie, aus der Brutto-Leistung:",solar_term_power_name:"{name} (0, wenn aus)",solar_setup_retry:"Erneut versuchen",solar_setup_check_again:"Erneut prüfen",solar_setup_why_solar:"Wähle eine Solaranlage.",solar_setup_why_checking:"Wird noch geprüft …",solar_setup_why_failed:"Die Prüfung ist fehlgeschlagen; versuche es erneut.",solar_setup_why_method:"Wähle, wie der Brutto-Zähler gebaut wird.",solar_setup_why_blocked:"Löse zuerst das Problem oben.",solar_setup_why_names:"Gib jedem Helfer einen Namen.",solar_setup_conflict:"Deine Energie-Einstellungen haben sich inzwischen geändert. Die Prüfung lief darauf noch einmal: Schau sie an und richte dann erneut ein.",error_solar_needs_power:"{entity_id} hat keinen Leistungssensor, und sein Zähler fängt vielleicht wieder bei 0 an. Diese Solaranlage braucht einen Leistungssensor.",error_solar_needs_data:"{entity_id} hat keinen Leistungssensor, und seine Statistik zeigt noch nicht, dass sein Zähler nie wieder bei 0 anfängt (er muss an zwei Tagen steigen). Setze den Leistungssensor der Solaranlage, oder warte ein, zwei Tage.",error_no_safe_method:"Keine Art passt zu {entity_id}: Es braucht einen Sensor für zurückgespeiste Energie auf seinem Gerät, einen Zähler, der beim Einspeisen rückwärts zählt, oder Leistungssensoren für den Kreis und die Solaranlage.",error_not_offered:"{entity_id} wird hier nicht (mehr) angeboten. Die Prüfung lief noch einmal.",error_choose_returned:"Wähle oben den Sensor für zurückgespeiste Energie.",error_input_disabled:"{entity_id} ist in Home Assistant deaktiviert. Aktiviere ihn zuerst in seinen Einstellungen; die Einrichtung aktiviert ihn nicht für dich.",error_values_changed:"Die Werte von {entity_id} haben sich inzwischen geändert, der Startwert stimmt darum nicht mehr. Die Prüfung lief noch einmal: Schau sie an und richte dann erneut ein.",reason_gross_power_needs_signed:"Ohne Live-Leistung: die Leistung des Kreises war in den letzten Tagen nie negativ, darum ist ihr Vorzeichen unklar",solar_setup_method_gone:"Der gewählte Weg ist nicht mehr möglich – wähle oben einen anderen.",solar_setup_power_refused_used:"{entity}, der Leistungssensor von {owner} in deinem Entwurf, wird schon anderswo im Energie-Dashboard verwendet oder ist ein Zähler dieser Einrichtung; die Einrichtung kann ihn darum nicht verwenden.",solar_setup_power_refused_not_power:"{entity}, der Leistungssensor von {owner} in deinem Entwurf, ist kein Leistungssensor (er braucht die Geräteklasse Leistung und eine Einheit wie W oder kW); die Einrichtung kann ihn darum nicht verwenden.",solar_setup_power_refused_ours:"{entity}, der Leistungssensor von {owner} in deinem Entwurf, ist eine Brutto-Leistung, die diese Einrichtung angelegt hat; sie würde die Solaranlage doppelt zählen.",solar_setup_set_circuit_power:"Leistungssensor von {name} setzen",solar_setup_why_power:"Wähle zuerst einen anderen Leistungssensor.",solar_setup_missing_power:"{name} hat keinen Leistungssensor.",evidence_unchecked:"nicht geprüft – die Statistik konnte nicht gelesen werden",solar_setup_daily_question:"{name}: Fängt er täglich wieder bei 0 an?",solar_term_energy_name:"{name} Energie",solar_setup_power_not_kept:"Die bisherige Leistung von {device} wird nicht übernommen, weil sie netto ist. Eine Live-Leistung lässt sich später nicht nachrüsten; willst du eine, richte das erst ein, wenn der Kreis einmal eingespeist hat.",solar_setup_unusable_power:"{entity}, der Leistungssensor von {name}, ist deaktiviert oder hat keine lesbare Leistungseinheit.",solar_block_free:"{solar}: Wo speist sie ein?",solar_block_free_hint:"Zieh sie auf den Stromkreis, in den die Solaranlage einspeist.",solar_block_strip:"Eine Solaranlage ist noch nicht platziert",solar_block_placed_title:"Zum Verschieben auf einen anderen Stromkreis ziehen, anklicken für mehr.",solar_block_placed:"{solar} ist bei {device} platziert.",solar_block_removed:"{solar} ist nicht mehr platziert.",solar_place_text:"{solar} speist in {device} ein. Das zeigt nur das Diagramm; die Energie-Einstellungen ändern sich dadurch nicht.",solar_place_move:"Zum Verschieben den Solar-Block auf einen anderen Stromkreis ziehen.",solar_place_replace_hint:"Der Zähler von {device} zählt die Solaranlage mit. Zurück zum echten Zähler geht es mit «Ersetzen durch …».",solar_place_remove:"Platzierung entfernen",solar_setup_place_only:"Mein Zähler zählt die Solaranlage schon: nur hier platzieren",hint_solar_elsewhere:"{solar} ist bei {device} platziert, aber dieser Zähler zählt sie noch mit, also doppelt. Ersetze diesen Zähler durch den echten.",solar_block_pick:"Stromkreis wählen…",solar_block_move:"In einen anderen Stromkreis verschieben…",solar_pick_title:"Wo speist {solar} ein?"},en:Lt,fr:{title:"Energy Flow Mapper",menu:"Menu",more:"Plus",reload:"Recharger",undo:"Annuler le dernier enregistrement",backups:"Sauvegardes",loading:"Chargement …",load_failed:"Les réglages d’énergie n’ont pas pu être chargés.",sources:"Sources",sources_hint:"Glisse un capteur libre sur une source ou touche une source. Les prix se modifient dans les réglages d’énergie.",open_energy_settings:"Réglages d’énergie",no_sources:"Aucune source configurée.",role_import:"Consommation réseau",role_export:"Injection réseau",role_production:"Production solaire",role_discharge:"Décharge batterie",role_charge:"Charge batterie",role_gas:"Gaz",role_water:"Eau",role_home:"Compteur de la maison",diagram:"Flux d’énergie",zoom_hint:"Zoome avec la molette ou deux doigts, glisse sur une zone vide pour déplacer.",zoom_in:"Agrandir",zoom_out:"Réduire",fit:"Ajuster",orientation_label:"Orientation",orientation_horizontal:"Horizontale",orientation_vertical:"Verticale",role_battery:"Batterie",home_measured:"{power} mesurés",home_stale:"{name} : données pas assez récentes",home_calculated:"{power} calculés",period_label:"Période",period_now:"Maintenant",period_today:"Aujourd’hui",period_week:"7 jours",period_month:"30 jours",energy_loading:"Chargement de la consommation …",detail_energy:"Énergie sur la période",devices:"Appareils",devices_hint:"Glisse un appareil sur un autre pour l’y inclure, ou utilise le menu ⋮.",home:"Maison",home_drop:"Dépose ici pour le niveau supérieur",no_devices:"Aucun appareil dans le tableau de bord énergie. Ajoute un capteur libre.",untracked:"Consommation non suivie",untracked_without_one:"sans {name}",untracked_without_many:"sans {count} appareils",untracked_missing_title:"Sans valeur : {names}",free_sensors:"Capteurs libres",free_collapse:"Replier les capteurs libres",free_expand:"Afficher les capteurs libres",free_sensors_hint:"Compteurs d’énergie qui ne sont pas encore dans le tableau de bord énergie.",free_contained:"Contenus dans des compteurs",free_contained_hint:"Ces capteurs font déjà partie d’un compteur de tes réglages énergie. Vérifie-le avant d’en ajouter un aussi.",free_contained_in:"Fait partie de {meter}",search:"Rechercher",no_candidates:"Aucun capteur d’énergie libre.",add:"Ajouter",add_title:"Ajouter {name} sous …",with_power:"Capteur de puissance : {entity}",actions:"Actions pour {name}",move:"Déplacer vers …",move_title:"Déplacer {name} vers …",top_level:"Niveau supérieur (Maison)",no_targets:"Il n’y a pas d’autre place pour cet appareil.",rename:"Renommer …",rename_title:"Renommer {name}",replace_with:"Remplacer par …",replace_title:"Remplacer {name} par …",replace_hint:"Reprend la place, les appareils enfant, le groupe et le nom que tu as choisi.",replace_none:"Aucun capteur libre",name_label:"Nom",name_hint:"Laisse vide pour utiliser le nom de l’entité.",remove:"Retirer du tableau de bord énergie",use_as_home_meter:"Utiliser comme compteur de la maison",remove_hint:"Ses appareils enfant remontent d’un niveau.",cancel:"Annuler",ok:"OK",close:"Fermer",details:"Détails",select_hint:"Sélectionne un appareil pour voir ses détails.",detail_statistic:"Statistique",detail_power_sensor:"Capteur de puissance",detail_device:"Appareil",detail_area:"Pièce",detail_power:"Puissance actuelle",detail_untracked:"Non suivi par ses appareils enfant",detail_issues:"Problèmes",none:"–",change_one:"1 modification",change_other:"{count} modifications",discard:"Abandonner",save:"Enregistrer",confirm_title:"Enregistrer les modifications ?",confirm_errors:"Corrige d’abord ces problèmes :",confirm_kept:"Ces problèmes étaient déjà dans vos paramètres d’énergie. Ils restent tels quels et n’empêchent pas l’enregistrement :",confirm_kept_rejected:"Ces problèmes étaient déjà dans vos paramètres d’énergie :",confirm_warnings:"À noter :",checking:"Vérification …",saving:"Enregistrement …",saved:"Enregistré. Une sauvegarde des réglages précédents a été créée.",nothing_to_save:"Rien n’a changé.",diff_added:"{name} ajouté",diff_added_under:"{name} ajouté sous {to}",diff_removed:"{name} retiré",diff_moved:"{name} déplacé sous {to}",diff_moved_top:"{name} déplacé au niveau supérieur",diff_renamed:"{name} renommé en « {to} »",diff_renamed_reset:"{name} utilise à nouveau le nom de l’entité",diff_rate:"Capteur de puissance de {name} modifié",issue_cycle:"Fait partie d’une boucle d’appareils",issue_self_parent:"Inclus en lui-même",issue_duplicate:"Présent plusieurs fois",issue_missing_parent:"Son appareil en amont n’est pas dans le tableau de bord énergie",issue_source_and_device:"Utilisé aussi comme source",issue_statistic_missing:"Statistique introuvable",issue_not_energy_unit:"L’unité {unit} n’est pas une unité d’énergie",issue_children_exceed_parent:"Ses appareils enfant consomment plus que lui",issue_devices_exceed_home:"Les appareils consomment plus que la maison",issue_counted_twice:"Aussi compté dans le compteur d’un autre appareil, sans être placé en dessous",issue_counted_twice_in:"Déjà compté dans {meter}, sans être placé en dessous",ha_reports:"Signalé par Home Assistant",coverage_toggle:"Couverture",types_toggle:"Marquer les entrées",type_sensor:"Capteur",type_helper:"Entrée",type_helper_kind:"Entrée : {kind}",type_integral:"intégrale",type_group:"groupe",type_template:"modèle",type_utility_meter:"compteur de consommation",type_external:"Statistique externe",detail_type:"Type",coverage_percent:"{percent} % couvert par les appareils",coverage_over:"plus de 100 % couvert par les appareils",coverage_below_one:"< 1 % couvert par les appareils",suggestion_text:"Suggestion : inclus dans {parent}",suggestion_apply:"Appliquer",suggestion_ignore:"Ignorer",suggestion_apply_all:"Appliquer toutes les suggestions",suggestion_show_ignored:"Afficher à nouveau les suggestions ignorées",export_image:"Enregistrer en image",export_title:"Enregistrer le diagramme en image",export_hide_names:"Masquer les noms",export_hide_hint:"Les appareils deviennent Appareil 1, 2, … ; les pièces et noms de capteurs sont omis.",export_save:"Enregistrer",export_device:"Appareil {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Brouillon, non enregistré",export_failed:"L'image n'a pas pu être créée.",backups_title:"Sauvegardes",backups_empty:"Aucune sauvegarde pour l’instant. Une sauvegarde est créée avant chaque enregistrement.",backup_by:"par {user}",restore:"Restaurer",restore_confirm:"Restaurer la sauvegarde du {date} ? Les réglages actuels sont sauvegardés d’abord.",undo_confirm:"Restaurer les réglages d’avant le dernier enregistrement ({date}) ? Les réglages actuels sont sauvegardés d’abord.",draft_lost:"Tes modifications non enregistrées seront perdues.",restored:"Sauvegarde restaurée.",summary_added:"{count} ajouté(s)",summary_removed:"{count} retiré(s)",summary_moved:"{count} déplacé(s)",summary_renamed:"{count} renommé(s)",summary_rate:"{count} avec nouveau capteur de puissance ou de débit",summary_restored:"Sauvegarde restaurée",error_conflict:"Les réglages d’énergie ou les groupes ont été modifiés ailleurs entre-temps. Ils ont été rechargés ; vérifie tes modifications et enregistre à nouveau.",error_not_loaded:"Energy Flow Mapper n’est pas chargé.",error_unsupported_energy_api:"Les réglages d’énergie de cette version de Home Assistant ne sont pas pris en charge. L’éditeur est désactivé pour protéger tes réglages.",assign_title:"Attribuer : {role}",assign_hint:"Choisis un compteur d’énergie libre.",battery_title:"Batterie : compteur de charge",battery_hint:"{name} mesure la décharge. Choisis le compteur qui mesure la charge.",source_assign:"Attribuer un capteur …",source_replace:"Remplacer le capteur …",source_remove:"Retirer comme source",power_only:"Puissance seulement",power_only_hint:"Ces capteurs de puissance n’ont pas de compteur d’énergie. « Créer un compteur » ajoute tout de suite une entrée d’aide intégrale ; elle reste même sans Energy Flow Mapper.",create_meter:"Créer un compteur",create_meter_title:"Créer un compteur d’énergie pour {name} ?",create_meter_text:"L’entrée d’aide « {helper} » est créée tout de suite sous Paramètres → Entrées. C’est une entrée normale de Home Assistant qui reste même si tu retires Energy Flow Mapper. Son compteur est ensuite ajouté à ton brouillon.",creating:"Création …",meter_created:"Compteur « {name} » créé et ajouté au brouillon.",energy_suffix:"Énergie",external_statistic:"Statistique externe",created_by:"Créé par Energy Flow Mapper",detail_helper:"Entrée d’aide",diff_source_added:"{name} attribué comme {role}",diff_source_removed:"{name} retiré comme {role}",summary_source_added:"{count} attribué(s) comme source",summary_source_removed:"{count} retiré(s) comme source",diff_source_rate:"Capteur de puissance de {name} ({role}) modifié",diff_source_rate_flow:"Capteur de débit de {name} ({role}) modifié",summary_source_rate:"{count} source(s) avec nouveau capteur de puissance ou de débit",issue_duplicate_source:"Utilisé par plusieurs sources",error_unknown_source:"Ce capteur n’est pas une source du tableau de bord énergie.",error_invalid_power_config:"Ce capteur de puissance ne convient pas à cette source.",error_home_exists:"Il y a déjà un compteur de la maison.",error_home_not_supported:"Cette version de Home Assistant n’a pas de compteur de la maison ; il faut la 2026.11 ou plus récente.",error_not_a_power_candidate:"Ce capteur n’est pas un capteur de puissance ou de débit sans compteur.",error_integral_failed:"L’assistant du compteur n’a pas pu être créé.",confirm_rejected:"Home Assistant n’accepte pas ces réglages :",source_last_meter:"C’est le dernier compteur de ce raccordement au réseau. Le retirer retire le raccordement avec ses prix.",error_invalid_changes:"Le brouillon contient des erreurs et n’a pas été enregistré.",error_restore_invalid:"Cette sauvegarde ne peut pas être restaurée : avec les réglages d’énergie actuels, elle causerait des erreurs ({issues}). Rien n’a été modifié.",error_device_exists:"Cet appareil est déjà dans le tableau de bord énergie.",error_unknown_device:"Un appareil de ton brouillon n’est plus dans le tableau de bord énergie. Abandonne le brouillon et réessaie.",error_unknown_change:"Cette modification n’est pas prise en charge.",error_backup_not_found:"Cette sauvegarde n’existe plus.",error_rejected_by_home_assistant:"Home Assistant a refusé les réglages : {error}",backups_hint:"Conservées dans le dossier de configuration de Home Assistant, elles font donc partie de chaque sauvegarde de Home Assistant. Exporte un fichier pour en garder une copie ailleurs.",export_current:"Exporter les réglages actuels",import_file:"Importer depuis un fichier …",export:"Exporter",import_title:"Importer {file}",import:"Importer",import_unchanged:"Ce fichier contient tes réglages actuels. Il n’y a rien à importer.",import_invalid_file:"Ce fichier n’a pas pu être lu. Choisis un fichier exporté par Energy Flow Mapper.",imported:"Importé. Les réglages précédents ont été sauvegardés.",summary_imported:"Fichier importé",error_invalid_import:"Ce fichier n’est pas un export d’Energy Flow Mapper.",error_unknown:"Erreur : {message}",tabs_label:"Partie du tableau de bord énergie",tab_electricity:"Électricité",tab_gas:"Gaz",diagram_gas:"Compteurs de gaz",free_sensors_hint_gas:"Compteurs de gaz qui ne sont pas encore dans le tableau de bord énergie. Home Assistant n’a pas d’appareils au gaz, seulement des compteurs de gaz.",no_candidates_gas:"Aucun compteur de gaz libre.",assign_hint_gas:"Choisis un compteur de gaz libre.",tab_water:"Eau",diagram_water:"Flux d’eau",free_sensors_hint_water:"Compteurs d’eau qui ne sont pas encore dans le tableau de bord énergie.",no_candidates_water:"Aucun compteur d’eau libre.",assign_hint_water:"Choisis un compteur d’eau libre.",with_flow:"Capteur de débit : {entity}",detail_flow_sensor:"Capteur de débit",detail_flow:"Débit actuel",detail_volume:"Eau sur la période",issue_not_water_unit:"L’unité {unit} n’est pas une unité d’eau",diff_water:"Eau : {text}",diff_rate_water:"Capteur de débit de {name} modifié",undo_change:"Annuler la modification",undo_change_hint:"Annuler la dernière modification du brouillon (Ctrl+Z)",draft_restored:"Vos modifications non enregistrées ont été restaurées.",draft_outdated:"Vos modifications non enregistrées n'ont pas pu être restaurées, car les paramètres d'énergie ont été modifiés entre-temps.",blocked_one:"1 problème empêche l'enregistrement",blocked_other:"{count} problèmes empêchent l'enregistrement",blocked_hint:"Cliquez sur Enregistrer pour voir les problèmes.",show_block:"Afficher",change_undone:"Dernière modification annulée.",flow_only:"Débit uniquement",flow_only_hint:"Ces capteurs de débit n’ont pas de compteur d’eau. « Créer un compteur » ajoute tout de suite un assistant d’intégrale ; il reste même sans Energy Flow Mapper.",create_water_meter_title:"Créer un compteur d’eau pour {name} ?",create_water_meter_text:"L’assistant « {helper} » est créé tout de suite sous Paramètres → Entrées. Il additionne le débit en eau (L/min en litres, m³/h en m³) et s’affiche comme eau. C’est un assistant Home Assistant ordinaire qui reste même si tu retires Energy Flow Mapper. Son compteur est ensuite ajouté à ton brouillon.",water_suffix:"Eau",find_device:"Chercher un appareil",find_none:"Aucun résultat",find_count:"{index} sur {count}",find_next:"Suivant",card_empty:"Aucun appareil dans le tableau de bord énergie pour l’instant.",card_root_missing:"Cet appareil n’est plus dans le tableau de bord énergie. Choisis-en un autre dans les réglages de la carte.",card_root_group_missing:"Ce groupe n’existe plus. Choisis un autre départ dans les réglages de la carte.",card_root_all:"Toute la maison",card_root_group:"Groupe : {name}",card_root_group_in:"Groupe : {name} (dans {parent})",card_stale:"Échec de l’actualisation, affichage des dernières valeurs.",card_field_title:"Titre (vide : sans titre)",card_field_kind:"Afficher",card_field_root:"Départ",card_field_show_sources:"Afficher les sources",card_field_show_untracked:"Afficher la consommation non suivie",card_field_show_coverage:"Afficher la part couverte par les appareils",card_field_show_types:"Marquer les entrées et les statistiques externes",select_mode:"Sélectionner",select_done:"Terminé",select_mode_hint:"Touche des blocs pour les sélectionner et les grouper. Ctrl+clic fonctionne aussi.",selected_count:"{count} sélectionné(s)",group_selection:"Grouper",clear_selection:"Effacer la sélection",group_parents_hint:"Seulement des appareils avec le même parent",group_name_title:"Nommer le nouveau groupe",group_devices_one:"1 appareil",group_devices_other:"{count} appareils",group_actions:"Actions pour le groupe {name}",diff_group_created:"Groupe « {name} » créé ({devices})",diff_group_renamed:"Groupe « {from} » renommé en « {to} »",diff_group_dissolved:"Groupe « {name} » dissous",diff_group_changed:"Groupe « {name} » modifié ({devices})",summary_group_created:"{count} groupe(s) créé(s)",summary_group_renamed:"{count} groupe(s) renommé(s)",summary_group_dissolved:"{count} groupe(s) dissous",summary_group_changed:"{count} groupe(s) modifié(s)",export_group:"Groupe {n}",error_unknown_group:"{stat} n’est pas un groupe.",error_group_parents_differ:"{stat} n’est pas placé sous le même appareil que ce groupe.",error_group_loop:"Un groupe ne peut pas être déplacé dans lui-même ni sous l’un de ses propres appareils ({stat}).",error_group_name_empty:"Un groupe doit avoir un nom.",error_group_name_taken:"Il existe déjà un groupe nommé {stat} ici.",error_group_exists:"Le groupe {stat} existe déjà.",group_dissolve:"Dissoudre le groupe",suggest_groups:"Proposer des groupes d’après les pièces",suggest_groups_none:"Aucun groupe à proposer : il n’y a pas deux appareils hors groupe sous le même parent dans la même pièce.",sum_create:"Créer un compteur de somme",sum_create_button:"Créer",sum_members:"Capteurs dans la somme",sum_fixed_hint:"Tous les appareils du groupe sont dans la somme ; tu peux ajouter d’autres capteurs.",sum_add:"Ajouter un capteur",sum_remove:"Retirer {name} de la somme",sum_no_sensors:"Aucun autre capteur ne peut être ajouté.",sum_blocked:"Les capteurs signalés ne peuvent pas être additionnés ; le compteur de somme ne peut donc pas être créé.",sum_text:"L’entrée d’aide « {helper} » est créée tout de suite sous Paramètres → Entrées et additionne ces capteurs. C’est une entrée normale de Home Assistant qui reste même si tu annules la modification ou retires Energy Flow Mapper. Son compteur est ensuite ajouté à ton brouillon ; tous les appareils de la somme passent sous lui, les sources restent des sources.",sum_text_replace:"L’entrée d’aide « {helper} » est créée tout de suite sous Paramètres → Entrées et additionne ces capteurs. C’est une entrée normale de Home Assistant qui reste même si tu annules la modification ou retires Energy Flow Mapper. Son compteur prend ensuite la place de {name} dans ton brouillon, avec ses enfants ; les sources restent des sources.",sum_rate_hint:"Chaque compteur de la somme a un capteur de puissance ; une deuxième entrée d’aide « {helper} » additionne donc leur puissance.",sum_rate_hint_water:"Chaque compteur de la somme a un capteur de débit ; une deuxième entrée d’aide « {helper} » additionne donc leur débit.",sum_rate_missing:"Pas de somme de puissance, car ceux-ci n’ont pas de capteur de puissance : {names}.",sum_rate_missing_water:"Pas de somme de débit, car ceux-ci n’ont pas de capteur de débit : {names}.",sum_rate_source_sign:"Pas de somme de puissance : la puissance du réseau et de la batterie ne peut pas être additionnée, car son signe dépend du sens.",sum_rate_source_water:"Pas de somme de débit : le débit d’une source d’eau ne peut pas être ajouté à une somme de débit.",sum_replace:"Remplacer {name}",sum_replace_reason:"Il fait déjà partie de la somme ; sous le nouveau compteur, il serait compté deux fois.",sum_created:"Compteur de somme « {name} » créé et ajouté au brouillon.",sum_solar_use_setup:"Un compteur de somme avec une installation solaire nécessite la configuration guidée « Le solaire alimente ici… » : elle seule vérifie comment compte le compteur de ton circuit, pour que rien ne soit compté deux fois ou de travers. Cette somme n’est donc pas créée.",sum_member_unchecked:"Non vérifié : trop peu de statistiques pour savoir s’il repart de 0",sum_periodic_solar:"Pour une installation solaire dans un circuit, « Le solaire alimente ici… » construit plutôt le compteur brut.",sum_periodic_way:"Que faire : utilise plutôt le capteur du total cumulé de l’appareil, ou crée un compteur à partir de son capteur de puissance (une entrée d’aide intégrale sous Paramètres → Appareils et services → Entrées).",sum_mixed_total:"Un compteur en total (un compteur brut ou net, qui peut aussi baisser) ne peut pas être additionné à des compteurs qui ne font que monter (total_increasing) : Home Assistant n’accepterait pas la somme comme compteur. Garde plutôt ces appareils séparés dans l’arbre.",sum_state_class_list:"Classes d’état : {list}.",sum_solar_save_first:"{names} : une installation solaire a été modifiée seulement dans ton brouillon (ajoutée, retirée ou avec un autre capteur de puissance). Enregistre d’abord, puis crée la somme.",sum_solar_no_device:"La somme n’a aucun appareil dans lequel l’installation solaire pourrait injecter. Retire l’installation solaire de la somme.",sum_solar_is:"Une installation solaire ou une partie : {names}.",sum_solar_open_setup:"Configurer le solaire pour {name}",sum_solar_one_device:"La configuration construit le compteur brut de l’appareil dans lequel l’installation solaire injecte ; il reste ensuite un appareil à part. Additionne les autres appareils sans l’installation solaire.",sum_solar_holders:"Contiennent déjà une installation solaire : {names}. Si l’un d’eux est déjà un compteur brut (consommation avec sa propre installation solaire), marque-le ci-dessous ; sinon retire-le de la somme.",sum_solar_holders_group:"Contiennent déjà une installation solaire : {names}. Si l’un d’eux est déjà un compteur brut (consommation avec sa propre installation solaire), marque-le ci-dessous ; sinon sors-le d’abord du groupe : chaque appareil d’un groupe fait partie de sa somme.",sum_solar_no_device_group:"La somme n’a aucun appareil dans lequel l’installation solaire pourrait injecter. Sors d’abord l’installation solaire du groupe : chaque appareil d’un groupe fait partie de sa somme.",sum_solar_one_device_group:"La configuration construit le compteur brut de l’appareil dans lequel l’installation solaire injecte ; il reste ensuite un appareil à part. Sors d’abord l’installation solaire du groupe, puis additionne le groupe.",sum_solar_group_move:"Sors d’abord l’installation solaire du groupe : chaque appareil d’un groupe fait partie de sa somme.",sum_gross_ok:"{name} est déjà un compteur brut (consommation avec solaire) – additionner quand même",sum_periodic:"Ces compteurs repartent de 0 de temps en temps (chaque jour, par exemple), la somme ne peut donc pas être créée : avec eux, elle baisserait à chacune de leurs remises à zéro, et Home Assistant compterait à nouveau toute la somme. Retire-les de la somme.",sum_periodic_member:"{name} : {evidence}",sum_check_unknown:"Non vérifié : impossible de vérifier si un compteur repart de 0 chaque jour (l’enregistreur n’a pas répondu). Tu peux quand même créer la somme.",sum_check_retry:"Vérifier à nouveau",sum_checking:"Vérification : un compteur repart-il de 0 chaque jour ? …",sum_need_name:"Donne un nom à l’entrée d’aide.",sum_need_member:"Ajoute au moins un capteur.",evidence_utility_meter:"une entrée d’aide compteur de services publics remise à zéro selon un cycle",evidence_last_reset:"son heure de départ (last_reset) change",evidence_drop:"est tombé le {date} à {time} de {before} à {after}",evidence_statistics:"ses statistiques montrent qu’il repart de 0",sum_reason_external:"Statistique externe : une entrée d’aide ne peut pas l’additionner",sum_reason_not_sensor:"Pas un capteur",sum_reason_unavailable:"Introuvable dans Home Assistant",sum_reason_device_class:"La classe d’appareil n’est pas {device_class}",sum_reason_state_class:"La classe d’état n’est pas total ou total_increasing",power_suffix:"Puissance",flow_suffix:"Débit",error_sum_not_possible:"{entity} ne peut pas être additionné : il doit s’agir d’un capteur avec la bonne classe d’appareil et la classe d’état total ou total_increasing.",error_sum_state_classes_differ:"Les capteurs n’ont pas tous la même classe d’état (total ou total_increasing) ; leur somme ne serait donc pas acceptée comme compteur.",error_sum_failed:"Le compteur de somme n’a pas pu être créé.",error_sum_with_solar:"{entity} est un compteur solaire ou en contient un. Un compteur de somme avec une installation solaire nécessite plutôt la configuration guidée « Le solaire alimente ici… ».",error_template_failed:"L’assistant modèle du compteur n’a pas pu être créé.",error_returned_disabled:"Le capteur d’énergie réinjectée {entity_id} est désactivé. Active-le d’abord dans ses réglages d’entité dans Home Assistant.",error_daily_without_power:"{entity_id} repart de 0 chaque jour ; seule « Depuis la puissance » pourrait donc construire le compteur brut, et il faut pour cela un capteur de puissance pour le circuit et un pour le solaire.",error_solar_already_in_meter:"{entity_id} additionne déjà l’installation solaire ; un compteur brut la compterait donc deux fois. Utilise-le tel quel, ou retire d’abord l’installation solaire de la somme.",error_unsupported_input:"{entity_id} ne peut pas être utilisé dans le compteur brut : il doit s’agir d’un capteur avec une unité d’énergie ou de puissance.",error_daily_check_failed:"La vérification si les compteurs de {entity_id} repartent de 0 chaque jour n’a pas pu se faire : l’enregistreur n’a pas répondu à temps. Réessaie dans un instant.",error_input_not_ready:"{entity_id} n’a pas de valeur pour le moment, la valeur de départ du compteur brut ne peut donc pas être fixée. Réessaie quand il indique une valeur.",discard_title:"Abandonner le brouillon ?",discard_confirm:"Les {count} modifications du brouillon seront perdues. Impossible de revenir en arrière.",tools:"Outils",help:"Aide",sum_name_exists:"Une entité nommée « {name} » existe déjà. La nouvelle entrée d’aide aurait le même nom ; choisis-en un autre pour les distinguer.",power_sensor:"Capteur de puissance …",flow_sensor:"Capteur de débit …",power_variant_single:"Standard",power_variant_inverted:"Inversé",power_variant_two:"Deux capteurs",power_none:"Aucun",power_same_device:"Même appareil",power_sensor_label:"Capteur de puissance",flow_sensor_label:"Capteur de débit",power_variant_single_grid:"Un capteur : positif lors du soutirage du réseau, négatif lors de l’injection.",power_variant_inverted_grid:"Un capteur au signe inverse : positif lors de l’injection, négatif lors du soutirage du réseau.",power_variant_two_grid:"Un capteur pour la puissance importée et un pour la puissance exportée, chacun positif.",power_variant_single_battery:"Un capteur : positif en décharge, négatif en charge.",power_variant_inverted_battery:"Un capteur au signe inverse : positif en charge, négatif en décharge.",power_variant_two_battery:"Un capteur pour la puissance de décharge et un pour la puissance de charge, chacun positif.",hints:"Remarques",hint_returned_energy:"Son appareil compte aussi l’énergie réinjectée ({entity}). Si une installation solaire alimente ce circuit, ce compteur ne voit que ce que le circuit tire de la maison, pas ce que l’installation solaire y produit.",hint_returned_energy_disabled:"Son appareil a aussi un capteur d’énergie réinjectée ({entity}), qui est désactivé, et ce circuit a réinjecté de l’énergie récemment (sa puissance est passée sous 0). Si une installation solaire alimente ce circuit, ce compteur ne voit que ce que le circuit tire de la maison, pas ce que l’installation solaire y produit.",hint_daily_in_sum:"Cette somme mélange des compteurs qui repartent de 0 chaque jour avec des compteurs qui ne le font pas : {names}. La somme chute alors une fois par jour, et Home Assistant compte à nouveau toute la somme. Dans l’entrée d’aide, utilise plutôt un compteur qui ne se remet pas à zéro (pour une installation solaire, une intégrale de sa puissance).",hint_power_available:"Son appareil a un capteur de puissance qui n’est pas défini : {entity}.",hint_flow_available:"Son appareil a un capteur de débit qui n’est pas défini : {entity}.",hint_set_power:"Définir le capteur de puissance",hint_set_flow:"Définir le capteur de débit",hint_open_helper:"Ouvrir les réglages de l’entrée d’aide",hint_dismiss:"Masquer",hint_dismiss_title:"Masquer cette remarque pour de bon. « Afficher à nouveau les suggestions ignorées » la ramène.",hint_dismiss_event_title:"Masquer cette remarque pour cet événement seulement. Un nouvel événement s’affiche à nouveau.",hint_children_solar:"Peut-être qu’une installation solaire alimente ce circuit : son compteur ne voit alors pas ce qu’elle y produit, et les appareils enfants semblent consommer plus.",hint_readme:"Plus d’infos dans le README",hint_show_sensor:"Afficher le capteur",hint_minutes:"{count} min",hint_hours:"{count} h",hint_gross_off_down:"{meter} a baissé de {drop} dans l’heure de {time} le {date}.",hint_gross_off_down_power:"{meter} a baissé de {drop} dans l’heure de {time} le {date} ; sa puissance brute donnait {power}.",hint_gross_off_less:"{meter} a compté {change} dans l’heure de {time} le {date}, nettement moins que ce que donnait sa puissance brute ({power}).",hint_gross_off_more:"{meter} a compté {change} dans l’heure de {time} le {date}, nettement plus que ce que donnait sa puissance brute ({power}).",hint_gross_off_counted:"{meter} a compté {change} dans l’heure de {time} le {date}.",hint_gross_off_input:"Le compteur {input} a probablement été remis à zéro ou remplacé : il est tombé à moins de la moitié dans cette heure, et le compteur brut garde ce saut. Tu peux retirer ce saut des statistiques dans Outils de développement → Statistiques (voir le README).",hint_gross_off_input_net:"Le compteur {input} a probablement été remis à zéro ou remplacé : il est tombé à moins de la moitié dans cette heure, et le compteur brut garde ce saut. Un compteur qui compte dans les deux sens baisse aussi pendant que le circuit injecte, mais rarement autant. Tu peux retirer ce saut des statistiques dans Outils de développement → Statistiques (voir le README).",hint_gross_off_solar_term:"Son entrée d’aide pour l’énergie du solaire a compté nettement moins que le solaire lui-même dans cette heure : la puissance du solaire n’avait pas de valeur (inconnue, ou indisponible plus de 10 minutes), ou Home Assistant ne tournait pas. Cette énergie solaire manque au compteur brut ; il n’y a rien à corriger.",hint_gross_off_sign:"Le compteur compte avec des compteurs d’énergie, il est donc probablement juste ; c’est sa puissance brute qui diffère. Soit son signe est faux, soit le compteur s’est arrêté un moment puis a rattrapé : un tel saut unique quitte la remarque de lui-même après 7 jours. Si la puissance brute a le mauvais signe, mets le capteur de puissance de l’appareil sur « Aucun » : le compteur continue de compter, seule sa valeur actuelle disparaît. Après l’enregistrement, la remarque disparaît.",hint_gross_off_sign_power:"Ce compteur brut compte sa puissance brute, et cette puissance est passée sous 0. Si la puissance du circuit a le mauvais signe, le compteur compte faux lui aussi : recrée le compteur brut avec la puissance du circuit inversée. Si une batterie ou autre chose injecte dans le circuit, il n’y a pas de solution : un compteur brut ne peut pas compter cela.",hint_gross_off_below_zero:"Un compteur brut de consommation ne doit pas passer sous 0. Soit autre chose que le solaire injecte dans le circuit (une batterie, un second onduleur), soit ses entrées sont mélangées (soutirage et réinjection inversés, ou un compteur net qui compte dans l’autre sens). Recrée le compteur brut avec la bonne méthode. Un compteur brut ne peut pas compter une batterie qui injecte : remets alors le compteur propre du circuit avec ⋮ → « Remplacer par … ».",hint_gross_off_unclear:"Les statistiques ne montrent pas pourquoi.",hint_gross_unknown:"{meter} n’avait pas de valeur pendant {length} à partir de {time} le {date}.",hint_gross_unknown_power:"{meter} n’a pas pu compter pendant {length} à partir de {time} le {date}.",hint_gross_unknown_input:"{input} n’en avait pas non plus pendant ce temps, et le compteur brut a besoin de tous ses capteurs. Vérifie ce capteur.",hint_gross_unknown_inputs:"Le compteur brut a besoin de tous ses capteurs ; vérifie ceux dont il est fait.",hint_solar_term_short:"Le {date}, l’entrée d’aide {term} a compté {term_energy} de l’énergie de ce solaire, nettement moins que le solaire lui-même ({source_energy}). La puissance du solaire n’avait pas de valeur (inconnue, ou indisponible plus de 10 minutes), ou Home Assistant ne tournait pas ; cette énergie manque aux compteurs bruts qui utilisent l’entrée d’aide. Il n’y a rien à corriger ; si cela arrive souvent, vérifie le capteur de puissance du solaire.",hint_solar_term_high:"Le {date}, l’entrée d’aide {term} a compté {term_energy} de l’énergie de ce solaire, nettement plus que le solaire lui-même ({source_energy}). La puissance du solaire garde peut-être une valeur alors que rien n’est produit (une valeur figée la nuit), elle mesure peut-être autre chose (le côté continu ou batterie), ou le compteur d’énergie du solaire compte une partie de la journée en retard, après minuit. Vérifie le capteur de puissance du solaire.",solar_setup:"Le solaire alimente ici…",solar_setup_title:"Le solaire alimente {name}",solar_setup_intro:"L’installation solaire alimente ce circuit, et les appareils qui y sont branchés consomment son énergie avant qu’elle n’atteigne le compteur. Le compteur indique donc moins que ce qu’ils consomment, voire devient négatif. La configuration crée un compteur brut : ce que les appareils de ce circuit consomment vraiment.",solar_setup_no_solar:"La configuration a besoin d’une source solaire dans le tableau de bord énergie. Ajoutes-en d’abord une, puis relance la configuration.",solar_setup_source:"Installation solaire",solar_setup_set_solar_power:"Définir le capteur de puissance du solaire",solar_setup_open_settings:"Ouvrir ses réglages",solar_setup_preview:"Ce qui est créé",solar_setup_energy:"Une entrée d’aide modèle pour l’énergie brute, {formula} :",solar_setup_offset:"Les {offset} kWh sont ajoutés pour que le compteur brut commence au-dessus de 0 : les réglages d’énergie de Home Assistant signalent un compteur dont l’état est sous 0. Ils ne changent rien à ce qu’il compte.",solar_setup_power:"Une entrée d’aide modèle pour la puissance brute, {formula} :",solar_setup_text:"Les entrées d’aide sont créées tout de suite sous Paramètres → Entrées. Ce sont des entrées normales de Home Assistant qui restent même si tu annules la modification ou retires Energy Flow Mapper. Le compteur brut prend ensuite la place de {name} dans ton brouillon, avec ses appareils enfants et son groupe, et le nom que tu as donné à {name}, s’il y en a un. Il reçoit la puissance brute comme capteur de puissance. Enregistre comme d’habitude.",solar_setup_text_no_power:"Les entrées d’aide sont créées tout de suite sous Paramètres → Entrées. Ce sont des entrées normales de Home Assistant qui restent même si tu annules la modification ou retires Energy Flow Mapper. Le compteur brut prend ensuite la place de {name} dans ton brouillon, avec ses appareils enfants et son groupe, et le nom que tu as donné à {name}, s’il y en a un. Enregistre comme d’habitude.",solar_setup_button:"Configurer",solar_setup_done:"Compteur brut « {name} » créé ; il prend la place de {old} dans le brouillon.",solar_setup_created_only:"Compteur brut « {name} » créé. Il n’a pas pu prendre la place de {old} dans le brouillon ; mets-le à sa place avec « Remplacer par … ».",solar_gross_name:"{name} brut",solar_gross_power_name:"{name} puissance brute",solar_setup_method:"Comment construire le compteur brut ?",solar_method_em:"Compteur EM : brut = consommé − réinjecté + solaire",solar_method_em_hint:"Pour un compteur qui compte séparément ce que le circuit consomme et ce qu’il réinjecte, comme un Shelly Pro EM.",solar_method_plug:"Prise ou interrupteur : brut = énergie − 2 × réinjecté + solaire",solar_method_plug_hint:"Pour une prise ou un interrupteur Shelly dont « Énergie » compte dans les deux sens.",solar_method_net:"Compteur net : brut = compteur + solaire",solar_method_net_hint:"Pour un compteur qui décompte pendant que le circuit réinjecte.",solar_method_power:"Depuis la puissance : brut = intégrale de (puissance du circuit + puissance solaire)",solar_method_power_hint:"Juste pour tout appareil dont la puissance du circuit a un signe ; l’énergie est une estimation à partir de la puissance.",solar_method_suggested:"Suggéré",reason_rule_shelly_em:"correspond à ton appareil ({device})",reason_rule_shelly_plug:"correspond à ton appareil ({device}) : son « Énergie » compte dans les deux sens",reason_rule_shelly_consumed:"correspond à ton appareil ({device}) : « Énergie consommée » ne compte que ce qu’il consomme",reason_rule_net_negative:"correspond à ton compteur : il est passé sous 0 ces derniers jours",reason_power_signed:"vérifié : sa puissance est passée sous 0 ces derniers jours, elle a donc un signe",reason_unverified_against_rule:"non vérifié – ce n’est pas la règle de ton appareil, ou pas le capteur d’énergie réinjectée auquel elle se fie ; à choisir seulement si tu sais que ton compteur compte ainsi",reason_unverified_may_reset:"non vérifié – ce compteur repart peut-être de 0 après une coupure de courant",reason_unverified_net:"non vérifié – à choisir seulement si ton compteur décompte pendant la réinjection ; il n’est jamais passé sous 0 ces derniers jours",reason_unverified_no_data:"non vérifié – un de ses compteurs n’a pas de statistiques ces derniers jours ; indique ci-dessous s’il repart de 0 chaque jour",reason_unverified_power_unsigned:"non vérifié – le circuit n’a jamais réinjecté ces derniers jours, on ne sait donc pas si sa puissance a un signe",reason_net_needs_signed_meter:"non proposé – le compteur ne fait que monter (total increasing), Home Assistant lirait donc chaque baisse comme une remise à zéro",reason_no_returned_sensor:"non proposé – son appareil n’a pas de capteur d’énergie réinjectée",reason_daily_input:"non proposé – un de ses compteurs repart de 0 chaque jour",reason_unsupported_input:"non proposé – un de ses compteurs n’a pas d’unité d’énergie lisible",reason_no_power:"non proposé – il faut un capteur de puissance pour le circuit et un pour le solaire",reason_unusable_power:"non proposé – le capteur de puissance du circuit est désactivé ou n’a pas d’unité de puissance lisible",solar_setup_drawn:"Compteur de ce que le circuit consomme",solar_setup_returned:"Capteur d’énergie réinjectée",solar_setup_choose:"Choisir …",solar_setup_disabled_option:"{entity} (désactivé dans Home Assistant)",solar_setup_disabled_sensor:"{entity} est désactivé dans Home Assistant. La configuration ne l’active pas à ta place.",solar_setup_inputs:"Compteurs et leurs statistiques",solar_setup_daily:"Repart de 0 chaque jour (périodique)",solar_setup_lifetime:"Continue de compter (ne repart jamais de 0)",solar_setup_daily_locked:"Fixé : {evidence}.",solar_setup_daily_hint:"Présélectionné d’après les statistiques ; change-le si tu sais mieux.",evidence_lifetime:"a augmenté ces derniers jours sans repartir de 0",evidence_no_data:"pas de statistiques ces derniers jours",solar_setup_power_title:"Puissance",solar_setup_circuit_power:"Circuit : {entity} ({from})",solar_setup_solar_power:"Solaire : {entity} ({from})",solar_setup_circuit_none:"Circuit : pas de capteur de puissance",solar_setup_solar_none:"Solaire : pas de capteur de puissance",solar_setup_from_draft:"de ton brouillon",solar_setup_from_saved:"enregistré",solar_setup_from_paired:"trouvé sur son appareil",solar_setup_live:"Maintenant : circuit {circuit} + solaire {solar} = {gross}",solar_setup_live_hint:"Vérifie que cela correspond à ce qui fonctionne en ce moment : pendant que le circuit réinjecte, sa puissance est négative.",solar_setup_invert:"Inverser la puissance du circuit",solar_setup_invert_hint:"Pour un capteur de puissance positif pendant que le circuit réinjecte.",solar_setup_power_history:"La nouvelle énergie brute commence à 0 et n’a pas d’historique ; c’est une estimation à partir de la puissance.",solar_setup_counter_night:"{solar} n’a pas de capteur de puissance, son compteur est donc utilisé tel quel. La nuit, le compteur brut peut faire une pause, et la consommation de la nuit arrive alors le matin ; les totaux restent justes.",solar_setup_hold:"Tant que le solaire est « indisponible », sa dernière puissance est conservée jusqu’à 10 minutes, puis elle compte comme 0. Un état « inconnu » et un état restauré après un redémarrage comptent tout de suite comme 0.",solar_setup_reuse:"Utilise l’entrée d’aide d’énergie solaire existante {entity}.",solar_setup_role_solar_power:"Une entrée d’aide modèle pour la puissance du solaire, 0 tant qu’il est hors ligne :",solar_setup_role_solar_energy:"Une entrée d’aide intégrale pour l’énergie du solaire, à partir de cette puissance :",solar_setup_role_energy_power:"Une entrée d’aide intégrale pour l’énergie brute, à partir de la puissance brute :",solar_term_power_name:"{name} (0 hors ligne)",solar_setup_retry:"Réessayer",solar_setup_check_again:"Vérifier à nouveau",solar_setup_why_solar:"Choisis une installation solaire.",solar_setup_why_checking:"Vérification en cours …",solar_setup_why_failed:"La vérification a échoué ; réessaie.",solar_setup_why_method:"Choisis comment le compteur brut est construit.",solar_setup_why_blocked:"Résous d’abord le problème ci-dessus.",solar_setup_why_names:"Donne un nom à chaque entrée d’aide.",solar_setup_conflict:"Tes réglages énergie ont changé entre-temps. La vérification a été relancée dessus : regarde-la, puis configure à nouveau.",error_solar_needs_power:"{entity_id} n’a pas de capteur de puissance, et son compteur repart peut-être de 0. Cette installation solaire a besoin d’un capteur de puissance.",error_solar_needs_data:"{entity_id} n’a pas de capteur de puissance, et ses statistiques ne montrent pas encore que son compteur ne repart jamais de 0 (il doit augmenter sur deux jours). Définis le capteur de puissance du solaire, ou attends un jour ou deux.",error_no_safe_method:"Aucune méthode ne convient à {entity_id} : il faut un capteur d’énergie réinjectée sur son appareil, un compteur qui décompte pendant la réinjection, ou des capteurs de puissance pour le circuit et le solaire.",error_not_offered:"{entity_id} n’est pas (plus) proposé ici. La vérification a été relancée.",error_choose_returned:"Choisis ci-dessus le capteur d’énergie réinjectée.",error_input_disabled:"{entity_id} est désactivé dans Home Assistant. Active-le d’abord dans ses réglages ; la configuration ne l’active pas à ta place.",error_values_changed:"Les valeurs de {entity_id} ont changé entre-temps, la valeur de départ n’est donc plus juste. La vérification a été relancée : regarde-la, puis configure à nouveau.",reason_gross_power_needs_signed:"Sans puissance en direct : la puissance du circuit n’est jamais passée sous 0 ces derniers jours, son signe est donc incertain",solar_setup_method_gone:"La méthode choisie n’est plus possible – choisis-en une autre ci-dessus.",solar_setup_power_refused_used:"{entity}, le capteur de puissance de {owner} dans ton brouillon, est déjà utilisé ailleurs dans le tableau de bord énergie ou est un compteur de cette configuration ; la configuration ne peut donc pas l’utiliser.",solar_setup_power_refused_not_power:"{entity}, le capteur de puissance de {owner} dans ton brouillon, n’est pas un capteur de puissance (il faut la classe d’appareil puissance et une unité comme W ou kW) ; la configuration ne peut donc pas l’utiliser.",solar_setup_power_refused_ours:"{entity}, le capteur de puissance de {owner} dans ton brouillon, est une puissance brute créée par cette configuration ; elle compterait le solaire deux fois.",solar_setup_set_circuit_power:"Définir le capteur de puissance de {name}",solar_setup_why_power:"Choisis d’abord un autre capteur de puissance.",solar_setup_missing_power:"{name} n’a pas de capteur de puissance.",evidence_unchecked:"non vérifié – les statistiques n’ont pas pu être lues",solar_setup_daily_question:"{name} : repart-il de 0 chaque jour ?",solar_term_energy_name:"{name} énergie",solar_setup_power_not_kept:"La puissance actuelle de {device} n’est pas reprise, car elle est nette. Une puissance en direct ne peut pas être ajoutée plus tard ; si tu en veux une, configure ceci seulement quand le circuit aura réinjecté une fois.",solar_setup_unusable_power:"{entity}, le capteur de puissance de {name}, est désactivé ou n’a pas d’unité de puissance lisible.",solar_block_free:"{solar} : où alimente-t-elle ?",solar_block_free_hint:"Fais-la glisser sur le circuit que l’installation solaire alimente.",solar_block_strip:"Une installation solaire n’est pas encore placée",solar_block_placed_title:"Glisse-la sur un autre circuit pour la déplacer ; clique pour plus.",solar_block_placed:"{solar} est placée sur {device}.",solar_block_removed:"{solar} n’est plus placée.",solar_place_text:"{solar} alimente {device}. Seul le diagramme le montre ; les paramètres d’énergie ne changent pas.",solar_place_move:"Pour la déplacer, fais glisser le bloc solaire sur un autre circuit.",solar_place_replace_hint:"Le compteur de {device} compte l’installation solaire. Pour revenir au vrai compteur, remplace-le.",solar_place_remove:"Retirer le placement",solar_setup_place_only:"Mon compteur compte déjà l’installation solaire : seulement la placer ici",hint_solar_elsewhere:"{solar} est placée sur {device}, mais ce compteur la compte encore, donc deux fois. Remplace ce compteur par le vrai.",solar_block_pick:"Choisir le circuit…",solar_block_move:"Déplacer vers un autre circuit…",solar_pick_title:"Où {solar} alimente-t-elle ?"},it:{title:"Energy Flow Mapper",menu:"Menu",more:"Altro",reload:"Ricarica",undo:"Annulla l’ultimo salvataggio",backups:"Backup",loading:"Caricamento …",load_failed:"Non è stato possibile caricare le impostazioni energetiche.",sources:"Fonti",sources_hint:"Trascina un sensore libero su una fonte o tocca una fonte. I prezzi si modificano nelle impostazioni energetiche.",open_energy_settings:"Impostazioni energetiche",no_sources:"Nessuna fonte configurata.",role_import:"Prelievo dalla rete",role_export:"Immissione in rete",role_production:"Produzione solare",role_discharge:"Scarica batteria",role_charge:"Carica batteria",role_gas:"Gas",role_water:"Acqua",role_home:"Contatore della casa",diagram:"Flusso di energia",zoom_hint:"Zooma con la rotella o con due dita, trascina su un’area vuota per spostare.",zoom_in:"Ingrandisci",zoom_out:"Riduci",fit:"Adatta",orientation_label:"Orientamento",orientation_horizontal:"Orizzontale",orientation_vertical:"Verticale",role_battery:"Batteria",home_measured:"{power} misurati",home_stale:"{name}: dati non abbastanza recenti",home_calculated:"{power} calcolati",period_label:"Periodo",period_now:"Ora",period_today:"Oggi",period_week:"7 giorni",period_month:"30 giorni",energy_loading:"Caricamento dei consumi …",detail_energy:"Energia nel periodo",devices:"Dispositivi",devices_hint:"Trascina un dispositivo su un altro per includerlo lì, oppure usa il menu ⋮.",home:"Casa",home_drop:"Rilascia qui per il livello superiore",no_devices:"Ancora nessun dispositivo nella dashboard energia. Aggiungi un sensore libero.",untracked:"Consumo non monitorato",untracked_without_one:"senza {name}",untracked_without_many:"senza {count} dispositivi",untracked_missing_title:"Senza valore: {names}",free_sensors:"Sensori liberi",free_collapse:"Comprimi i sensori liberi",free_expand:"Mostra i sensori liberi",free_sensors_hint:"Contatori di energia che non sono ancora nella dashboard energia.",free_contained:"Contenuti nei contatori",free_contained_hint:"Questi sensori fanno già parte di un contatore delle tue impostazioni energia. Controllalo prima di aggiungerne uno.",free_contained_in:"Fa parte di {meter}",search:"Cerca",no_candidates:"Nessun sensore di energia libero.",add:"Aggiungi",add_title:"Aggiungi {name} sotto …",with_power:"Sensore di potenza: {entity}",actions:"Azioni per {name}",move:"Sposta in …",move_title:"Sposta {name} in …",top_level:"Livello superiore (Casa)",no_targets:"Non c’è un altro posto per questo dispositivo.",rename:"Rinomina …",rename_title:"Rinomina {name}",replace_with:"Sostituisci con …",replace_title:"Sostituisci {name} con …",replace_hint:"Riprende posto, dispositivi figli, gruppo e il nome che hai impostato.",replace_none:"Nessun sensore libero",name_label:"Nome",name_hint:"Lascia vuoto per usare il nome dell’entità.",remove:"Rimuovi dalla dashboard energia",use_as_home_meter:"Usa come contatore della casa",remove_hint:"I suoi dispositivi figli salgono di un livello.",cancel:"Annulla",ok:"OK",close:"Chiudi",details:"Dettagli",select_hint:"Seleziona un dispositivo per vederne i dettagli.",detail_statistic:"Statistica",detail_power_sensor:"Sensore di potenza",detail_device:"Dispositivo",detail_area:"Area",detail_power:"Potenza attuale",detail_untracked:"Non monitorato dai dispositivi figli",detail_issues:"Problemi",none:"–",change_one:"1 modifica",change_other:"{count} modifiche",discard:"Scarta",save:"Salva",confirm_title:"Salvare le modifiche?",confirm_errors:"Risolvi prima questi problemi:",confirm_kept:"Questi problemi erano già nelle tue impostazioni energetiche. Restano come sono e non impediscono il salvataggio:",confirm_kept_rejected:"Questi problemi erano già nelle tue impostazioni energetiche:",confirm_warnings:"Da notare:",checking:"Verifica …",saving:"Salvataggio …",saved:"Salvato. È stato creato un backup delle impostazioni precedenti.",nothing_to_save:"Non è cambiato nulla.",diff_added:"{name} aggiunto",diff_added_under:"{name} aggiunto sotto {to}",diff_removed:"{name} rimosso",diff_moved:"{name} spostato sotto {to}",diff_moved_top:"{name} spostato al livello superiore",diff_renamed:"{name} rinominato in «{to}»",diff_renamed_reset:"{name} usa di nuovo il nome dell’entità",diff_rate:"Sensore di potenza di {name} modificato",issue_cycle:"Fa parte di un ciclo di dispositivi",issue_self_parent:"Incluso in sé stesso",issue_duplicate:"Presente più volte",issue_missing_parent:"Il suo dispositivo a monte non è nella dashboard energia",issue_source_and_device:"Usato anche come fonte",issue_statistic_missing:"Statistica non trovata",issue_not_energy_unit:"L’unità {unit} non è un’unità di energia",issue_children_exceed_parent:"I suoi dispositivi figli consumano più di lui",issue_devices_exceed_home:"I dispositivi consumano più della casa",issue_counted_twice:"Conteggiato anche nel contatore di un altro dispositivo, ma non è posto sotto di esso",issue_counted_twice_in:"Già conteggiato in {meter}, ma non è posto sotto di esso",ha_reports:"Segnalazioni di Home Assistant",coverage_toggle:"Copertura",types_toggle:"Segna gli aiutanti",type_sensor:"Sensore",type_helper:"Aiutante",type_helper_kind:"Aiutante: {kind}",type_integral:"integrale",type_group:"gruppo",type_template:"template",type_utility_meter:"contatore di consumo",type_external:"Statistica esterna",detail_type:"Tipo",coverage_percent:"{percent}% coperto dai dispositivi",coverage_over:"oltre il 100% coperto dai dispositivi",coverage_below_one:"< 1% coperto dai dispositivi",suggestion_text:"Suggerimento: incluso in {parent}",suggestion_apply:"Applica",suggestion_ignore:"Ignora",suggestion_apply_all:"Applica tutti i suggerimenti",suggestion_show_ignored:"Mostra di nuovo i suggerimenti ignorati",export_image:"Salva come immagine",export_title:"Salva il diagramma come immagine",export_hide_names:"Nascondi i nomi",export_hide_hint:"I dispositivi diventano Dispositivo 1, 2, …; aree e nomi dei sensori vengono omessi.",export_save:"Salva",export_device:"Dispositivo {n}",export_footer:"Energy Flow Mapper · {tab} · {period} · {time}",export_draft:"Bozza, non salvata",export_failed:"Impossibile creare l'immagine.",backups_title:"Backup",backups_empty:"Ancora nessun backup. Ne viene creato uno prima di ogni salvataggio.",backup_by:"di {user}",restore:"Ripristina",restore_confirm:"Ripristinare il backup del {date}? Le impostazioni attuali vengono salvate prima.",undo_confirm:"Ripristinare le impostazioni di prima dell’ultimo salvataggio ({date})? Le impostazioni attuali vengono salvate prima.",draft_lost:"Le modifiche non salvate andranno perse.",restored:"Backup ripristinato.",summary_added:"{count} aggiunti",summary_removed:"{count} rimossi",summary_moved:"{count} spostati",summary_renamed:"{count} rinominati",summary_rate:"{count} con nuovo sensore di potenza o di portata",summary_restored:"Backup ripristinato",error_conflict:"Le impostazioni energetiche o i gruppi sono stati modificati altrove nel frattempo. Sono stati ricaricati; controlla le modifiche e salva di nuovo.",error_not_loaded:"Energy Flow Mapper non è caricato.",error_unsupported_energy_api:"Le impostazioni energetiche di questa versione di Home Assistant non sono supportate. L’editor è disattivato per proteggere le tue impostazioni.",assign_title:"Assegna: {role}",assign_hint:"Scegli un contatore di energia libero.",battery_title:"Batteria: contatore di carica",battery_hint:"{name} misura la scarica. Scegli il contatore che misura la carica.",source_assign:"Assegna sensore …",source_replace:"Sostituisci sensore …",source_remove:"Rimuovi come fonte",power_only:"Solo potenza",power_only_hint:"Questi sensori di potenza non hanno un contatore di energia. «Crea contatore» aggiunge subito un aiutante integrale; resta anche senza Energy Flow Mapper.",create_meter:"Crea contatore",create_meter_title:"Creare un contatore di energia per {name}?",create_meter_text:"L’aiutante «{helper}» viene creato subito in Impostazioni → Aiutanti. È un normale aiutante di Home Assistant e resta anche se rimuovi Energy Flow Mapper. Il suo contatore viene poi aggiunto alla tua bozza.",creating:"Creazione …",meter_created:"Contatore «{name}» creato e aggiunto alla bozza.",energy_suffix:"Energia",external_statistic:"Statistica esterna",created_by:"Creato da Energy Flow Mapper",detail_helper:"Aiutante",diff_source_added:"{name} assegnato come {role}",diff_source_removed:"{name} rimosso come {role}",summary_source_added:"{count} assegnati come fonte",summary_source_removed:"{count} rimossi come fonte",diff_source_rate:"Sensore di potenza di {name} ({role}) modificato",diff_source_rate_flow:"Sensore di portata di {name} ({role}) modificato",summary_source_rate:"{count} fonti con nuovo sensore di potenza o di portata",issue_duplicate_source:"Usato da più fonti",error_unknown_source:"Questo sensore non è una fonte nella dashboard energia.",error_invalid_power_config:"Questo sensore di potenza non è adatto a questa fonte.",error_home_exists:"C’è già un contatore della casa.",error_home_not_supported:"Questa versione di Home Assistant non ha il contatore della casa; serve la 2026.11 o successiva.",error_not_a_power_candidate:"Questo sensore non è un sensore di potenza o di portata senza contatore.",error_integral_failed:"Non è stato possibile creare l’helper del contatore.",confirm_rejected:"Home Assistant non accetta queste impostazioni:",source_last_meter:"È l’ultimo contatore di questo allacciamento alla rete. Rimuoverlo rimuove l’allacciamento con i suoi prezzi.",error_invalid_changes:"La bozza contiene errori e non è stata salvata.",error_restore_invalid:"Questo backup non può essere ripristinato: insieme alle impostazioni energetiche attuali causerebbe errori ({issues}). Non è stato modificato nulla.",error_device_exists:"Questo dispositivo è già nella dashboard energia.",error_unknown_device:"Un dispositivo della tua bozza non è più nella dashboard energia. Annulla la bozza e riprova.",error_unknown_change:"Questa modifica non è supportata.",error_backup_not_found:"Questo backup non esiste più.",error_rejected_by_home_assistant:"Home Assistant ha rifiutato le impostazioni: {error}",backups_hint:"Conservati nella cartella di configurazione di Home Assistant, quindi fanno parte di ogni backup di Home Assistant. Esporta un file per tenerne una copia altrove.",export_current:"Esporta impostazioni attuali",import_file:"Importa da file …",export:"Esporta",import_title:"Importa {file}",import:"Importa",import_unchanged:"Questo file contiene le tue impostazioni attuali. Non c’è nulla da importare.",import_invalid_file:"Impossibile leggere questo file. Scegli un file esportato da Energy Flow Mapper.",imported:"Importato. Le impostazioni precedenti sono state salvate.",summary_imported:"File importato",error_invalid_import:"Questo file non è un’esportazione di Energy Flow Mapper.",error_unknown:"Errore: {message}",tabs_label:"Parte della dashboard energia",tab_electricity:"Elettricità",tab_gas:"Gas",diagram_gas:"Contatori del gas",free_sensors_hint_gas:"Contatori del gas che non sono ancora nella dashboard energia. Home Assistant non ha dispositivi a gas, solo contatori del gas.",no_candidates_gas:"Nessun contatore del gas libero.",assign_hint_gas:"Scegli un contatore del gas libero.",tab_water:"Acqua",diagram_water:"Flusso d’acqua",free_sensors_hint_water:"Contatori d’acqua che non sono ancora nella dashboard energia.",no_candidates_water:"Nessun contatore d’acqua libero.",assign_hint_water:"Scegli un contatore d’acqua libero.",with_flow:"Sensore di portata: {entity}",detail_flow_sensor:"Sensore di portata",detail_flow:"Portata attuale",detail_volume:"Acqua nel periodo",issue_not_water_unit:"L’unità {unit} non è un’unità d’acqua",diff_water:"Acqua: {text}",diff_rate_water:"Sensore di portata di {name} modificato",undo_change:"Annulla modifica",undo_change_hint:"Annulla l’ultima modifica della bozza (Ctrl+Z)",draft_restored:"Le modifiche non salvate sono state ripristinate.",draft_outdated:"Le modifiche non salvate non possono essere ripristinate, perché nel frattempo le impostazioni energetiche sono cambiate.",blocked_one:"1 problema impedisce il salvataggio",blocked_other:"{count} problemi impediscono il salvataggio",blocked_hint:"Fai clic su Salva per vedere i problemi.",show_block:"Mostra",change_undone:"Ultima modifica annullata.",flow_only:"Solo portata",flow_only_hint:"Questi sensori di portata non hanno un contatore d’acqua. «Crea contatore» aggiunge subito un helper integrale; resta anche senza Energy Flow Mapper.",create_water_meter_title:"Creare un contatore d’acqua per {name}?",create_water_meter_text:"L’helper «{helper}» viene creato subito in Impostazioni → Helper. Somma la portata in acqua (L/min in litri, m³/h in m³) e viene mostrato come acqua. È un normale helper di Home Assistant e resta anche se rimuovi Energy Flow Mapper. Il suo contatore viene poi aggiunto alla tua bozza.",water_suffix:"Acqua",find_device:"Cerca dispositivo",find_none:"Nessun risultato",find_count:"{index} di {count}",find_next:"Avanti",card_empty:"Ancora nessun dispositivo nella dashboard energia.",card_root_missing:"Questo dispositivo non è più nella dashboard energia. Scegline un altro nelle impostazioni della scheda.",card_root_group_missing:"Questo gruppo non esiste più. Scegli un altro punto di partenza nelle impostazioni della scheda.",card_root_all:"Tutta la casa",card_root_group:"Gruppo: {name}",card_root_group_in:"Gruppo: {name} (in {parent})",card_stale:"Aggiornamento non riuscito, vengono mostrati gli ultimi valori.",card_field_title:"Titolo (vuoto: nessun titolo)",card_field_kind:"Mostra",card_field_root:"Punto di partenza",card_field_show_sources:"Mostra le fonti",card_field_show_untracked:"Mostra il consumo non monitorato",card_field_show_coverage:"Mostra quanto coprono i dispositivi",card_field_show_types:"Segna aiutanti e statistiche esterne",select_mode:"Seleziona",select_done:"Fine",select_mode_hint:"Tocca i blocchi per selezionarli e raggrupparli. Funziona anche Ctrl+clic.",selected_count:"{count} selezionati",group_selection:"Raggruppa",clear_selection:"Annulla selezione",group_parents_hint:"Solo dispositivi con lo stesso genitore",group_name_title:"Dai un nome al nuovo gruppo",group_devices_one:"1 dispositivo",group_devices_other:"{count} dispositivi",group_actions:"Azioni per il gruppo {name}",diff_group_created:"Gruppo «{name}» creato ({devices})",diff_group_renamed:"Gruppo «{from}» rinominato in «{to}»",diff_group_dissolved:"Gruppo «{name}» sciolto",diff_group_changed:"Gruppo «{name}» modificato ({devices})",summary_group_created:"{count} gruppi creati",summary_group_renamed:"{count} gruppi rinominati",summary_group_dissolved:"{count} gruppi sciolti",summary_group_changed:"{count} gruppi modificati",export_group:"Gruppo {n}",error_unknown_group:"{stat} non è un gruppo.",error_group_parents_differ:"{stat} non si trova sotto lo stesso dispositivo di questo gruppo.",error_group_loop:"Un gruppo non può essere spostato in se stesso né sotto uno dei suoi dispositivi ({stat}).",error_group_name_empty:"Un gruppo ha bisogno di un nome.",error_group_name_taken:"Qui esiste già un gruppo chiamato {stat}.",error_group_exists:"Il gruppo {stat} esiste già.",group_dissolve:"Sciogli il gruppo",suggest_groups:"Suggerisci gruppi dalle aree",suggest_groups_none:"Nessun gruppo da suggerire: non ci sono due dispositivi non raggruppati sotto lo stesso genitore nella stessa area.",sum_create:"Crea contatore somma",sum_create_button:"Crea",sum_members:"Sensori nella somma",sum_fixed_hint:"Tutti i dispositivi del gruppo sono nella somma; puoi aggiungere altri sensori.",sum_add:"Aggiungi sensore",sum_remove:"Rimuovi {name} dalla somma",sum_no_sensors:"Non si può aggiungere nessun altro sensore.",sum_blocked:"I sensori segnalati non possono essere sommati, quindi il contatore somma non può essere creato.",sum_text:"L’aiutante «{helper}» viene creato subito in Impostazioni → Aiutanti e somma questi sensori. È un normale aiutante di Home Assistant e resta anche se annulli la modifica o rimuovi Energy Flow Mapper. Il suo contatore viene poi aggiunto alla tua bozza; tutti i dispositivi della somma passano sotto di esso, le fonti restano fonti.",sum_text_replace:"L’aiutante «{helper}» viene creato subito in Impostazioni → Aiutanti e somma questi sensori. È un normale aiutante di Home Assistant e resta anche se annulli la modifica o rimuovi Energy Flow Mapper. Il suo contatore prende poi il posto di {name} nella tua bozza, con i suoi figli; le fonti restano fonti.",sum_rate_hint:"Ogni contatore della somma ha un sensore di potenza, quindi un secondo aiutante «{helper}» ne somma la potenza.",sum_rate_hint_water:"Ogni contatore della somma ha un sensore di portata, quindi un secondo aiutante «{helper}» ne somma la portata.",sum_rate_missing:"Nessuna somma di potenza, perché questi non hanno un sensore di potenza: {names}.",sum_rate_missing_water:"Nessuna somma di portata, perché questi non hanno un sensore di portata: {names}.",sum_rate_source_sign:"Nessuna somma di potenza: la potenza di rete e batteria non si può sommare, perché il suo segno dipende dalla direzione.",sum_rate_source_water:"Nessuna somma di portata: la portata di una fonte d’acqua non si può aggiungere a una somma di portata.",sum_replace:"Sostituisci {name}",sum_replace_reason:"Fa già parte della somma; sotto il nuovo contatore verrebbe contato due volte.",sum_created:"Contatore somma «{name}» creato e aggiunto alla bozza.",sum_solar_use_setup:"Un contatore somma con un impianto solare richiede la configurazione guidata «Il solare immette qui…»: solo lei verifica come conta il contatore del tuo circuito, così niente viene contato due volte o in modo sbagliato. Perciò questa somma non viene creata.",sum_member_unchecked:"Non verificato: troppe poche statistiche per capire se riparte da 0",sum_periodic_solar:"Per un impianto solare in un circuito, «Il solare immette qui…» crea invece il contatore lordo.",sum_periodic_way:"Cosa fare: usa invece il sensore del totale complessivo del dispositivo, oppure crea un contatore dal suo sensore di potenza (un aiutante integrale in Impostazioni → Dispositivi e servizi → Aiutanti).",sum_mixed_total:"Un contatore total (un contatore lordo o netto, che può anche scendere) non può essere sommato a contatori che salgono soltanto (total_increasing): Home Assistant non accetterebbe la somma come contatore. Tieni invece questi dispositivi separati nell’albero.",sum_state_class_list:"Classi di stato: {list}.",sum_solar_save_first:"{names}: un impianto solare è stato modificato solo nella tua bozza (aggiunto, rimosso o con un altro sensore di potenza). Salva prima, poi crea la somma.",sum_solar_no_device:"La somma non ha alcun dispositivo in cui l’impianto solare possa immettere. Rimuovi l’impianto solare dalla somma.",sum_solar_is:"Un impianto solare o una sua parte: {names}.",sum_solar_open_setup:"Configura il solare per {name}",sum_solar_one_device:"La configurazione crea il contatore lordo del dispositivo in cui l’impianto solare immette; resta poi un dispositivo a sé. Somma gli altri dispositivi senza l’impianto solare.",sum_solar_holders:"Contengono già un impianto solare: {names}. Se uno di essi è già un contatore lordo (consumo con il proprio impianto solare), segnalo qui sotto; altrimenti rimuovilo dalla somma.",sum_solar_holders_group:"Contengono già un impianto solare: {names}. Se uno di essi è già un contatore lordo (consumo con il proprio impianto solare), segnalo qui sotto; altrimenti toglilo prima dal gruppo: ogni dispositivo di un gruppo fa parte della sua somma.",sum_solar_no_device_group:"La somma non ha alcun dispositivo in cui l’impianto solare possa immettere. Togli prima l’impianto solare dal gruppo: ogni dispositivo di un gruppo fa parte della sua somma.",sum_solar_one_device_group:"La configurazione crea il contatore lordo del dispositivo in cui l’impianto solare immette; resta poi un dispositivo a sé. Togli prima l’impianto solare dal gruppo, poi somma il gruppo.",sum_solar_group_move:"Togli prima l’impianto solare dal gruppo: ogni dispositivo di un gruppo fa parte della sua somma.",sum_gross_ok:"{name} è già un contatore lordo (consumo con solare) – somma comunque",sum_periodic:"Questi contatori ripartono da 0 di tanto in tanto (per esempio ogni giorno), quindi la somma non può essere creata: con loro scenderebbe a ogni loro azzeramento e Home Assistant conterebbe di nuovo l’intera somma. Rimuovili dalla somma.",sum_periodic_member:"{name}: {evidence}",sum_check_unknown:"Non verificato: non è stato possibile verificare se un contatore riparte da 0 ogni giorno (il registratore non ha risposto). Puoi comunque creare la somma.",sum_check_retry:"Verifica di nuovo",sum_checking:"Verifica in corso: un contatore riparte da 0 ogni giorno? …",sum_need_name:"Dai un nome all’aiutante.",sum_need_member:"Aggiungi almeno un sensore.",evidence_utility_meter:"un aiutante contatore di consumo che si azzera a ciclo",evidence_last_reset:"il suo orario di inizio (last_reset) cambia",evidence_drop:"è sceso il {date} alle {time} da {before} a {after}",evidence_statistics:"le sue statistiche mostrano che riparte da 0",sum_reason_external:"Statistica esterna: un aiutante non può sommarla",sum_reason_not_sensor:"Non è un sensore",sum_reason_unavailable:"Non trovato in Home Assistant",sum_reason_device_class:"La classe di dispositivo non è {device_class}",sum_reason_state_class:"La classe di stato non è total o total_increasing",power_suffix:"Potenza",flow_suffix:"Portata",error_sum_not_possible:"{entity} non può essere sommato: deve essere un sensore con la classe di dispositivo corretta e la classe di stato total o total_increasing.",error_sum_state_classes_differ:"I sensori non hanno tutti la stessa classe di stato (total o total_increasing); la loro somma non sarebbe quindi accettata come contatore.",error_sum_failed:"Non è stato possibile creare il contatore somma.",error_sum_with_solar:"{entity} è un contatore solare o ne contiene uno. Un contatore somma con un impianto solare richiede invece la configurazione guidata «Il solare immette qui…».",error_template_failed:"Non è stato possibile creare l’helper template del contatore.",error_returned_disabled:"Il sensore dell’energia immessa {entity_id} è disattivato. Attivalo prima nelle impostazioni della sua entità in Home Assistant.",error_daily_without_power:"{entity_id} riparte da 0 ogni giorno, quindi solo «Dalla potenza» potrebbe costruire il contatore lordo, e servono un sensore di potenza per il circuito e uno per il solare.",error_solar_already_in_meter:"{entity_id} somma già l’impianto solare, quindi un contatore lordo lo conterebbe due volte. Usalo così com’è, oppure togli prima l’impianto solare dalla somma.",error_unsupported_input:"{entity_id} non può essere usato nel contatore lordo: deve essere un sensore con un’unità di energia o di potenza.",error_daily_check_failed:"Non è stato possibile verificare se i contatori di {entity_id} ripartono da 0 ogni giorno: il registratore non ha risposto in tempo. Riprova tra un momento.",error_input_not_ready:"{entity_id} al momento non ha un valore, quindi non è possibile fissare il valore iniziale del contatore lordo. Riprova quando indica un valore.",discard_title:"Scartare la bozza?",discard_confirm:"Tutte le {count} modifiche della bozza andranno perse. Non si può annullare.",tools:"Strumenti",help:"Aiuto",sum_name_exists:"Esiste già un’entità chiamata «{name}». Il nuovo aiutante avrebbe lo stesso nome; scegline un altro per distinguerli.",power_sensor:"Sensore di potenza …",flow_sensor:"Sensore di portata …",power_variant_single:"Standard",power_variant_inverted:"Invertito",power_variant_two:"Due sensori",power_none:"Nessuno",power_same_device:"Stesso dispositivo",power_sensor_label:"Sensore di potenza",flow_sensor_label:"Sensore di portata",power_variant_single_grid:"Un sensore: positivo durante il prelievo dalla rete, negativo durante l’immissione.",power_variant_inverted_grid:"Un sensore con segno opposto: positivo durante l’immissione, negativo durante il prelievo dalla rete.",power_variant_two_grid:"Un sensore per la potenza importata e uno per quella esportata, entrambi positivi.",power_variant_single_battery:"Un sensore: positivo in scarica, negativo in carica.",power_variant_inverted_battery:"Un sensore con segno opposto: positivo in carica, negativo in scarica.",power_variant_two_battery:"Un sensore per la potenza di scarica e uno per quella di carica, entrambi positivi.",hints:"Indicazioni",hint_returned_energy:"Il suo dispositivo conta anche l’energia immessa ({entity}). Se un impianto solare immette in questo circuito, questo contatore vede solo ciò che il circuito preleva dalla casa, non ciò che l’impianto solare vi produce.",hint_returned_energy_disabled:"Il suo dispositivo ha anche un sensore dell’energia immessa ({entity}), che è disattivato, e questo circuito ha immesso energia di recente (la sua potenza è scesa sotto 0). Se un impianto solare immette in questo circuito, questo contatore vede solo ciò che il circuito preleva dalla casa, non ciò che l’impianto solare vi produce.",hint_daily_in_sum:"Questa somma mescola contatori che ripartono da 0 ogni giorno con contatori che non lo fanno: {names}. La somma allora scende una volta al giorno, e Home Assistant conta di nuovo l’intera somma. Nell’aiutante usa invece un contatore che non si azzera (per un impianto solare, un integrale della sua potenza).",hint_power_available:"Il suo dispositivo ha un sensore di potenza non impostato: {entity}.",hint_flow_available:"Il suo dispositivo ha un sensore di portata non impostato: {entity}.",hint_set_power:"Imposta sensore di potenza",hint_set_flow:"Imposta sensore di portata",hint_open_helper:"Apri impostazioni dell’aiutante",hint_dismiss:"Nascondi",hint_dismiss_title:"Nascondi questa indicazione per sempre. «Mostra di nuovo i suggerimenti ignorati» la riporta.",hint_dismiss_event_title:"Nascondi questa indicazione solo per questo evento. Uno nuovo viene mostrato di nuovo.",hint_children_solar:"Forse un impianto solare immette in questo circuito: al suo contatore manca allora ciò che l’impianto vi produce, e i dispositivi figli sembrano consumare di più.",hint_readme:"Maggiori dettagli nel README",hint_show_sensor:"Mostra sensore",hint_minutes:"{count} min",hint_hours:"{count} h",hint_gross_off_down:"{meter} è sceso di {drop} nell’ora dalle {time} del {date}.",hint_gross_off_down_power:"{meter} è sceso di {drop} nell’ora dalle {time} del {date}; la sua potenza lorda dava {power}.",hint_gross_off_less:"{meter} ha contato {change} nell’ora dalle {time} del {date}, nettamente meno di quanto dava la sua potenza lorda ({power}).",hint_gross_off_more:"{meter} ha contato {change} nell’ora dalle {time} del {date}, nettamente più di quanto dava la sua potenza lorda ({power}).",hint_gross_off_counted:"{meter} ha contato {change} nell’ora dalle {time} del {date}.",hint_gross_off_input:"Il contatore {input} è stato probabilmente azzerato o sostituito: è sceso a meno della metà in quell’ora, e il contatore lordo mantiene questo salto. Puoi togliere questo salto dalle statistiche in Strumenti per sviluppatori → Statistiche (vedi il README).",hint_gross_off_input_net:"Il contatore {input} è stato probabilmente azzerato o sostituito: è sceso a meno della metà in quell’ora, e il contatore lordo mantiene questo salto. Un contatore che conta in entrambe le direzioni scende anche mentre il circuito immette, ma raramente così tanto. Puoi togliere questo salto dalle statistiche in Strumenti per sviluppatori → Statistiche (vedi il README).",hint_gross_off_solar_term:"Il suo aiutante per l’energia del solare ha contato nettamente meno del solare stesso in quell’ora: la potenza del solare non aveva un valore (sconosciuta, o non disponibile per più di 10 minuti), oppure Home Assistant non era in funzione. Quell’energia solare manca nel contatore lordo; non c’è niente da correggere.",hint_gross_off_sign:"Il contatore conta con contatori di energia, quindi probabilmente è giusto; a differire è la sua potenza lorda. O il suo segno è sbagliato, oppure il contatore è rimasto fermo per un po’ e poi ha recuperato: un tale salto unico lascia l’indicazione da solo dopo 7 giorni. Se la potenza lorda ha il segno sbagliato, imposta il sensore di potenza del dispositivo su «Nessuno»: il contatore continua a contare, sparisce solo il suo valore attuale. Dopo il salvataggio l’indicazione sparisce.",hint_gross_off_sign_power:"Questo contatore lordo conta la sua potenza lorda, e quella potenza è scesa sotto 0. Se la potenza del circuito ha il segno sbagliato, anche il contatore conta male: crea di nuovo il contatore lordo con la potenza del circuito invertita. Se una batteria o altro immette nel circuito, non c’è soluzione: un contatore lordo non può contarlo.",hint_gross_off_below_zero:"Un contatore lordo di consumo non deve scendere sotto 0. O nel circuito immette qualcos’altro oltre al solare (una batteria, un secondo inverter), oppure i suoi ingressi sono scambiati (prelievo e immissione invertiti, o un contatore netto che conta al contrario). Crea di nuovo il contatore lordo con il metodo giusto. Un contatore lordo non può contare una batteria che immette: rimetti allora il contatore proprio del circuito con ⋮ → «Sostituisci con …».",hint_gross_off_unclear:"Le statistiche non mostrano perché.",hint_gross_unknown:"{meter} non ha avuto un valore per {length} dalle {time} del {date}.",hint_gross_unknown_power:"{meter} non ha potuto contare per {length} dalle {time} del {date}.",hint_gross_unknown_input:"Neanche {input} aveva un valore in quel periodo, e il contatore lordo ha bisogno di tutti i suoi sensori. Controlla quel sensore.",hint_gross_unknown_inputs:"Il contatore lordo ha bisogno di tutti i suoi sensori; controlla quelli di cui è fatto.",hint_solar_term_short:"Il {date}, l’aiutante {term} ha contato {term_energy} dell’energia di questo solare, nettamente meno del solare stesso ({source_energy}). La potenza del solare non aveva un valore (sconosciuta, o non disponibile per più di 10 minuti), oppure Home Assistant non era in funzione; ai contatori lordi che usano l’aiutante manca quell’energia. Non c’è niente da correggere; se succede spesso, controlla il sensore di potenza del solare.",hint_solar_term_high:"Il {date}, l’aiutante {term} ha contato {term_energy} dell’energia di questo solare, nettamente più del solare stesso ({source_energy}). Forse la potenza del solare mantiene un valore mentre non si produce nulla (un valore bloccato durante la notte), forse misura altro (il lato in corrente continua o della batteria), oppure il contatore di energia del solare registra una parte della giornata in ritardo, dopo mezzanotte. Controlla il sensore di potenza del solare.",solar_setup:"Il solare immette qui…",solar_setup_title:"Il solare immette in {name}",solar_setup_intro:"L’impianto solare immette in questo circuito, e i dispositivi collegati ne consumano l’energia prima che raggiunga il contatore. Il contatore mostra quindi meno di quanto consumano, o diventa persino negativo. La configurazione crea un contatore lordo: ciò che i dispositivi di questo circuito consumano davvero.",solar_setup_no_solar:"La configurazione richiede una fonte solare nella dashboard energia. Aggiungine prima una, poi riavvia la configurazione.",solar_setup_source:"Impianto solare",solar_setup_set_solar_power:"Imposta sensore di potenza del solare",solar_setup_open_settings:"Apri le sue impostazioni",solar_setup_preview:"Cosa viene creato",solar_setup_energy:"Un aiutante modello per l’energia lorda, {formula}:",solar_setup_offset:"I {offset} kWh vengono aggiunti perché il contatore lordo parta sopra 0: le impostazioni dell’energia di Home Assistant segnalano un contatore il cui stato è sotto 0. Non cambiano ciò che conta.",solar_setup_power:"Un aiutante modello per la potenza lorda, {formula}:",solar_setup_text:"Gli aiutanti vengono creati subito in Impostazioni → Aiutanti. Sono normali aiutanti di Home Assistant e restano anche se annulli la modifica o rimuovi Energy Flow Mapper. Il contatore lordo prende poi il posto di {name} nella tua bozza, con i suoi dispositivi figli e il suo gruppo, e il nome che hai dato a {name}, se presente. Riceve la potenza lorda come sensore di potenza. Salva come al solito.",solar_setup_text_no_power:"Gli aiutanti vengono creati subito in Impostazioni → Aiutanti. Sono normali aiutanti di Home Assistant e restano anche se annulli la modifica o rimuovi Energy Flow Mapper. Il contatore lordo prende poi il posto di {name} nella tua bozza, con i suoi dispositivi figli e il suo gruppo, e il nome che hai dato a {name}, se presente. Salva come al solito.",solar_setup_button:"Configura",solar_setup_done:"Contatore lordo «{name}» creato; prende il posto di {old} nella bozza.",solar_setup_created_only:"Contatore lordo «{name}» creato. Non ha potuto prendere il posto di {old} nella bozza; mettilo al suo posto con «Sostituisci con …».",solar_gross_name:"{name} lordo",solar_gross_power_name:"{name} potenza lorda",solar_setup_method:"Come va costruito il contatore lordo?",solar_method_em:"Contatore EM: lordo = prelievo − immissione + solare",solar_method_em_hint:"Per un contatore che conta separatamente prelievo e immissione del circuito, come uno Shelly Pro EM.",solar_method_plug:"Presa o interruttore: lordo = energia − 2 × immissione + solare",solar_method_plug_hint:"Per una presa o un interruttore Shelly la cui «Energia» conta in entrambe le direzioni.",solar_method_net:"Contatore netto: lordo = contatore + solare",solar_method_net_hint:"Per un contatore che conta all’indietro mentre il circuito immette.",solar_method_power:"Dalla potenza: lordo = integrale di (potenza del circuito + potenza solare)",solar_method_power_hint:"Corretto per ogni dispositivo la cui potenza del circuito ha un segno; l’energia è una stima dalla potenza.",solar_method_suggested:"Suggerito",reason_rule_shelly_em:"adatto al tuo dispositivo ({device})",reason_rule_shelly_plug:"adatto al tuo dispositivo ({device}): la sua «Energia» conta in entrambe le direzioni",reason_rule_shelly_consumed:"adatto al tuo dispositivo ({device}): «Energia consumata» conta solo il prelievo",reason_rule_net_negative:"adatto al tuo contatore: è sceso sotto 0 negli ultimi giorni",reason_power_signed:"verificato: la sua potenza è scesa sotto 0 negli ultimi giorni, quindi ha un segno",reason_unverified_against_rule:"non verificato – non è la regola del tuo dispositivo, o non il sensore dell’energia immessa di cui si fida; sceglilo solo se sai che il tuo contatore conta così",reason_unverified_may_reset:"non verificato – questo contatore forse riparte da 0 dopo un’interruzione di corrente",reason_unverified_net:"non verificato – sceglilo solo se il tuo contatore conta all’indietro durante l’immissione; negli ultimi giorni non è mai sceso sotto 0",reason_unverified_no_data:"non verificato – un suo contatore non ha statistiche negli ultimi giorni; indica qui sotto se riparte da 0 ogni giorno",reason_unverified_power_unsigned:"non verificato – il circuito non ha mai immesso negli ultimi giorni, quindi non è chiaro se la sua potenza ha un segno",reason_net_needs_signed_meter:"non offerto – il contatore conta solo in salita (total increasing), quindi Home Assistant leggerebbe ogni calo come un azzeramento",reason_no_returned_sensor:"non offerto – il suo dispositivo non ha un sensore dell’energia immessa",reason_daily_input:"non offerto – un suo contatore riparte da 0 ogni giorno",reason_unsupported_input:"non offerto – un suo contatore non ha un’unità di energia leggibile",reason_no_power:"non offerto – servono un sensore di potenza per il circuito e uno per il solare",reason_unusable_power:"non offerto – il sensore di potenza del circuito è disattivato o non ha un’unità di potenza leggibile",solar_setup_drawn:"Contatore del prelievo del circuito",solar_setup_returned:"Sensore dell’energia immessa",solar_setup_choose:"Scegli …",solar_setup_disabled_option:"{entity} (disattivato in Home Assistant)",solar_setup_disabled_sensor:"{entity} è disattivato in Home Assistant. La configurazione non lo attiva al posto tuo.",solar_setup_inputs:"Contatori e loro statistiche",solar_setup_daily:"Riparte da 0 ogni giorno (periodico)",solar_setup_lifetime:"Continua a contare (non riparte mai da 0)",solar_setup_daily_locked:"Fisso: {evidence}.",solar_setup_daily_hint:"Preselezionato dalle statistiche; cambialo se lo sai meglio.",evidence_lifetime:"è salito negli ultimi giorni senza ripartire da 0",evidence_no_data:"nessuna statistica negli ultimi giorni",solar_setup_power_title:"Potenza",solar_setup_circuit_power:"Circuito: {entity} ({from})",solar_setup_solar_power:"Solare: {entity} ({from})",solar_setup_circuit_none:"Circuito: nessun sensore di potenza",solar_setup_solar_none:"Solare: nessun sensore di potenza",solar_setup_from_draft:"dalla tua bozza",solar_setup_from_saved:"salvato",solar_setup_from_paired:"trovato sul suo dispositivo",solar_setup_live:"Ora: circuito {circuit} + solare {solar} = {gross}",solar_setup_live_hint:"Verifica che corrisponda a ciò che è in funzione ora: mentre il circuito immette, la sua potenza è negativa.",solar_setup_invert:"Inverti la potenza del circuito",solar_setup_invert_hint:"Per un sensore di potenza positivo mentre il circuito immette.",solar_setup_power_history:"La nuova energia lorda parte da 0 e non ha storico; è una stima dalla potenza.",solar_setup_counter_night:"{solar} non ha un sensore di potenza, quindi il suo contatore viene usato così com’è. Di notte il contatore lordo può fermarsi, e il consumo della notte arriva allora al mattino; i totali restano corretti.",solar_setup_hold:"Finché il solare è «non disponibile», la sua ultima potenza viene mantenuta fino a 10 minuti, poi conta come 0. Uno stato «sconosciuto» e uno ripristinato dopo un riavvio contano subito come 0.",solar_setup_reuse:"Usa l’aiutante di energia solare esistente {entity}.",solar_setup_role_solar_power:"Un aiutante modello per la potenza del solare, 0 finché è spento:",solar_setup_role_solar_energy:"Un aiutante integrale per l’energia del solare, da quella potenza:",solar_setup_role_energy_power:"Un aiutante integrale per l’energia lorda, dalla potenza lorda:",solar_term_power_name:"{name} (0 se spento)",solar_setup_retry:"Riprova",solar_setup_check_again:"Verifica di nuovo",solar_setup_why_solar:"Scegli un impianto solare.",solar_setup_why_checking:"Verifica in corso …",solar_setup_why_failed:"La verifica non è riuscita; riprova.",solar_setup_why_method:"Scegli come costruire il contatore lordo.",solar_setup_why_blocked:"Risolvi prima il problema qui sopra.",solar_setup_why_names:"Dai un nome a ogni aiutante.",solar_setup_conflict:"Le tue impostazioni energia sono cambiate nel frattempo. La verifica è stata ripetuta su di esse: controllala, poi configura di nuovo.",error_solar_needs_power:"{entity_id} non ha un sensore di potenza, e il suo contatore forse riparte da 0. Questo impianto solare ha bisogno di un sensore di potenza.",error_solar_needs_data:"{entity_id} non ha un sensore di potenza, e le sue statistiche non mostrano ancora che il suo contatore non riparte mai da 0 (deve salire in due giorni). Imposta il sensore di potenza del solare, oppure aspetta un giorno o due.",error_no_safe_method:"Nessun metodo è adatto a {entity_id}: serve un sensore dell’energia immessa sul suo dispositivo, un contatore che conta all’indietro durante l’immissione, oppure sensori di potenza per il circuito e il solare.",error_not_offered:"{entity_id} non è (più) offerto qui. La verifica è stata ripetuta.",error_choose_returned:"Scegli qui sopra il sensore dell’energia immessa.",error_input_disabled:"{entity_id} è disattivato in Home Assistant. Attivalo prima nelle sue impostazioni; la configurazione non lo attiva al posto tuo.",error_values_changed:"I valori di {entity_id} sono cambiati nel frattempo, quindi il valore iniziale non è più giusto. La verifica è stata ripetuta: controllala, poi configura di nuovo.",reason_gross_power_needs_signed:"Senza potenza in tempo reale: la potenza del circuito non è mai scesa sotto 0 negli ultimi giorni, quindi il suo segno non è chiaro",solar_setup_method_gone:"Il metodo scelto non è più possibile – scegline un altro qui sopra.",solar_setup_power_refused_used:"{entity}, il sensore di potenza di {owner} nella tua bozza, è già usato altrove nella dashboard energia o è un contatore di questa configurazione, quindi la configurazione non può usarlo.",solar_setup_power_refused_not_power:"{entity}, il sensore di potenza di {owner} nella tua bozza, non è un sensore di potenza (servono la classe di dispositivo potenza e un’unità come W o kW), quindi la configurazione non può usarlo.",solar_setup_power_refused_ours:"{entity}, il sensore di potenza di {owner} nella tua bozza, è una potenza lorda creata da questa configurazione; conterebbe il solare due volte.",solar_setup_set_circuit_power:"Imposta sensore di potenza di {name}",solar_setup_why_power:"Scegli prima un altro sensore di potenza.",solar_setup_missing_power:"{name} non ha un sensore di potenza.",evidence_unchecked:"non verificato – non è stato possibile leggere le statistiche",solar_setup_daily_question:"{name}: riparte da 0 ogni giorno?",solar_term_energy_name:"{name} energia",solar_setup_power_not_kept:"La potenza attuale di {device} non viene ripresa, perché è netta. Una potenza in tempo reale non si può aggiungere dopo; se ne vuoi una, configura questo solo quando il circuito avrà immesso almeno una volta.",solar_setup_unusable_power:"{entity}, il sensore di potenza di {name}, è disattivato o non ha un’unità di potenza leggibile.",solar_block_free:"{solar}: dove immette?",solar_block_free_hint:"Trascinalo sul circuito in cui l’impianto solare immette.",solar_block_strip:"Un impianto solare non è ancora posizionato",solar_block_placed_title:"Trascinalo su un altro circuito per spostarlo; clicca per altro.",solar_block_placed:"{solar} è posizionato su {device}.",solar_block_removed:"{solar} non è più posizionato.",solar_place_text:"{solar} immette in {device}. Lo mostra solo il diagramma; le impostazioni energetiche non cambiano.",solar_place_move:"Per spostarlo, trascina il blocco solare su un altro circuito.",solar_place_replace_hint:"Il contatore di {device} conta l’impianto solare. Per tornare al contatore vero, sostituiscilo.",solar_place_remove:"Rimuovi posizionamento",solar_setup_place_only:"Il mio contatore conta già l’impianto solare: posizionalo solo qui",hint_solar_elsewhere:"{solar} è posizionato su {device}, ma questo contatore lo conta ancora, quindi due volte. Sostituisci questo contatore con quello vero.",solar_block_pick:"Scegli il circuito…",solar_block_move:"Sposta in un altro circuito…",solar_pick_title:"Dove immette {solar}?"}};function qt(e){return e?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function Pt(e,t,s={}){var r;return((r=qt(e),Ht[r]??Ht[r.split("-")[0]]??Lt)[t]??Lt[t]??t).replace(/\{(\w+)\}/g,(e,t)=>t in s?s[t]:e)}function Nt(e){return e in Lt}const It={comma_decimal:["en-US","en"],decimal_comma:["de","es","it"],quote_decimal:["de-CH"],space_comma:["fr","sv","cs"],system:void 0};function jt(e,t,s=0){const r=e?.locale.number_format??"language",i=r in It?It[r]:"none"===r?["en-US"]:[qt(e)];try{return new Intl.NumberFormat(i,{useGrouping:"none"!==r,maximumFractionDigits:s}).format(t)}catch{return String(t)}}function Rt(e,t){const s=Math.abs(t);return s>=1e6?`${jt(e,t/1e6,2)} MW`:s>=1e3?`${jt(e,t/1e3,2)} kW`:`${jt(e,t)} W`}function Ft(e,t){const s=Math.abs(t);return s<1?`${jt(e,1e3*t)} Wh`:`${jt(e,t,s<10?2:s<100?1:0)} kWh`}function Gt(e,t,s){return"L"===s&&Math.abs(t)>=1e3?`${jt(e,t/1e3,Zt(t/1e3))} m³`:`${jt(e,t,Zt(t))} ${s}`}function Ot(e,t,s){const r="gal"===s?t/3.785411784:t;return`${jt(e,r,Zt(r))} ${s}/min`}function Zt(e){const t=Math.abs(e);return t<10?2:t<100?1:0}function Bt(e,t){try{return new Intl.DateTimeFormat(qt(e),{dateStyle:"medium",timeStyle:"short"}).format(new Date(t))}catch{return t}}function Wt(e,t){const s=t??{},r=`error_${s.translation_key??""}`;if(s.translation_key&&Nt(r)){const t=Object.fromEntries(Object.entries(s.translation_placeholders??{}).map(([e,t])=>[e,String(t)]));return Pt(e,r,t)}return Pt(e,"error_unknown",{message:s.message??String(t)})}function Ut(e,t,s){const r=e?.localize?.(`component.energy.issues.${t.type}.title`,t.placeholders??void 0)||t.type,i=t.entities.filter(([e])=>e!==s).map(([e,t])=>null==t?e:`${e} (${String(t)})`);return i.length?`${r}: ${i.join(", ")}`:r}function Vt(e){return e?.locale.language||("undefined"==typeof document?"":document.documentElement.lang)||"en"}function Kt(e,t){const s=new Date(t),r=e?.config?.time_zone,i=t=>{try{return new Intl.DateTimeFormat(Vt(e),{...t,...r?{timeZone:r}:{}}).format(s)}catch{return new Intl.DateTimeFormat(Vt(e),t).format(s)}};return{date:i({day:"numeric",month:"numeric"}),time:i({hour:"2-digit",minute:"2-digit"})}}function Qt(e,t){const s=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);if(!s)return t;const r=new Date(Date.UTC(Number(s[1]),Number(s[2])-1,Number(s[3]),12));return new Intl.DateTimeFormat(Vt(e),{day:"numeric",month:"numeric",timeZone:"UTC"}).format(r)}function Jt(e,t,s){if("utility_meter"===t.reason)return Pt(e,"evidence_utility_meter");if("last_reset"===t.reason)return Pt(e,"evidence_last_reset");const r=t.drops.at(-1);if(void 0===r)return Pt(e,"evidence_statistics");const i=t=>s?`${jt(e,t,2)} ${s}`:jt(e,t,2);return Pt(e,"evidence_drop",{...Kt(e,r.at),before:i(r.before),after:i(r.after)})}const Yt="efm-solar-setup",Xt=new Set(["used","not_power","ours"]),es={periodic:null,certain:!1,reason:null,drops:[],went_negative:!1,series:[]},ts="solar-setup-why";class ss extends le{static properties={hass:{attribute:!1},localize:{attribute:!1},context:{attribute:!1},_solar:{state:!0},_choices:{state:!0},_preview:{state:!0},_loading:{state:!0},_error:{state:!0},_refused:{state:!0},_notice:{state:!0},_names:{state:!0},_busy:{state:!0}};_request=0;_started=!1;_asked=!1;constructor(){super(),this.localize=e=>e,this._solar=null,this._choices={method:null,drawn:null,returned:null,invert:null,periodic:{}},this._preview=null,this._loading=!1,this._error=null,this._refused=null,this._notice=null,this._names={},this._busy=!1}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents",this.context&&this.isUpdatePending?this.performUpdate():this._loading&&this._loadPreview()}disconnectedCallback(){super.disconnectedCallback(),this._request++}willUpdate(){if(!this._started){this._started=!0;const{solar:e,solars:t,resume:s}=this.context;s&&(this._choices={...s.choices,periodic:{...s.choices.periodic}},this._names={...s.names});const r=s?.solar??e;this._solar=r&&t.includes(r)?r:1===t.length?t[0]:null}!this._asked&&this.hass&&this._solar&&(this._asked=!0,this._loadPreview())}_emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t}))}_state(){return{solar:this._solar,choices:{...this._choices,periodic:{...this._choices.periodic}},names:{...this._names}}}_setSolarPower(){this._emit("set-solar-power",{solar:this._solar,state:this._state()})}_setCircuitPower(){this._emit("set-circuit-power",{stat:this.context.stat,state:this._state()})}_openSettings(e){this._emit("open-settings",{entity_id:e,state:this._state()})}_display(e){return e===this.context.stat?this.context.deviceName:this.context.solars.includes(e)?this.context.name(e):this.context.sensorName(e)}_errorText(e){const t=e??{},s=t.translation_placeholders?.entity_id;return Wt(this.hass,"string"!=typeof s?e:{...t,translation_placeholders:{...t.translation_placeholders,entity_id:this._display(s)}})}_message(e){const{method:t,drawn:s,returned:r,invert:i,periodic:n}=this._choices,o=this.context.draft();return{type:`energy_flow_mapper/${e}`,stat:this.context.stat,solar:this._solar,...t?{method:t}:{},...s?{drawn:s}:{},...r?{returned:r}:{},...null!==i?{invert:i}:{},...Object.keys(n).length?{periodic:{...n}}:{},...o?{base_hash:o.base_hash,changes:o.changes}:{}}}_refusedPower(e){const t=e.translation_placeholders??{},{entity_id:s,power:r,why:i}=t;return"not_offered"!==e.translation_key||"string"!=typeof s||"circuit"!==r&&"solar"!==r||"string"!=typeof i||!Xt.has(i)?null:{entity:s,power:r,why:i}}_dropPick(e){const t=e.translation_placeholders?.entity_id,{drawn:s,returned:r}=this._choices;return void 0!==t&&(t===s||t===r)&&(this._choices={...this._choices,drawn:t===s?null:s,returned:t===r?null:r},!0)}_dropMethod(){this._choices={...this._choices,method:null},this._notice=this.localize("solar_setup_method_gone")}async _loadPreview(){const e=this.hass,t=this._solar;if(!e||!t)return;const s=++this._request,r=()=>s!==this._request||this._solar!==t;this._loading=!0,this._error=null,this._refused=null;let i=!1,n=!1,o=!1;for(;;)try{const t=await e.callWS(this._message("solar_setup_preview"));if(r())return;const s=this._choices.method;if(s&&!o&&!t.methods.some(e=>e.method===s&&e.offered)){o=!0,this._dropMethod();continue}return this._preview=t,void(this._loading=!1)}catch(e){if(r())return;const t=e??{};if("conflict"===t.translation_key&&!i){i=!0;try{await this.context.reload()}catch{}if(r())return;continue}const s=this._refusedPower(t);if(null!==s)return this._refused=s,void(this._loading=!1);if("not_offered"===t.translation_key&&!n&&this._dropPick(t)){n=!0,this._notice=this._errorText(e);continue}return this._error=this._errorText(e),void(this._loading=!1)}}_choose(e){this._choices={...this._choices,...e},this._notice=null,this._loadPreview()}_pickSolar(e){this._solar=e,this._asked=!0,this._preview=null,this._error=null,this._notice=null,this._loadPreview()}_nameOf(e,t){const s=this._names[e];if(void 0!==s)return s;const r=this.localize,i=this.context.deviceName,n=t.power.solar?this.context.sensorName(t.power.solar):"";switch(e){case"energy":return r("solar_gross_name",{name:i});case"power":return r("solar_gross_power_name",{name:i});case"solar_power":return r("solar_term_power_name",{name:n});default:return r("solar_term_energy_name",{name:n})}}_why(){const e=this.localize,t=this._preview;return this._solar?null!==this._refused?e("solar_setup_why_power"):null!==this._error?e("solar_setup_why_failed"):this._loading||null===t||this.context.busy?e("solar_setup_why_checking"):t.blocked?e("solar_setup_why_blocked"):t.method?t.helpers.some(({role:e})=>!this._nameOf(e,t).trim())?e("solar_setup_why_names"):null:e("solar_setup_why_method"):e("solar_setup_why_solar")}async _create(){const e=this.hass,t=this._preview;if(!e||!t||this._busy||null!==this._why())return;const s=this.context.stat,r=this.context.deviceName,i=Object.fromEntries(t.helpers.map(({role:e})=>[e,this._nameOf(e,t).trim()]));this._busy=!0,this._notice=null;try{const n=await e.callWS({...this._message("create_solar_setup"),method:t.method,drawn:t.drawn,...t.returned?{returned:t.returned}:{},invert:t.invert,offset:t.offset,names:i}),o={stat:s,entity_id:n.entity_id,stat_rate:n.stat_rate,old:r,name:i.energy??""};this._emit("created",o)}catch(e){const t=e??{},r=t.translation_key??"";if("conflict"===r){try{await this.context.reload()}catch{}this._notice=this.localize("solar_setup_conflict")}else"not_offered"===r&&null===this._refusedPower(t)?t.translation_placeholders?.entity_id===s?this._dropMethod():(this._dropPick(t),this._notice=this._errorText(e)):"values_changed"===r?this._notice=this._errorText(e):"not_offered"!==r&&this._emit("failed",{error:e});this._loadPreview()}finally{this._busy=!1}}_t(e,t){return Nt(e)?this.localize(e,t):e}_device(e){const t=this.hass?.entities?.[e]?.device_id,s=t?this.hass?.devices?.[t]:void 0;return s?.model||s?.name_by_user||s?.name||"Shelly"}render(){const e=this.localize,{deviceName:t,solars:s}=this.context,r=O`<h2>${e("solar_setup_title",{name:t})}</h2>
      <p class="hint">${e("solar_setup_intro")}</p>`;if(0===s.length)return O`${r}
        <p class="warning solar-no-solar">${e("solar_setup_no_solar")}</p>
        <div class="dialog-actions">
          <button @click=${()=>this._emit("close")}>${e("cancel")}</button>
        </div>`;const i=this._preview,n=this._busy?null:this._why();return O`${r}
      ${1===s.length?O`<h3>${e("solar_setup_source")}</h3>
            <p class="solar-source">${this.context.name(s[0])}</p>`:O`<fieldset class="solar-sources">
            <legend>${e("solar_setup_source")}</legend>
            ${s.map(e=>O`<label class="check">
                <input
                  type="radio"
                  name="solar-source"
                  value=${e}
                  .checked=${this._solar===e}
                  ?disabled=${this._busy}
                  @change=${()=>this._pickSolar(e)}
                />
                ${this.context.name(e)}
              </label>`)}
          </fieldset>`}
      <div class="solar-status" aria-live="polite">
        ${this._loading?O`<p class="hint solar-checking">${e("checking")}</p>`:W}
        ${null!==this._error?O`<p class="warning solar-error">${this._error}</p>`:W}
        ${null!==this._refused?this._renderRefused(this._refused):W}
        ${null!==this._notice?O`<p class="warning solar-notice">${this._notice}</p>`:W}
      </div>
      ${null!==this._error?O`<button class="solar-retry" @click=${()=>{this._loadPreview()}}>${e("solar_setup_retry")}</button>`:W}
      ${null!==this._refused?O`<button class="solar-refused-action" @click=${()=>"solar"===this._refused?.power?this._setSolarPower():this._setCircuitPower()}>
            ${"solar"===this._refused.power?e("solar_setup_set_solar_power"):e("solar_setup_set_circuit_power",{name:t})}
          </button>`:W}
      ${"not_power"===this._refused?.why?O`<button class="solar-refused-check" @click=${()=>{this._loadPreview()}}>
            ${e("solar_setup_check_again")}
          </button>`:W}
      ${null!==i?this._renderPreview(i):W}
      ${null!==this._solar&&(this.context.canPlace?.(this._solar)??!0)?O`<button
            class="link solar-place-only"
            ?disabled=${this._busy}
            @click=${()=>this._emit("place",{stat:this.context.stat,solar:this._solar})}
          >
            ${e("solar_setup_place_only")}
          </button>`:W}
      <div class="dialog-actions">
        ${null!==n?O`<span class="hint solar-why" id=${ts}>${n}</span>`:W}
        <button @click=${()=>this._emit("close")}>${e("cancel")}</button>
        <button
          class="primary solar-create"
          aria-describedby=${null!==n?ts:W}
          ?disabled=${null!==n||this._busy}
          @click=${()=>{this._create()}}
        >
          ${this._busy?e("creating"):e("solar_setup_button")}
        </button>
      </div>`}_renderRefused(e){const t="solar"===e.power?this._display(this._solar??""):this.context.deviceName;return O`<p class="warning solar-refused">
      ${this._t(`solar_setup_power_refused_${e.why}`,{entity:this.context.sensorName(e.entity),owner:t})}
    </p>`}_renderPreview(e){const t=this.localize,s=e.method,r=null!==s&&"power"!==s,i=e.blocked;return O`<fieldset class="solar-methods">
        <legend>${t("solar_setup_method")}</legend>
        ${e.methods.map(t=>this._renderMethod(e,t))}
      </fieldset>
      ${r&&(e.drawn_candidates.length>1||e.drawn_candidates.some(e=>e.disabled))?this._renderPicker(e,"drawn",e.drawn_candidates,e.drawn):W}
      ${"em"===s||"plug"===s?this._renderPicker(e,"returned",e.returned_candidates,e.returned):W}
      ${this._renderInputs(e)} ${this._renderPower(e)} ${r?this._renderSolarTerm(e):W}
      ${i?O`<p class="warning solar-blocked">
              ${this._errorText({translation_key:i,translation_placeholders:{entity_id:e.blocked_entity??this.context.stat}})}
            </p>
            ${this._renderBlockedAction(e,i)}`:this._renderHelpers(e)}`}_renderMethod(e,t){const s=this.localize,{method:r}=t,i=t.verified?"verified":t.offered?"unverified":"not-offered";return O`<div class="solar-method ${i}" data-method=${r}>
      <label class="check">
        <input
          type="radio"
          name="solar-method"
          value=${r}
          .checked=${e.method===r}
          ?disabled=${!t.offered||this._busy}
          @change=${()=>this._choose({method:r})}
        />
        <span>${this._t(`solar_method_${r}`)}</span>
        ${e.suggested===r?O`<span class="solar-suggested">${s("solar_method_suggested")}</span>`:W}
      </label>
      <p class="hint solar-method-hint">${this._t(`solar_method_${r}_hint`)}</p>
      ${t.reason?O`<p class="hint solar-method-status">
            ${this._t(`reason_${t.reason}`,{device:this._device(e.drawn)})}
          </p>`:W}
    </div>`}_renderPicker(e,t,s,r){const i=this.localize,n=e=>this.context.sensorName(e);return O`<label class="solar-picker">
        ${i("drawn"===t?"solar_setup_drawn":"solar_setup_returned")}
        <select
          class="solar-${t}"
          ?disabled=${this._busy}
          @change=${e=>this._choose({[t]:e.target.value||null})}
        >
          ${null===r?O`<option value="" .selected=${!0}>${i("solar_setup_choose")}</option>`:W}
          ${s.map(e=>O`<option value=${e.entity} .selected=${e.entity===r}>
                ${e.disabled?i("solar_setup_disabled_option",{entity:n(e.entity)}):n(e.entity)}
              </option>`)}
        </select>
      </label>
      ${s.filter(t=>t.disabled&&t.entity!==e.blocked_entity).map(e=>O`<p class="hint solar-disabled">
            ${i("solar_setup_disabled_sensor",{entity:n(e.entity)})}
            <button
              class="link"
              ?disabled=${this._busy}
              @click=${()=>this._openSettings(e.entity)}
            >
              ${i("solar_setup_open_settings")}
            </button>
          </p>`)}`}_renderInputs(e){const t=this.localize,s=[e.drawn,...e.returned?[e.returned]:[],...null===e.power.solar&&this._solar?[this._solar]:[]];return O`<h3>${t("solar_setup_inputs")}</h3>
      ${[...new Set(s)].map(t=>this._renderInput(e,t))}`}_renderInput(e,t){const s=this._display(t),r=(e,t)=>O`<div class="solar-input-head">
        <span class="solar-input-name">${s}</span>
        ${function(e){const{series:t,drops:s}=e;if(0===t.length)return W;const r=t.map(([e])=>Date.parse(e)),i=t.map(([,e])=>e),[n,o]=[Math.min(...r),Math.max(...r)],[a,l]=[Math.min(...i),Math.max(...i)],u=e=>e-6,d=e=>o===n?60:3+(Math.min(Math.max(e,n),o)-n)/(o-n)*u(120),c=e=>l===a?14:25-(Math.min(Math.max(e,a),l)-a)/(l-a)*u(28),_=e=>Math.round(10*e)/10,h=t.map(([e,t])=>`${_(d(Date.parse(e)))},${_(c(t))}`).join(" ");return O`<svg
    class="solar-sparkline"
    viewBox="0 0 120 28"
    width="120"
    height="28"
    aria-hidden="true"
  >
    <polyline points=${h} fill="none" stroke="currentColor" stroke-width="1.5"></polyline>
    ${s.map(e=>Z`<circle class="drop" cx=${_(d(Date.parse(e.at)))} cy=${_(c(e.after))} r="2.5"></circle>`)}
  </svg>`}(t)}
      </div>
      <p class="hint solar-evidence">${e}</p>`;if("daily_check_failed"===e.blocked)return O`<div class="solar-input" data-entity=${t}>
        ${r(this.localize("evidence_unchecked"),es)}
      </div>`;const i=e.evidence[t]??es,n=this.hass?.states[t]?.attributes.unit_of_measurement,o=function(e,t,s){return t.certain||t.periodic||t.drops.length?Jt(e,t,s):Pt(e,!1===t.periodic?"evidence_lifetime":"evidence_no_data")}(this.hass,i,"string"==typeof n?n:null);return O`<div class="solar-input" data-entity=${t}>
      ${r(o,i)} ${this._renderDaily(t,s,i)}
    </div>`}_renderDaily(e,t,s){const r=this.localize,i=this._choices.periodic[e],n=t=>this._choose({periodic:{...this._choices.periodic,[e]:t}}),o=r("solar_setup_daily");if(s.certain)return O`<label class="check">
          <input type="checkbox" class="solar-daily" .checked=${!0} disabled aria-label=${`${t}: ${o}`} />
          ${o}
        </label>
        <p class="hint solar-daily-locked">
          ${r("solar_setup_daily_locked",{evidence:Jt(this.hass,s,null)})}
        </p>`;if(null===s.periodic){if(e===this._solar)return W;const s=s=>{const o=r("daily"===s?"solar_setup_daily":"solar_setup_lifetime");return O`<label class="check">
          <input
            type="radio"
            class="solar-daily-choice"
            name="solar-daily-${e}"
            value=${s}
            aria-label=${`${t}: ${o}`}
            .checked=${i===("daily"===s)}
            ?disabled=${this._busy}
            @change=${()=>n("daily"===s)}
          />
          ${o}
        </label>`};return O`<div role="radiogroup" aria-label=${r("solar_setup_daily_question",{name:t})}>
        ${s("daily")} ${s("lifetime")}
      </div>`}return O`<label class="check">
        <input
          type="checkbox"
          class="solar-daily"
          aria-label=${`${t}: ${o}`}
          .checked=${i??s.periodic}
          ?disabled=${this._busy}
          @change=${e=>n(e.target.checked)}
        />
        ${o}
      </label>
      ${void 0===i?O`<p class="hint">${r("solar_setup_daily_hint")}</p>`:W}`}_renderPower(e){const t=this.localize,{power:s,live:r}=e,i=e=>t(`solar_setup_from_${e??"saved"}`),n=e=>null===e?"–":Rt(this.hass,e),o=!["solar_needs_power","solar_needs_data","daily_without_power","no_safe_method"].includes(e.blocked??""),a=e.helpers.some(({role:e})=>"power"===e);return O`<h3>${t("solar_setup_power_title")}</h3>
      <p class="hint solar-circuit-power">
        ${s.circuit?t("solar_setup_circuit_power",{entity:this.context.sensorName(s.circuit),from:i(s.circuit_from)}):t("solar_setup_circuit_none")}
      </p>
      <p class="hint solar-solar-power">
        ${s.solar?t("solar_setup_solar_power",{entity:this.context.sensorName(s.solar),from:i(s.solar_from)}):t("solar_setup_solar_none")}
        ${null===s.solar&&o?O`<button class="link solar-set-power" ?disabled=${this._busy} @click=${()=>this._setSolarPower()}>
              ${t("solar_setup_set_solar_power")}
            </button>`:W}
      </p>
      ${e.power_reason?O`<p class="hint solar-power-reason">${this._t(`reason_${e.power_reason}`)}</p>
            <p class="hint solar-power-not-kept">
              ${t("solar_setup_power_not_kept",{device:this.context.deviceName})}
            </p>`:W}
      ${a?O`<p class="solar-live">
              ${t("solar_setup_live",{circuit:n(r.circuit_w),solar:n(r.solar_w),gross:n(r.gross_w)})}
            </p>
            <p class="hint">${t("solar_setup_live_hint")}</p>
            <label class="check">
              <input
                type="checkbox"
                class="solar-invert"
                .checked=${e.invert}
                ?disabled=${this._busy}
                @change=${e=>this._choose({invert:e.target.checked})}
              />
              ${t("solar_setup_invert")}
            </label>
            <p class="hint">${t("solar_setup_invert_hint")}</p>`:W}
      ${"power"===e.method?O`<p class="hint solar-power-history">${t("solar_setup_power_history")}</p>`:W}`}_renderSolarTerm(e){const t=this.localize,{kind:s,reuse:r}=e.solar_term;return"counter"===s?O`<p class="hint solar-counter">
        ${t("solar_setup_counter_night",{solar:this._display(this._solar??"")})}
      </p>`:"integral"!==s?W:O`${r?O`<p class="hint solar-reuse">${t("solar_setup_reuse",{entity:this.context.sensorName(r)})}</p>`:W}
      <p class="hint solar-hold">${t("solar_setup_hold")}</p>`}_renderBlockedAction(e,t){const s=this.localize,r=(e,t)=>O`<button class="solar-blocked-action" @click=${t}>${e}</button>`;switch(t){case"solar_needs_power":case"solar_needs_data":return r(s("solar_setup_set_solar_power"),()=>this._setSolarPower());case"daily_without_power":case"no_safe_method":{const t=this.context.deviceName,i=this._display(this._solar??""),n=e.power.circuit,o=null!==n&&e.methods.some(e=>"power"===e.method&&"unusable_power"===e.reason);return O`${null===n?O`<p class="hint solar-missing-power">${s("solar_setup_missing_power",{name:t})}</p>`:W}
        ${o?O`<p class="hint solar-unusable-power">
              ${s("solar_setup_unusable_power",{entity:this.context.sensorName(n),name:t})}
            </p>`:W}
        ${null===e.power.solar?O`<p class="hint solar-missing-power">${s("solar_setup_missing_power",{name:i})}</p>`:W}
        ${null===n||o?r(s("solar_setup_set_circuit_power",{name:t}),()=>this._setCircuitPower()):W}
        ${o?r(s("solar_setup_open_settings"),()=>this._openSettings(n)):W}
        ${null===e.power.solar?r(s("solar_setup_set_solar_power"),()=>this._setSolarPower()):W}`}case"daily_check_failed":case"input_not_ready":case"not_offered":return r(s("solar_setup_check_again"),()=>this._choose({}));case"unsupported_input":case"solar_already_in_meter":return null!==e.blocked_entity&&e.blocked_entity===e.power.solar?r(s("solar_setup_set_solar_power"),()=>this._setSolarPower()):null!==e.blocked_entity&&e.blocked_entity===e.power.circuit?r(s("solar_setup_set_circuit_power",{name:this.context.deviceName}),()=>this._setCircuitPower()):W;case"input_disabled":case"returned_disabled":return e.blocked_entity?r(s("solar_setup_open_settings"),()=>this._openSettings(e.blocked_entity??"")):W;default:return W}}_renderHelpers(e){const t=this.localize;if(0===e.helpers.length)return W;const s=e=>this.context.sensorName(e),{power:r,method:i,offset:n}=e,o=e.solar_term.reuse?s(e.solar_term.reuse):"counter"===e.solar_term.kind?this._display(this._solar??""):this._nameOf("solar_energy",e),a=e.returned?s(e.returned):"?",l="em"===i?`${s(e.drawn)} − ${a} + ${o}`:"plug"===i?`${s(e.drawn)} − 2 × ${a} + ${o}`:`${s(e.drawn)} + ${o}`,u=r.circuit?s(r.circuit):"?",d=e.helpers.some(({role:e})=>"power"===e);return O`<h3>${t("solar_setup_preview")}</h3>
      <ul class="solar-helpers">
        ${e.helpers.map(({role:o})=>O`<li>
            <label
              >${(o=>{switch(o){case"solar_power":return t("solar_setup_role_solar_power");case"solar_energy":return t("solar_setup_role_solar_energy");case"power":return t("solar_setup_power",{formula:`${e.invert?`−1 × ${u}`:u} + ${r.solar?s(r.solar):"?"}`});default:return"power"===i?t("solar_setup_role_energy_power"):t("solar_setup_energy",{formula:n?`${l} + ${n} kWh`:l})}})(o)}
              <input
                type="text"
                class="solar-name"
                data-role=${o}
                .value=${this._nameOf(o,e)}
                ?disabled=${this._busy}
                @input=${e=>this._names={...this._names,[o]:e.target.value}}
              />
            </label>
            ${"energy"===o&&"power"!==i&&n?O`<p class="hint solar-offset">${t("solar_setup_offset",{offset:String(n)})}</p>`:W}
          </li>`)}
      </ul>
      <p class="hint">
        ${t(d?"solar_setup_text":"solar_setup_text_no_power",{name:this.context.deviceName})}
      </p>`}}customElements.get(Yt)||customElements.define(Yt,ss);const rs=220,is=72,ns=160,os="home",as={import:"var(--energy-grid-consumption-color, #488fc2)",export:"var(--energy-grid-return-color, #8353d1)",production:"var(--energy-solar-color, #ff9800)",battery:"var(--energy-battery-out-color, #4db6ac)",discharge:"var(--energy-battery-out-color, #4db6ac)",charge:"var(--energy-battery-in-color, #f06292)",gas:"var(--energy-gas-color, #8e021b)",water:"var(--energy-water-color, #00bcd4)",consumption:"var(--energy-gas-color, #8e021b)",home:"var(--secondary-text-color)"},ls=["import","production","battery","export"],us=["water"],ds=["gas"],cs=[...ls,"home"],_s=["import","production","discharge","gas","water","consumption","home"];function hs(e){return`untracked:${e}`}function ps(e,t,s,r){return e.map(e=>{if("group"===e.type){const i=lt(e.group.id),n=t.has(i)?[]:ps(e.children,t,s,r);return{id:i,kind:"group",group:e.group,display:e,children:n}}const i=e.node.stat,n=(r.get(i)??[]).map(e=>{return{id:(t=e.stat,s=i,`solar:${t}@${s}`),kind:"solar",stat:e.stat,source:e,placedAt:i,children:[]};var t,s}),o=0===e.children.length||t.has(i)?n:[...n,...ps(e.children,t,s,r),...s?[{id:hs(i),kind:"untracked",stat:i,children:[]}]:[]];return{id:i,kind:"device",stat:i,node:e.node,display:e,children:o}})}function ms(e){return e.map(e=>({type:"device",node:e,children:ms(e.children)}))}function gs(e){return"group"===e.kind&&e.children.length>0}function fs(e,t,s){if(0===e.children.length)return t;const r=e.children.reduce((e,r)=>e+fs(r,t,s),0);return Math.max(t,r+s*(e.children.length-1))+(gs(e)?24:0)}function vs(e,t,s,r,i=new Set,n=ls,o=!0,a="horizontal",l=!1,u=new Map){const d=[],c=[],_=[],h="vertical"===a,p=h?rs:is,m=h?is:rs,g=h?ns:is,f=h?is:ns,v=h?80:56,b=h?12:24,w=(e,t)=>h?{x:e,y:t}:{x:t,y:e},y=new Set(t.map(e=>"battery"===e.type?"battery":e.role)),k=t.map((e,t)=>({id:`source:${t}`,kind:"source",x:0,y:0,w:ns,h:is,stat:e.stat,role:e.role,source:e}));for(const e of n)y.has(e)||k.push({id:`placeholder:${e}`,kind:"placeholder",x:0,y:0,w:ns,h:is,role:e});const $=k.length*f+(k.length-1)*b,x=ps(e.length>0&&"type"in e[0]?e:ms(e),i,o,u);o&&l&&x.push({id:hs(os),kind:"untracked",stat:os,children:[]});const S=x.length?x.reduce((e,t)=>e+fs(t,m,b),0)+b*(x.length-1):m,z=Math.max($,S,m),E=24+z/2;let A=E-$/2;for(const e of k)Object.assign(e,w(24,A)),A+=f+b,d.push(e);const C=24+g+v;d.push({id:os,kind:"home",...w(C,E-m/2),w:rs,h:is});for(const e of k){if("source"!==e.kind)continue;const t=_s.includes(e.role);c.push({from:t?e.id:os,to:t?os:e.id,kind:"source",power:null})}let M=C+p;const T=(e,t,i,n)=>{const o=fs(e,m,b),a=C+(i+1)*(p+v),l=a+p;M=Math.max(M,l);const u=e.stat??"";let g;g="untracked"===e.kind?r.get(u)??null:"group"===e.kind?At(e.display,s):"solar"===e.kind?null:s.get(u)??null,d.push({id:e.id,kind:e.kind,...w(a,t+(o-m)/2),w:rs,h:is,stat:e.stat,node:e.node,group:e.group,..."solar"===e.kind?{role:"production",source:e.source,placedAt:e.placedAt}:{}}),c.push("solar"===e.kind?{from:e.id,to:n,kind:"solar",power:g}:{from:n,to:e.id,kind:e.kind,power:g});const f=gs(e)?{id:e.id,...w(a-12,t),...h?{w:0,h:o}:{w:o,h:0},group:e.group}:null;f&&_.push(f);let y=t+(o-(e.children.reduce((e,t)=>e+fs(t,m,b),0)+b*(e.children.length-1)))/2,k=l;for(const t of e.children)k=Math.max(k,T(t,y,i+1,e.id)),y+=fs(t,m,b)+b;if(f){k+=12,M=Math.max(M,k);const e=k-(a-12);h?f.w=e:f.h=e}return k};let D=E-S/2;for(const e of x)T(e,D,0,os),D+=fs(e,m,b)+b;const L=z+48,H=M+24;return{blocks:d,edges:c,frames:_,width:h?H:L,height:h?L:H}}function bs(e,t){return null===e||t<=0?2:2+6*Math.min(1,Math.max(0,e)/t)}function ws(e,t,s=0,r="horizontal"){if("vertical"===r){const r=e.x<=t.x,i=r?e.x+e.w:e.x,n=e.y+e.h/2,o=r?t.x-s:t.x+t.w+s,a=t.y+t.h/2,l=(i+o)/2;return`M ${i} ${n} C ${l} ${n}, ${l} ${a}, ${o} ${a}`}const i=e.y<=t.y,n=e.x+e.w/2,o=i?e.y+e.h:e.y,a=t.x+t.w/2,l=i?t.y-s:t.y+t.h+s,u=(o+l)/2;return`M ${n} ${o} C ${n} ${u}, ${a} ${u}, ${a} ${l}`}function ys(e){const t=Math.max(5,.9*e+2.5);return{half:t,length:1.3*t}}function ks(e,t,s=6,r=1.4*s,i="horizontal"){if("vertical"===i){const i=e.x<=t.x,n=i?t.x:t.x+t.w,o=t.y+t.h/2,a=i?n-r:n+r;return`${a},${o-s} ${a},${o+s} ${n},${o}`}const n=e.y<=t.y,o=t.x+t.w/2,a=n?t.y:t.y+t.h,l=n?a-r:a+r;return`${o-s},${l} ${o+s},${l} ${o},${a}`}const $s="energy-flow-mapper-panel",xs="energy_flow_mapper",Ss=4e3,zs="__home__",Es=.1,As=2.5,Cs=.9,Ms=.8,Ts=48,Ds="energy_flow_mapper.orientation",Ls="energy_flow_mapper.coverage",Hs="energy_flow_mapper.helper_marks",qs="energy_flow_mapper.free_collapsed",Ps="energy_flow_mapper.draft",Ns="https://github.com/Skylolerr/ha-energy-flow-mapper",Is={gross_off:"hour",gross_unknown:"hour",solar_term_short:"day",solar_term_high:"day"},js={gross_off:"if-a-gross-meter-falls-or-jumps",gross_off_input:"if-an-input-was-reset-or-replaced",gross_unknown:"gaps-in-a-gross-meter",solar_term:"solar-term-differs"},Rs=["electricity","water","gas"],Fs=["single","inverted","two"],Gs={single:"power_variant_single",inverted:"power_variant_inverted",two:"power_variant_two"},Os={grid:{single:"power_variant_single_grid",inverted:"power_variant_inverted_grid",two:"power_variant_two_grid"},battery:{single:"power_variant_single_battery",inverted:"power_variant_inverted_battery",two:"power_variant_two_battery"}},Zs=new Set(["import","export","production","discharge","charge","gas","water","home"]),Bs=new Set(["import","export","discharge","charge"]);function Ws(e,t){const s=e[t];return"string"==typeof s?s:""}const Us=new Set(["unknown_group","group_parents_differ","group_loop","group_exists"]),Vs=["total","total_increasing"];const Ks="src:",Qs="var(--accent-color, #ff9800)",Js=["mWh","Wh","kWh","MWh","GWh","TWh","J","kJ","MJ","GJ","cal","kcal","Mcal","Gcal"];function Ys(e){switch(e){case"import":case"export":case"production":case"battery":case"water":case"gas":case"home":return e;case"discharge":case"charge":return"battery";default:return null}}function Xs(e){const t=new Date(e),s=e=>String(e).padStart(2,"0");return[t.getFullYear(),s(t.getMonth()+1),s(t.getDate()),s(t.getHours()),s(t.getMinutes()),s(t.getSeconds())].join("-")}function er(e,t){tr(e,new Blob([JSON.stringify(t,null,2)],{type:"application/json"}))}function tr(e,t){const s=URL.createObjectURL(t),r=document.createElement("a");r.href=s,r.download=e,r.click(),setTimeout(()=>URL.revokeObjectURL(s),0)}function sr(e,t,s=[]){try{t.length?localStorage.setItem(Ps,JSON.stringify({hash:e,changes:t,steps:s})):localStorage.removeItem(Ps)}catch{}}function rr(e){history.pushState(null,"",e),window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:!1}}))}class ir extends le{static properties={hass:{attribute:!1},narrow:{type:Boolean,reflect:!0},_snapshot:{state:!0},_loadError:{state:!0},_changes:{state:!0},_validation:{state:!0},_selected:{state:!0},_collapsed:{state:!0},_dragged:{state:!0},_dropTarget:{state:!0},_search:{state:!0},_dialog:{state:!0},_busy:{state:!0},_toast:{state:!0},_renameValue:{state:!0},_view:{state:!0},_zoom:{state:!0},_period:{state:!0},_orientation:{state:!0},_coverage:{state:!0},_typeMarks:{state:!0},_freeCollapsed:{state:!0},_ignored:{state:!0},_dismissed:{state:!0},_places:{state:!0},_energy:{state:!0},_tab:{state:!0},_find:{state:!0},_findIndex:{state:!0},_multi:{state:!0},_selectMode:{state:!0},_toolsOpen:{state:!0},_helpOpen:{state:!0},_sumCheck:{state:!0}};_haTexts=!1;_exporting=!1;_suggestionMemo=null;_draftMemo=new Map;_steps=new WeakMap;_seenGroups=new Set;_groupNames=new Map;_toPng=ot;_loading=!1;_draftChecked=!1;_validateRequest=0;_energyRequest=0;_sumSession=0;_setupResume=null;_sumCheckSession=0;_toastTimer;_fitted=!1;_autoFit=!0;_resizeObserver;_observed=null;_footerObserver;_observedFooter=null;_pointers=new Map;_pointerType="mouse";constructor(){super(),this.narrow=!1,this._snapshot=null,this._loadError=null,this._changes=[],this._validation=null,this._selected=null,this._collapsed=new Set,this._dragged=null,this._dropTarget=null,this._search="",this._dialog=null,this._busy=!1,this._toast=null,this._renameValue="",this._view="diagram",this._zoom={x:0,y:0,k:1},this._period="now",this._orientation=function(){try{return"vertical"===localStorage.getItem(Ds)?"vertical":"horizontal"}catch{return"horizontal"}}(),this._coverage=function(){try{return"off"!==localStorage.getItem(Ls)}catch{return!0}}(),this._typeMarks=function(){try{return"on"===localStorage.getItem(Hs)}catch{return!1}}(),this._freeCollapsed=function(){try{return"on"===localStorage.getItem(qs)}catch{return!1}}(),this._ignored=[],this._dismissed=[],this._places={},this._energy=null,this._tab="electricity",this._find="",this._findIndex=0,this._multi=new Set,this._selectMode=!1,this._toolsOpen=!1,this._helpOpen=!1,this._sumCheck={evidence:{},failed:[],pending:[]}}_onKeyDown=e=>{const t=e.composedPath()[0];!e.ctrlKey&&!e.metaKey||e.shiftKey||"z"!==e.key.toLowerCase()||this._dialog||!(this._changes.length>0)||t&&["INPUT","TEXTAREA"].includes(t.tagName)||(e.preventDefault(),this._undoChange())};connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("dialog-closed",this._onHaDialogClosed)}_t(e,t={}){return Pt(this.hass,e,t)}_localize=(e,t={})=>this._t(e,t);willUpdate(e){if(!e.has("hass")||!this.hass||this._snapshot||this._loading||this._loadError||this._load(),e.has("_changes"))for(const e of this._changes)"create_group"===e.type&&this._seenGroups.add(e.id);if("sum"===this._dialog?.kind){const{all:e}=this._sumMembers(this._dialog),{evidence:t,failed:s,pending:r}=this._sumCheck,i=e.filter(e=>!(e in t)&&!s.includes(e)&&!r.includes(e));i.length>0&&null===this._sumSolar(e,this._dialog.grossOk)&&this._checkSum(i)}if((e.has("_changes")||e.has("_snapshot"))&&this._multi.size){const e=this.draft,t=this._groups,s=[...this._multi].filter(s=>s.startsWith(at)?t.some(e=>lt(e.id)===s):e.some(e=>e.stat_consumption===s));s.length!==this._multi.size&&(this._multi=new Set(s))}}async _load(){if(this.hass){this._loading=!0;try{this._snapshot=await this.hass.callWS({type:`${xs}/get`}),this._loadError=null,this._ignored=this._snapshot.ignored_suggestions??[],this._dismissed=this._snapshot.dismissed_hints??[],this._places=this._snapshot.solar_places??{},this._collapseGroups(this._snapshot),this._restoreDraft(this._snapshot.hash),this._keepDraft(),this._loadHaTexts()}catch(e){this._loadError=Wt(this.hass,e)}finally{this._loading=!1}await Promise.all([this._validate(),this._loadEnergy()])}}_collapseGroups(e){for(const t of Object.values(e.groups??{}).flatMap(e=>e??[]))this._groupNames.set(t.id,t.name);const t=Object.values(e.groups??{}).flatMap(e=>(e??[]).map(e=>e.id)).filter(e=>!this._seenGroups.has(e));for(const e of t)this._seenGroups.add(e);t.length&&(this._collapsed=new Set([...this._collapsed,...t.map(lt)]))}_restoreDraft(e){if(this._draftChecked)return;this._draftChecked=!0;const t=function(){try{const e=JSON.parse(localStorage.getItem(Ps)??"null");return e&&"string"==typeof e.hash&&Array.isArray(e.changes)?e:null}catch{return null}}();t&&!this._changes.length&&(t.hash===e?(this._restoreSteps(t),this._changes=t.changes,this._showToast(this._t("draft_restored"))):(sr(e,[]),this._showToast(this._t("draft_outdated"))))}_restoreSteps(e){const t=e.steps;if(!Array.isArray(t)||t.length!==e.changes.length)return;let s=0;for(let r=1;r<=t.length;r++)r!==t.length&&t[r]===t[s]||(this._bundle(e.changes.slice(s,r)),s=r)}_keepDraft(){if(!this._draftChecked||!this._snapshot)return;const e=[];let t;for(const[s,r]of this._changes.entries()){const i=this._steps.get(r);e.push(s>0&&void 0!==i&&i===t?e[s-1]:s),t=i}sr(this._snapshot.hash,this._changes,e)}_loadHaTexts(){!this._haTexts&&this.hass?.loadBackendTranslation&&(this._haTexts=!0,this.hass.loadBackendTranslation("issues","energy").then(()=>this.requestUpdate()).catch(()=>{this._haTexts=!1}))}setPeriod(e){this._period=e,this._energy=null,this._loadEnergy()}async _loadEnergy(){const e=++this._energyRequest;if(this.hass&&this._snapshot&&"now"!==this._period)try{const t=await this.hass.callWS({type:`${xs}/energy`,period:this._period,...this._changes.length?{base_hash:this._snapshot.hash,changes:this._changes}:{}});e===this._energyRequest&&(this._energy=t)}catch(t){e===this._energyRequest&&await this._handleError(t)}else this._energy=null}setTab(e){e!==this._tab&&(this._tab=e,this._selected=null,this._multi=new Set,this._selectMode=!1,this._find="",this._findIndex=0,this._autoFit=!0,this._fitted=!1)}_values(e){if("now"===this._period)return this._rateMap(e);const t=this._energy?.energy??{};return new Map(e.map(e=>[e.stat_consumption,t[e.stat_consumption]??null]))}_waterUnit(){return this._energy?.water_unit??("gal"===this.hass?.config?.unit_system?.volume?"gal":"L")}_formatValue(e){return"water"===Ve(this._tab)?"now"===this._period?Ot(this.hass,e,this._waterUnit()):Gt(this.hass,e,this._waterUnit()):"now"===this._period?Rt(this.hass,e):Ft(this.hass,e)}_draftState(e){const t=[this._snapshot,this._changes],s=this._draftMemo.get(e);if(s&&s.key.every((e,s)=>e===t[s]))return s.value;const r=this._snapshot?.prefs,i=function(e,t,s,r,i=[]){let n=structuredClone(e),o=structuredClone(t),a=structuredClone(i);for(const e of s){if(fe(e)){a=Qe(a,[e]);continue}if(ve(e)!==r)continue;if("use_as_home_meter"===e.type&&a.some(e=>"home"===e.type))continue;let t=new Set;if(dt.has(e.type)){const t=structuredClone(o);try{n=$t(n,t,r,e)}catch(e){if(e instanceof ct)continue;throw e}o=t}else"remove"===e.type||"use_as_home_meter"===e.type?t=xt(n,o,e.stat):"move"===e.type&&n.some(t=>t.stat_consumption===e.stat)&&St(o,e.stat,e.parent),({devices:n,sources:a}=be(n,a,[e],r));o=ft(o,n,t)}return{devices:n,groups:o}}(("water"===e?r?.device_consumption_water:r?.device_consumption)??[],this._snapshot?.groups?.[e]??[],this._changes,e,r?.energy_sources??[]);return this._draftMemo.set(e,{key:t,value:i}),i}draftOf(e){return this._draftState(e).devices}groupsOf(e){return this._draftState(e).groups}get _groups(){return"gas"===this._tab?[]:this.groupsOf(this._tab)}get draft(){return"gas"===this._tab?[]:this.draftOf(this._tab)}_deviceKind(){return Ve(this._tab)}_kind(){return"water"===Ve(this._tab)?{kind:"water"}:{}}_candidates(e=this._tab){const t=this._snapshot;return{electricity:t?.candidates,water:t?.water_candidates,gas:t?.gas_candidates}[e]??[]}_allCandidates(){return[...this._candidates("electricity"),...this._candidates("water"),...this._candidates("gas")]}get draftSources(){const e=this._snapshot?.prefs;return Qe(e?.energy_sources??[],this._changes,e?.device_consumption??[])}_canUseHomeMeter(e){const t=void 0===e||!this.draft.find(t=>t.stat_consumption===e)?.included_in_stat;return t&&!0===this._snapshot?.home_supported&&"electricity"===this._tab&&!this.draftSources.some(e=>"home"===e.type)}_home(){if("electricity"!==this._tab)return null;if("now"!==this._period)return this._energy?.home??null;const e=this.hass?function(e,t){const s=t.find(e=>"home"===e.type)?.stat_rate;return"string"==typeof s?Te(e,s):null}(this.hass,this.draftSources):null;if(null===e)return null;const t=this.draft,s=this._values(t);return{value:e,basis:"measured",stale:null,untracked:(r=we(t),i=s,n=e,null===n?null:n-r.reduce((e,t)=>e+(i.get(t.stat)??0),0))};var r,i,n}_missingFor(e,t,s=this._values(t)){const r=we(t);return e===os?null!=this._home()?.value?r.filter(e=>null===(s.get(e.stat)??null)).map(e=>e.stat):[]:function(e,t){const s=new Map;for(const r of ye(e)){if(null===(t.get(r.stat)??null))continue;const e=r.children.filter(e=>null===(t.get(e.stat)??null)).map(e=>e.stat);e.length&&s.set(r.stat,e)}return s}(r,s).get(e)??[]}_untrackedText(e,t,s,r){const i=null==t?this._t("none"):this._formatValue(t),n=null==t?null:this._missingText(this._missingFor(e,s,r),s);return{value:i,text:n?`${i} · ${n.text}`:i,title:n?.title??null,hint:n?.text??null}}_missingText(e,t){if(!e.length)return null;const s=e.map(e=>this._name(e,t));return{text:1===s.length?this._t("untracked_without_one",{name:s[0]}):this._t("untracked_without_many",{count:String(s.length)}),title:this._t("untracked_missing_title",{names:s.join(", ")})}}_info(e){return this._snapshot?.stats[e]??this._allCandidates().find(t=>t.stat===e)??this._snapshot?.power_candidates?.find(t=>t.stat===e)??this._snapshot?.flow_candidates?.find(t=>t.stat===e)}_name(e,t=("water"===Ve(this._tab)?[...this.draftOf("water"),...this.draftOf("electricity")]:[...this.draftOf("electricity"),...this.draftOf("water")])){const s=this._allCandidates(),r={...this._snapshot?.stats,...Object.fromEntries(s.map(e=>[e.stat,e]))};return function(e,t,s,r=new Set){const i=t.find(t=>t.stat_consumption===e),n=s[e];return i?.name||(r.has(e)?n?.energy_entity_name:null)||n?.energy_name||n?.name||e}(e,t,r,this._ambiguous(r))}_ambiguous(e){const t=ze(this.draftOf("electricity"),e),s=ze(this.draftOf("water"),e);return new Set([...t,...s])}_issues(){const e=this._validation?.issues??this._snapshot?.issues??[];return"now"===this._period?e:[...e,...this._energy?.issues??[]]}_suggestions(){const e=[this._snapshot,this._changes,this._ignored,this._tab],t=this._suggestionMemo;if(t&&t.key.every((t,s)=>t===e[s]))return t.value;const s=xe(this.draft,this._snapshot?.child_pairs??[],this._ignored,this._deviceKind());return this._suggestionMemo={key:e,value:s},s}_suggestionFor(e){return this._suggestions().find(t=>t.stat===e)}_applySuggestion(e){this._change(this._suggestionChange(e))}_suggestionChange(e){return{type:"move",stat:e.stat,parent:e.parent,...this._kind()}}_applyAllSuggestions(){const e=[];for(const t of this._suggestions())if(xe(this.draft,[t],this._ignored,this._deviceKind()).length){const s=this._suggestionChange(t);e.push(s),this._changes=[...this._changes,s]}e.length&&(this._bundle(e),this._validate(),this._loadEnergy())}_suggestGroups(){const e=function(e,t,s,r,i="electricity"){const n=new Set(t.flatMap(e=>e.members)),o=new Set(e.map(e=>e.stat_consumption)),a=[];for(const t of e){const e=t.included_in_stat??null;a.includes(e)||null!==e&&!o.has(e)||a.push(e)}const l=t.map(e=>({parent:e.parent,name:e.name})),u=[];for(const t of a){const o=new Map;for(const r of e){const e=r.stat_consumption,i=s[e]?.area_name;(r.included_in_stat??null)===t&&!n.has(e)&&i&&o.set(i,[...o.get(i)??[],e])}for(const[e,s]of o){const n=r(e).trim();s.length<2||!n||l.some(e=>e.parent===t&&e.name===n)||(l.push({parent:t,name:n}),u.push({type:"create_group",id:ut(),name:n,parent:t,members:s,groups:[],kind:i}))}}return u}(this.draft,this._groups,this._snapshot?.stats??{},e=>e,this._deviceKind());0!==e.length?this._changeAll(e):this._showToast(this._t("suggest_groups_none"))}async _ignoreSuggestion(e){if(this.hass)try{const t=await this.hass.callWS({type:`${xs}/ignore_suggestion`,kind:e.kind,stat:e.stat,parent:e.parent});this._ignored=t.ignored}catch(e){this._showToast(Wt(this.hass,e))}}async _clearIgnored(){if(!this.hass)return;const e=this._tab;try{const t=await this.hass.callWS({type:`${xs}/clear_suggestions`,kind:e});this._ignored=t.ignored,this._dismissed=this._dismissed.filter(t=>t.kind!==e)}catch(e){this._showToast(Wt(this.hass,e))}}_haIssuesFor(e){return(this._snapshot?.ha_issues??[]).filter(t=>t.stat===e&&t.kind===this._tab)}_powerOnlyGridStats(){return this.draftSources.filter(e=>"grid"===e.type&&!e.stat_energy_from&&!e.stat_energy_to).flatMap(e=>je(e))}_badgeTitle(e,t){return[...t.map(e=>this._issueText(e)),...this._haIssuesFor(e).map(t=>Ut(this.hass,t,e))].join("\n")}_issuesFor(e){return this._issues().filter(t=>t.stat===e&&(t.kind??"electricity")===this._tab)}_hintRole(e){const t=e.data?.role;return"string"==typeof t?t:null}_canDismiss(e){return"solar_elsewhere"!==e.code&&(void 0===Is[e.code]||Object.keys(this._hintEvent(e)).length>0)}_hintEvent(e){const t=Is[e.code],s=void 0===t?void 0:e.data?.[t];return void 0!==t&&"string"==typeof s?{[t]:s}:{}}_isDismissed(e){const t=this._hintRole(e),s=Is[e.code],r=void 0===s?void 0:this._hintEvent(e)[s];return this._dismissed.some(i=>i.code===e.code&&i.kind===e.kind&&i.stat===e.stat&&(i.role??null)===t&&(void 0===s||void 0!==r&&i[s]===r))}_hintApplies(e){if("returned_energy"===e.code){const e=new Set(this.draftOf("electricity").flatMap(e=>this._snapshot?.solar_counted?.[e.stat_consumption]??[]));return this._hasSolar()&&this._freeSolarStats(!0).some(t=>!e.has(t))}if(this._signFixedByPower(e))return Boolean(this.draft.find(t=>t.stat_consumption===e.stat)?.stat_rate);if("power_available"!==e.code)return!0;const t=this._hintRole(e);if(null===t){const t=this.draft.find(t=>t.stat_consumption===e.stat);return void 0!==t&&!t.stat_rate}const s=Re(this.draftSources).find(s=>s.stat===e.stat&&s.role===t);return void 0!==s&&!s.stat_rate&&!s.power_config}_hintsFor(e,t){const s=void 0===t?this._solarElsewhereHints(e):[];return[...this._snapshot?.hints??[],...s].filter(s=>{const r=this._hintRole(s);return s.stat===e&&s.kind===this._tab&&(void 0===t?null===r:null===r||r===t)&&!this._isDismissed(s)&&this._hintApplies(s)})}_hasDismissedHints(){return(this._snapshot?.hints??[]).some(e=>e.kind===this._tab&&this._isDismissed(e))}_hintText(e){const t=e.data??{},s="string"==typeof t.entity_id?this._sensorName(t.entity_id):"";switch(e.code){case"returned_energy":return this._t(!0===t.disabled?"hint_returned_energy_disabled":"hint_returned_energy",{entity:s});case"daily_in_sum":{const e=Array.isArray(t.daily)?t.daily.filter(e=>"string"==typeof e):[];return this._t("hint_daily_in_sum",{names:e.map(e=>this._sensorName(e)).join(", ")})}case"power_available":return this._t("electricity"===e.kind?"hint_power_available":"hint_flow_available",{entity:s});case"gross_off":return this._grossOffText(e);case"gross_unknown":{const s="string"==typeof t.input?t.input:null;return[this._t("power"===t.method?"hint_gross_unknown_power":"hint_gross_unknown",{meter:this._name(e.stat),length:this._minutesText(Number(t.minutes)),...this._hourText(t.hour)}),null===s?this._t("hint_gross_unknown_inputs"):this._t("hint_gross_unknown_input",{input:this._sensorName(s)})].join(" ")}case"solar_elsewhere":return this._t("hint_solar_elsewhere",{solar:this._solarName(String(t.solar)),device:this._name(String(t.placed_at))});case"solar_term_short":case"solar_term_high":return this._t("solar_term_short"===e.code?"hint_solar_term_short":"hint_solar_term_high",{date:Qt(this.hass,String(t.day??"")),term:s,term_energy:Ft(this.hass,Number(t.term_kwh)),source_energy:Ft(this.hass,Number(t.source_kwh))});default:return e.code}}_hourText(e){return"string"==typeof e?Kt(this.hass,e):{date:"",time:""}}_minutesText(e){return e<120?this._t("hint_minutes",{count:jt(this.hass,e)}):this._t("hint_hours",{count:jt(this.hass,e/60,1)})}_grossOffText(e){const t=e.data??{},s=Number(t.change_kwh),r="number"==typeof t.power_kwh?t.power_kwh:null,i={meter:this._name(e.stat),change:Ft(this.hass,s),drop:Ft(this.hass,-s),power:null===r?"":Ft(this.hass,r),...this._hourText(t.hour)},n=s<0?null===r?"hint_gross_off_down":"hint_gross_off_down_power":null===r?"hint_gross_off_counted":"jump"===t.direction?"hint_gross_off_more":"hint_gross_off_less";return`${this._t(n,i)} ${this._t(this._grossOffCause(e),{input:"string"==typeof t.input?this._sensorName(t.input):""})}`}_grossOffCause(e){const t=e.data??{};return"input"===t.cause?"net"!==t.method||this._isSolarMeter(String(t.input))?"hint_gross_off_input":"hint_gross_off_input_net":"solar_term"===t.cause?"hint_gross_off_solar_term":"power"!==t.method&&Number(t.change_kwh)<0?"hint_gross_off_below_zero":"sign"===t.cause?"power"===t.method?"hint_gross_off_sign_power":"hint_gross_off_sign":"hint_gross_off_unclear"}_signFixedByPower(e){const t=e.data??{};return"gross_off"===e.code&&"sign"===t.cause&&"power"!==t.method&&Number(t.change_kwh)>=0}_hintPower(e){if("string"==typeof e.data?.power)return e.data.power;const t=this.draftSources.find(t=>"solar"===t.type&&t.stat_energy_from===e.stat)?.stat_rate;return"string"==typeof t?t:null}_hintReadme(e){switch(e.code){case"gross_off":return`${Ns}#${"input"===e.data?.cause?js.gross_off_input:js.gross_off}`;case"gross_unknown":return`${Ns}#${js.gross_unknown}`;case"solar_term_short":case"solar_term_high":return`${Ns}#${js.solar_term}`;default:return null}}async _dismissHint(e){if(!this.hass||!this._canDismiss(e))return;const t=this._hintRole(e);try{const s=await this.hass.callWS({type:`${xs}/dismiss_hint`,code:e.code,kind:e.kind,stat:e.stat,...null!==t?{role:t}:{},...this._hintEvent(e)});this._dismissed=s.dismissed}catch(e){this._showToast(Wt(this.hass,e))}}_openEntitySettings(e){this._close(),this._setupResume=null,this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:e,view:"settings"},bubbles:!0,composed:!0}))}_openMoreInfo(e){this._close(),this._setupResume=null,this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:e},bubbles:!0,composed:!0}))}_change(e){this._changeAll([e])}_changeAll(e){this._bundle(e),this._changes=[...this._changes,...e],this._validate(),this._loadEnergy()}_bundle(e){if(e.length>1){const t={};for(const s of e)this._steps.set(s,t)}}async _validate(){const e=++this._validateRequest;if(!this.hass||!this._snapshot||0===this._changes.length)return this._validation=null,null;try{const t=await this.hass.callWS({type:`${xs}/validate`,base_hash:this._snapshot.hash,changes:this._changes});return e===this._validateRequest&&(this._validation=t),t}catch(t){return e===this._validateRequest&&(this._validation=null),await this._handleError(t),null}}_groupName(e){for(const t of[...this._changes].reverse())if(("create_group"===t.type||"rename_group"===t.type)&&t.id===e){const e=(t.name??"").trim();if(e)return e}return this._groupNames.get(e)??null}_errorText(e){const t=e??{},s=t.translation_placeholders?.stat,r=Us.has(t.translation_key??"")&&"string"==typeof s?this._groupName(s):null;return Wt(this.hass,null===r?e:{translation_key:t.translation_key,translation_placeholders:{...t.translation_placeholders,stat:r}})}async _handleError(e){this._showToast(this._errorText(e)),"conflict"===e?.translation_key&&(this._snapshot=null,await this._load())}_undoChange(){const e=this._changes;if(0===e.length)return;const t=this._steps.get(e[e.length-1]);let s=1;for(;void 0!==t&&s<e.length&&this._steps.get(e[e.length-1-s])===t;)s++;this._changes=e.slice(0,e.length-s),this._showToast(this._t("change_undone")),this._validate(),this._loadEnergy()}_changeCount(){return this._validation?.diff.length??this._changes.length}_askDiscard(){this._changeCount()>1?this._dialog={kind:"discard"}:this._discard()}_discard(){this._changes=[],this._validation=null,this._loadEnergy()}async _openConfirm(){const e={kind:"confirm",result:null};this._dialog=e;const t=await this._validate();this._dialog===e&&(this._dialog=t?{kind:"confirm",result:t}:null)}async _save(){if(this.hass&&this._snapshot){this._busy=!0;try{const e=await this.hass.callWS({type:`${xs}/save`,base_hash:this._snapshot.hash,changes:this._changes});this._dialog=null,this._discard(),this._showToast(this._t(e.backup_id?"saved":"nothing_to_save")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}async _openBackups(e){if(this.hass)try{const{backups:t}=await this.hass.callWS({type:`${xs}/backups`});e&&t.length>0?this._dialog={kind:"restore",backup:t[0],undo:!0}:this._dialog={kind:"backups",entries:t}}catch(e){await this._handleError(e)}}async _restore(e){if(this.hass&&this._snapshot){this._busy=!0;try{await this.hass.callWS({type:`${xs}/restore`,backup_id:e.id,base_hash:this._snapshot.hash}),this._dialog=null,this._discard(),this._showToast(this._t("restored")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}async _export(e){if(this.hass)try{const t=await this.hass.callWS({type:`${xs}/export`,...e?{backup_id:e.id}:{}});er(`energy-flow-mapper-${e?"backup":"settings"}-${Xs(e?.created??t.exported)}.json`,t)}catch(e){await this._handleError(e)}}_pickImportFile(){const e=document.createElement("input");e.type="file",e.accept=".json,application/json",e.addEventListener("change",()=>{const t=e.files?.[0];t&&this._readImport(t)}),e.click()}async _readImport(e){if(!this.hass||!this._snapshot)return;let t;try{t=JSON.parse(await e.text())}catch{return void this._showToast(this._t("import_invalid_file"))}const s={kind:"import",file:e.name,document:t,result:null};this._dialog=s;try{const e=await this.hass.callWS({type:`${xs}/import_check`,base_hash:this._snapshot.hash,document:t});this._dialog===s&&(this._dialog={...s,result:e})}catch(e){if(this._dialog!==s)return;this._dialog=null,await this._handleError(e)}}async _import(e){if(this.hass&&this._snapshot){this._busy=!0;try{const t=await this.hass.callWS({type:`${xs}/import`,base_hash:this._snapshot.hash,document:e});this._dialog=null,this._discard(),this._showToast(this._t(t.backup_id?"imported":"nothing_to_save")),await this._load()}catch(e){this._dialog=null,await this._handleError(e)}finally{this._busy=!1}}}_showToast(e){this._toast=e,clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},4e3)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("dialog-closed",this._onHaDialogClosed),clearTimeout(this._toastTimer),this._resizeObserver?.disconnect(),this._observed=null,this._footerObserver?.disconnect(),this._observedFooter=null}_onViewportResize(){this._autoFit&&this.fit()}_observeViewport(){const e=this._viewport();e!==this._observed&&"undefined"!=typeof ResizeObserver&&(this._resizeObserver??=new ResizeObserver(()=>this._onViewportResize()),this._resizeObserver.disconnect(),e&&this._resizeObserver.observe(e),this._observed=e)}_measureFooter(){const e=this.renderRoot.querySelector(".footer");this.style.setProperty("--efm-footer-height",`${e?.offsetHeight??0}px`)}_observeFooter(){const e=this.renderRoot.querySelector(".footer");"undefined"!=typeof ResizeObserver?e!==this._observedFooter&&(this._measureFooter(),this._footerObserver??=new ResizeObserver(()=>this._measureFooter()),this._footerObserver.disconnect(),e&&this._footerObserver.observe(e),this._observedFooter=e):this._measureFooter()}_canDrop(e){const t=this._dragged;return null!==t&&("solar"===t.kind?!e.startsWith(Ks)&&null!==this._solarDrop(t.stat,e):e.startsWith(Ks)?"device"===t.kind?e.startsWith(`${Ks}home:`)&&this._canUseHomeMeter(t.stat):"candidate"===t.kind:"candidate"===t.kind?"gas"!==this._tab&&!e.startsWith(at):null!==this._dropPlan(t,e))}_dropPlan(e,t){const s=this.draft,r=this._groups,i=this._kind(),n=t.startsWith(at)?r.find(e=>lt(e.id)===t):void 0;if(t.startsWith(at)&&void 0===n)return null;const o=t===zs?null:t;if("device"===e.kind){const t=e.stat,a=s.find(e=>e.stat_consumption===t);if(void 0===a)return null;const l=a.included_in_stat??null,u=r.find(e=>e.members.includes(t));if(void 0!==n){if(u?.id===n.id)return null;const e={type:"set_group",stat:t,group:n.id,...i};return n.parent===l?[e]:$e(s,t,n.parent)?[{type:"move",stat:t,parent:n.parent,...i},e]:null}return o===l?u?[{type:"set_group",stat:t,group:null,...i}]:null:$e(s,t,o)?[{type:"move",stat:t,parent:o,...i}]:null}const a=r.find(t=>lt(t.id)===e.stat);if(void 0===a)return null;const l=new Set(r.filter(e=>function(e,t,s){const r=new Set;let i=t;for(;void 0!==i&&!r.has(i.id);){if(i.id===s)return!0;r.add(i.id);const t=i.group;i=e.find(e=>e.id===t)}return!1}(r,e,a.id)).map(e=>e.id)),u=ht(r,a.id),d=e=>u.every(t=>$e(s,t,e))&&!r.some(t=>!l.has(t.id)&&t.parent===e&&r.some(e=>l.has(e.id)&&e.name===t.name));return void 0!==n?l.has(n.id)||a.group===n.id?null:n.parent===a.parent?[{type:"set_group",group_id:a.id,group:n.id,...i}]:d(n.parent)?[{type:"move_group",id:a.id,parent:n.parent,group:n.id,...i}]:null:o===a.parent?null!==a.group?[{type:"set_group",group_id:a.id,group:null,...i}]:null:d(o)?[{type:"move_group",id:a.id,parent:o,...i}]:null}_drop(e){const t=this._dragged,s=this._canDrop(e);if(this._dragged=null,this._dropTarget=null,null!==t&&s)if("solar"!==t.kind){if(e.startsWith(Ks)){const s=e.slice(4),r=s.indexOf(":"),i=s.slice(r+1);if("device"===t.kind)return void this._change({type:"use_as_home_meter",stat:t.stat});const n=this.diagramLayout().blocks.find(e=>e.id===i&&"source"===e.kind);return void this._assign(s.slice(0,r),t.stat,n?.stat??null)}"candidate"===t.kind?this._addCandidate(t.stat,e===zs?null:e):this._changeAll(this._dropPlan(t,e)??[])}else this._putSolar(t.stat,e)}_dragHandlers(e){return{over:t=>{this._canDrop(e)&&(t.preventDefault(),this._dropTarget=e)},leave:()=>{this._dropTarget===e&&(this._dropTarget=null)},drop:t=>{t.preventDefault(),this._drop(e)}}}_startDrag(e,t){e.dataTransfer?.setData("text/plain",t.stat),e.dataTransfer&&(e.dataTransfer.effectAllowed="move"),"candidate"===t.kind||t.free||"diagram"!==this._view||this._setDragImage(e),this._dragged=t}_setDragImage(e){const t=e.currentTarget,s=e.dataTransfer;if(!t||!s?.setDragImage)return;const r="touch"===this._pointerType||"pen"===this._pointerType,i=r?Math.max(this._zoom.k,.8):this._zoom.k,n=t.offsetWidth*i,o=t.offsetHeight*i,a=document.createElement("div");a.className="drag-ghost",a.style.cssText=`position:fixed;left:0;top:-${Math.ceil(o)+100}px;width:${n}px;height:${o}px;overflow:hidden;pointer-events:none`;const l=t.cloneNode(!0);l.style.left="0",l.style.top="0",l.style.transform=`scale(${i})`,l.style.transformOrigin="0 0",a.append(l),this.renderRoot.append(a);const u=t.getBoundingClientRect();r?s.setDragImage(a,n/2,o+48):s.setDragImage(a,Math.min(n,Math.max(0,e.clientX-u.left)),Math.min(o,Math.max(0,e.clientY-u.top))),setTimeout(()=>a.remove(),0)}_addCandidate(e,t){const s=this._candidates().find(t=>t.stat===e);this._change({type:"add",stat:e,parent:t,stat_rate:s?.power??null,...this._kind()}),this._selected=e}_assign(e,t,s=null){if("battery"===e)return void(this._dialog={kind:"battery",discharge:t});this._dialog=null;const r="import"===e||"export"===e||"water"===e||"gas"===e;this._change({type:"assign_source",role:e,stat:t,...r&&s?{replace:s}:{}})}_usedInDraft(){const e=new Set;for(const t of[...this.draftOf("electricity"),...this.draftOf("water")])e.add(t.stat_consumption),t.stat_rate&&e.add(t.stat_rate);for(const t of Re(this.draftSources))e.add(t.stat);for(const t of this.draftSources)for(const s of je(t))e.add(s);return e}_freePowerSensors(){const e=this._usedInDraft();return("gas"===this._tab?[]:("water"===Ve(this._tab)?this._snapshot?.flow_candidates:this._snapshot?.power_candidates)??[]).filter(t=>!e.has(t.stat))}_meterName(e){return`${this._info(e)?.name||e} ${this._t("water"===Ve(this._tab)?"water_suffix":"energy_suffix")}`}async _createMeter(e){if(!this.hass)return;const t=this._meterName(e),s=this._tab,r=()=>{"integral"===this._dialog?.kind&&this._dialog.stat===e&&(this._dialog=null)};this._busy=!0;try{const i=await this.hass.callWS({type:`${xs}/create_integral`,power_entity_id:e,name:t});r(),await this._load(),this._change({type:"add",stat:i.entity_id,parent:null,stat_rate:i.stat_rate,..."water"===i.kind?{kind:"water"}:{}}),this._tab===s&&(this._selected=i.entity_id),this._showToast(this._t("meter_created",{name:t}))}catch(e){r(),await this._handleError(e)}finally{this._busy=!1}}_openPowerDialog(e,t){let s="single",r="",i="";if("device"===e.kind)r=this.draft.find(t=>t.stat_consumption===e.stat)?.stat_rate??"";else{const t=Re(this.draftSources).find(t=>t.stat===e.stat&&t.role===e.role),n=t?.power_config??{};Ws(n,"stat_rate_inverted")?(s="inverted",r=Ws(n,"stat_rate_inverted")):Ws(n,"stat_rate_from")||Ws(n,"stat_rate_to")?(s="two",r=Ws(n,"stat_rate_from"),i=Ws(n,"stat_rate_to")):r=Ws(n,"stat_rate")||(t?.stat_rate??"")}const n={kind:"power",target:e,variant:s,first:r,second:i,initial:""};this._dialog={...n,initial:JSON.stringify(this._powerChange(n)),...t?{first:t}:{}}}_powerChange(e){const{target:t,variant:s}=e,r=e.first||null;if("device"===t.kind)return{type:"set_rate",stat:t.stat,stat_rate:r,...this._kind()};const i=t.role;if("consumption"===i)return null;if(!Bs.has(i))return{type:"set_source_rate",stat:t.stat,role:i,stat_rate:r};const n="two"===s&&e.second||null;if("two"===s&&null===r!=(null===n))return null;const o=null===r?null:"two"===s?{stat_rate_from:r,stat_rate_to:n}:"inverted"===s?{stat_rate_inverted:r}:{stat_rate:r};return{type:"set_source_rate",stat:t.stat,role:i,power_config:o}}_powerOptions(e){const t="electricity"!==this._tab,s=t?"volume_flow_rate":"power",r=new Set(Object.entries(this.hass?.states??{}).filter(([e,t])=>e.startsWith("sensor.")&&t?.attributes?.device_class===s).map(([e])=>e));for(const e of(t?this._snapshot?.flow_candidates:this._snapshot?.power_candidates)??[])r.add(e.stat);const i=this._info(e)?.device_id??null,n=this.hass?.entities??{};return[...r].map(e=>({entity_id:e,sameDevice:null!==i&&n[e]?.device_id===i,name:this._sensorName(e)})).sort((e,t)=>Number(t.sameDevice)-Number(e.sameDevice)||e.name.localeCompare(t.name)).map(({entity_id:e,sameDevice:t})=>({entity_id:e,sameDevice:t}))}_sensorName(e){const t=[...this._snapshot?.power_candidates??[],...this._snapshot?.flow_candidates??[]].find(t=>t.stat===e);return String(this.hass?.states[e]?.attributes.friendly_name??"")||t?.name||this._info(e)?.name||e}_openSum(e){this._sumSession++,this._resetSumCheck(),this._setSum("group"in e?{kind:"sum",group:e.group,origin:null,added:[],picking:!1}:{kind:"sum",group:null,origin:e.origin,added:[e.origin],picking:!1})}_setSum(e){const t={...e};if(delete t.error,this._dialog=t,t.named)return;const{all:s}=this._sumMembers(t),r=!1===t.replace?null:this._sumReplaceable(s),i=null===r?void 0:this.draft.find(e=>e.stat_consumption===r)?.name,n=null!==t.group?this._groups.find(e=>e.id===t.group)?.name??"":this._name(t.origin??"",this.draft);this._renameValue=i||`${n} ${this._t("water"===Ve(this._tab)?"water_suffix":"energy_suffix")}`}_sumMembers(e){const t=null!==e.group?ht(this._groups,e.group):[];return{fixed:t,all:[...t,...e.added.filter(e=>!t.includes(e))]}}_sumParent(e){return null!==e.group?this._groups.find(t=>t.id===e.group)?.parent??null:this.draft.find(t=>t.stat_consumption===e.origin)?.included_in_stat??null}_sumReason(e){const t=this._info(e),s=t?t.entity_id:e.includes(":")?null:e;if(null===s)return this._t("sum_reason_external");if(!s.startsWith("sensor."))return this._t("sum_reason_not_sensor");const r=this.hass?.states[s];if(void 0===r)return this._t("sum_reason_unavailable");const i="water"===Ve(this._tab)?"water":"energy";return(r.attributes.device_class??t?.device_class)!==i?this._t("sum_reason_device_class",{device_class:i}):Vs.includes(String(r.attributes.state_class))?null:this._t("sum_reason_state_class")}_entityNamed(e){const t=e.trim().toLowerCase();return""!==t&&Object.values(this.hass?.states??{}).some(e=>String(e.attributes.friendly_name??"").trim().toLowerCase()===t)}_sumStateClasses(e){return new Set(e.map(e=>String(this.hass?.states[e]?.attributes.state_class)))}_sumRates(e){const t=this.draft,s=Re(this.draftSources,this._tab),r=[],i=[];let n=!1;for(const o of e){if(s.some(e=>e.stat===o)){n=!0;continue}const e=t.find(e=>e.stat_consumption===o)?.stat_rate;"string"==typeof e&&""!==e?r.push(e):i.push(o)}return{rates:n||i.length?[]:r,missing:i,blockedBySource:n}}_sumReplaceable(e){const t=new Set(Re(this.draftSources,this._tab).map(e=>e.stat)),s=e.filter(e=>this.draft.some(t=>t.stat_consumption===e));return 1===s.length&&e.some(e=>t.has(e))?s[0]:null}_isSolarMeter(e){return this.draftSources.some(t=>"solar"===t.type&&t.stat_energy_from===e)}_sumSaveFirst(e){const t=e=>e.filter(e=>"solar"===e.type).flatMap(e=>[e.stat_energy_from,e.stat_rate]).filter(e=>"string"==typeof e&&""!==e),s=t(this._snapshot?.prefs.energy_sources??[]),r=(this._snapshot?.prefs.energy_sources??[]).filter(e=>"solar"===e.type&&"string"==typeof e.stat_energy_from).map(e=>e.stat_energy_from),i=t(this.draftSources).filter(e=>!s.includes(e)),n=this._snapshot?.inputs??{};return e.filter(e=>r.includes(e)&&!this._isSolarMeter(e)||!this._isSolarMeter(e)&&(n[e]??[]).some(e=>i.includes(e)))}_isSolarMember(e){return this._isSolarMeter(e)||"solar"===this._snapshot?.solar_holds?.[e]&&!this._sumSaveFirst([e]).length}_sumHolders(e){const t=this._sumSaveFirst(e);return e.filter(e=>"holder"===this._snapshot?.solar_holds?.[e]&&!t.includes(e))}_sumSolar(e,t=[]){const s=e.filter(e=>this._isSolarMember(e)),r=this._sumHolders(e),i=r.filter(e=>!t.includes(e));if(0===s.length&&0===i.length)return null;const n=this._sumSaveFirst(e),o=e.filter(e=>!s.includes(e)&&!r.includes(e)&&!n.includes(e)&&this.draft.some(t=>t.stat_consumption===e)),a=this.draftSources.filter(e=>"solar"===e.type&&"string"==typeof e.stat_energy_from).map(e=>e.stat_energy_from),l=s.find(e=>a.includes(e))??(1===a.length?a[0]:void 0);return{solars:s,holders:i,devices:o,...l?{solar:l}:{}}}_resetSumCheck(){this._sumCheckSession++,this._sumCheck={evidence:{},failed:[],pending:[]}}async _checkSum(e){if(!this.hass)return;const t=this._sumCheckSession;this._sumCheck={...this._sumCheck,pending:[...this._sumCheck.pending,...e]};const s={};if("electricity"===this._tab)for(const t of e){const e=this.draft.find(e=>e.stat_consumption===t)?.stat_rate;"string"==typeof e&&""!==e&&(s[t]=e)}let r=null;try{r=await this.hass.callWS({type:`${xs}/daily_check`,stats:e,...Object.keys(s).length?{power:s}:{}})}catch{r=null}if(t!==this._sumCheckSession)return;const i=this._sumCheck,n=i.pending.filter(t=>!e.includes(t));if(null==r||r.unknown)return void(this._sumCheck={...i,pending:n,failed:[...i.failed,...e]});const o={periodic:null,certain:!1,reason:null,drops:[],went_negative:!1,series:[]},a=Object.fromEntries(e.map(e=>[e,r.evidence?.[e]??o]));this._sumCheck={...i,pending:n,evidence:{...i.evidence,...a}}}_sumPeriodic(e){const t=this._sumCheck,s=[];for(const r of e){const e=t.evidence[r],i=void 0!==e&&null!==e.periodic;!0===e?.periodic?s.push({stat:r,evidence:Jt(this.hass,e,this._info(r)?.unit??null)}):i||void 0===e&&!t.failed.includes(r)||!this._info(r)?.daily_reset||s.push({stat:r,evidence:this._t("evidence_statistics")})}return s}_sumUnchecked(e){return e.filter(e=>null===this._sumCheck.evidence[e]?.periodic&&!0!==this._info(e)?.daily_reset)}_sumRateName(e){const t="water"===Ve(this._tab),s=` ${this._t(t?"water_suffix":"energy_suffix")}`;return`${e.endsWith(s)?e.slice(0,-s.length):e} ${this._t(t?"flow_suffix":"power_suffix")}`}_sumOptions(e){const t=this.draft,{all:s}=this._sumMembers(e),r=this._sumParent(e),i=s.filter(e=>t.some(t=>t.stat_consumption===e)),n=t.map(e=>e.stat_consumption).filter(e=>{const n=ke(t,e);return!s.includes(e)&&(null===r||!n.has(r))&&i.every(s=>!n.has(s)&&!ke(t,s).has(e))});for(const e of Re(this.draftSources,this._tab))"home"===e.role||s.includes(e.stat)||n.includes(e.stat)||n.push(e.stat);return n}async _createSum(e){if(!this.hass)return;const t=this._renameValue.trim(),s=this.draft,r=this._groups,{all:i}=this._sumMembers(e),n=this._sumParent(e),o=null!==e.group?r.find(t=>t.id===e.group)?.group??null:null,a=null!==e.group?r.filter(t=>t.group===e.group).map(e=>e.id):[],l=new Set(a.flatMap(e=>ht(r,e))),u=i.filter(e=>s.some(t=>t.stat_consumption===e)&&!l.has(e)),{rates:d}=this._sumRates(i),c=this._sumHolders(i).filter(t=>e.grossOk?.includes(t)),_=!1===e.replace?null:this._sumReplaceable(i),h=null!==e.group?o:r.find(e=>e.members.includes(_??""))?.id??null,p=this._tab,m=this._deviceKind(),g=this._kind(),f=this._sumSession;this._busy=!0;try{const e=await this.hass.callWS({type:`${xs}/create_sum_meter`,kind:m,name:t,entity_ids:i,...d.length?{rate_entity_ids:d,rate_name:this._sumRateName(t)}:{},...c.length?{gross_ok:c}:{}});"sum"===this._dialog?.kind&&this._sumSession===f&&(this._dialog=null),await this._load();const s=e.entity_id,r=a.map(e=>({type:"move_group",id:e,parent:s,...g})),l=(null!==_?this._replaceSteps(_,s,e.stat_rate,h,r,m):[]).map(e=>"add"===e.type&&void 0!==e.name?{...e,name:t}:e);this._changeAll(l.length?l:[{type:"add",stat:s,parent:n,...e.stat_rate?{stat_rate:e.stat_rate}:{},...g},...null!==o?[{type:"set_group",stat:s,group:o,...g}]:[],...r,...u.map(e=>({type:"move",stat:e,parent:s,...g}))]),this._tab===p&&(this._selected=s),this._showToast(this._t("sum_created",{name:t}))}catch(e){const t=this._dialog;"sum"===t?.kind&&this._sumSession===f?this._dialog={...t,error:this._errorText(e)}:await this._handleError(e)}finally{this._busy=!1}}_replace(e,t,s=null){const r=this._groups.find(t=>t.members.includes(e))?.id??null,i=this._replaceSteps(e,t,s,r);0!==i.length&&(this._changeAll(i),this._selected=t)}_replaceSteps(e,t,s,r,i=[],n=this._deviceKind()){const o="water"===n?{kind:"water"}:{},a=function(e,t,s,r,i){const n=e.find(e=>e.stat_consumption===s);if(void 0===n||s===r)return[];const o="water"===i.kind?{kind:"water"}:{},a=e.filter(e=>e.included_in_stat===s&&e.stat_consumption!==s).map(e=>e.stat_consumption);return[{type:"add",stat:r,parent:n.included_in_stat??null,...n.name?{name:n.name}:{},...i.newRate?{stat_rate:i.newRate}:{},...o},...null!==t?[{type:"set_group",stat:r,group:t,...o}]:[],...a.map(e=>({type:"move",stat:e,parent:r,...o})),{type:"remove",stat:s,...o}]}(this.draftOf(n),r,e,t,{kind:n,newRate:s});if(0===a.length)return[];const l=this.groupsOf(n).filter(t=>t.parent===e&&null===t.group).map(e=>({type:"move_group",id:e.id,parent:t,...o})),u=a.findIndex(e=>"move"===e.type||"remove"===e.type);return a.splice(u,0,...i,...l),a}_hasSolar(){return this.draftSources.some(e=>"solar"===e.type&&!!e.stat_energy_from)}_setupSolars(){return this.draftSources.filter(e=>"solar"===e.type&&"string"==typeof e.stat_energy_from&&""!==e.stat_energy_from).map(e=>e.stat_energy_from)}_offersSolarSetup(e){return"electricity"===this._tab&&this._hasSolar()&&this.draft.some(t=>t.stat_consumption===e)}_openSolarSetup(e,t){this._sumSession++;const s=this._setupResume;this._setupResume=null,null===s||s.stat!==e?this._dialog=t?{kind:"solar",stat:e,solar:t}:{kind:"solar",stat:e}:this._dialog={...s}}async _onSolarCreated(e,t){const{stat:s,entity_id:r,stat_rate:i,name:n,old:o}=t,a="electricity";this._busy=!0;try{const t=this._dialog;(t===e||"solar"===t?.kind&&t.stat===s)&&(this._dialog=null),await this._load();const l=this.groupsOf(a).find(e=>e.members.includes(s))?.id??null,u=this._replaceSteps(s,r,i,l,[],a);u.length&&(this._dialogOf(s)&&this._close(),this._changeAll(u),this._tab===a&&(this._selected=r)),this._showToast(this._t(u.length?"solar_setup_done":"solar_setup_created_only",{name:n,old:o}))}catch(e){await this._handleError(e)}finally{this._busy=!1}}_dialogOf(e){const t=this._dialog;return null!==t&&("power"===t.kind?"device"===t.target.kind&&t.target.stat===e:"sum"===t.kind?this._sumMembers(t).all.includes(e):"stat"in t&&t.stat===e)}async _onSolarFailed(e){this._busy=!0;try{await this._handleError(e)}finally{this._busy=!1}}_freeCandidates(e=this._search){const t=this._usedInDraft();return e=e.trim().toLowerCase(),this._candidates().filter(s=>!t.has(s.stat)&&(!e||[s.name,s.stat,s.area_name,s.device_name].some(t=>t?.toLowerCase().includes(e))))}updated(e){if(e.has("_changes")&&this._keepDraft(),!this._fitted&&this._autoFit&&this._snapshot&&"diagram"===this._view&&(this._fitted=this.fit()),this._observeViewport(),this._observeFooter(),"power"===this._dialog?.kind)for(const e of this.renderRoot.querySelectorAll("select.power-picker"))e.value=e.dataset.value??"";if(!e.has("_dialog"))return;const t=this.renderRoot.querySelector("dialog");t&&(this._dialog&&!t.open?t.showModal?.():!this._dialog&&t.open&&t.close?.())}_reload(){this._snapshot=null,this._loadError=null,this._load()}render(){return O`
      <div class="header">
        ${this.narrow?O`<button
              class="icon"
              aria-label=${this._t("menu")}
              @click=${()=>this.dispatchEvent(new Event("hass-toggle-menu",{bubbles:!0,composed:!0}))}
            >
              ${Dt("menu")}
            </button>`:W}
        <h1>${this._t("title")}</h1>
        ${this.narrow?O`<button
              class="icon"
              aria-label=${this._t("more")}
              @click=${()=>this._dialog={kind:"menu"}}
            >
              ${Dt("dots")}
            </button>`:O`<div class="header-actions">
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
                ${Dt("undo")} ${this._t("undo")}
              </button>
              <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
                ${Dt("history")} ${this._t("backups")}
              </button>
              <button
                class="icon"
                aria-label=${this._t("reload")}
                title=${this._t("reload")}
                @click=${()=>this._reload()}
              >
                ${Dt("refresh")}
              </button>
            </div>`}
      </div>
      ${this._renderBody()} ${this._renderFooter()} ${this._renderDialog()}
      ${this._toast&&!this._dialog?this._renderToast():W}
    `}_renderToast(){const e=!this._dialog&&(this._changes.length>0||this._multi.size>0);return O`<div class="toast ${e?"over-footer":""}" role="status">${this._toast}</div>`}_renderBody(){return this._loadError?O`<div class="message error">${this._t("load_failed")}<br />${this._loadError}</div>`:this._snapshot?O`
      <div class="tabs" role="tablist" aria-label=${this._t("tabs_label")}>
        ${Rs.map(e=>O`<button
            role="tab"
            class=${this._tab===e?"active":""}
            aria-selected=${String(this._tab===e)}
            data-tab=${e}
            @click=${()=>this.setTab(e)}
          >
            ${Dt("water"===e?"water":"gas"===e?"fire":"flash")} ${this._t(`tab_${e}`)}
          </button>`)}
      </div>
      <div
        class="content ${this.narrow?"narrow":""} ${!this.narrow&&this._freeCollapsed?"free-collapsed":""} ${this._changes.length||this._multi.size||this._selectMode?"above-footer":""}"
      >
        ${this.narrow?W:O`<aside class="column free">
              ${this._freeCollapsed?this._renderFreeStrip():this._renderCandidates(!0)}
            </aside>`}
        <main class="column main">
          ${"list"===this._view?O`${this._renderSources()} ${this._renderTree()}`:this._renderDiagram()}
        </main>
        ${this.narrow?W:O`<aside class="column details">${this._renderDetails()}</aside>`}
      </div>
    `:O`<div class="message">${this._t("loading")}</div>`}_rateMap(e){return new Map(e.map(e=>[e.stat_consumption,this.hass?De(this.hass,e.stat_rate,this._deviceKind()):null]))}diagramLayout(){const e=this.draft,t=we(e),s=this._values(e),r=qe(t,s),i=this._home();null!=i?.value&&r.set(os,i.untracked);const n=Re(this.draftSources,this._tab);return vs(Et(t,this._groups),n,s,r,this._collapsed,"water"===Ve(this._tab)?us:"gas"===this._tab?ds:this._snapshot?.home_supported?cs:ls,!0,this._orientation,null!=i?.value,this._solarRows(n))}_solarRows(e){const t=new Map;if("electricity"!==this._tab)return t;for(const[s,r]of Ye(this.draftSources,this.draft,this._places))t.set(s,r.flatMap(t=>e.filter(e=>e.stat===t&&"production"===e.role)));return t}_freeSolarStats(e=!1){return e||"electricity"===this._tab?function(e,t,s){const r=new Set([...Ye(e,t,s).values()].flat());return Je(e).filter(e=>!r.has(e))}(this.draftSources,this.draftOf("electricity"),this._places):[]}_solarDrop(e,t){return"electricity"!==this._tab?null:function(e,t,s,r,i,n){return t!==e&&"solar"!==n[t]&&r[e]!==t&&s.some(e=>e.stat_consumption===t)?(i[t]??[]).includes(e)?"place":"setup":null}(e,t,this.draft,this._places,this._snapshot?.solar_counted??{},this._snapshot?.solar_holds??{})}_solarName(e){return Re(this.draftSources).find(t=>t.stat===e&&"production"===t.role)?.name||this._name(e)}_solarElsewhereHints(e){if("electricity"!==this._tab)return[];const t=function(e,t,s,r){const i=new Map;for(const[r,n]of Ye(e,t,s))for(const e of n)i.set(e,r);const n=new Map(t.map(e=>[e.stat_consumption,e.included_in_stat??null])),o=e=>{const t=new Set;for(let s=n.get(e)??null;null!==s&&!t.has(s);s=n.get(s)??null)t.add(s);return t},a=(e,t)=>e===t||o(e).has(t)||o(t).has(e),l=new Map;for(const e of t){const t=e.stat_consumption,s=(r[t]??[]).filter(e=>i.has(e)&&!a(i.get(e),t)).map(e=>({solar:e,placedAt:i.get(e)}));s.length&&l.set(t,s)}return l}(this.draftSources,this.draft,this._places,this._snapshot?.solar_counted??{}).get(e);return(t??[]).map(({solar:t,placedAt:s})=>({code:"solar_elsewhere",stat:e,kind:"electricity",data:{solar:t,placed_at:s}}))}_putSolar(e,t){"place"===this._solarDrop(e,t)?this._placeSolar(e,t):this._openSolarSetup(t,e)}async _placeSolar(e,t){if(this.hass)try{const s=await this.hass.callWS({type:`${xs}/place_solar`,solar:e,stat:t});this._places=s.places,this._showToast(null===t?this._t("solar_block_removed",{solar:this._solarName(e)}):this._t("solar_block_placed",{solar:this._solarName(e),device:this._name(t)}))}catch(e){this._showToast(Wt(this.hass,e))}}_cssColor(e,t="#888888"){const s=/^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/.exec(e.trim());if(!s)return e;return getComputedStyle(this).getPropertyValue(s[1]).trim()||s[2]?.trim()||t}_exportBlock(e,t,s,r){const i=t?.querySelector(".node-name")?.textContent?.trim()??"",n=[...t?.querySelectorAll(".sub")??[]].map(e=>e.textContent?.trim()??"").filter(Boolean),o=Boolean(t?.querySelector(".badge")),a=Boolean(t?.querySelector(".hint-mark"));if("device"===e.kind){const t=e.stat,r=s.find(e=>e.stat_consumption===t),i=r?this._values([r]).get(t)??null:null;return{block:e,title:this._name(t,s),sub:null===i?null:this._formatValue(i),area:this._info(t)?.area_name??null,color:this._cssColor("var(--primary-color, #03a9f4)"),warn:o,info:a,hidden:this._collapsed.has(t)?e.node?.children.length??0:0,mark:this._typeMarks&&this._info(t)?.stat_type?(l=this._info(t).stat_type,Tt[l]):null}}var l;if("group"===e.kind){const t=r.get(e.id)??null,s=null===t?null:this._formatValue(t),i=this._collapsed.has(e.id)?[this._devicesText(e.group.id),s]:[s];return{block:e,title:e.group.name,sub:i.filter(Boolean).join(" · ")||null,area:null,color:this._cssColor(Qs),warn:!1}}if("solar"===e.kind)return{block:e,title:this._roleLabel("production"),sub:this._sourceValueText(e),area:this._solarName(e.stat),color:this._cssColor(as.production),warn:!1};const u="source"===e.kind||"placeholder"===e.kind?as[e.role??""]??"var(--divider-color, #e0e0e0)":"var(--secondary-text-color, #727272)";if("untracked"===e.kind){const t=this._untrackedText(e.stat,r.get(e.id),s);return{block:e,title:i,sub:t.value,area:t.hint,color:this._cssColor(u),warn:o}}if("source"===e.kind&&e.stat)return{block:e,title:i,sub:this._sourceValueText(e),area:e.source?.name||this._name(e.stat),color:this._cssColor(u),warn:o,info:a};const d="home"===e.kind&&null!=this._home()?.stale;return{block:e,title:i,sub:n.join("\n")||null,area:null,color:this._cssColor(u),warn:o,named:d}}async _saveImage(e){if(!this._exporting){this._exporting=!0;try{await this._writeImage(e)}finally{this._exporting=!1}}}async _writeImage(e){const t=this.diagramLayout(),s=new Map(t.blocks.map(e=>[e.id,e])),r=this.draft,i=[...this.shadowRoot?.querySelectorAll(".canvas > .block")??[]],n=new Map(t.edges.map(e=>[e.to,e.power]));let o=t.blocks.map((e,t)=>this._exportBlock(e,i[t],r,n));e&&(o=function(e,t,s=t){const r=nt(e,"device"),i=nt(e,"group");return e.map(e=>{const n=r.get(e);if(void 0!==n)return{...e,title:t(n),area:null};const o=i.get(e);return void 0!==o?{...e,title:s(o),area:null}:e.named?{...e,sub:null,area:null}:{...e,area:null}})}(o,e=>this._t("export_device",{n:String(e)}),e=>this._t("export_group",{n:String(e)})));const a=Math.max(0,...t.edges.map(e=>e.power??0)),l=t.edges.flatMap(e=>{const t=s.get(e.from),r=s.get(e.to);if(!t||!r)return[];const i=bs(e.power,a),n=ys(i);return[{d:ws(t,r,n.length-1,this._orientation),color:this._cssColor(this._edgeColor(e,s),"#727272"),width:i,dashed:this._dashed(e,t),head:ks(t,r,n.half,n.length,this._orientation)}]}),u=(new Date).toISOString(),d=[this._t("export_footer",{tab:this._t(`tab_${this._tab}`),period:this._t(`period_${this._period}`),time:Bt(this.hass,u)}),...this._changes.length?[this._t("export_draft")]:[]].join(" · "),c=it(t,o,l,{theme:{background:this._cssColor("var(--primary-background-color, #fafafa)"),text:this._cssColor("var(--primary-text-color, #212121)"),secondary:this._cssColor("var(--secondary-text-color, #727272)"),card:this._cssColor("var(--card-background-color, #ffffff)"),divider:this._cssColor("var(--divider-color, #e0e0e0)"),group:this._cssColor(Qs)},footer:d}),_=rt(t,d);try{const e=await this._toPng(c,_.width,_.height);tr(`energy-flow-mapper-${this._tab}-${Xs(u).slice(0,10)}.png`,e),this._close()}catch{this._close(),this._showToast(this._t("export_failed"))}}setCoverage(e){this._coverage=e;try{localStorage.setItem(Ls,e?"on":"off")}catch{}}setFreeCollapsed(e){this._freeCollapsed=e;try{localStorage.setItem(qs,e?"on":"off")}catch{}}setTypeMarks(e){this._typeMarks=e;try{localStorage.setItem(Hs,e?"on":"off")}catch{}}_typeText(e){const t=this._info(e),s=t?.stat_type;if(!s)return null;const r="external"===s?this._t("type_external"):"helper"===s?this._t("type_helper"):this._t("type_helper_kind",{kind:this._t(`type_${s}`)});return t?.created_helper?`${r} · ${this._t("created_by")}`:r}setOrientation(e){this._orientation=e;try{localStorage.setItem(Ds,e)}catch{}this._autoFit=!0,this.fit()}_viewport(){return this.renderRoot.querySelector(".viewport")}findMatches(e=this._find){const t=e.trim().toLowerCase();if(!t)return[];const s=this.draft;return s.map(e=>e.stat_consumption).filter(e=>[this._name(e,s),e.slice(e.indexOf(".")+1),this._info(e)?.area_name].some(e=>e?.toLowerCase().includes(t)))}setFind(e){this._find=e,this._findIndex=0,this._showMatch()}nextMatch(){const e=this.findMatches().length;e>0&&(this._findIndex=(this._findIndex+1)%e,this._showMatch())}_showMatch(){const e=this.findMatches()[this._findIndex];void 0!==e&&this._reveal(e)}_reveal(e){const t=this.draft,s=this._groups,r=new Set(this._collapsed),i=e=>{let t=s.find(t=>t.members.includes(e));const i=new Set;for(;void 0!==t&&!i.has(t.id);){i.add(t.id),r.delete(lt(t.id));const e=t.group;t=s.find(t=>t.id===e)}};i(e);let n=t.find(t=>t.stat_consumption===e)?.included_in_stat;const o=new Set;for(;n&&!o.has(n);)o.add(n),r.delete(n),i(n),n=t.find(e=>e.stat_consumption===n)?.included_in_stat;this._collapsed=r,this._selected=e;const a=this.diagramLayout().blocks,l=a.find(t=>"device"===t.kind&&t.stat===e)??a.find(t=>"source"===t.kind&&t.stat===e),u=this._viewport();if(!l||!u?.clientWidth)return;this._autoFit=!1;const d=Math.min(2.5,Math.max(this._zoom.k,.9));this._zoom={k:d,x:u.clientWidth/2-(l.x+l.w/2)*d,y:u.clientHeight/2-(l.y+l.h/2)*d}}_findClass(e){if(!this._find.trim())return"";const t=this.findMatches();return t.includes(e)?t[this._findIndex]===e?"match current":"match":"dim"}fit(){const e=this._viewport(),t=e?.clientWidth??0,s=e?.clientHeight??0;if(!t||!s)return!1;const{width:r,height:i}=this.diagramLayout(),n=Math.min(1.4,Math.max(.1,Math.min(t/r,s/i)));return this._zoom={k:n,x:(t-r*n)/2,y:Math.max(0,(s-i*n)/2)},!0}zoomAt(e,t,s){const{x:r,y:i,k:n}=this._zoom,o=Math.min(2.5,Math.max(.1,n*s)),a=o/n;this._zoom={k:o,x:e-(e-r)*a,y:t-(t-i)*a}}_zoomCenter(e){this._autoFit=!1;const t=this._viewport();this.zoomAt((t?.clientWidth??0)/2,(t?.clientHeight??0)/2,e)}_local(e){const t=this._viewport()?.getBoundingClientRect();return{x:e.clientX-(t?.left??0),y:e.clientY-(t?.top??0)}}_onWheel(e){e.preventDefault(),this._autoFit=!1;const{x:t,y:s}=this._local(e);this.zoomAt(t,s,Math.exp(.0015*-e.deltaY))}_onPointerDown(e){this._pointerType=e.pointerType||"mouse",e.target.closest?.(".block, button, a")||(e.currentTarget?.setPointerCapture?.(e.pointerId),this._pointers.set(e.pointerId,this._local(e)))}_onPointerMove(e){const t=this._pointers.get(e.pointerId);if(!t)return;this._autoFit=!1;const s=[...this._pointers.values()],r=this._local(e);if(this._pointers.set(e.pointerId,r),1===this._pointers.size)return void(this._zoom={...this._zoom,x:this._zoom.x+r.x-t.x,y:this._zoom.y+r.y-t.y});const i=[...this._pointers.values()],n=e=>Math.hypot(e[0].x-e[1].x,e[0].y-e[1].y),o=e=>({x:(e[0].x+e[1].x)/2,y:(e[0].y+e[1].y)/2}),[a,l]=[o(s),o(i)];this._zoom={...this._zoom,x:this._zoom.x+l.x-a.x,y:this._zoom.y+l.y-a.y},n(s)>0&&this.zoomAt(l.x,l.y,n(i)/n(s))}_onPointerUp(e){this._pointers.delete(e.pointerId)}_renderDiagram(){const e=this.draft,t=this.diagramLayout(),s=new Map(t.blocks.map(e=>[e.id,e])),r=Math.max(0,...t.edges.map(e=>e.power??0)),i=new Map(t.edges.map(e=>[e.to,e.power])),n=this._values(e),o=qe(we(e),n),a=this._home();null!=a?.value&&o.set(os,a.untracked);const l=we(e).map(e=>n.get(e.stat)).filter(e=>null!=e),u=l.reduce((e,t)=>e+t,0),d=l.length&&u>=0?u:null,{x:c,y:_,k:h}=this._zoom;return O`
      <section class="card diagram-card">
        <div class="card-header">
          <h2>${this._t("electricity"===this._tab?"diagram":`diagram_${this._tab}`)}</h2>
          <div class="periods" role="group" aria-label=${this._t("period_label")}>
            ${["now","today","week","month"].map(e=>O`<button
                class=${this._period===e?"active":""}
                aria-pressed=${String(this._period===e)}
                data-period=${e}
                @click=${()=>this.setPeriod(e)}
              >
                ${this._t(`period_${e}`)}
              </button>`)}
          </div>
          ${this._renderToolbar()}
        </div>
        ${this._renderHint()} ${this._renderFind()}
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
            style="width:${t.width}px;height:${t.height}px;transform:translate(${c}px, ${_}px) scale(${h})"
          >
            <svg class="edges" width=${t.width} height=${t.height} aria-hidden="true">
              ${t.edges.map(e=>this._renderEdge(e,s,r))}
            </svg>
            ${t.frames.map(e=>this._renderFrame(e))}
            ${t.blocks.map(t=>this._renderBlock(t,e,d,o,i))}
          </div>
        </div>
      </section>
    `}_renderToolbar(){return this.narrow&&!this._toolsOpen?W:O`<div class="toolbar">
            ${this._suggestions().length>=2?O`<button class="apply-all" @click=${()=>this._applyAllSuggestions()}>
                  ${Dt("lightbulb")} ${this._t("suggestion_apply_all")}
                </button>`:W}
            ${"gas"!==this._tab?O`<button
                  class="select-mode ${this._selectMode?"active":""}"
                  aria-pressed=${String(this._selectMode)}
                  title=${this._t("select_mode_hint")}
                  @click=${()=>this.setSelectMode(!this._selectMode)}
                >
                  ${this._t("select_mode")}
                </button>
                <button class="suggest-groups" @click=${()=>this._suggestGroups()}>${this._t("suggest_groups")}</button>`:W}
            ${"electricity"!==this._tab||null===this._coverageRatio()&&!this._energyLoading()?W:O`<button
                  class="coverage-toggle ${this._coverage?"active":""}"
                  aria-pressed=${String(this._coverage)}
                  @click=${()=>this.setCoverage(!this._coverage)}
                >
                  ${this._t("coverage_toggle")}
                </button>`}
            ${"gas"!==this._tab?O`<button
                  class="types-toggle ${this._typeMarks?"active":""}"
                  aria-pressed=${String(this._typeMarks)}
                  @click=${()=>this.setTypeMarks(!this._typeMarks)}
                >
                  ${this._t("types_toggle")}
                </button>`:W}
            <div class="orientation" role="group" aria-label=${this._t("orientation_label")}>
              ${["horizontal","vertical"].map(e=>O`<button
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
          </div>`}_renderHint(){const e=this._ignored.some(e=>e.kind===this._tab)||this._hasDismissedHints(),t=!this.narrow||this._helpOpen,s=this._energyLoading();return e||t||s?O`<p class="hint">
      ${e?O`<button class="link" @click=${()=>{this._clearIgnored()}}>
            ${this._t("suggestion_show_ignored")}
          </button>`:W}
      ${t?O`${this._t("devices_hint")} ${this._t("sources_hint")} ${this._t("zoom_hint")}`:W}
      ${s?O`<span class="loading">${this._t("energy_loading")}</span>`:W}
    </p>`:W}_renderPhoneToggles(){return this.narrow?O`<button
        class="tools-toggle ${this._toolsOpen?"active":""}"
        aria-expanded=${String(this._toolsOpen)}
        @click=${()=>this._toolsOpen=!this._toolsOpen}
      >
        ${this._t("tools")} ${this._toolsOpen?"▴":"▾"}
      </button>
      <button
        class="help-toggle icon ${this._helpOpen?"active":""}"
        aria-expanded=${String(this._helpOpen)}
        aria-label=${this._t("help")}
        title=${this._t("help")}
        @click=${()=>this._helpOpen=!this._helpOpen}
      >
        ?
      </button>`:W}_renderFind(){const e=this.findMatches(),t=""!==this._find.trim();return O`<div class="find">
      <input
        type="search"
        placeholder=${this._t("find_device")}
        aria-label=${this._t("find_device")}
        .value=${this._find}
        @input=${e=>this.setFind(e.target.value)}
        @keydown=${e=>{"Enter"===e.key&&(e.preventDefault(),this.nextMatch())}}
      />
      ${t?O`<span class="find-count" role="status">
              ${0===e.length?this._t("find_none"):this._t("find_count",{index:jt(this.hass,this._findIndex+1),count:jt(this.hass,e.length)})}
            </span>
            ${e.length>1?O`<button class="find-next" @click=${()=>this.nextMatch()}>${this._t("find_next")}</button>`:W}`:W}
      ${this._renderPhoneToggles()}
    </div>`}_edgeColor(e,t){if("untracked"===e.kind)return"var(--secondary-text-color)";if("solar"===e.kind)return as.production;if("source"===e.kind){const s=t.get(e.from===os?e.to:e.from);return as[s?.role??""]??"var(--secondary-text-color)"}return"var(--primary-color)"}_dashed(e,t){return"untracked"===e.kind||("device"===e.kind||"group"===e.kind)&&null===e.power||"source"===e.kind&&"home"===t.role}_renderEdge(e,t,s){const r=t.get(e.from),i=t.get(e.to);if(!r||!i)return W;const n=this._edgeColor(e,t),o=this._dashed(e,r),a=bs(e.power,s),l=ys(a);return Z`<g class="edge edge-${e.kind}" data-from=${e.from} data-to=${e.to}>
      <path
        d=${ws(r,i,l.length-1,this._orientation)}
        fill="none"
        stroke=${n}
        stroke-width=${a}
        stroke-dasharray=${o?(u=a,`${Math.max(4,2*u)} ${Math.max(4,1.25*u)}`):"none"}
        stroke-linecap="butt"
      ></path>
      <polygon points=${ks(r,i,l.half,l.length,this._orientation)} fill=${n}></polygon>
    </g>`;var u}_homeText(e){const t=this._home();if(t?.stale)return O`<span class="sub">${this._t("home_stale",{name:this._name(t.stale)})}</span>`;if(null==t?.value&&"electricity"===this._tab&&this.draftSources.some(e=>"home"===e.type))return W;const[s,r]=null!=t?.value?["calculated"===t.basis?"home_calculated":"home_measured",t.value]:["home_measured",e];if(null===r)return W;const i=this._coverage?this._coverageRatio():null;return O`<span class="sub">${this._t(s,{power:this._formatValue(r)})}</span>${null===i?W:O`<span class="sub coverage">${function(e,t){return t>1?Pt(e,"coverage_over"):t>0&&t<.01?Pt(e,"coverage_below_one"):Pt(e,"coverage_percent",{percent:jt(e,Math.round(100*t))})}(this.hass,i)}</span>`}`}_coverageRatio(){const e=this._home();return null==e?.value||e.stale?null:function(e,t){return null===e||e<=0||t.some(e=>null!==e&&e<0)?null:t.reduce((e,t)=>e+(t??0),0)/e}(e.value,this._tops())}_energyLoading(){return"now"!==this._period&&null===this._energy}_tops(){const e=this.draft,t=this._values(e);return we(e).map(e=>t.get(e.stat)??null)}_blockStyle(e){return`left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px`}_renderBlock(e,t,s,r,i){const n=this._blockStyle(e);switch(e.kind){case"group":return this._renderGroupBlock(e,i.get(e.id)??null);case"home":{const e=this._dragHandlers(zs);return O`<div
          class="block home ${this._dropTarget===zs?"drop":""} ${this._dragged&&this._canDrop(zs)?"can-drop":""}"
          style=${n}
          @dragover=${e.over}
          @dragleave=${e.leave}
          @drop=${e.drop}
        >
          ${Dt("home")}
          <div class="block-text">
            <span class="node-name">${this._t("home")}</span>
            ${this._homeText(s)}
          </div>
          ${this._issuesFor(os).length?O`<span class="badge" title=${this._issuesFor(os).map(e=>this._issueText(e)).join("\n")}
                >!</span
              >`:W}
        </div>`}case"source":case"placeholder":{const t=e.role??"import",s=this._roleLabel("consumption"===t?e.source?.type??"gas":t),r=Ys(t),i=r?`${Ks}${r}:${e.id}`:null,o=e.stat?[e.stat]:"placeholder"===e.kind&&"import"===t?this._powerOnlyGridStats():[],a=i?this._dragHandlers(i):null;return O`<button
          class="block source ${e.kind} ${i&&this._dropTarget===i?"drop":""} ${i&&this._dragged&&this._canDrop(i)?"can-drop":""}"
          style="${n};--source-color:${as[t]??"var(--divider-color)"}"
          title=${this._t("sources_hint")}
          data-role=${t}
          @dragover=${a?.over}
          @dragleave=${a?.leave}
          @drop=${a?.drop}
          @click=${()=>{"placeholder"===e.kind&&r?this._dialog={kind:"assign",role:r}:this._dialog={kind:"source",role:t,label:s,stat:e.stat??null}}}
        >
          <div class="block-text">
            <span class="node-name">${"placeholder"===e.kind?`+ ${s}`:s}</span>
            ${e.stat?this._renderSourceSub(e):W}
          </div>
          ${o.some(e=>this._haIssuesFor(e).length)?O`<span class="badge" title=${o.map(e=>this._badgeTitle(e,[])).filter(Boolean).join("\n")}
                >!</span
              >`:W}
          ${"source"===e.kind&&e.stat?this._renderHintMark(this._hintsFor(e.stat,t)):W}
        </button>`}case"solar":return this._renderSolarBlock(e);case"untracked":{const s=this._untrackedText(e.stat,r.get(e.stat),t);return O`<div class="block untracked" style=${n} data-parent=${e.stat}>
          <div class="block-text">
            <span class="node-name">${this._t("untracked")}</span>
            <span class="sub" title=${s.title??W}>${s.text}</span>
          </div>
        </div>`}default:return this._renderDeviceBlock(e,t)}}_renderSolarBlock(e){const t=e.stat,s=e.placedAt,r=this._sourceValueText(e);return O`<div
      class="block solar placed ${"solar"===this._dragged?.kind&&this._dragged.stat===t?"dragged":""}"
      style="${this._blockStyle(e)};--source-color:${as.production}"
      draggable="true"
      data-solar=${t}
      data-at=${s}
      title=${this._t("solar_block_placed_title")}
      @dragstart=${e=>this._startDrag(e,{kind:"solar",stat:t})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @click=${()=>this._dialog={kind:"solar_place",solar:t,stat:s}}
    >
      ${Dt("sun")}
      <div class="block-text">
        <span class="node-name">${this._solarName(t)}</span>
        ${null===r?W:O`<span class="sub">${r}</span>`}
      </div>
    </div>`}_renderSourceSub(e){const t=e.source?.name||this._name(e.stat),s="source"===e.kind?this._sourceValueText(e):null;return O`<span class="sub"
      >${null===s?W:O`<span class="value">${s}</span> · `}${t}</span
    >`}_sourceValueText(e){const t=e.role??"import";if(!e.stat||"consumption"===t)return null;if("gas"===t)return this._gasValueText(e.stat);if("now"!==this._period&&this._home()?.stale===e.stat)return null;const s="now"===this._period?this.hass?He(this.hass,e.source,t):null:this._energy?.energy[e.stat]??null;return null===s?null:this._formatValue(s)}_gasValueText(e){if("now"===this._period){const t=this.draftSources.find(t=>"gas"===t.type&&t.stat_energy_from===e)?.stat_rate,s="string"==typeof t?this.hass?.states[t]:void 0,r=s?Number(s.state):NaN;return s&&""!==s.state&&Number.isFinite(r)?`${jt(this.hass,r,2)} ${s.attributes.unit_of_measurement??""}`.trim():null}const t=this._energy?.energy[e];if(null==t)return null;const s=this._info(e)?.unit;return s&&Js.includes(s)?Ft(this.hass,t):Gt(this.hass,t,this._energy?.gas_unit??"m³")}_renderDeviceBlock(e,t){const s=e.stat,r=e.node,i=this._name(s,t),n=this._issuesFor(s),o=n.length>0||this._haIssuesFor(s).length>0,a=this._suggestionFor(s),l=n.some(e=>"error"===e.severity)||null!==r.problem,u=this._dragHandlers(s),d=t.find(e=>e.stat_consumption===s),c=d?this._values([d]).get(s)??null:null,_=this._info(s),h=[null===c?null:this._formatValue(c),_?.area_name].filter(Boolean).join(" · "),p=this._collapsed.has(s);return O`<div
      class="block device node ${a?"suggested":""} ${this._findClass(s)} ${this._selected===s?"selected":""} ${this._multi.has(s)?"multi":""} ${this._dropTarget===s?"drop":""} ${l?"has-error":o?"has-warning":""} ${this._dragged?.stat===s?"dragged":this._dragged&&this._canDrop(s)?"can-drop":""}"
      style=${this._blockStyle(e)}
      draggable="true"
      data-stat=${s}
      @dragstart=${e=>this._startDrag(e,{kind:"device",stat:s})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @dragover=${u.over}
      @dragleave=${u.leave}
      @drop=${u.drop}
      @click=${e=>{this._selecting(e)?this._toggleMulti(s):(this._selected=s,this.narrow&&(this._dialog={kind:"details"}))}}
    >
      ${r.children.length?O`<button
            class="icon toggle"
            aria-label=${i}
            aria-expanded=${String(!p)}
            @click=${e=>{e.stopPropagation(),this._toggle(s)}}
          >
            ${p?"▸":"▾"}
          </button>`:W}
      <div class="block-text">
        <span class="node-name" title=${i}>${i}</span>
        ${h?O`<span class="sub">${h}</span>`:W}
      </div>
      ${o||r.problem?O`<span class="badge" title=${this._badgeTitle(s,n)}>!</span>`:W}
      ${this._renderHintMark(this._hintsFor(s))}
      ${this._typeMarks&&this._info(s)?.stat_type?O`<span class="type-mark" title=${this._typeText(s)??W}>${m=this._info(s).stat_type,Z`<svg class="type-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d=${Tt[m]}></path></svg>`}</span>`:W}
      ${a?O`<span class="suggestion" title=${this._t("suggestion_text",{parent:this._name(a.parent,t)})}
            >${Dt("lightbulb")}</span
          >`:W}
      <button
        class="icon"
        aria-label=${this._t("actions",{name:i})}
        @click=${e=>{e.stopPropagation(),this._dialog={kind:"actions",stat:s}}}
      >
        ${Dt("dots")}
      </button>
    </div>`;var m}_renderSolarTags(e){const t="electricity"===this._tab?Ye(this.draftSources,this.draft,this._places).get(e)??[]:[];return t.length?O`${t.map(t=>O`<button
            class="solar-tag"
            title=${this._t("solar_block_placed_title")}
            @click=${s=>{s.stopPropagation(),this._dialog={kind:"solar_place",solar:t,stat:e}}}
          >
            ${Dt("sun")} ${this._solarName(t)}
          </button>`)}`:W}_devicesText(e){return this._countText(ht(this._groups,e).length)}_countText(e){return 1===e?this._t("group_devices_one"):this._t("group_devices_other",{count:jt(this.hass,e)})}_renderGroupBlock(e,t){const s=e.group,r=e.id,i=this._collapsed.has(r),n=null===t?null:this._formatValue(t),o=this._dragHandlers(r);return O`<div
      class="block group ${i?"collapsed":"header"} ${this._multi.has(r)?"multi":""} ${this._dropTarget===r?"drop":""} ${this._dragged?.stat===r?"dragged":this._dragged&&this._canDrop(r)?"can-drop":""}"
      style=${this._blockStyle(e)}
      draggable="true"
      data-group=${s.id}
      @dragstart=${e=>this._startDrag(e,{kind:"group",stat:r})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
      @dragover=${o.over}
      @dragleave=${o.leave}
      @drop=${o.drop}
      @click=${e=>{this._selecting(e)?this._toggleMulti(r):this._toggle(r)}}
    >
      <button
        class="icon toggle"
        aria-label=${s.name}
        aria-expanded=${String(!i)}
        @click=${e=>{e.stopPropagation(),this._toggle(r)}}
      >
        ${i?"▸":"▾"}
      </button>
      <div class="block-text">
        ${i?O`<span class="node-name" title=${s.name}>${s.name}</span>
              <span class="sub">${[this._devicesText(s.id),n].filter(Boolean).join(" · ")}</span>`:O`<span class="node-name" title=${s.name}>${[s.name,n].filter(Boolean).join(" · ")}</span>
              <span class="sub">${this._devicesText(s.id)}</span>`}
      </div>
      <button
        class="icon"
        aria-label=${this._t("group_actions",{name:s.name})}
        @click=${e=>{e.stopPropagation(),this._dialog={kind:"group",id:s.id}}}
      >
        ${Dt("dots")}
      </button>
    </div>`}_renderFrame(e){const t=this._dragHandlers(e.id);return O`<div
      class="frame ${this._dropTarget===e.id?"drop":""} ${this._dragged&&this._canDrop(e.id)?"can-drop":""}"
      style=${this._blockStyle(e)}
      data-group=${e.group.id}
      @dragover=${t.over}
      @dragleave=${t.leave}
      @drop=${t.drop}
    ></div>`}_toggle(e){const t=new Set(this._collapsed);t.has(e)?t.delete(e):t.add(e),this._collapsed=t}_selecting(e){return this._selectMode||e.ctrlKey||e.metaKey}setSelectMode(e){this._selectMode=e,e||(this._multi=new Set)}_toggleMulti(e){const t=new Set(this._multi);t.has(e)?t.delete(e):t.add(e),this._multi=t}_selectionParent(){const[e]=this._multi;return e?.startsWith(at)?this._groups.find(t=>lt(t.id)===e)?.parent??null:this.draft.find(t=>t.stat_consumption===e)?.included_in_stat??null}_groupSelection(e){const t=[...this._multi],s=this._groups;if(!Ct(this.draft,s,t))return;const r=t.filter(e=>!e.startsWith(at)),i=t.filter(e=>e.startsWith(at)).map(e=>e.slice(6)),n=new Set([...r.map(e=>s.find(t=>t.members.includes(e))?.id??null),...i.map(e=>s.find(t=>t.id===e)?.group??null)]),o={type:"create_group",id:ut(),name:e.trim(),parent:this._selectionParent(),group:1===n.size?[...n][0]:null,members:r,groups:i,...this._kind()};this._close(),this._multi=new Set,this._change(o)}_renderSources(){const e=Re(this.draftSources,this._tab);return O`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("sources")}</h2>
          <button class="link" @click=${()=>rr("/config/energy")}>
            ${this._t("open_energy_settings")}
          </button>
        </div>
        <p class="hint">${this._t("sources_hint")}</p>
        ${0===e.length?O`<p class="empty">${this._t("no_sources")}</p>`:O`<div class="sources">
              ${e.map(e=>{const t=this._roleLabel("consumption"===e.role?e.type:e.role);return O`<button
                  class="source"
                  data-role=${e.role}
                  @click=${()=>this._dialog={kind:"source",role:e.role,label:t,stat:e.stat}}
                >
                  <span class="source-role">${t} ${this._renderHintMark(this._hintsFor(e.stat,e.role))}</span>
                  <span class="source-name">${e.name||this._name(e.stat)}</span>
                </button>`})}
            </div>`}
      </section>
    `}_renderTree(){const e=this.draft,t=we(e),s=this._rateMap(e),r=qe(t,s),i=this._dragHandlers(zs);return O`
      <section class="card">
        <div class="card-header"><h2>${this._t("devices")}</h2></div>
        <p class="hint">${this._t("devices_hint")}</p>
        <div
          class="home ${this._dropTarget===zs?"drop":""}"
          @dragover=${i.over}
          @dragleave=${i.leave}
          @drop=${i.drop}
        >
          ${Dt("home")}
          <span>${this._t("home")}</span>
          ${this._dragged?O`<span class="hint">${this._t("home_drop")}</span>`:W}
        </div>
        ${0===t.length?O`<p class="empty">${this._t("no_devices")}</p>`:O`<ul class="tree" role="tree">
              ${t.map(t=>this._renderNode(t,e,s,r))}
            </ul>`}
      </section>
    `}_renderNode(e,t,s,r){const i=this._name(e.stat,t),n=this._issuesFor(e.stat),o=n.length>0||this._haIssuesFor(e.stat).length>0,a=n.some(e=>"error"===e.severity)||null!==e.problem,l=this._collapsed.has(e.stat),u=this._dragHandlers(e.stat),d=s.get(e.stat)??null,c=r.get(e.stat),_=void 0===c?null:this._untrackedText(e.stat,c,t,s);return O`
      <li role="treeitem" aria-expanded=${e.children.length?String(!l):W}>
        <div
          class="node ${this._selected===e.stat?"selected":""} ${this._dropTarget===e.stat?"drop":""} ${a?"has-error":o?"has-warning":""}"
          draggable="true"
          data-stat=${e.stat}
          @dragstart=${t=>this._startDrag(t,{kind:"device",stat:e.stat})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
          @dragover=${u.over}
          @dragleave=${u.leave}
          @drop=${u.drop}
          @click=${()=>{this._selected=e.stat,this.narrow&&(this._dialog={kind:"details"})}}
        >
          ${e.children.length?O`<button
                class="icon toggle"
                aria-label=${i}
                @click=${t=>{t.stopPropagation();const s=new Set(this._collapsed);l?s.delete(e.stat):s.add(e.stat),this._collapsed=s}}
              >
                ${l?"▸":"▾"}
              </button>`:O`<span class="toggle"></span>`}
          <span class="node-name">${i}</span>
          ${this._renderSolarTags(e.stat)}
          ${o||e.problem?O`<span class="badge" title=${this._badgeTitle(e.stat,n)}>!</span>`:W}
          ${this._renderHintMark(this._hintsFor(e.stat))}
          <span class="node-power">${null===d?W:this._formatValue(d)}</span>
          <button
            class="icon"
            aria-label=${this._t("actions",{name:i})}
            @click=${t=>{t.stopPropagation(),this._dialog={kind:"actions",stat:e.stat}}}
          >
            ${Dt("dots")}
          </button>
        </div>
        ${e.children.length&&!l?O`<ul role="group">
              ${e.children.map(e=>this._renderNode(e,t,s,r))}
              ${void 0!==c?O`<li class="untracked">
                    <span class="toggle"></span>
                    <span class="node-name">${this._t("untracked")}</span>
                    <span class="node-power" title=${_?.title??W}>${_?.text}</span>
                  </li>`:W}
            </ul>`:W}
      </li>
    `}_renderFreeStrip(){return O`<button
      class="free-strip"
      aria-expanded="false"
      title=${this._t("free_expand")}
      @click=${()=>this.setFreeCollapsed(!1)}
    >
      ${Dt("chevronRight")}
      <span class="free-strip-label">${this._t("free_sensors")}</span>
      <span class="free-strip-count"
        >${jt(this.hass,this._freeCandidates().filter(e=>null===this._holderOf()(e)).length)}</span
      >
      ${this._freeSolarStats().length?O`<span class="free-strip-solar" title=${this._t("solar_block_strip")}>${Dt("sun")}</span>`:W}
    </button>`}_renderCandidates(e=!1){const t=this._freeCandidates(),s=this._holderOf(),r=t.filter(e=>null===s(e)),i=t.filter(e=>null!==s(e));return O`
      <section class="card">
        <div class="card-header">
          <h2>${this._t("free_sensors")}</h2>
          ${e?O`<button
                class="icon fold"
                aria-label=${this._t("free_collapse")}
                title=${this._t("free_collapse")}
                aria-expanded="true"
                @click=${()=>this.setFreeCollapsed(!0)}
              >
                ${Dt("chevronLeft")}
              </button>`:W}
        </div>
        <p class="hint">${this._t(this._tabKey("free_sensors_hint"))}</p>
        ${this._renderFreeSolars()}
        <input
          type="search"
          placeholder=${this._t("search")}
          aria-label=${this._t("search")}
          .value=${this._search}
          @input=${e=>this._search=e.target.value}
        />
        ${0===t.length?O`<p class="empty">${this._t(this._tabKey("no_candidates"))}</p>`:O`<ul class="candidates">
              ${r.map(e=>this._renderCandidate(e))}
            </ul>`}
        ${i.length?O`<details class="contained">
              <summary>
                ${this._t("free_contained")} <span class="contained-count">${jt(this.hass,i.length)}</span>
              </summary>
              <p class="hint">${this._t("free_contained_hint")}</p>
              <ul class="candidates contained-list">
                ${i.map(e=>this._renderCandidate(e,this._t("free_contained_in",{meter:this._name(s(e))})))}
              </ul>
            </details>`:W}
        ${this._renderPowerSensors()}
      </section>
    `}_renderFreeSolars(){const e=this._freeSolarStats();return e.length?O`<ul class="candidates solar-free">
      ${e.map(e=>O`<li
          class="candidate solar-block"
          draggable="true"
          data-solar=${e}
          @dragstart=${t=>this._startDrag(t,{kind:"solar",stat:e,free:!0})}
          @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
        >
          ${Dt("sun")}
          <div class="candidate-text">
            <span class="node-name">${this._t("solar_block_free",{solar:this._solarName(e)})}</span>
            <span class="sub">${this._t("solar_block_free_hint")}</span>
          </div>
          <button class="solar-pick" @click=${()=>this._dialog={kind:"solar_pick",solar:e}}>
            ${this._t("solar_block_pick")}
          </button>
        </li>`)}
    </ul>`:W}_holderOf(){const e=this._usedInDraft();return t=>t.contained_in&&e.has(t.contained_in)?t.contained_in:null}_heldLast(e,t=null){const s=this._holderOf(),r=e=>null!==s(e)&&s(e)!==t;return[...e.filter(e=>!r(e)),...e.filter(r)]}_heldText(e,t=null){const s=this._holderOf()(e);return null===s||s===t?null:this._t("free_contained_in",{meter:this._name(s)})}_renderCandidate(e,t){return O`<li
      class="candidate"
      draggable="true"
      data-stat=${e.stat}
      @dragstart=${t=>this._startDrag(t,{kind:"candidate",stat:e.stat})}
      @dragend=${()=>{this._dragged=null,this._dropTarget=null}}
    >
      <div class="candidate-text">
        <span class="node-name">${e.name||e.stat}</span>
        <span class="sub"
          >${t??([e.external?this._t("external_statistic"):null,e.area_name,e.device_name,e.created_helper?this._t("created_by"):null].filter(Boolean).join(" · ")||e.stat)}</span
        >
      </div>
      <button
        @click=${()=>"gas"===this._tab?this._assign("gas",e.stat):this._dialog={kind:"add",stat:e.stat}}
      >
        ${this._t("add")}
      </button>
    </li>`}_renderPowerSensors(){const e=this._freePowerSensors();if(0===e.length)return W;const t="water"===Ve(this._tab);return O`<h3>${this._t(t?"flow_only":"power_only")}</h3>
      <p class="hint">${this._t(t?"flow_only_hint":"power_only_hint")}</p>
      <ul class="candidates power-only">
        ${e.map(e=>O`<li data-stat=${e.stat}>
            <div class="candidate-text">
              <span class="node-name">${e.name||e.stat}</span>
              <span class="sub">${[e.area_name,e.device_name].filter(Boolean).join(" · ")||e.stat}</span>
            </div>
            <button @click=${()=>this._dialog={kind:"integral",stat:e.stat}}>
              ${this._t("create_meter")}
            </button>
          </li>`)}
      </ul>`}_renderDetails(){const e=this._selected,t=this.draft,s=t.find(t=>t.stat_consumption===e);if(!e||!s)return O`<section class="card">
        <div class="card-header"><h2>${this._t("details")}</h2></div>
        <p class="empty">${this._t("select_hint")}</p>
      </section>`;const r=this._info(e),i="water"===Ve(this._tab),n=this.hass?De(this.hass,s.stat_rate,this._deviceKind()):null,o=null===n?null:i?Ot(this.hass,n,this._waterUnit()):Rt(this.hass,n),a=we(t),l=this._values(t),u=qe(a,l).get(e),d="now"===this._period?void 0:l.get(e)??null,c=this._issuesFor(e),_=(e,t)=>O`<dt>${this._t(e)}</dt>
        <dd>${t||this._t("none")}</dd>`;return O`
      <section class="card">
        <div class="card-header"><h2>${this._name(e,t)}</h2></div>
        <dl>
          ${_("detail_statistic",e)}
          ${_(i?"detail_flow_sensor":"detail_power_sensor",s.stat_rate)}
          ${_("detail_device",r?.device_name)} ${_("detail_area",r?.area_name)}
          ${_(i?"detail_flow":"detail_power",o)}
          ${void 0!==d?_(i?"detail_volume":"detail_energy",null===d?null:this._formatValue(d)):W}
          ${_("detail_type",r?.stat_type?this._typeText(e):this._t("type_sensor"))}
          ${r?.created_helper?_("detail_helper",this._t("created_by")):W}
          ${void 0!==u?_("detail_untracked",null===u?null:this._untrackedText(e,u,t).text):W}
        </dl>
        ${c.length?O`<h3>${this._t("detail_issues")}</h3>
              <ul class="issues">
                ${c.map(t=>O`<li class=${t.severity}>
                    ${this._issueText(t)}
                    ${"children_exceed_parent"===t.code&&this._offersSolarSetup(e)?O`<p class="hint children-solar">${this._t("hint_children_solar")}</p>
                          <button class="link" @click=${()=>this._openSolarSetup(e)}>
                            ${this._t("solar_setup")}
                          </button>`:W}
                  </li>`)}
              </ul>`:W}
        ${this._renderHaIssues(e)} ${this._renderHints(e)} ${this._renderSuggestion(e,t)}
      </section>
    `}_renderSelection(){const e=this._multi.size;if(0===e&&!this._selectMode)return W;const t=this._selectMode?O`<button class="select-done" @click=${()=>this.setSelectMode(!1)}>${this._t("select_done")}</button>`:W;if(0===e)return O`<div class="selection">
        <span>${this._t("selected_count",{count:jt(this.hass,0)})}</span>
        ${t}
      </div>`;const s=Ct(this.draft,this._groups,[...this._multi]);return O`<div class="selection">
      <span>${this._t("selected_count",{count:jt(this.hass,e)})}</span>
      <button
        class="group-selection"
        ?disabled=${!s}
        title=${s?"":this._t("group_parents_hint")}
        @click=${()=>{this._renameValue="",this._dialog={kind:"group_name"}}}
      >
        ${this._t("group_selection")}
      </button>
      <button class="clear-selection" @click=${()=>this._multi=new Set}>${this._t("clear_selection")}</button>
      ${t}
      ${s?W:O`<span class="group-hint">${this._t("group_parents_hint")}</span>`}
    </div>`}_renderFooter(){return 0!==this._changes.length||0!==this._multi.size||this._selectMode?O`<div class="footer">${this._renderSelection()} ${this._changes.length?this._renderDraftBar():W}</div>`:W}_renderDraftBar(){const e=this._changeCount(),t=this._validation?.issues.filter(e=>"error"===e.severity&&!e.existing).length??0;return O`
      <span class="count"
        >${1===e?this._t("change_one"):this._t("change_other",{count:jt(this.hass,e)})}</span
      >
      ${t?O`<span class="blocked" title=${this._t("blocked_hint")}
            >${Dt("alert")}
            ${1===t?this._t("blocked_one"):this._t("blocked_other",{count:jt(this.hass,t)})}</span
          >`:W}
      <button
        class="undo-change"
        title=${this._t("undo_change_hint")}
        aria-label=${this._t("undo_change")}
        @click=${()=>this._undoChange()}
      >
        ${Dt("undo")} <span class="label">${this._t("undo_change")}</span>
      </button>
      <button class="discard" @click=${()=>this._askDiscard()}>${this._t("discard")}</button>
      <button class="primary" @click=${()=>this._openConfirm()}>${this._t("save")}</button>
    `}_renderHintMark(e){return e.length?O`<span class="hint-mark" title=${e.map(e=>this._hintText(e)).join("\n")}>i</span>`:W}_hintAction(e){switch(e.code){case"returned_energy":return this._offersSolarSetup(e.stat)?O`<button class="primary" @click=${()=>this._openSolarSetup(e.stat)}>${this._t("solar_setup")}</button>`:W;case"solar_elsewhere":return O`<button class="primary" @click=${()=>this._dialog={kind:"replace",stat:e.stat}}>
          ${this._t("replace_with")}
        </button>`;case"daily_in_sum":return O`<button class="primary" @click=${()=>this._openEntitySettings(e.stat)}>
          ${this._t("hint_open_helper")}
        </button>`;case"power_available":{const t=this._hintRole(e),s=null===t?{kind:"device",stat:e.stat}:{kind:"source",stat:e.stat,role:t};return O`<button class="primary" @click=${()=>this._openPowerDialog(s,this._hintPreselect(e))}>
          ${this._t("electricity"===e.kind?"hint_set_power":"hint_set_flow")}
        </button>`}case"gross_off":return this._signFixedByPower(e)?O`<button class="primary" @click=${()=>this._openPowerDialog({kind:"device",stat:e.stat})}>
              ${this._t("power_sensor")}
            </button>`:W;case"gross_unknown":{const t=e.data?.input;return"string"==typeof t?O`<button class="primary" @click=${()=>this._openMoreInfo(t)}>${this._t("hint_show_sensor")}</button>`:W}case"solar_term_short":case"solar_term_high":{const t=this._hintPower(e);return null!==t?O`<button class="primary" @click=${()=>this._openMoreInfo(t)}>${this._t("hint_show_sensor")}</button>`:W}default:return W}}_hintPreselect(e){const t=this._hintRole(e);if(null===t||!Bs.has(t))return"string"==typeof e.data?.entity_id?e.data.entity_id:void 0}_renderHints(e,t){const s=this._hintsFor(e,t);return s.length?O`<h3>${this._t("hints")}</h3>
      ${s.map(e=>O`<div class="hint-line" data-code=${e.code}>
          <p>
            <span class="hint-mark">i</span> ${this._hintText(e)}
            ${this._hintReadme(e)?O`<a class="readme" href=${this._hintReadme(e)} target="_blank" rel="noreferrer"
                  >${this._t("hint_readme")}</a
                >`:W}
          </p>
          <div class="dialog-actions">
            ${this._hintAction(e)}
            ${this._canDismiss(e)?O`<button
                  title=${this._t(Is[e.code]?"hint_dismiss_event_title":"hint_dismiss_title")}
                  @click=${()=>{this._dismissHint(e)}}
                >
                  ${this._t("hint_dismiss")}
                </button>`:W}
          </div>
        </div>`)}`:W}_renderSuggestion(e,t){const s=this._suggestionFor(e);return s?O`<div class="suggestion-line">
      <p>${Dt("lightbulb")} ${this._t("suggestion_text",{parent:this._name(s.parent,t)})}</p>
      <div class="dialog-actions">
        <button class="primary" @click=${()=>this._applySuggestion(s)}>${this._t("suggestion_apply")}</button>
        <button @click=${()=>{this._ignoreSuggestion(s)}}>${this._t("suggestion_ignore")}</button>
      </div>
    </div>`:W}_renderHaIssues(e){const t=this._haIssuesFor(e);return t.length?O`<h3>${this._t("ha_reports")}</h3>
          <ul class="issues ha-issues">
            ${t.map(t=>O`<li class="warning">${Ut(this.hass,t,e)}</li>`)}
          </ul>`:W}_issueText(e){if("counted_twice"===e.code&&"string"==typeof e.details.meter)return this._t("issue_counted_twice_in",{meter:this._name(e.details.meter)});const t=`issue_${e.code}`;return Nt(t)?this._t(t,{unit:String(e.details.unit??"")}):e.code}_diffText(e){const t=this._diffLine(e);return"water"===e.kind?this._t("diff_water",{text:t}):t}_groupDiffLine(e){const t=e.name??"",s=this._countText(e.count??0);switch(e.type){case"group_created":return this._t("diff_group_created",{name:t,devices:s});case"group_renamed":return this._t("diff_group_renamed",{from:e.from??"",to:e.to??""});case"group_dissolved":return this._t("diff_group_dissolved",{name:t});default:return this._t("diff_group_changed",{name:t,devices:s})}}_diffLine(e){if(e.type.startsWith("group_"))return this._groupDiffLine(e);const t=e.kind??"electricity",s=this.draftOf(t),r=("water"===t?this._snapshot?.prefs.device_consumption_water:this._snapshot?.prefs.device_consumption)??[],i=this._name(e.stat,e.kind?s:void 0),n=e.to?this._name(e.to,s):"";switch(e.type){case"added":return e.parent?this._t("diff_added_under",{name:i,to:this._name(e.parent,s)}):this._t("diff_added",{name:i});case"removed":return this._t("diff_removed",{name:this._name(e.stat,r)});case"moved":return e.to?this._t("diff_moved",{name:i,to:n}):this._t("diff_moved_top",{name:i});case"renamed":{const t=e.from||this._name(e.stat,r);return e.to?this._t("diff_renamed",{name:t,to:e.to}):this._t("diff_renamed_reset",{name:t})}case"source_added":case"source_removed":return this._t("source_added"===e.type?"diff_source_added":"diff_source_removed",{name:i,role:this._roleLabel(e.role)});case"source_rate":return this._t("water"===e.role||"gas"===e.role?"diff_source_rate_flow":"diff_source_rate",{name:i,role:this._roleLabel(e.role)});default:return this._t("water"===t?"diff_rate_water":"diff_rate",{name:i})}}_roleLabel(e){const t=`role_${e??""}`;return Nt(t)?this._t(t):e??""}_sensorList(e,t){const s=this._heldLast(this._freeCandidates("").filter(t=>!e.includes(t.stat)));return 0===s.length?O`<p class="empty">${this._t("no_candidates")}</p>`:O`<ul class="targets">
      ${s.map(e=>{const s=this._heldText(e);return O`<li>
          <button class="target" data-target=${e.stat} @click=${()=>t(e.stat)}>
            ${s?O`<span class="candidate-text">
                  <span class="node-name">${e.name||e.stat}</span>
                  <span class="sub">${s}</span>
                </span>`:e.name||e.stat}
          </button>
        </li>`})}
    </ul>`}_renderCheck(e){const t=e.issues.filter(e=>"error"===e.severity&&!e.existing),s=e.issues.filter(e=>"error"===e.severity&&e.existing),r=e.issues.filter(e=>"warning"===e.severity),i=e=>O`<ul class="issues">
        ${e.map(e=>O`<li class=${e.severity}>
              ${this._name(e.stat)}: ${this._issueText(e)}
              <button class="link" @click=${()=>this._showIssue(e)}>${this._t("show_block")}</button>
            </li>`)}
      </ul>`;return O`<ul class="diff">
        ${e.diff.map(e=>O`<li>${this._diffText(e)}</li>`)}
      </ul>
      ${t.length?O`<p>${this._t("confirm_errors")}</p>${i(t)}`:W}
      ${s.length?O`<p class="kept-note">
              ${Dt("alert")} ${this._t(e.rejected?"confirm_kept_rejected":"confirm_kept")}
            </p>
            ${i(s)}`:W}
      ${r.length?O`<p>${this._t("confirm_warnings")}</p>${i(r)}`:W}
      ${e.rejected?O`<p>${this._t("confirm_rejected")}</p>
            <p class="rejected">${e.rejected}</p>`:W}`}_tabKey(e){return"electricity"===this._tab?e:`${e}_${this._tab}`}_showIssue(e){this._close(),this.setTab(e.kind??"electricity"),this._reveal(e.stat)}_summaryText(e){return Object.entries(e).map(([e,t])=>{const s=`summary_${e}`;return Nt(s)?this._t(s,{count:String(t)}):`${e}: ${t}`}).join(", ")}_renderDialog(){return O`<dialog
      @close=${e=>{e.target.open||(this._dialog=null)}}
      @cancel=${e=>{if("power"===this._dialog?.kind&&this._dialog.back)return e.preventDefault(),void(this._dialog=this._dialog.back);this._dialog=null}}
    >
      ${this._dialog?this._renderDialogContent(this._dialog):W}
      ${this._dialog&&this._toast?this._renderToast():W}
    </dialog>`}_close(){this._sumSession++,this._resetSumCheck(),this._dialog=null}_targetList(e,t){return 0===e.length?O`<p class="empty">${this._t("no_targets")}</p>`:O`<ul class="targets">
      ${e.map(e=>O`<li>
          <button class="target" data-target=${e??zs} @click=${()=>t(e)}>
            ${null===e?this._t("top_level"):this._name(e)}
          </button>
        </li>`)}
    </ul>`}_renderSum(e){const{fixed:t,all:s}=this._sumMembers(e),r=new Map(s.map(e=>[e,this._sumReason(e)])),i=[...r.values()].some(e=>null!==e),n=e.grossOk??[],o=this._sumHolders(s),a=this._sumSaveFirst(s),l=this._sumSolar(s,n),u=!i&&null===l&&this._sumStateClasses(s).size>1,d=this._renameValue.trim(),{rates:c,missing:_,blockedBySource:h}=this._sumRates(s),p=null===l?this._sumReplaceable(s):null,m=this._sumCheck,g=null===l,f=g&&s.some(e=>!(e in m.evidence)&&!m.failed.includes(e)),v=g&&s.some(e=>m.failed.includes(e)),b=g?this._sumPeriodic(s):[],w=g?this._sumUnchecked(s):[],y="water"===Ve(this._tab),k=(t,s)=>this._setSum({...e,added:t,picking:s}),$=e.picking?this._sumOptions(e):[],x=this._busy?null:d?0===s.length?this._t("sum_need_member"):!f||i||u?null:this._t("sum_checking"):this._t("sum_need_name"),S=!d||0===s.length||i||u||null!==l||a.length>0||f||b.length>0||this._busy;return O`<h2>${this._t("sum_create")}</h2>
      <label
        >${this._t("name_label")}
        <input
          type="text"
          .value=${this._renameValue}
          @input=${e=>{this._renameValue=e.target.value,"sum"!==this._dialog?.kind||this._dialog.named||(this._dialog={...this._dialog,named:!0})}}
        />
      </label>
      ${this._entityNamed(d)?O`<p class="hint warning sum-name-exists">${this._t("sum_name_exists",{name:d})}</p>`:W}
      <h3>${this._t("sum_members")}</h3>
      ${null!==e.group?O`<p class="hint">${this._t("sum_fixed_hint")}</p>`:W}
      <ul class="sum-members">
        ${s.map(s=>{const i=r.get(s)??null,a=this._name(s);return O`<li class="sum-member" data-stat=${s}>
            <div class="candidate-text">
              <span class="node-name">${a}</span>
              ${i?O`<span class="sub warning">${i}</span>`:W}
              ${w.includes(s)?O`<span class="sub warning sum-member-unchecked">${this._t("sum_member_unchecked")}</span>`:W}
              ${o.includes(s)?O`<label class="check sum-gross-ok">
                    <input
                      type="checkbox"
                      .checked=${n.includes(s)}
                      @change=${t=>this._setSum({...e,grossOk:t.target.checked?[...n,s]:n.filter(e=>e!==s)})}
                    />
                    ${this._t("sum_gross_ok",{name:a})}
                  </label>`:W}
            </div>
            ${t.includes(s)?W:O`<button
                  class="icon remove"
                  aria-label=${this._t("sum_remove",{name:a})}
                  title=${this._t("sum_remove",{name:a})}
                  @click=${()=>k(e.added.filter(e=>e!==s),e.picking)}
                >
                  ✕
                </button>`}
          </li>`})}
      </ul>
      ${i?O`<p class="warning">${this._t("sum_blocked")}</p>`:W}
      ${a.length?O`<p class="warning sum-solar-save-first">
            ${this._t("sum_solar_save_first",{names:a.map(e=>this._name(e)).join(", ")})}
          </p>`:W}
      ${null!==l?this._renderSumSolar(l,t):W}
      ${u?this._renderSumMixed(s):W}
      ${b.length?O`<div class="warning sum-periodic">
            <p>${this._t("sum_periodic")}</p>
            <ul>
              ${b.map(({stat:e,evidence:t})=>O`<li>${this._t("sum_periodic_member",{name:this._name(e),evidence:t})}</li>`)}
            </ul>
            <p>${this._t("sum_periodic_way")}</p>
            ${"electricity"===this._tab&&this._hasSolar()?O`<p>${this._t("sum_periodic_solar")}</p>`:W}
          </div>`:W}
      ${v?O`<p class="hint warning sum-unchecked">${this._t("sum_check_unknown")}</p>
            <button
              class="sum-recheck"
              ?disabled=${this._busy}
              @click=${()=>this._sumCheck={...this._sumCheck,failed:[]}}
            >
              ${this._t("sum_check_retry")}
            </button>`:W}
      ${e.picking?$.length?O`<ul class="targets">
              ${$.map(t=>O`<li>
                  <button class="target" data-target=${t} @click=${()=>k([...e.added,t],!1)}>
                    ${this._name(t)}
                  </button>
                </li>`)}
            </ul>`:O`<p class="empty">${this._t("sum_no_sensors")}</p>`:O`<button class="sum-add" @click=${()=>k(e.added,!0)}>${this._t("sum_add")}</button>`}
      ${null!==p?O`<label class="check sum-replace">
              <input
                type="checkbox"
                .checked=${!1!==e.replace}
                @change=${t=>this._setSum({...e,replace:t.target.checked})}
              />
              ${this._t("sum_replace",{name:this._name(p)})}
            </label>
            <p class="hint">${this._t("sum_replace_reason")}</p>`:W}
      ${null===l?O`<p class="hint">
              ${null!==p&&!1!==e.replace?this._t("sum_text_replace",{helper:d,name:this._name(p)}):this._t("sum_text",{helper:d})}
            </p>
            ${c.length?O`<p class="hint">
                  ${this._t(y?"sum_rate_hint_water":"sum_rate_hint",{helper:this._sumRateName(d)})}
                </p>`:h?O`<p class="hint sum-rate-none">
                    ${this._t(y?"sum_rate_source_water":"sum_rate_source_sign")}
                  </p>`:_.length?O`<p class="hint sum-rate-none">
                      ${this._t(y?"sum_rate_missing_water":"sum_rate_missing",{names:_.map(e=>this._name(e)).join(", ")})}
                    </p>`:W}`:W}
      ${e.error?O`<p class="warning sum-error">${e.error}</p>`:W}
      ${x?O`<p class="hint sum-why">${x}</p>`:W}
      <div class="dialog-actions">
        <button @click=${()=>this._close()}>${this._t("cancel")}</button>
        <button class="primary" ?disabled=${S} @click=${()=>this._createSum(e)}>
          ${this._busy?this._t("creating"):this._t("sum_create_button")}
        </button>
      </div>`}_renderSumSolar(e,t=[]){const{solars:s,holders:r,devices:i}=e,n=e=>e.map(e=>this._name(e)).join(", "),o=e=>e.some(e=>t.includes(e)),a=o(s);return O`${s.length?O`<p class="warning sum-solar-is">${this._t("sum_solar_is",{names:n(s)})}</p>`:W}
      <p class="warning sum-solar">${this._t("sum_solar_use_setup")}</p>
      ${r.length?O`<p class="hint sum-solar-holders">
            ${this._t(o(r)?"sum_solar_holders_group":"sum_solar_holders",{names:n(r)})}
          </p>`:W}
      ${0===s.length?W:0===i.length?O`<p class="hint sum-solar-no-device">
              ${this._t(a?"sum_solar_no_device_group":"sum_solar_no_device")}
            </p>`:O`${i.length>1?O`<p class="hint sum-solar-one-device">
                    ${this._t(a?"sum_solar_one_device_group":"sum_solar_one_device")}
                  </p>`:a?O`<p class="hint sum-solar-group-move">${this._t("sum_solar_group_move")}</p>`:W}
              ${i.map(t=>O`<button class="sum-solar-setup" @click=${()=>this._openSolarSetup(t,e.solar)}>
                    ${this._t("sum_solar_open_setup",{name:this._name(t,this.draft)})}
                  </button>`)}`}`}_renderSumMixed(e){const t=e=>String(this.hass?.states[e]?.attributes.state_class),s=e.map(e=>`${this._name(e)}: ${t(e)}`).join(", ");return O`<p class="warning sum-mixed">
        ${this._t("error_sum_state_classes_differ")} ${this._t("sum_state_class_list",{list:s})}
      </p>
      ${e.some(e=>"total"===t(e))?O`<p class="hint sum-mixed-total">${this._t("sum_mixed_total")}</p>`:W}`}_renderSolar(e){const t={stat:e.stat,solar:e.solar??null,...e.resume?{resume:e.resume}:{},deviceName:this._name(e.stat,this.draft),solars:this._setupSolars(),busy:this._busy,name:e=>this._name(e),sensorName:e=>this._sensorName(e),draft:()=>this._snapshot&&this._changes.length?{base_hash:this._snapshot.hash,changes:this._changes}:null,reload:()=>this._load(),canPlace:t=>null!==this._solarDrop(t,e.stat)};return O`${_e(e,O`<efm-solar-setup
        .hass=${this.hass}
        .localize=${this._localize}
        .context=${t}
        @close=${()=>this._close()}
        @place=${e=>{this._close(),this._placeSolar(e.detail.solar,e.detail.stat)}}
        @created=${t=>{this._onSolarCreated(e,t.detail)}}
        @failed=${e=>{this._onSolarFailed(e.detail.error)}}
        @set-solar-power=${t=>this._powerFromSetup(e,{kind:"source",stat:t.detail.solar,role:"production"},t.detail.state)}
        @set-circuit-power=${t=>this._powerFromSetup(e,{kind:"device",stat:t.detail.stat},t.detail.state)}
        @open-settings=${t=>this._settingsFromSetup(e,t.detail.entity_id,t.detail.state)}
      ></efm-solar-setup>`)}`}_powerFromSetup(e,t,s){this._openPowerDialog(t),"power"===this._dialog?.kind&&(this._dialog={...this._dialog,back:{...e,resume:s}})}_settingsFromSetup(e,t,s){this._openEntitySettings(t),this._setupResume={...e,resume:s}}_onHaDialogClosed=e=>{const t=this._setupResume;null!==t&&"ha-more-info-dialog"===e.detail?.dialog&&(this._setupResume=null,null===this._dialog&&(this._dialog=t))};_renderPower(e){const{target:t}=e,s="source"===t.kind?t.role:null,r=this._t("electricity"===this._tab?"power_sensor_label":"flow_sensor_label"),i=null!==s&&Bs.has(s),n="discharge"===s||"charge"===s,o=e=>{"power"===this._dialog?.kind&&(this._dialog={...this._dialog,...e})},a=this._powerChange(e);return O`<h2>${"device"===t.kind?this._name(t.stat,this.draft):this._roleLabel(s)}</h2>
      ${"source"===t.kind?O`<p>${this._name(t.stat)}</p>`:W}
      ${i?O`<div class="power-variants">
            ${Fs.map(t=>O`<label class="check">
                <input
                  type="radio"
                  name="power-variant"
                  value=${t}
                  .checked=${e.variant===t}
                  @change=${()=>o({variant:t})}
                />
                ${this._t(Gs[t])}
              </label>
              <p class="hint power-variant-hint">${this._t(Os[n?"battery":"grid"][t])}</p>`)}
          </div>`:W}
      ${i&&"two"===e.variant?O`${this._renderPowerPicker(t.stat,e.first,this._roleLabel(n?"discharge":"import"),e=>o({first:e}))}
          ${this._renderPowerPicker(t.stat,e.second,this._roleLabel(n?"charge":"export"),e=>o({second:e}))}`:this._renderPowerPicker(t.stat,e.first,r,e=>o({first:e}))}
      <div class="dialog-actions">
        <button @click=${()=>e.back?this._dialog=e.back:this._close()}>
          ${this._t("cancel")}
        </button>
        <button
          class="primary"
          ?disabled=${null===a}
          @click=${()=>{this._close(),null!==a&&JSON.stringify(a)!==e.initial&&this._change(a),e.back&&(this._dialog=e.back)}}
        >
          ${this._t("ok")}
        </button>
      </div>`}_renderPowerPicker(e,t,s,r){const i=this._powerOptions(e);return t&&!i.some(e=>e.entity_id===t)&&i.unshift({entity_id:t,sameDevice:!1}),O`<label
      >${s}
      <select
        class="power-picker"
        data-value=${t}
        @change=${e=>r(e.target.value)}
      >
        <option value="">${this._t("power_none")}</option>
        ${i.map(e=>O`<option value=${e.entity_id} title=${e.entity_id}>
            ${this._sensorName(e.entity_id)}${e.sameDevice?` · ${this._t("power_same_device")}`:""}
          </option>`)}
      </select>
    </label>`}_renderDialogContent(e){const t=this.draft;switch(e.kind){case"actions":{const s=this._name(e.stat,t);return O`<h2>${s}</h2>
          <div class="dialog-actions column-actions">
            <button @click=${()=>this._dialog={kind:"move",stat:e.stat}}>
              ${this._t("move")}
            </button>
            <button
              @click=${()=>{this._renameValue=t.find(t=>t.stat_consumption===e.stat)?.name??"",this._dialog={kind:"rename",stat:e.stat}}}
            >
              ${this._t("rename")}
            </button>
            <button @click=${()=>this._openPowerDialog({kind:"device",stat:e.stat})}>
              ${this._t("water"===Ve(this._tab)?"flow_sensor":"power_sensor")}
            </button>
            ${this._freeCandidates("").length?O`<button @click=${()=>this._dialog={kind:"replace",stat:e.stat}}>
                  ${this._t("replace_with")}
                </button>`:O`<button disabled title=${this._t("replace_none")}>${this._t("replace_with")}</button>
                  <p class="hint replace-none">${this._t("replace_none")}</p>`}
            <button @click=${()=>this._openSum({origin:e.stat})}>${this._t("sum_create")}</button>
            ${this._offersSolarSetup(e.stat)?O`<button @click=${()=>this._openSolarSetup(e.stat)}>${this._t("solar_setup")}</button>`:W}
            ${this._canUseHomeMeter(e.stat)?O`<button
                  @click=${()=>{this._close(),this._change({type:"use_as_home_meter",stat:e.stat})}}
                >
                  ${this._t("use_as_home_meter")}
                </button>`:W}
            <button
              class="danger"
              @click=${()=>{this._close(),this._selected===e.stat&&(this._selected=null),this._change({type:"remove",stat:e.stat,...this._kind()})}}
            >
              ${this._t("remove")}
            </button>
            ${t.some(t=>t.included_in_stat===e.stat)?O`<p class="hint">${this._t("remove_hint")}</p>`:W}
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"move":{const s=this._name(e.stat,t),r=[...$e(t,e.stat,null)?[null]:[],...Se(t,e.stat)];return O`<h2>${this._t("move_title",{name:s})}</h2>
          ${this._targetList(r,t=>{this._close(),this._change({type:"move",stat:e.stat,parent:t,...this._kind()})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"add":{const s=this._candidates().find(t=>t.stat===e.stat),r=s?.name||e.stat,i=[null,...t.map(e=>e.stat_consumption)];return O`<h2>${this._t("add_title",{name:r})}</h2>
          ${s?.power?O`<p class="hint">
                ${this._t("water"===Ve(this._tab)?"with_flow":"with_power",{entity:s.power})}
              </p>`:W}
          ${this._targetList(i,t=>{this._close(),this._addCandidate(e.stat,t)})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"replace":{const s=this._name(e.stat,t),r=this._heldLast(this._freeCandidates(""),e.stat);return O`<h2>${this._t("replace_title",{name:s})}</h2>
          <p class="hint">${this._t("replace_hint")}</p>
          ${0===r.length?O`<p class="empty">${this._t(this._tabKey("no_candidates"))}</p>`:O`<ul class="targets">
                ${r.map(t=>O`<li>
                    <button
                      class="target"
                      data-target=${t.stat}
                      @click=${()=>{this._close(),this._replace(e.stat,t.stat,t.power)}}
                    >
                      <span class="candidate-text">
                        <span class="node-name">${t.name||t.stat}</span>
                        <span class="sub"
                          >${[this._heldText(t,e.stat),t.area_name,t.device_name,t.power?this._t("water"===Ve(this._tab)?"with_flow":"with_power",{entity:t.power}):null].filter(Boolean).join(" · ")||t.stat}</span
                        >
                      </span>
                    </button>
                  </li>`)}
              </ul>`}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"rename":{const s=this._name(e.stat,t);return O`<h2>${this._t("rename_title",{name:s})}</h2>
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
          </div>`}case"confirm":{const t=e.result;return null===t?O`<h2>${this._t("confirm_title")}</h2>
            <p>${this._t("checking")}</p>
            <div class="dialog-actions">
              <button class="cancel" @click=${()=>this._close()}>${this._t("cancel")}</button>
            </div>`:O`<h2>${this._t("confirm_title")}</h2>
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
          </div>`}case"backups":return O`<h2>${this._t("backups_title")}</h2>
          <p class="hint">${this._t("backups_hint")}</p>
          <div class="dialog-actions transfer-actions">
            <button @click=${()=>this._export()}>${this._t("export_current")}</button>
            <button @click=${()=>this._pickImportFile()}>${this._t("import_file")}</button>
          </div>
          ${0===e.entries.length?O`<p class="empty">${this._t("backups_empty")}</p>`:O`<ul class="backups">
                ${e.entries.map(e=>O`<li>
                    <div class="candidate-text">
                      <span class="node-name">${Bt(this.hass,e.created)}</span>
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
          </div>`;case"restore":{const t=Bt(this.hass,e.backup.created);return O`<h2>${this._t(e.undo?"undo":"restore")}</h2>
          <p>${this._t(e.undo?"undo_confirm":"restore_confirm",{date:t})}</p>
          ${this._changes.length?O`<p class="warning">${this._t("draft_lost")}</p>`:W}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${this._busy}
              @click=${()=>this._restore(e.backup)}
            >
              ${this._t("restore")}
            </button>
          </div>`}case"import":{const t=e.result,s=O`<h2>${this._t("import_title",{file:e.file})}</h2>`;return null===t?O`${s}
            <p>${this._t("checking")}</p>
            <div class="dialog-actions">
              <button class="cancel" @click=${()=>this._close()}>${this._t("cancel")}</button>
            </div>`:O`${s}
          ${t.changed?this._renderCheck(t):O`<p>${this._t("import_unchanged")}</p>`}
          ${t.changed&&this._changes.length?O`<p class="warning">${this._t("draft_lost")}</p>`:W}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!t.valid||!t.changed||this._busy}
              @click=${()=>this._import(e.document)}
            >
              ${this._t("import")}
            </button>
          </div>`}case"source":{const t=Ys(e.role),s="import"===t||"export"===t||"water"===t||"gas"===t,r=e=>e.filter(e=>"grid"===e.type).length,i=!!e.stat&&r(Qe(this.draftSources,[{type:"unassign_source",stat:e.stat,role:e.role}]))<r(this.draftSources);return O`<h2>${e.label}</h2>
          ${e.stat?O`<p>${this._name(e.stat)}</p>`:W}
          ${e.stat?this._renderHaIssues(e.stat):W}
          ${e.stat?this._renderHints(e.stat,e.role):W}
          ${e.stat&&t&&i?O`<p class="hint">${this._t("source_last_meter")}</p>`:W}
          <div class="dialog-actions column-actions">
            ${t?O`<button
                  @click=${()=>this._dialog={kind:"assign",role:t,replace:s?e.stat:null}}
                >
                  ${this._t(e.stat&&"production"!==t&&"battery"!==t?"source_replace":"source_assign")}
                </button>`:W}
            ${e.stat&&Zs.has(e.role)?O`<button
                  @click=${()=>this._openPowerDialog({kind:"source",stat:e.stat,role:e.role})}
                >
                  ${this._t("water"===e.role||"gas"===e.role?"flow_sensor":"power_sensor")}
                </button>`:W}
            ${e.stat&&t?O`<button
                  class="danger"
                  @click=${()=>{this._close(),this._change({type:"unassign_source",stat:e.stat,role:e.role})}}
                >
                  ${this._t("source_remove")}
                </button>`:W}
            <button
              @click=${()=>{this._close(),rr("/config/energy")}}
            >
              ${this._t("open_energy_settings")}
            </button>
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"assign":return O`<h2>${this._t("assign_title",{role:this._roleLabel(e.role)})}</h2>
          <p class="hint">
            ${this._t("water"===e.role?"assign_hint_water":"gas"===e.role?"assign_hint_gas":"assign_hint")}
          </p>
          ${"import"===e.role?this._powerOnlyGridStats().map(e=>this._renderHaIssues(e)):W}
          ${this._sensorList([],t=>this._assign(e.role,t,e.replace??null))}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"battery":return O`<h2>${this._t("battery_title")}</h2>
          <p class="hint">${this._t("battery_hint",{name:this._name(e.discharge)})}</p>
          ${this._sensorList([e.discharge],t=>{this._close(),this._change({type:"assign_source",role:"battery",stat:e.discharge,stat_to:t})})}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`;case"integral":{const t=this._info(e.stat)?.name||e.stat,s="water"===Ve(this._tab);return O`<h2>${this._t(s?"create_water_meter_title":"create_meter_title",{name:t})}</h2>
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
          </div>`}case"power":return this._renderPower(e);case"menu":return O`<div class="dialog-actions column-actions">
          <button ?disabled=${!this._snapshot} @click=${()=>this._dialog={kind:"candidates"}}>
            ${this._t("free_sensors")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!0)}>
            ${Dt("undo")} ${this._t("undo")}
          </button>
          <button ?disabled=${!this._snapshot} @click=${()=>this._openBackups(!1)}>
            ${Dt("history")} ${this._t("backups")}
          </button>
          <button
            @click=${()=>{this._close(),this._reload()}}
          >
            ${Dt("refresh")} ${this._t("reload")}
          </button>
          <button @click=${()=>this._close()}>${this._t("close")}</button>
        </div>`;case"candidates":return O`${this._renderCandidates()}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`;case"export":return O`<h2>${this._t("export_title")}</h2>
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
          </div>`;case"group":{const t=this._groups.find(t=>t.id===e.id);return O`${t?O`<h2>${t.name}</h2>
                <p class="hint">${this._devicesText(t.id)}</p>`:W}
          <div class="dialog-actions column-actions">
            ${t?O`<button
                    @click=${()=>{this._renameValue=t.name,this._dialog={kind:"group_rename",id:t.id}}}
                  >
                    ${this._t("rename")}
                  </button>
                  <button
                    @click=${()=>{this._close(),this._change({type:"dissolve_group",id:t.id,...this._kind()})}}
                  >
                    ${this._t("group_dissolve")}
                  </button>
                  <button @click=${()=>this._openSum({group:t.id})}>${this._t("sum_create")}</button>`:W}
            <button @click=${()=>this._close()}>${this._t("close")}</button>
          </div>`}case"group_rename":{const t=this._groups.find(t=>t.id===e.id),s=this._renameValue.trim(),r=""!==s&&this._groups.some(r=>r.id!==e.id&&r.parent===t?.parent&&r.name===s);return O`<h2>${this._t("rename_title",{name:t?.name??""})}</h2>
          <label
            >${this._t("name_label")}
            <input
              type="text"
              .value=${this._renameValue}
              @input=${e=>this._renameValue=e.target.value}
            />
          </label>
          ${r?O`<p class="warning">${this._t("error_group_name_taken",{stat:s})}</p>`:W}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="primary"
              ?disabled=${!t||!s||r||s===t.name}
              @click=${()=>{this._close(),this._change({type:"rename_group",id:e.id,name:s,...this._kind()})}}
            >
              ${this._t("ok")}
            </button>
          </div>`}case"sum":return this._renderSum(e);case"solar":return this._renderSolar(e);case"solar_pick":{const s=t.filter(t=>null!==this._solarDrop(e.solar,t.stat_consumption));return O`<h2>${this._t("solar_pick_title",{solar:this._solarName(e.solar)})}</h2>
          <p class="hint">${this._t("solar_block_free_hint")}</p>
          <div class="dialog-actions column-actions">
            ${s.map(s=>O`<button
                class="solar-choice"
                @click=${()=>{this._close(),this._putSolar(e.solar,s.stat_consumption)}}
              >
                ${this._name(s.stat_consumption,t)}
              </button>`)}
            <button class="cancel" @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"solar_place":{const s=this._solarName(e.solar),r=this._name(e.stat,t),i=(this._snapshot?.solar_counted?.[e.stat]??[]).includes(e.solar);return O`<h2>${s}</h2>
          <p>${this._t("solar_place_text",{solar:s,device:r})}</p>
          <p class="hint">${this._t("solar_place_move")}</p>
          ${i?O`<p class="hint">${this._t("solar_place_replace_hint",{device:r})}</p>`:W}
          <div class="dialog-actions column-actions">
            <button @click=${()=>this._dialog={kind:"solar_pick",solar:e.solar}}>
              ${this._t("solar_block_move")}
            </button>
            <button
              class="solar-unplace"
              @click=${()=>{this._close(),this._placeSolar(e.solar,null)}}
            >
              ${this._t("solar_place_remove")}
            </button>
            ${i?O`<button @click=${()=>this._dialog={kind:"replace",stat:e.stat}}>
                  ${this._t("replace_with")}
                </button>`:W}
            <button class="cancel" @click=${()=>this._close()}>${this._t("cancel")}</button>
          </div>`}case"group_name":{const e=this._renameValue.trim(),t=this._selectionParent(),s=""!==e&&this._groups.some(s=>s.parent===t&&s.name===e);return O`<h2>${this._t("group_name_title")}</h2>
          <label
            >${this._t("name_label")}
            <input
              type="text"
              .value=${this._renameValue}
              @input=${e=>this._renameValue=e.target.value}
            />
          </label>
          ${s?O`<p class="warning">${this._t("error_group_name_taken",{stat:e})}</p>`:W}
          <div class="dialog-actions">
            <button @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button class="primary" ?disabled=${!e||s} @click=${()=>this._groupSelection(e)}>
              ${this._t("ok")}
            </button>
          </div>`}case"discard":return O`<h2>${this._t("discard_title")}</h2>
          <p>${this._t("discard_confirm",{count:jt(this.hass,this._changeCount())})}</p>
          <div class="dialog-actions">
            <button class="cancel" @click=${()=>this._close()}>${this._t("cancel")}</button>
            <button
              class="danger"
              @click=${()=>{this._close(),this._discard()}}
            >
              ${this._t("discard")}
            </button>
          </div>`;case"details":return O`${this._renderDetails()}
          <div class="dialog-actions">
            ${this._selected?O`<button
                  @click=${()=>this._dialog={kind:"actions",stat:this._selected}}
                >
                  ${this._t("actions",{name:this._name(this._selected)})}
                </button>`:W}
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
    /* A phone: the panel is exactly as tall as the room between the system bars,
       so the diagram gets what header, tabs, search and footer leave, without
       scrolling the page. Home Assistant pads its custom-panel container by the
       safe-area insets (0 in a browser), so the panel leaves them out. */
    :host([narrow]) {
      height: calc(100vh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px));
      height: calc(100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px));
      min-height: 0;
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
    /* Folded free sensors: a slim strip; the diagram gets the room. */
    .content.free-collapsed {
      /* Details as wide as with the free sensors open (a fifth); the rest is the diagram's. */
      grid-template-columns: auto minmax(360px, 1fr) minmax(240px, 20%);
    }
    @container panel (max-width: 960px) {
      .content.free-collapsed {
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas:
          "free main"
          "free details";
      }
    }
    .free-strip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 10px 6px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
    }
    .free-strip .mdi {
      width: 20px;
      height: 20px;
    }
    .free-strip-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-weight: 500;
    }
    .free-strip-count {
      min-width: 20px;
      padding: 1px 6px;
      border-radius: 10px;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      font-size: 12px;
      text-align: center;
    }
    .card-header .fold {
      margin-left: auto;
    }
    .content.narrow {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr);
      grid-template-areas: "main";
      align-items: stretch;
      min-height: 0;
      padding: 8px;
      gap: 8px;
    }
    .narrow .diagram-card {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1 1 auto;
      padding-top: 8px;
    }
    /* The tab already names the diagram. */
    .narrow .diagram-card .card-header h2 {
      display: none;
    }
    /* The periods share one line, also with longer words (French). */
    .narrow .periods {
      margin-left: 0;
      flex: 1 1 100%;
    }
    .narrow .periods button {
      flex: 1 1 auto;
      padding: 4px 6px;
      font-size: 14px;
      white-space: nowrap;
    }
    :host([narrow]) .tabs {
      padding: 4px 8px 0;
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
    /* Long names without spaces (a statistic id) wrap instead of overflowing. */
    dialog h2,
    dialog p,
    dialog .node-name,
    .card-header h2,
    .targets button {
      overflow-wrap: anywhere;
      min-width: 0;
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
    /* A source row of the list view is a button: it opens the source dialog. */
    .sources .source {
      align-items: flex-start;
      gap: 2px;
      border: none;
      font: inherit;
      color: inherit;
      text-align: start;
      cursor: pointer;
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
    /* A hint only explains: an outline «i», unlike the filled «!» of checks and warnings. */
    .hint-mark {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid var(--info-color, #039be5);
      color: var(--info-color, #039be5);
      background: transparent;
      font: italic 700 12px/1 Georgia, "Times New Roman", serif;
    }
    .hint-line p {
      margin: 8px 0 0;
    }
    .hint-line p .hint-mark {
      margin-right: 4px;
      vertical-align: -3px;
    }
    .hint-line a.readme {
      color: var(--primary-color);
      white-space: nowrap;
    }
    .children-solar {
      margin: 4px 0 0;
    }
    input[type="search"],
    input[type="text"],
    select.power-picker {
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
    .backups li,
    .sum-members li {
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
    /* Free sensors a meter already counts, folded below the others. */
    .contained {
      margin-top: 12px;
    }
    .contained summary {
      cursor: pointer;
      font-weight: 500;
    }
    .contained-count {
      color: var(--secondary-text-color);
      font-weight: normal;
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
    .block .type-mark {
      position: absolute;
      top: 4px;
      left: 6px;
      line-height: 0;
      color: var(--secondary-text-color);
    }
    .block .type-icon {
      width: 14px;
      height: 14px;
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
    .power-variant-hint {
      margin: 0 0 8px 24px;
    }
    fieldset.solar-methods,
    fieldset.solar-sources {
      border: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    fieldset.solar-methods > legend,
    fieldset.solar-sources > legend {
      font-weight: 500;
      font-size: 1.17em;
      margin: 16px 0 8px;
      padding: 0;
    }
    .solar-method,
    .solar-input {
      margin: 0 0 8px;
    }
    .solar-method label.check {
      margin-bottom: 0;
    }
    .solar-method .hint,
    .solar-input .hint {
      margin: 0 0 0 24px;
    }
    .solar-method.not-offered {
      opacity: 0.7;
    }
    .solar-method.unverified .solar-method-status {
      color: var(--warning-color, #ffa600);
    }
    .solar-suggested {
      font-size: 0.85em;
      padding: 0 6px;
      border-radius: 8px;
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .solar-input-head {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .solar-input .hint.solar-evidence {
      margin-left: 0;
    }
    .solar-sparkline {
      color: var(--primary-color);
      flex: none;
    }
    .solar-sparkline .drop {
      fill: var(--error-color, #db4437);
    }
    .solar-picker {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0;
    }
    /*
     * A sensor without a name (disabled, so without a state) shows its entity
     * ID, which has no spaces: it wraps, so the setup never scrolls sideways
     * on a phone.
     */
    .solar-input-name,
    .solar-helpers label,
    .solar-picker,
    .solar-why {
      overflow-wrap: anywhere;
      min-width: 0;
    }
    .solar-picker select,
    .solar-helpers input {
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .solar-live {
      font-weight: 500;
    }
    .solar-why {
      margin-right: auto;
      align-self: center;
    }
    .periods button.active,
    .coverage-toggle.active,
    .types-toggle.active,
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
      --group-color: var(--accent-color, #ff9800);
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
    /* A phone: the diagram takes the height left over (see :host([narrow])). */
    .narrow .viewport {
      flex: 1 1 0;
      height: auto;
      min-height: 200px;
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
    /* A placed solar below its device: the source's colour, dragged to move it. */
    .block.solar {
      cursor: grab;
      border: 1px solid var(--source-color);
      border-left: 5px solid var(--source-color);
      background: color-mix(in srgb, var(--source-color) 14%, var(--block-bg));
    }
    .block.solar .mdi,
    .solar-block .mdi,
    .free-strip-solar .mdi,
    .solar-tag .mdi {
      color: var(--energy-solar-color, #ff9800);
    }
    .solar-block {
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 4px solid var(--energy-solar-color, #ff9800);
    }
    .solar-block .solar-pick {
      margin-left: auto;
      flex: none;
    }
    .solar-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 0 6px;
      border: none;
      border-radius: 10px;
      background: color-mix(in srgb, var(--energy-solar-color, #ff9800) 14%, transparent);
      color: var(--primary-text-color);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .solar-tag .mdi {
      width: 14px;
      height: 14px;
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
    .dragging .block.group:not(.can-drop):not(.dragged),
    .dragging .block.home:not(.can-drop) {
      opacity: 0.45;
    }
    /* Groups: dashed in the group colour; a frame around an expanded one. */
    .block.group {
      cursor: grab;
      border: 2px dashed var(--group-color);
      background: color-mix(in srgb, var(--group-color) 10%, var(--block-bg));
    }
    .block.group.header {
      box-shadow: none;
    }
    .frame {
      position: absolute;
      box-sizing: border-box;
      border: 2px dashed var(--group-color);
      border-radius: 14px;
      background: color-mix(in srgb, var(--group-color) 5%, transparent);
    }
    .frame.can-drop {
      border-color: var(--primary-color);
    }
    .frame.drop {
      border-style: solid;
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    }
    .block.multi {
      outline: 3px solid var(--group-color);
      outline-offset: 3px;
    }
    .select-mode.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
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
    .narrow .find input {
      flex: 1 1 auto;
      margin: 0;
    }
    .find .tools-toggle.active,
    .find .help-toggle.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    .find .help-toggle {
      border: 1px solid var(--divider-color);
      min-width: 32px;
      align-self: stretch;
    }
    .find .tools-toggle {
      white-space: nowrap;
      align-self: stretch;
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
      /* In the companion app the page runs under the phone's navigation bar; Home
         Assistant sets this inset to its height there and to 0 in a browser. */
      padding-bottom: calc(12px + var(--safe-area-inset-bottom, 0px));
      background: var(--card-background-color, var(--primary-background-color));
      border-top: 1px solid var(--divider-color);
      z-index: 2;
    }
    .footer {
      flex-wrap: wrap;
    }
    .footer .count,
    .footer .selection {
      flex: 1;
    }
    /* The count stays on screen: on a phone the buttons wrap below it. */
    .footer .selection {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    /* Why Group is disabled, visible without hovering (touch). */
    .footer .group-hint {
      flex-basis: 100%;
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    /* A phone: compact, so the draft bar usually fits on one line. The panel
       already ends above the navigation bar (see :host([narrow])). */
    :host([narrow]) .footer {
      gap: 6px;
      padding: 8px;
    }
    :host([narrow]) .footer button {
      padding: 6px 10px;
    }
    :host([narrow]) .footer .count {
      font-size: 14px;
    }
    /* On a phone «Undo change» is its icon (the label stays for screen readers). */
    :host([narrow]) .undo-change .label {
      display: none;
    }
    .footer .blocked {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--error-color);
    }
    .kept-note {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: var(--secondary-text-color);
    }
    .kept-note .mdi {
      flex: none;
      width: 18px;
      height: 18px;
      color: var(--warning-color, #ffa600);
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
      box-sizing: border-box;
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
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .column-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .sum-add {
      margin-top: 8px;
    }
    /* The reason a sensor cannot be summed may be long: it wraps. */
    .sum-member .candidate-text .sub {
      white-space: normal;
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
    /* Only a message: taps go through to the buttons below it. */
    .toast {
      position: fixed;
      left: 50%;
      bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      box-sizing: border-box;
      width: max-content;
      max-width: calc(100vw - 32px);
      padding: 10px 16px;
      border-radius: 8px;
      background: var(--primary-text-color);
      color: var(--primary-background-color);
      z-index: 3;
      pointer-events: none;
    }
    /* Above the footer, whose measured height includes the navigation bar. */
    .toast.over-footer {
      bottom: calc(var(--efm-footer-height, 0px) + 12px);
    }
    /* On a phone the footer ends above the navigation bar, which the toast,
       fixed to the screen, has to add. */
    :host([narrow]) .toast.over-footer {
      bottom: calc(var(--efm-footer-height, 0px) + var(--safe-area-inset-bottom, 0px) + 12px);
    }
  `}customElements.get($s)||customElements.define($s,ir);export{xs as DOMAIN,ir as EnergyFlowMapperPanel,Cs as FIND_ZOOM,As as MAX_ZOOM,Es as MIN_ZOOM,$s as PANEL_TAG,js as README_ANCHORS,Rs as TABS,Ss as TOAST_MS,Ts as TOUCH_DRAG_LIFT,Ms as TOUCH_DRAG_SCALE,Ys as assignRole,tr as downloadBlob,er as downloadJson,Wt as errorText,Xs as fileStamp};
