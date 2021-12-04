## VZlog:  fast dependency-free user behavior tracker for Web ##

### Why? ###
* VZLog tracks user activity on your website and dispatches it to any API on YOUR server;
* Currently it supports tracking of:
	* User activity time (you choose what to count as an activity);
	* Vertical scrolling;
	* Clicks (you choose clicks to which elements are counted, e.g. outbound links or buttons);
	* Browser data;
	* Your custom events
* Set-up by 1 line of code;
* Amazingly small (10kb minified) and fast (using beaconAPI, passive:true and other optimizations);
* It supports browsers released after 2016 (ES6) and works with any frameworks as well as without them. *(Later: ES5/IE11 version)*

### Current features ###
* Track **browser data**: timezone, language, screen resolution etc;
* Track **user activity time**:
	* track how much time user actually spent on the page doing something
	* you can set events to be treated as activity
* Track **clicks**: 
	* track any elements that matches the specified CSS-selectors (e.g. `a, div.class, button[type=submit]`);
	* track clicks to outbound links (including non-http, e.g. tg://);
	* if you want to track clicks to links, it's ok to have any child elements in `<a>` (e.g. `<a><img></a>`), it still will be tracked;
	* if click was made with the middle mouse button, it still will be tracked;
	* your API receives unique DOM path of target element, e.g. `div#content>ul.navbar>li:nth-of-type(3)>a`, so you will know exactly what is happened
* Track **scroll**: 
	* track when user reaches some breakpoints (e.g. 50%, 90%) if page is big enough (e.g. >150% of viewport)
	* scroll events are sent once per each breakpoint per pageview. If your app is SPA, it's ok! Scroll tracking will be reset if `<title>`+location.href is changed (not taking into account #hash);
* You can track any **custom events** triggered in your code by `VZlog.event('event_name',any_params)`

### Technical details ###
* Uses non-blocking BeaconAPI to send events if available (if not, uses XMLHttpRequest);
* Uses passive:true and other optimizations for event listeners, so tracking scrolling & user activity is not a bottleneck;
* Currently VZlog is written using basic ES6 features, so **it doesn't support IE11**! But you can compile it with Babel to ES5;

# How to use #

### Installation ###
Just download `vzlog.js` and include it on your pages using `<script src="/path/to/vzlog.js"></script>`.

### Usage: general set-up ###

Activate VZlog and set a path to your API that can collect JSON.
```javascript
var _VZLog=new VZlog('/path/to/your/api');
```
In fact, that's enough!

With default settings, it tracks:
* user activity time;
* browser data once per user;
* clicks to outbound links (and it's child elements);
* scrolling to breakpoints 50% and 90% of document if page is 1.5x larger than viewport (sends event for each breakpoint only once per page view)

If you want to specify some settings, that's how to.
The default settings are an equivalent to:
```javascript
var _VZLog=new VZlog('/path/to/your/api',['activity','browser','click','scroll']);
``` 
If you want to change defaults:
```javascript
var _VZLog=new VZlog('/path/to/your/api',options);
``` 
`options` can be null, string, Array or Object.

Use options as a `string` if you want to turn on only one feature with default parameters:
```javascript
// Track only browser data (with default parameters):
var _VZLog=new VZlog('/path/to/your/api','browser'); 
// Track only clicks (with default parameters):
var _VZLog=new VZlog('/path/to/your/api','click'); 
// Track only scroll (with default parameters):
var _VZLog=new VZlog('/path/to/your/api','scroll'); 
// etc.
``` 
Use options as an `Array`, if you want to turn on specified features with default parameters:
```javascript
// Track clicks & scroll (with default parameters):
var _VZLog=new VZlog('/path/to/your/api',['click','scroll']); 

``` 
If options is an `Object`, you can specify parameters of each feature. 
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'click':params,'scroll':params});
// To use default parameters, set params to true:
var _VZLog=new VZlog('/path/to/your/api',{'click':true,'scroll':true}); // track clicks & scroll (with default parameters)
// It's an equivalent to:
var _VZLog=new VZlog('/path/to/your/api',['click','scroll']);
```

### Advanced: click tracking settings ###

```javascript
//By default, it tracks clicks only on outbound links and it's child elements
var _VZLog=new VZlog('/path/to/your/api',['click']); 
``` 
It's an equivalent to default settings:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'click':'only_outbound_links'}); 

``` 
To track clicks on the specified CSS-selectors (and it's children):
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'click':{'on':'a,button.class,button[type=submit]'}}); 
// Or you can specify selectors via Array, it's the same:
var _VZLog=new VZlog('/path/to/your/api',{'click':{'on':['a','button.class','button[type=submit]']}}); 
```
Special parameter value `only_outbound_links`: track click ONLY on outbound links (and it's children):
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'click':['on':'only_outbound_links']}); 
```
You can use `only_outbound_links` in the mix with the other selectors, but they should be set in Array, not in single string:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'click':['on':['only_outbound_links','span.someclass']]}); 
```
Then the following logic will be observed: 
- track clicks to outbound links AND track links to `<span>` with class `.someclass`.
- if `span.someclass` is placed inside `<a>` with inbound href, it won't be tracked!


### Advanced: scroll tracking settings ###

By default, it tracks scroll only on breakpouints 50% and 90% and only if page height is at least 1.5x larger than viewport:
```javascript
var _VZLog=new VZlog('/path/to/your/api',['scroll']);
``` 
It's an equivalent to default settings:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'breakpoints':[50,90],'iflargerthan':150}}); 
``` 
You can set any number of your custom breakpoints:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'breakpoints':[10,40,70,95]}});
``` 
Log scrolling if page height is at least 3x larger than viewport:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'iflargerthan':300}}); 
```

### Advanced: user activity time tracking ###

By default, the following events are considered as activity: clicks, scrolling, pressing any key on the keyboard, focus. 

By default, activity is considered suspended after 30 seconds of inactivity, or if user has switched/closed the browser tab, or minimized/closed the browser.

```javascript
var _VZLog=new VZlog('/path/to/your/api',['activity']); 
``` 
It's an equivalent to default settings:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'activity':{'on':['pointerdown','scroll','keydown','focus'],'inactivity_period':30}}); 
``` 
You can set any other browser events which will be considered as activity:
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'activity':{'on':['pointermove','pointerdown','pointermove','scroll']}}); 
``` 
You can set the time that elapses from the moment of the last user action before the activity stops being counted. 
```javascript
var _VZLog=new VZlog('/path/to/your/api',{'activity':{'inactivity_period':10}}); 
```
Switching to another tab, minifying or closing the browser will interrupt the activity automatically.

The event is sent to the server as soon as the activity stops. 

To prevent the loss of activity data in various scenarios of closing the browser, current realization (visibilitychange+BeaconAPI) covers >95% cases in modern desktop browsers and 90% in mobile browsers.

In the next versions I'll try to cover the remaining cases, such as a network disconnection or non-obvious behavior of specific browsers. I'm assuming to temporarily save activity data in user's browser (using IndexedDB), so that the data about the activity is sent anyway, if for some reason it was not delivered in real time.


## TBD – what will your server receive? / API requirements

(you will receive JSON)

(Until this block is completed, you can check what is sending in the browser console or by smth like var_dump)