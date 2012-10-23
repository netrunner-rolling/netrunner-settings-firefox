/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperDownloadProcService"];

/**
 * Constants.
 */

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperDownloadProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new DLProc();
			}
		} catch(e) {
			dump("!!! [DownloadProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}


/**
* Object constructor
*/
function DLProc() {
	try {
		//dump("[DLProc] constructor\n");
		this.init();
	} catch(e) {
		dump("[DLProc] !!! constructor: "+e+"\n");
	}
}

DLProc.prototype = {
	get name() { return "download"; },
	get provider() { return "DownloadHelper"; },
	get title() { return Util.getText("processor.download.title"); },
	get description() { return Util.getText("processor.download.description"); },
	get enabled() { return true; },
	get weight() { return 300; },
}

DLProc.prototype.init=function() {
	try {
		//dump("[DLProc] init()\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		                            	.getService(Components.interfaces.mozIJSSubScriptLoader);
		jsLoader.loadSubScript("chrome://dwhelper/content/dlproc-helper.js");
		this.helper=new DLProcHelper();
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProcessor(this);
	} catch(e) {
		dump("[DLProc] !!! init(): "+e+"\n");
	}	
}

DLProc.prototype.canHandle=function(desc) {
	//dump("[DLProc] canHandle()\n");
	return this.helper.canHandle(desc);
}

DLProc.prototype.requireDownload=function(desc) {
	//dump("[DLProc] requireDownload()\n");
	return this.helper.requireDownload(desc);
}

DLProc.prototype.preDownload=function(desc) {
	//dump("[DLProc] preDownload()\n");
	return this.helper.preDownload(desc,true,false);
}

DLProc.prototype.handle=function(desc) {
	//dump("[DLProc] handle()\n");
	this.helper.handle(desc,true);
}

DLProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

