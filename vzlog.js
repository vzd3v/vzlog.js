/**
 * 
 * A simple dependency-free tracker of user behavior for web. 
 * This implementation doesn't support old browsers (e.g. IE) due to the use of ES6.
 * GitHub and documentation: {@link https://github.com/vzd3v/vzlog.js | GitHub}. 
 * @author Vasily Zakharov <vz@vz.team>
 * 
 */
 class VZlog {

	/**
	 * 
	 * Set up
	 * @param {string} api_url URL to API where JSON will be sent via POST 
	 * @param {string|Array|Object} [options] which events to track. 
	 * 		Examples: 
	 * 			'click' 											 or 
	 * 			['click','scroll'] 									 or 
	 * 			{'click':'a,button.class','scroll':true} 			 or 
	 * 			{'click':{'on':['a','button.class']},'scroll':{'breakpoints':[50,80]}} 
	 * See more on {@link https://github.com/vzd3v/vzlog.js | GitHub}. 
	 * 
	 */
	constructor(api_url, options) {

		if (!api_url) { return; }
		this._api_url = api_url;

		this.default_options={
			'browser': {
				'user_agent': false,
				'once_per_user': true,
			},
			'click': {
				'on': 'only_outbound_links',
			},
			'scroll': {
				'iflargerthan': 150,
				'breakpoints': [50,90]
			}
		};

		//private properties
		this._debug=false;
		this._browser_data = null;
		this._last_event = null;

		this._browser_data_is_submitted_key='vzl_static_submitted';

		this._scroll_breakpoints_status={};

		this._listener_click=null;
		this._listener_scroll=null;

		// where the logic starts

		var _this = this;

		this.options=this._deepClone(this.default_options);

		if(options && this._isObject(options)) {
			for(let k in options) {
				if(this._isObject(options[k])) {
					Object.assign(this.options[k],options[k]);
				}
			}
		}

		// parsing options

		if 	(options == 'click' 
			|| (Array.isArray(options)&&options.indexOf('click') > -1) 
			|| (this._isObject(options) && 'click' in options)) {

				this._listener_click=function (e) { _this._trackClick(e, _this); };
				window.addEventListener('mouseup', this._listener_click);
		}

		if 	(options == 'scroll' 
			|| (Array.isArray(options)&&options.indexOf('scroll') > -1) 
			|| (this._isObject(options) && 'scroll' in options)) {

				this._listener_scroll=function () { _this._trackVerticalScroll(_this); };
				document.addEventListener('scroll', this._listener_scroll, {'passive':true});
		} 

		if 	(options == 'browser' 
			|| (Array.isArray(options)&&options.indexOf('browser') > -1) 
			|| (this._isObject(options) && 'browser' in options)) {

				if(!this.options.browser.once_per_user || !localStorage.getItem(this._browser_data_is_submitted_key)) { 
					this._collectBrowserData(true); 
					localStorage.setItem(this._browser_data_is_submitted_key,'1');
				}
		} 
	}

	/**
	 * Collect data independent of user actions on the page. Usually is sent once. 
	 * @param {boolean} send_event if true, send event '_browser_data' with collected data
	 * @returns {Object} collected data
	 */
	_collectBrowserData(send_event) {
		var data = {
			'language': navigator.language ? navigator.language : null,
			'timezone_str': null,
			'timezone_offset': new Date().getTimezoneOffset()/60,
		};

		if(this.options.browser.user_agent) {
			data.useragent = navigator.userAgent;
		}

		try {
			data.timezone_str = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch (e) { }

		data.screen = {};
		var k = ['width', 'height', 'colorDepth', 'pixelDepth', 'availHeight', 'availWidth'];
		for (let i = 0; i < k.length; i++) {
			data.screen[k[i]] = window.screen[k[i]] ? window.screen[k[i]] : null;
		}
		data.screen.orientation = {
			'angle': window.screen.orientation ? window.screen.orientation.angle : 0,
			'type': window.screen.orientation.type ? window.screen.orientation.type : null,
			'type_calc': window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
		};

		data.hardware = {
			'memory': typeof navigator.deviceMemory !='undefined' ? navigator.deviceMemory : null,
			'cpu_cores': typeof navigator.hardwareConcurrency !='undefined' ? navigator.hardwareConcurrency : null,
		};
		this._browser_data = data;

		if(send_event) { this.event('_browser_data',data); }
		return data;
	}

	_preserveFilterFor_trackClick(filter) {

	}

	/**
	 * Tracking clicks. Should be used as listener on mouseup.
	 * If this.options.click.on is set, track clicks only on elements (or ANY of its parents) that match a css-selector. 
	 * Example: 	'a,button.class,button[type="submit"],.class'. 
	 * 				Or Array: ['a','button.class','button[type=submit]', '.class'] 
	 * If options.click.on=='only_outbound_links', track ONLY clicks on outbound links. 
	 * If options.click.on is Array and has 'only_outbound_links' value, then links (a tag) will be tracked only if outbound.
	 * @param {PointerEvent|MouseEvent} e 
	 * @param {VZlog} _this 
	 */
	_trackClick(e, _this) {
		var ev_btn=e.button; // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		if([0,1].indexOf(ev_btn)==-1) { return; } // track only main and new tab (wheel)
		
		var el = e.target;

		var filter=_this.options.click.on;

		var only_outbound_links=false;
		if(filter==='only_outbound_links') { only_outbound_links=true; filter='a'; }
		if(Array.isArray(filter)) {
			filter=filter.slice();
			let inb_indx=filter.indexOf('only_outbound_links');
			if(inb_indx>-1) {
				only_outbound_links=true;
				delete filter[inb_indx];
			}
			filter=filter.implode(',');
		}
		if(filter&&!el.closest(filter)) { return; }

		this._last_event=e;
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
			'tagName': el_tag,
		};
		if(el.className.trim()) { params.el.className=el.className.trim(); }
		if(el.id) { params.el.id=el.id; }

		params.event = {
			'button': ev_btn, // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		};

		_this.event('click', params);
	}

	/**
	 * Tracking vertical scrolling. Send events when it reaches this.options.scroll.breakpoints
	 * @param {VZlog} _this
	 */
	_trackVerticalScroll(_this) {
		var cur_scroll = _this._getVerticalScrollPercent();

		// if document height is too small, remove event listener
		if(!cur_scroll) {
			document.removeEventListener('scroll',_this._listener_scroll); 
			return; 
		}

		var bp_status=_this._scroll_breakpoints_status;
		
		var scroll_breakpoints=_this.options.scroll.breakpoints;

		var bp_to_send=[];

		for(let bp of scroll_breakpoints) {
			let bp_is_sent=((bp in bp_status)&&bp_status[bp]) ? true : false;
			if(!bp_is_sent && cur_scroll>bp) {
				bp_to_send.push(bp);
				_this._scroll_breakpoints_status[bp]=bp_status[bp]=true;
			}
		}
		if(bp_to_send.length>0) {
			_this.event('scroll',{'breakpoints':bp_to_send});
		}
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

		var el_className = el.className.trim();
		var el_class_str = el_className ? ('.' + el_className.replace(/ +/g, '.')) : '';
		
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
			let ev1 = this._deepClone(ev); // we don't want to affect original ev
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

		obj_to_send.timestamp=Date.now();
		obj_to_send.pathname=window.location.pathname;
		obj_to_send.location={
			'https': window.location.protocol==='https:' ? true : false
		};

		if(window.location.port) { obj_to_send.location.port=window.location.port;}
		if(window.location.search) { obj_to_send.location.search=window.location.search;}
		if(window.location.hash) { obj_to_send.location.hash=window.location.hash;}

		this._send(obj_to_send);
	}

	/**
	 * @returns current vertical scroll position in percent
	 * or undefined if document height is less than this.options.scroll.iflargerthan
	 */
	_getVerticalScrollPercent() {
		var scroll_position = window.pageYOffset || document.body.scrollTop || 
			document.documentElement.scrollTop || 0;
		var window_height = window.innerHeight || document.documentElement.clientHeight || 
			document.body.clientHeight || 0;
		var document_height = Math.max(document.body.scrollHeight || 0, 
			document.documentElement.scrollHeight || 0, 
			document.body.offsetHeight || 0, 
			document.documentElement.offsetHeight || 0, 
			document.body.clientHeight || 0, 
			document.documentElement.clientHeight || 0);

		if(this._debug) { console.log({scroll_position,window_height,document_height}); }

		// eliminate the possibility of division by zero
		if(!document_height||!window_height) { return; } 

		// return nothing if the document isn't large enough than window
		if(document_height/window_height*100<this.options.scroll.iflargerthan) { return; } 

		var scroll_percent=(scroll_position + window_height) / document_height * 100;
		if(this._debug) { console.log({scroll_percent}); }
		
		return scroll_percent;
	}

	/**
	 * Sends data to server. 
	 * Using non-blocking sendBeacon as primary method and XMLHttpRequest for old browsers.
	 * @param {*} data 
	 */
	_send(data) {
		if(navigator.sendBeacon) {
			navigator.sendBeacon(this._api_url, JSON.stringify(data));
		} else {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', this._api_url, true);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.send(JSON.stringify(data));
		}
	}

	/**
	 * Deep clone an object or array using JSON.stringify
	 * @param {Object|Array} obj 
	 * @returns {Object|Array}
	 */
	_deepClone(obj) {
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
}