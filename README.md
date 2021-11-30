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

### Installation ###
Just download vzlog.js and include it on your pages using `<script src="/path/to/vzlog.js"></script>`.

### Usage ###

Activate VZlog and set a path to your API that can collect JSON.
```javascript
var _VZLog=new VZlog('/path/to/your/api');
```
By default, it tracks:
* clicks to all links 
* scrolling to breakpoints 60% and 90% of document if document is 1.5x larger than viewport

...TBD

### Notes ###


This implementation doesn't support old browsers (e.g. IE) due to the use of ES6.