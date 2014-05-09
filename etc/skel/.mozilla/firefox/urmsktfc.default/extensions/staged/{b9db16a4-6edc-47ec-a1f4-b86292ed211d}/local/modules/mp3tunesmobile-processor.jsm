/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperMP3TunesMobileProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperMP3TunesMobileProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new MTMProc();
			}
		} catch(e) {
			dump("!!! [MP3TunesMobileProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function MTMProc() {
	try {
		//dump("[MTMProc] constructor\n");
		this.init();
	} catch(e) {
		dump("[MTMProc] !!! constructor: "+e+"\n");
	}
}

MTMProc.prototype = {
	get name() { return "mp3tunes-mobile"; },
	get provider() { return "MP3Tunes"; },
	get title() { return Util.getText("mp3tunes.mobile-processor.title"); },
	get description() { return Util.getText("mp3tunes.mobile-processor.description"); },
	get enabled() { return this.helper.enabled; },
	get weight() { return 40; },
}

MTMProc.prototype.init=function() {
	try {
		//dump("[MTMProc] init()\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		        						.getService(Components.interfaces.mozIJSSubScriptLoader);
		jsLoader.loadSubScript("chrome://dwhelper/content/mp3tunes/mp3tunes-proc-helper.js");
		
		if(!Util.priorTo19()) {
			this.helper=new MTProcHelper(true);
			this.core=Components.classes["@downloadhelper.net/core;1"].
				getService(Components.interfaces.dhICore);
			this.core.registerProcessor(this);
		}
	} catch(e) {
		dump("[MTMProc] !!! init(): "+e+"\n");
	}	
}

MTMProc.prototype.canHandle=function(desc) {
	//dump("[MTMProc] canHandle()\n");
	return this.helper.canHandle(desc);
}

MTMProc.prototype.requireDownload=function(desc) {
	//dump("[MTMProc] requireDownload()\n");
	return this.helper.requireDownload(desc);
}
	
MTMProc.prototype.preDownload=function(desc) {
	//dump("[MTMProc] preDownload()\n");
	return this.helper.preDownload(desc,false,false);
}

MTMProc.prototype.handle=function(desc) {
	//dump("[MTMProc] handle()\n");
	this.helper.handle(desc,false);
}

MTMProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
