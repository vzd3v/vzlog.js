## VZlog: ⚡ Light dependency-free user behaivor tracker for web ##
❗ CURRENTLY IS IN ACTIVE DEVELOPMENT ❗

* VZLog can track user actions on your website (click, scrolling etc) and dispatches them to any API;
* Set-up can be made by 1 line of code;
* Current features:
	* browser data: timezone, language, screen resolution etc;
	* clicks: 
		* you can track any elements that matches the specified CSS-selectors (e.g. `a, div.class, button[type=submit]`);
		* you can track outbound links (including non-http, e.g. tg://);
		* if click is done by middle mouse button, it also tracks it;
		* your API receives href even if target element doesn't have href but was inside `a`;
		* your API receives unique DOM path of matches element, e.g. `div#content>ul.navbar>li:nth-of-type(3)>a`
	* scroll: track when user reaches some breakpoints (e.g. 60%, 90%) if page is big enough (e.g. >150% of viewport)
	* It supports custom events triggered in your code by `VZlog.event('event_name',params)`
* Uses non-blocking beackonAPI if available

### Installation ###
Just download vzlog.js and include it on your pages using `<script src="/path/to/vzlog.js"></script>`.

### Usage: Front ###

Activate VZlog and set a path to your API that can collect JSON.
```javascript
var _VZLog=new VZlog('/path/to/your/api');
```
By default, it tracks:
* clicks to outbound links & buttons
* scrolling to breakpoints 60% and 90% of document if document is 1.5x larger than viewport

If you want to specify, what to track:
```javascript

// GENERAL
// You can use defaults:
var _VZLog=new VZlog('/path/to/your/api');
// It's turning on tracking of browser data, clicks and scrolling with default parameters.

// If you want to change defaults:
var _VZLog=new VZlog('/path/to/your/api',options);
// where options can be null, string, Array or Object.

//If options is a string, turn on only one feature with default parameters:
var _VZLog=new VZlog('/path/to/your/api','browser'); // track only browser data (with default parameters).
var _VZLog=new VZlog('/path/to/your/api','click'); // track only clicks (with default parameters).
var _VZLog=new VZlog('/path/to/your/api','scroll'); // track only scroll (with default parameters).

// If options is an array, turn on specified features with default parameters:
var _VZLog=new VZlog('/path/to/your/api',['click','scroll']); // track clicks & scroll (with default parameters).

// If options is an object, you can specify parameters of each feature. 
var _VZLog=new VZlog('/path/to/your/api',['click':params,'scroll':params]);
// To use default parameters, set params to true:
var _VZLog=new VZlog('/path/to/your/api',['click':true,'scroll':true]); // track clicks (by default on links) & scrolling


//Defaults params:
var _VZLog=new VZlog('/path/to/your/api',['browser':null,'click':'only_outbound_links','scroll':[60,90]]);


// CLICKS
var _VZLog=new VZlog('/path/to/your/api',['click']); //By default, it tracks clicks only on outbound links 
// It's an equivalent to 
var _VZLog=new VZlog('/path/to/your/api',{'click':'only_outbound_links'}); 

// Track clicks on the specified CSS-selectors (and it's children):
var _VZLog=new VZlog('/path/to/your/api',{'click':'a,button.class,button[type=submit]'}); 
// is equivalent to
var _VZLog=new VZlog('/path/to/your/api',{'click':['a','button.class','button[type=submit]']}); 
// Track click ONLY on outbound links (and it's children):
var _VZLog=new VZlog('/path/to/your/api',{'click':'only_outbound_links'}); 

// SCROLL
var _VZLog=new VZlog('/path/to/your/api',{'scroll'}); 
```

...TBD




### Notes ###


This implementation doesn't support old browsers (e.g. IE) due to the use of ES6.