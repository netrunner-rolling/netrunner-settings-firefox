/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperMP3TunesLockerProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperMP3TunesLockerProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new MTLProc();
			}
		} catch(e) {
			dump("!!! [MP3TunesLockerProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function MTLProc() {
	try {
		//dump("[MTLProc] constructor\n");
		this.init();
	} catch(e) {
		dump("[MTLProc] !!! constructor: "+e+"\n");
	}
}

MTLProc.prototype = {
	get name() { return "mp3tunes-locker"; },
	get provider() { return "MP3Tunes"; },
	get title() { return Util.getText("mp3tunes.locker-processor.title"); },
	get description() { return Util.getText("mp3tunes.locker-processor.description"); },
	get enabled() { return this.helper.enabled; },
	get weight() { return 50; },
}

MTLProc.prototype.init=function() {
	try {
		//dump("[MTLProc] init()\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		        						.getService(Components.interfaces.mozIJSSubScriptLoader);
       	jsLoader.loadSubScript("chrome://dwhelper/content/mp3tunes/mp3tunes-proc-helper.js");
		if(!Util.priorTo19()) {
			this.helper=new MTProcHelper(false);
			this.core=Components.classes["@downloadhelper.net/core;1"].
				getService(Components.interfaces.dhICore);
			this.core.registerProcessor(this);
		}
	} catch(e) {
		dump("[MTLProc] !!! init: "+e+"\n");
	}
}

MTLProc.prototype.canHandle=function(desc) {
	//dump("[MTLProc] canHandle()\n");
	return this.helper.canHandle(desc);
}

MTLProc.prototype.requireDownload=function(desc) {
	//dump("[MTLProc] requireDownload()\n");
	return this.helper.requireDownload(desc);
}
	
MTLProc.prototype.preDownload=function(desc) {
	//dump("[MTLProc] preDownload()\n");
	return this.helper.preDownload(desc,false,false);
}

MTLProc.prototype.handle=function(desc) {
	//dump("[MTLProc] handle()\n");
	this.helper.handle(desc,false);
}

MTLProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

