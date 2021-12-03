## VZlog: ⚡ Light dependency-free user behaivor tracker for web ##

❗ CURRENTLY IS IN ACTIVE DEVELOPMENT ❗

### Main features ###
* VZLog can track user activity on your website and dispatch them to any API;
* VZLog is amazingly small and fast (using beaconAPI, passive:true and other optimizations);
* Set-up can be made by 1 line of code;
* It supports modern SPA-frameworks like React/Vue;
* Current features:
	* track browser data: timezone, language, screen resolution etc;
	* track user activity time:
		* you can track how much time user actually spent on the page doing something
		* you can set actions (events) that will be considered an activity
	* track clicks: 
		* you can track any elements that matches the specified CSS-selectors (e.g. `a, div.class, button[type=submit]`);
		* you can track outbound links (including non-http, e.g. tg://);
		* if click is done by middle mouse button, it also tracks it;
		* your API receives href even if target element doesn't have href but was inside `a`;
		* your API receives unique DOM path of matches element, e.g. `div#content>ul.navbar>li:nth-of-type(3)>a`
	* track scroll: 
		* track when user reaches some breakpoints (e.g. 50%, 90%) if page is big enough (e.g. >150% of viewport)
		* scroll events are sent once per each breakpoint per pageview. If your app is SPA, scroll tracking is reset if location is changed (not taking into account #hash), or you can manually tell VZlog that page was refreshed: `VZlog.newpage()`;
	* VZLog also supports custom events triggered in your code by `VZlog.event('event_name',any_params)`
* Uses non-blocking beackonAPI if available

## How to use ##

### Installation ###
Just download vzlog.js and include it on your pages using `<script src="/path/to/vzlog.js"></script>`.

### Usage: general set-up ###

Activate VZlog and set a path to your API that can collect JSON.
```javascript
var _VZLog=new VZlog('/path/to/your/api');
```
That's all!

With default settings, it tracks:
* user activity time;
* browser data once per user;
* clicks to outbound links (and it's child elements);
* scrolling to breakpoints 50% and 90% of document if page is 1.5x larger than viewport (sends event for each breakpoint only once per page view)

If you want to specify some settings, that's how to:
```javascript
// You can use the defaults:
var _VZLog=new VZlog('/path/to/your/api');
// It's an equivalent to default settings:
var _VZLog=new VZlog('/path/to/your/api',['activity','browser','click','scroll']);

// If you want to change defaults:
var _VZLog=new VZlog('/path/to/your/api',options);
// where options can be null, string, Array or Object.

// Use options as a string if you want to turn on only one feautute with default parameters:
var _VZLog=new VZlog('/path/to/your/api','browser'); // track only browser data (with default parameters)
var _VZLog=new VZlog('/path/to/your/api','click'); // track only clicks (with default parameters)
var _VZLog=new VZlog('/path/to/your/api','scroll'); // track only scroll (with default parameters)

// Use options as an array, if you want to turn on specified features with default parameters:
var _VZLog=new VZlog('/path/to/your/api',['click','scroll']); // track clicks & scroll (with default parameters).

// If options is an object, you can specify parameters of each feature. 
var _VZLog=new VZlog('/path/to/your/api',{'click':params,'scroll':params});
// To use default parameters, set params to true:
var _VZLog=new VZlog('/path/to/your/api',{'click':true,'scroll':true}); // track clicks & scroll (with default parameters)
// It's an equivalent to:
var _VZLog=new VZlog('/path/to/your/api',['click','scroll']);
```

### Usage – click tracking settings ###

```javascript
//By default, it tracks clicks only on outbound links and it's child elements
var _VZLog=new VZlog('/path/to/your/api',['click']); 
// It's an equivalent to default settings:
var _VZLog=new VZlog('/path/to/your/api',{'click':'only_outbound_links'}); 

// Track clicks on the specified CSS-selectors (and it's children):
var _VZLog=new VZlog('/path/to/your/api',{'click':{'on':'a,button.class,button[type=submit]'}}); 
// Or you can specify selectors via Array, it's the same:
var _VZLog=new VZlog('/path/to/your/api',{'click':{'on':['a','button.class','button[type=submit]']}}); 

// Special param: track click ONLY on outbound links (and it's children):
var _VZLog=new VZlog('/path/to/your/api',{'click':['on':'only_outbound_links']}); 

// You can use 'only_outbound_links' in mix with other selectors, but they should be in array, not in one string:
var _VZLog=new VZlog('/path/to/your/api',{'click':['on':['only_outbound_links','span.someclass']]}); 
// Then the following logic will be observed: 
// track clicks to outbound links AND track links to <span> with class 'someclass'.
// But if if span.someclass is placed inside <a> with inbound link (href), it won't be tracked!
```

### Usage – scroll tracking settings ###

```javascript
//By default, it tracks scroll only on breakpouints 50% and 90% and only if page height is at least 1.5x larger than viewport:
var _VZLog=new VZlog('/path/to/your/api',['scroll']); 
// It's an equivalent to default settings:
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'breakpoints':[50,90],'iflargerthan':150}}); 

// You can set any number of your custom breakpoints
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'breakpoints':[10,40,70,95]}});

// Log scrolling if page height is at least 3x larger than viewport:
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'iflargerthan':300}}); 

```

### Usage – user activity time tracking ###

```javascript
//By default, the following events are considered as activity: clicks, scrolling, pressing any key on keybord, focus the document. Activity is considered suspended after 30 seconds of inactivity, or if user has left pr closed the browser tab, or minimized or closed the browser.
var _VZLog=new VZlog('/path/to/your/api',['activity']); 
// It's an equivalent to default settings:
var _VZLog=new VZlog('/path/to/your/api',{'activity':{'on':['pointerdown','scroll','keydown','focus'],'inactivity_period':30}}); 

// You can set any other document events which will be considered as activity:
var _VZLog=new VZlog('/path/to/your/api',{'activity':{'on':['pointerdown'],'inactivity_period':30}}); 

// Log scrolling if page height is at least 3x larger than viewport:
var _VZLog=new VZlog('/path/to/your/api',{'scroll':{'iflargerthan':300}}); 

```




### Compatibility notes ###


This implementation doesn't support old browsers (e.g. IE) due to the use of ES6. 

Latter I'll compile the minified version with ES5 support. Until then you can try to use Babel.