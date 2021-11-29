/**
 * A simple dependency-free tracker of user behavior for web. 
 * @author Vasily Zakharov <vz@vz.team>
 */
class VZlog {
	collect_user_agent = false;

	api_url = '';
	static_data = null;
	last_event = null;
	_static_data_is_submitted_key='vzl_static_submitted';
	//scroll_log_if_height_more_than = 150; // % of viewport
	//scroll_breakpoints = [50, 80]; // % of page height

	constructor(api_url, track_events) {
		if (!api_url) { return; }
		this.api_url = api_url;
		var _this = this;

		if(!localStorage.getItem(this._static_data_is_submitted_key)) { this._collectStaticData(); }

		if (track_events) {
			if (track_events == 'click' || (Array.isArray(track_events)&&track_events.indexOf('click') > -1) || (this._isObject(track_events) && 'click' in track_events)) {
				let click_filters=this._isObject(track_events)?track_events['click']:null;
				window.addEventListener('mouseup', function (e) { _this._trackClick(e, _this, click_filters); });
			} 
		}
	}

	/**
	 * Collect data independent of user actions on the page
	 * @returns {Object} collected data
	 */
	_collectStaticData() {
		var data = {
			'language': navigator.language ? navigator.language : null,
			'timezone_str': null,
			'timezone_offset': new Date().getTimezoneOffset()/60,
			'useragent': this.collect_user_agent ? navigator.userAgent : null,
		};
		try {
			data.timezone_str = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch (e) { }

		data.screen = {};
		var k = ['width', 'height', 'colorDepth', 'pixelDepth', 'availHeight', 'availWidth'];
		for (let i = 0; i < k.length; i++) {
			data.screen[k[i]] = window.screen[k[i]] ? window.screen[k[i]] : null;
		}
		data.screen.orientation = {
			'angle': window.screen.orientation ? window.screen.orientation['angle'] : 0,
			'type': window.screen.orientation.type ? window.screen.orientation.type : null,
			'type_calc': window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
		};

		data.hardware = {
			'memory': typeof navigator.deviceMemory !='undefined' ? navigator.deviceMemory : null,
			'cpu_cores': typeof navigator.hardwareConcurrency !='undefined' ? navigator.hardwareConcurrency : null,
		};
		this.static_data = data;

		this.event('browser_data',data);
		localStorage.setItem(this._static_data_is_submitted_key,'1');

		return data;
	}

	/**
	 * Tracking clicks. Can be used as listener on mouseup.
	 * @param {PointerEvent|MouseEvent} e 
	 * @param {VZlog} _this 
	 * @param {string|Array} filter If set, track clicks only on elements (or ANY of its parents) that match a css-selector. 
	 * Example: 'a,button.class,button[type="submit"],.class'. Or Array: ['a','button.class','button[type=submit]', '.class'] 
	 * If filter=='only_outbound_links', track ONLY clicks on outbound links. 
	 * If filter is Array and has 'only_outbound_links' value, then links (a tag) will be tracked only if outbound.
	 */
	_trackClick(e, _this, filter) {
		var ev_btn=e.button; // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		if([0,1].indexOf(ev_btn)==-1) { return; } // track only main and new tab (wheel)
		
		var el = e.target;

		var only_outbound_links=false;
		if(filter==='only_outbound_links') { only_outbound_links=true; filter='a'; }
		if(Array.isArray(filter)) {
			filter=_this._clone(filter);
			let inb_indx=filter.indexOf('only_outbound_links');
			if(inb_indx>-1) {
				only_outbound_links=true;
				delete filter[inb_indx];
			}
			filter=filter.implode(',');
		}
		if(filter&&!el.closest(filter)) { return; }

		this.last_event=e;
		var el_tag = el.tagName.toLowerCase();
		var params={};

		var el_a=el.closest('a');
		if(el_a) {

			let href=el_a.href;
			let is_inbound=href.indexOf(window.location.origin)>-1;
			if(is_inbound) {
				if(only_outbound_links) { return; }
				href=href.replace(window.location.origin,'');
			}
			params.link={
				'is_inbound':is_inbound,
				'href':href
			};
		} 

		params.el = {
			'el': _this.getPrettyElementName(el),
			'path': _this.getPrettyPathToElement(el),
			'id': el.id,
			'className': el.className,
			'tagName': el_tag,
		};
		params.event = {
			'button': ev_btn, // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		};

		_this.event('click', params);
	}

	/**
	 * Get unique path to element (starting with body or nearest first parent with id)
	 * @param {Element} el 
	 * @param {boolean} return_array 
	 * @returns {string} smth like body>div.class1.class2>p:nth-of-type(1) or div#id>p.class:nth-of-type(2)
	 */
	getPrettyPathToElement(el, return_array = false) {
		var arr = [];
		while (el.parentNode != null) {
			arr.unshift(this.getPrettyElementName(el));
			if(el.id||el.nodeName=='body') {break;}
			el = el.parentNode;
		}
		var ret_arr = arr; // delete the first one 
		return return_array ? ret_arr : ret_arr.join('>');
	}

	/**
	 * Get (not unique) DOM identificator of element 
	 * @param {Element} el 
	 * @returns {string} smth like div#id or div.classname:nth-of-type(2)
	 */
	getPrettyElementName(el) {
		if (el.hasAttribute('id') && el.id != '') {
			return el.nodeName.toLowerCase() + '#' + el.id;
		}

		var el_tag = el.nodeName.toLowerCase();
		if(el_tag=='body') { return 'body'; }

		var el_className = el.className;
		var el_class_str = el_className ? ('.' + el.className.replaceAll(' ', '.')) : '';
		
		//var el_siblings = el.parentNode.childNodes;
		var el_siblings = el.parentNode.querySelectorAll(el_tag+el_class_str);
		var sibl_index = 0;
		var el_index = 0;

		for (let i = 0; i < el_siblings.length; i++) {
			if (el_siblings[i] === el) {
				el_index = sibl_index;
			}
			sibl_index++;
		}

		if (el_siblings.length > 1) {
			return el.nodeName.toLowerCase() + el_class_str + ':nth-of-type(' + (el_index+1) + ')';
		} else {
			return el.nodeName.toLowerCase() + el_class_str;
		}
	}

	/**
	 * Track any event
	 * @param {string|Array} ev event name (recommended chars = alphanumeric+'_'+'-'). 
	 * If Array is sent, there must be a key 'event', any other keys are sending as params
	 * @param {Object} params any params to register with event
	 */
	event(ev, params) {
		if (!ev) { return; }
		var obj_to_send = {};

		if (this._isObject(ev)) {
			let ev1 = this._clone(ev); // we don't want to affect original ev
			if (!Object.prototype.hasOwnProperty.call(ev1, 'event')) { return; }
			obj_to_send.event = ev1.event;
			delete ev1.event;
			obj_to_send.params = ev1;
			if (params && this._isObject(params)) {
				obj_to_send.params = Object.assign(ev1, params);
			}
		} else {
			obj_to_send.event = ev;
			if (params && this._isObject(params)) {
				obj_to_send.params = params;
			}
		}
		this._send(obj_to_send);
	}

	/**
	 * Sends data to server
	 * @param {*} data 
	 */
	_send(data) {
		navigator.sendBeacon(this.api_url, JSON.stringify(data));
	}

	/**
	 * Clone an object using JSON.stringify
	 * @param {Object} obj 
	 * @returns {Object}
	 */
	_clone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	/**
	 * Checks if a variable is an object but NOT a function nor an array
	 * @param {*} smth 
	 * @returns {boolean}
	 */
	_isObject(smth) {
		var type = typeof smth;
		//return smth === Object(smth) && Object.prototype.toString.call(smth) !== '[object Array]' && type != 'function' && smth !== null;
		return smth === Object(smth) && !Array.isArray(smth) && type !== 'function' && smth !== null;
	}

	/**
	 * Simple insecure hash-function
	 * Source: https://stackoverflow.com/questions/6122571/simple-non-secure-hash-function-for-javascript
	 * @param {string} str 
	 * @returns 
	 */
	_hash(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash &= hash; // Convert to 32bit integer
		}
		return new Uint32Array([hash])[0].toString(36);
	}
}