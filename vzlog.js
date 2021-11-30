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
	 * @param {string|Array|Object} track_events which events to track. 
	 * 		Examples: 
	 * 			'click' 											 or 
	 * 			['click','scroll'] 									 or 
	 * 			{'click':'a,button.class','scroll':true} 			 or 
	 * 			{'click':['a','button.class'],'scroll':[50,80]} 
	 * See more on {@link https://github.com/vzd3v/vzlog.js | GitHub}. 
	 * 
	 */
	constructor(api_url, track_events) {

		if (!api_url) { return; }
		this._api_url = api_url;

		// Unfortunately, class fields are not widely supported yet.
		// default settings
		this.collect_user_agent = false;
		this.send_browser_data_every_event=false;
		this.click_filters='a'; 
		this.scroll_log_if_doc_is_larger_than_window = 150; // % of viewport
		this.scroll_breakpoints = [60, 90]; // % of page height

		//private properties
		this._browser_data = null;
		this._last_event = null;

		this._browser_data_is_submitted_key='vzl_static_submitted';

		this._scroll_breakpoints_status={};

		this._listener_click=null;
		this._listener_scroll=null;

		//constructor method start

		var _this = this;

		if(!localStorage.getItem(this._browser_data_is_submitted_key)) { this._collectBrowserData(true); }

		if (!track_events || track_events == 'click' || (Array.isArray(track_events)&&track_events.indexOf('click') > -1) || (this._isObject(track_events) && 'click' in track_events)) {
			if(this._isObject(track_events)&&track_events.click) {
				_this.click_filters=track_events.click;
			}
			this._listener_click=function (e) { _this._trackClick(e, _this); };
			window.addEventListener('mouseup', this._listener_click);
		}
		if (!track_events || track_events == 'scroll' || (Array.isArray(track_events)&&track_events.indexOf('scroll') > -1) || (this._isObject(track_events) && 'scroll' in track_events)) {
			if(this._isObject(track_events)&&track_events.scroll) {
				_this.scroll_breakpoints=track_events.scroll;
			}
			this._listener_scroll=function () { _this._trackVerticalScroll(_this); };
			document.addEventListener('scroll', this._listener_scroll, {'passive':true});
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

		localStorage.setItem(this._browser_data_is_submitted_key,'1');

		return data;
	}

	/**
	 * Tracking clicks. Should be used as listener on mouseup.
	 * If this.click_filters is set, track clicks only on elements (or ANY of its parents) that match a css-selector. 
	 * Example: 	'a,button.class,button[type="submit"],.class'. 
	 * 				Or Array: ['a','button.class','button[type=submit]', '.class'] 
	 * If click_filters=='only_outbound_links', track ONLY clicks on outbound links. 
	 * If click_filters is Array and has 'only_outbound_links' value, then links (a tag) will be tracked only if outbound.
	 * @param {PointerEvent|MouseEvent} e 
	 * @param {VZlog} _this 
	 */
	_trackClick(e, _this) {
		var ev_btn=e.button; // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		if([0,1].indexOf(ev_btn)==-1) { return; } // track only main and new tab (wheel)
		
		var el = e.target;

		var filter=_this.click_filters;

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
		if(el.className) { params.el.className=el.className; }
		if(el.id) { params.el.id=el.id; }

		params.event = {
			'button': ev_btn, // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		};

		_this.event('click', params);
	}

	/**
	 * Tracking vertical scrolling. Send events when it reaches this.scroll_breakpoints
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
		
		var scroll_breakpoints=_this.scroll_breakpoints;

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
		if(this.send_browser_data_every_event) { obj_to_send.params._browser_data=this._collectBrowserData(); }

		this._send(obj_to_send);
	}

	/**
	 * @returns current vertical scroll position in percent 
	 * or undefined if document height is less than this.scroll_log_if_doc_is_larger_than_window
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
		console.log({scroll_position:scroll_position,window_height:window_height,document_height:document_height});
		if(!document_height||!window_height) { return; } // eliminate the possibility of division by zero
		if(document_height/window_height<(this.scroll_log_if_doc_is_larger_than_window/100)) { return; } // return nothing if the document isn't large enough than window
		return (scroll_position + window_height) / document_height * 100;
	}

	/**
	 * Sends data to server. 
	 * Use sendBeacon or XMLHttpRequest for old browsers.
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
}