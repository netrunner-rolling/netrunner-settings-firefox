/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperQuickDownloadProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperQuickDownloadProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new QDLProc();
			}
		} catch(e) {
			dump("!!! [QuickDownloadProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function QDLProc() {
	try {
		//dump("[QDLProc] constructor\n");
		this.init();
	} catch(e) {
		dump("[QDLProc] !!! constructor: "+e+"\n");
	}
}

QDLProc.prototype = {
	get name() { return "quick-download"; },
	get provider() { return "DownloadHelper"; },
	get title() { return Util.getText("processor.quick-download.title"); },
	get description() { return Util.getText("processor.quick-download.description"); },
	get enabled() { return true; },
	get weight() { return 400; },
}

QDLProc.prototype.init=function() {
	try {
		//dump("[QDLProc] init()\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		        						.getService(Components.interfaces.mozIJSSubScriptLoader);
		jsLoader.loadSubScript("chrome://dwhelper/content/dlproc-helper.js");
		this.helper=new DLProcHelper();
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProcessor(this);
	} catch(e) {
		dump("[QDLProc] !!! init(): "+e+"\n");
	}
}

QDLProc.prototype.canHandle=function(desc) {
	//dump("[QDLProc] canHandle()\n");
	return this.helper.canHandle(desc);
}

QDLProc.prototype.requireDownload=function(desc) {
	//dump("[QDLProc] requireDownload()\n");
	return this.helper.requireDownload(desc);
}
	
QDLProc.prototype.preDownload=function(desc) {
	//dump("[QDLProc] preDownload()\n");
	return this.helper.preDownload(desc,false,false);
}

QDLProc.prototype.handle=function(desc) {
	//dump("[QDLProc] handle()\n");
	this.helper.handle(desc,false);
}

QDLProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
