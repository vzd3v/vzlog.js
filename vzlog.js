/**
 * 
 * A simple dependency-free tracker of user behavior for web. 
 * This implementation doesn't support old browsers (e.g. IE) due to the use of ES6.
 * Documentation: {@link https://github.com/vzd3v/vzlog.js | GitHub}. 
 * @author Vasily Zakharov <vz@vz.team>
 * 
 * @todo Activity: save current activity data in browser (LS/IDB) and send next time if it hasn't been sent before. This feature is especially needed on mobile devices due to connection unstability and visibilitychange/pagehide events specifics.
 * @todo General: add an option to send all the collected data not in real-time but on visibilitychange, not only for 'activity'
 * @todo Scroll: add an option to track scroll path length instead of % of page from zero 
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
	 * See more on GitHub
	 * 
	 */
	constructor(api_url, options) {

		if (!api_url) { return; }
		this._api_url = api_url;


		// Documentation is on GitHub

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
			},
			'activity': {
				'on':['pointerdown','scroll','keydown','focus'],
				'inactivity_period': 30,
			}
		};

		// Private properties

		this._debug=false;
		this._debug_scroll=false;
		this._debug_activity=false;

		this._browser_data = null;
		this._last_event = null;

		this._browser_data_is_submitted_key='vzl_static_submitted';

		this._scroll_breakpoints_status={};
		this._scroll_ticker=false; 
		this._scroll_start_pos=null;

		this._activity_ticker=false;
		this._activity={'cur':{},'total':0,'last_transaction':0};

		this._listener_click=null;
		this._listener_scroll=null;
		this._listener_activity=null;
		this._listener_activity_visibility_stopper=null;
		this._listener_activity_stopper=null;

		this._onLocationChange_watch_el=null;
		this._onLocationChange_observer=null;
		this._onLocationChange_prev_url=null;
		this._onLocationChange_funcs=[];

		// Parsing options

		this.options={};

		if(options) {
			// case (Object) {...}
			if(this._isObject(options))
			{
				for(let k in options) {
					// case {a:{p:...,p:...}, b:{p:...,p:...}}
					if(this._isObject(options[k])) {
						this.options[k]=Object.assign(this._deepClone(this.default_options[k]),options[k]);
					} else {
					// case {a:true,b:true}
						this.options[k]=this._deepClone(this.default_options[k]);
					}
				}
			}
			// case (Array) [a,b]
			if(Array.isArray(options)) {
				for (let k of options) {
					this.options[k]=this._deepClone(this.default_options[k]);
				}
			}
			// case (string) 'a'
			if(typeof(options)==='string') {
				this.options[options]=this._deepClone(this.default_options[options]);
			}
		} else {
			this.options=this._deepClone(this.default_options);
		}

		options=this.options;
		if(this._debug) { console.log(this.options); }

		// Bind event listeners

		if 	(options == 'click' 
			|| (Array.isArray(options)&&options.indexOf('click') > -1) 
			|| (this._isObject(options) && 'click' in options)) {

				this._listener_click=this._listenerClick.bind(this);
				window.addEventListener('pointerup', this._listener_click);
		}

		if 	(options == 'scroll' 
			|| (Array.isArray(options)&&options.indexOf('scroll') > -1) 
			|| (this._isObject(options) && 'scroll' in options)) {

				this._scroll_start_pos=this._getVerticalScrollPercent();
				this._listener_scroll=this._listenerVerticalScroll.bind(this);
				document.addEventListener('scroll', this._listener_scroll, {'passive':true});

				// Reset and send events for breakpoints again if location is changed.

				this._onLocationChange(function() { 
					this._scroll_breakpoints_status={};
				});
		} 

		if 	(options == 'browser' 
			|| (Array.isArray(options)&&options.indexOf('browser') > -1) 
			|| (this._isObject(options) && 'browser' in options)) {

				if(!this.options.browser.once_per_user || !localStorage.getItem(this._browser_data_is_submitted_key)) { 
					this._collectBrowserData(true); 
					localStorage.setItem(this._browser_data_is_submitted_key,'1');
				}
		} 

		if 	(options == 'activity' 
			|| (Array.isArray(options)&&options.indexOf('activity') > -1) 
			|| (this._isObject(options) && 'activity' in options)) {

				this._listener_activity=this._listenerUserActivity.bind(this);

				for (var event of this.options.activity.on) {
					event=event.replace('mouse','pointer');
					document.addEventListener(event, this._listener_activity, {'passive':true});
				}

				this._listener_activity_visibility_stopper=function() {
					if (document.visibilityState === 'hidden') {
						this._activityStatus(false);
					}
				}.bind(this);
				document.addEventListener('visibilitychange',this._listener_activity_visibility_stopper);

				this._listener_activity_stopper=this._activityStatus.bind(this,false);
				document.addEventListener('pagehide',this._listener_activity_stopper);

				this._activityStatus(true);
		}
	}

	/**
	 * Collects data that doesn't depend on the actions of user on the page.
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

	/**
	 * Custom event-like function for monitoring current address (location.href) change
	 * By default it watches <title> tag and, if it changes, checks location.href.
	 */ 

	_onLocationChange(func)
	{
		if(!this._onLocationChange_observer) {

			this._onLocationChange_prev_url = document.location.href;
			var mon_selector=this._onLocationChange_watch_el || 'head title';

			var target=document.querySelector(mon_selector);

			this._onLocationChange_observer = new MutationObserver(function() {
				if (this._onLocationChange_prev_url !== document.location.href) {
					this._onLocationChange_prev_url = document.location.href;
					if(this._debug) { console.log(document.location.href); }
					for(let func of this._onLocationChange_funcs) {
						func();
					}
				}
			}.bind(this));

			var obs_conf = {
				characterData:true,
				childList: true,
				attributes: true
			};

			this._onLocationChange_observer.observe(target, obs_conf);
		}

		this._onLocationChange_funcs.push(func.bind(this));
	}

	/**
	 * Tracking clicks. Should be used as listener on mouseup.
	 * If this.options.click.on is set, track clicks only on elements (or ANY of its parents) that match a css-selector. 
	 * Example: 	'a,button.class,button[type="submit"],.class'. 
	 * 				Or Array: ['a','button.class','button[type=submit]', '.class'] 
	 * If options.click.on=='only_outbound_links', track ONLY clicks on outbound links. 
	 * If options.click.on is Array and has 'only_outbound_links' value, then links (a tag) will be tracked only if outbound.
	 * 
	 * Don't forget to use with bind(this) if context is changed (e.g. in event listeners)
	 * 
	 * @param {PointerEvent|MouseEvent} e 
	 */
	_listenerClick(e) {
		var ev_btn=e.button; // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		if([0,1].indexOf(ev_btn)==-1) { return; } // track only main and new tab (wheel)
		
		var el = e.target;

		var filter=this.options.click.on;

                var only_outbound_links=false;
                if(filter==='only_outbound_links') { only_outbound_links=true; filter='a'; }
                if(Array.isArray(filter)) {
                        filter=filter.slice();
                        let inb_indx=filter.indexOf('only_outbound_links');
                        if(inb_indx>-1) {
                                only_outbound_links=true;
                                filter.splice(inb_indx,1);
                        }
                        filter=filter.join(',');
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
			'el': this.getPrettyElementName(el),
			'path': this.getPrettyPathToElement(el),
			'tagName': el_tag,
		};
		if(el.className.trim()) { params.el.className=el.className.trim(); }
		if(el.id) { params.el.id=el.id; }

		params.event = {
			'button': ev_btn, // 0=main(left), 1=middle(mouse wheel), 2=secondary(right) https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
		};

		this.event('click', params);
	}

	_activityAutoEnd_daemon() {
		this.activity_setInterval_id = setInterval(function(){
			if(this._activityStatus() && this._activity.cur.auto_end_at<Date.now()) {
				this._activityStatus(false);
			}
		}.bind(this),500);
	}

	/** 
	 * Get or set current user activity status.
	 * @param {boolean} [status] if set, true = user is active, false = isn't. 
	 * 		If false, sends event with last activity period.
	 */
	_activityStatus(status) {
		if(status!==false&&status!==true) {
			return this._activity_is_active_now;
		}

		var cur_time=Date.now();

		if(this._debug_activity) { console.log('%cActivity','background-color:orange;',cur_time,this._activity_is_active_now,this._activity); }

		if(status===false) {
			// if before was active, send event to server
			if(this._activity_is_active_now && this._activity.cur.start_time) {

				this._activity.last_transaction = cur_time - this._activity.cur.start_time;
				this._activity.total += this._activity.last_transaction;

				let params = {
					'increment': this._activity.last_transaction,
					'total': this._activity.total
				};

				this.event('activity',params);

				this._activity.cur.start_time=0;
				this._activity.cur.auto_end_at=0;
			}
			return this._activity_is_active_now=false;
		}
		if(status===true) {

			// if before was unactive, set start time as now
			if(!this._activity_is_active_now || !this._activity.cur.start_time) {
				this._activity.cur.start_time=cur_time;
			}

			// prolong auto end time
			var inact_period=this.options.activity.inactivity_period*1000;
			this._activity.cur.auto_end_at=cur_time+inact_period;

			// start auto end daemon if it's not yet
			if(!this.activity_setInterval_id) {
				this._activityAutoEnd_daemon();
			}

			return this._activity_is_active_now=true;
		}
	}

	/**
	 * Tracks User Activity Time.
	 */
	_listenerUserActivity() {
		// Optimization.
		if(this._activity_ticker) { return; }
		this._activity_ticker=true;
		setTimeout(function() {
			this._activity_ticker=false;
		}.bind(this),500);

		this._activityStatus(true);
	}

	/**
	 * Tracking vertical scrolling. Sends events when it reaches this.options.scroll.breakpoints
	 */
	_listenerVerticalScroll() {

		// Optimization.
		if(this._scroll_ticker) { return; }
		this._scroll_ticker=true;
		setTimeout(function() {
			this._scroll_ticker=false;
		}.bind(this),200);

		var cur_scroll = this._getVerticalScrollPercent();

		// if document height is too small, remove event listener
		if(!cur_scroll) {
			document.removeEventListener('scroll',this._listener_scroll); 
			return; 
		}

		var bp_status=this._scroll_breakpoints_status;
		
		var scroll_breakpoints=this.options.scroll.breakpoints;

		var bp_to_send=[];

		for(let bp of scroll_breakpoints) {
			let bp_is_sent=((bp in bp_status)&&bp_status[bp]) ? true : false;
			if(!bp_is_sent && cur_scroll>bp) { // Measure from the start of the page. Not relevant if user hasn't been started from the zero position, e.g. came through #hash to the middle of the article!
				bp_to_send.push(bp);
				this._scroll_breakpoints_status[bp]=bp_status[bp]=true;
			}
		}
		if(bp_to_send.length>0) {
			this.event('scroll',{'breakpoints':bp_to_send});
		}
	}

	/**
	 * Get unique path to element (starting with body or closest first parent with id)
	 * @param {Element} el 
	 * @param {boolean} return_array 
	 * @returns {string} smth like 
	 * 								 body>div.class1.class2>p:nth-of-type(1) 
	 * 						or 		 div#id>p.class:nth-of-type(2)
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

		if(this._debug) { console.log('%cEVENT '+ev,'font-size:150%; background-color:yellow; font-weight:bold;',params); }

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

		if(this._debug_scroll) { console.log({scroll_position,window_height,document_height}); }

		// eliminate the possibility of division by zero
		if(!document_height||!window_height) { return; } 

		// return nothing if the document isn't large enough than window
		if(document_height/window_height*100<this.options.scroll.iflargerthan) { return; } 

		var scroll_percent=(scroll_position + window_height) / document_height * 100;
		if(this._debug_scroll) { console.log({scroll_percent}); }
		
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