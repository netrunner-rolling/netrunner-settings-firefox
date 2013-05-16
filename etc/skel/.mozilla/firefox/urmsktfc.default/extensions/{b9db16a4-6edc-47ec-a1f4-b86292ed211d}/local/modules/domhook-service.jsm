/******************************************************************************
 *            Copyright (c) 2009-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DOMHookService"];

/**
 * Constants.
 */

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DOMHookService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new Hook();
			}
		} catch(e) {
			dump("!!! [DOMHookService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function Hook() {
	try {
		//dump("[Hook] constructor\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
	} catch(e) {
		dump("[Hook] !!! constructor: "+e+"\n");
	}
}

Hook.prototype = {}

Hook.prototype.hook=function(document,window) {
	//dump("[Hook] hook("+document.URL+")\n");
	try {
		var ytInPage=this.pref.getBoolPref("yt-inpage");
		if(ytInPage) {
			this.ytHook(document,window);
		}
	} catch(e) {
		dump("!!! [Hook] hook("+document.URL+"): "+e+"\n");
	}
}

Hook.prototype.ytHook=function(document,window) {
	if(/^https?:\/\/(?:[a-z]+\.)?youtube\.com\//.test(document.URL)) {
		//dump("[Hook] hook(): YouTube page\n");
		var titleH1=Util.xpGetSingleNode(document.documentElement,".//div[@id='watch-vid-title']/h1");
		if(!titleH1) {
			titleH1=Util.xpGetSingleNode(document.documentElement,".//h1[@id='watch-headline-title']");
		}
		if(!titleH1) {
			//dump("!!! [Hook] hook(): title not found\n");
			return;
		}
		
		var img=this.createXULElement(document,window,"toolbarbutton");
		img.setAttribute("image","http://www.downloadhelper.net/favicon.ico");
		img.setAttribute("type","menu-button");
		img.style.margin="0px 12px 0px 0px";
		img.style.position="relative";
		titleH1.style.paddingBottom="8px";
		var span=Util.xpGetSingleNode(titleH1,".//span");
		if(span) {
			span.style.verticalAlign="top";
		}
		
		var menupopup=this.createXULElement(document,window,"menupopup");
		menupopup.setAttribute("position","end_before");
		img.appendChild(menupopup);

		function Listener(core,document,processor) {
			this.core=core;
			this.document=document;
			this.processor=processor;
		}
		Listener.prototype={
			handleEvent: function(event) {
				var i=this.core.getEntries().enumerate();
				while(i.hasMoreElements()) {
					var entry=i.getNext().QueryInterface(Components.interfaces.nsIProperties);
					if(entry.has("document") && entry.has("capture-method") && 
							Util.getPropsString(entry,"capture-method")=="youtube-hq" &&
							entry.get("document",Components.interfaces.nsIDOMDocument)==this.document) {
						this.core.processEntry(this.processor,entry);
						break;
					}
				}
				event.stopPropagation(); 
			},
		}

		var defProcName=this.pref.getCharPref("yt-inpage.default-processor");
		var defProcessor=null;
		
		var i=this.core.getProcessors().enumerate();
		while(i.hasMoreElements()) {
			var processor=i.getNext().QueryInterface(Components.interfaces.dhIProcessor);
			if(processor.name==defProcName)
				defProcessor=processor;
			var menuitem=this.createXULElement(document,window,"menuitem");
			menuitem.setAttribute("label",processor.title);
			menuitem.setAttribute("tooltiptext",processor.description);
			menuitem.QueryInterface(Components.interfaces.nsIDOMEventTarget).
				addEventListener("command",new Listener(this.core,document,processor),false,false);
			menupopup.appendChild(menuitem);
		}
		if(defProcessor)
			img.QueryInterface(Components.interfaces.nsIDOMEventTarget).
				addEventListener("command",new Listener(this.core,document,defProcessor),false,false);
		titleH1.insertBefore(img,titleH1.firstChild);
		img.style.MozBoxAlign="baseline";
		var nodes=document.getAnonymousNodes(img);
		for(var i=0;i<nodes.length;i++) {
			var node=nodes[i];
			node.style.padding="0";
			node.style.margin="0";
		}
	}
}

Hook.prototype.createXULElement=function(document,window,tag) {
	var xulNS="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";		
	if(Util.priorTo20()) {
		var element=document.createElementNS(xulNS,"xul:"+tag);
		return element;
	} else {
		var element=window.document.createElementNS(xulNS,"xul:"+tag);
		return document.importNode(element,true);		
	}
}

Hook.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIDOMHook)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
