/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperYouTubeProbeService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperYouTubeProbeService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new YTProbe();
			}
		} catch(e) {
			dump("!!! [YouTubeProbeService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function YTProbe() {
	try {
		//dump("[YTProbe] constructor\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		Components.utils['import']("resource://dwhelper/youtubeinfo-service.jsm");
		this.ytInfo=YouTubeInfoService.get();
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProbe(this);
		try {
			Components.utils['import']("resource://gre/modules/PrivateBrowsingUtils.jsm");
			this.pbUtils=PrivateBrowsingUtils;
		} catch(e) {
			this.pbUtils=null;
		}
	} catch(e) {
		dump("[YTProbe] !!! constructor: "+e+"\n");
	}
}

YTProbe.prototype = {}

YTProbe.prototype.handleDocument=function(document,window) {
	this.ytInfo.handleDocument(document,window);
}


YTProbe.prototype.handleRequest=function(request) {
	this.ytInfo.handleRequest(request);
}
	
YTProbe.prototype.handleResponse=function(request) {
}

YTProbe.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProbe)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

