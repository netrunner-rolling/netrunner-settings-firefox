/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperMediaLinkProbeService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperMediaLinkProbeService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new MLProbe();
			}
		} catch(e) {
			dump("!!! [MediaLinkProbeService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function MLProbe() {
	try {
		//dump("[MLProbe] constructor\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                       			.getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.mediaPattern="jpg|jpeg|gif|png|mpg|mpeg|avi|rm|wmv|mov|flv";
		this.minFileCount=2;
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProbe(this);
	} catch(e) {
		dump("[MLProbe] !!! constructor: "+e+"\n");
	}
}

MLProbe.prototype = {}

MLProbe.prototype.handleDocument=function(document,window) {
	try {
		//dump("[MLProbe] handleDocument("+document.URL+")\n");

		var medialinkEnabled=true;
		try {
			medialinkEnabled=this.pref.getBoolPref("enable-medialink-method");
		} catch(e) {
		}
		if(medialinkEnabled==false)
			return;

		var dom=document.documentElement;
		var classes={};
		var allHRefs={};
		var mediaNodes=[];
		var hitCount=0;
		var hitCountMax=this.pref.getIntPref("medialink-max-hits");
		var aNodes=Util.xpGetNodes(dom,".//a[@href]",{});
		for(var i=0;i<aNodes.length;i++) {
			var aNode=aNodes[i];
			var href=aNode.getAttribute("href");
			if(allHRefs[href]!=null)
				continue;
			allHRefs[href]="";
			var mediaPattern=this.mediaPattern;
			try {
				mediaPattern=this.pref.getCharPref("medialink-extensions");
			} catch(e) {}
			var mPatt=new RegExp("^.*\\.(?:"+mediaPattern+")$","i");
			if(mPatt.exec(href)==null)
				continue;
			mediaNodes.push(aNode);
			
			var hrefParts=/^(.*[^0-9])?([0-9]+)([^\/]*?\.[^\/]*?)$/.exec(href);
			if(hrefParts!=null && hrefParts.length==4) {
				if(hrefParts[1]==undefined)
					hrefParts[1]="";
				var key=hrefParts[1]+"$$$"+hrefParts[3];
				var group=classes[key];
				if(group==null) {
					group={
						nodes: [],
						ext: /.*\.(.*?)$/.exec(hrefParts[3])[1],
					};
					classes[key]=group;
				}
				var classNodes=group.nodes;
				classNodes.push(aNode);
			}
			hitCount++;
			if(isNaN(hitCountMax)==false && hitCountMax>0 && hitCount>=hitCountMax)
				break;
		}
		this.groups=[];
		var groupIndex=0;
		var maxNodeCount=0;
		for(var i in classes) {
			var group=classes[i];
			var classNodes=group.nodes;
			if(maxNodeCount<classNodes.length)
				maxNodeCount=classNodes.length;
			if(classNodes.length>=this.minFileCount) {
				var desc=this.getDesc(document,group.ext+" ("+classNodes.length+")",group.nodes)
				this.core.addEntryForDocument(desc,document,window);
			}
		}
		if(maxNodeCount<mediaNodes.length) {
			var desc=this.getDesc(document,Util.getText("menu.alllinkstomedia")+" ("+mediaNodes.length+")",mediaNodes);
			this.core.addEntryForDocument(desc,document,window);
		}
		return;
	} catch(e) {
		dump("!!! [MLProbe] handleDocument("+document.URL+"): "+Util.exceptionDesc(e)+"\n");
	}
}

MLProbe.prototype.getDesc = function(document,label,nodes) {
	var desc=Components.classes["@mozilla.org/properties;1"].
		createInstance(Components.interfaces.nsIProperties);
	Util.setPropsString(desc,"page-url",document.URL);
	Util.setPropsString(desc,"referrer",document.URL);
	Util.setPropsString(desc,"label",label);				
	Util.setPropsString(desc,"icon-url","chrome://dwhelper/skin/medialink.gif");
	Util.setPropsString(desc,"capture-method","medialink");
	Util.setPropsString(desc,"sn-preserve-label","yes");
	desc.set("mouse-listener",this);
	
	var fdescs=Components.classes["@mozilla.org/array;1"].
		createInstance(Components.interfaces.nsIMutableArray);
	desc.set("links",fdescs);
	for(var j=0;j<nodes.length;j++) {
		var node=nodes[j];
		var ndesc=Components.classes["@mozilla.org/properties;1"].
			createInstance(Components.interfaces.nsIProperties);
		var href=node.getAttribute("href");
	    var url = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
		url.spec = document.URL;
		var urlStr=url.resolve(href);
		Util.setPropsString(ndesc,"media-url",urlStr);
		ndesc.set("node",node);
		fdescs.appendElement(ndesc,false);
	}
	return desc;
}

MLProbe.prototype.mouseOver = function(desc) {
	//dump("[MLProbe] mouseOver()\n");
	try {
		if(desc.has("links")) {
			var links=desc.get("links",Components.interfaces.nsIArray);
			var i=links.enumerate();
			while(i.hasMoreElements()) {
				var ndesc=i.getNext().QueryInterface(Components.interfaces.nsIProperties);
				if(ndesc.has("node")) {
					var aNode=ndesc.get("node",Components.interfaces.nsIDOMNode);
					var oldBorder=aNode.style.border;
					aNode.setAttribute("dwhelper-border",oldBorder);
					aNode.style.border="5px dashed Red";
					var oldDisplay=aNode.style.display;
					aNode.setAttribute("dwhelper-display",oldDisplay);
					aNode.style.display="block";
				}
			}
		}
	} catch(e) {
		dump("!!! [MLProbe] mouseOver(): "+Util.exceptionDesc(e)+"\n");
	}
}

MLProbe.prototype.mouseOut = function(desc) {
	//dump("[MLProbe] mouseOut()\n");
	try {
		if(desc.has("links")) {
			var links=desc.get("links",Components.interfaces.nsIArray);
			var i=links.enumerate();
			while(i.hasMoreElements()) {
				var ndesc=i.getNext().QueryInterface(Components.interfaces.nsIProperties);
				if(ndesc.has("node")) {
					var aNode=ndesc.get("node",Components.interfaces.nsIDOMNode);
					var oldBorder=aNode.getAttribute("dwhelper-border");
					aNode.style.border=oldBorder;
					var oldDisplay=aNode.getAttribute("dwhelper-display");
					aNode.style.display=oldDisplay;
				}
			}
		}
	} catch(e) {
		dump("!!! [MLProbe] mouseOut(): "+Util.exceptionDesc(e)+"\n");
	}
}

MLProbe.prototype.handleRequest=function(request) {
}
	
MLProbe.prototype.handleResponse=function(request) {
}
	
MLProbe.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProbe) ||
    	iid.equals(Components.interfaces.dhIProbeMouseListener)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

