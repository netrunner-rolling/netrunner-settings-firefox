/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperDownloadConvertProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperDownloadConvertProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new DLCProc();
			}
		} catch(e) {
			dump("!!! [DownloadConvertProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function DLCProc() {
	try {
		//dump("[DLCProc] constructor\n");
		this.init();
	} catch(e) {
		dump("[DLCProc] !!! constructor: "+e+"\n");
	}
}

DLCProc.prototype = {
	get name() { return "convert-choice"; },
	get provider() { return "DownloadHelper"; },
	get title() { return Util.getText("processor.convert-choice.title"); },
	get description() { return Util.getText("processor.convert-choice.description"); },
	get enabled() { return true; },
	get weight() { return 500; }
}

DLCProc.prototype.init=function() {
	//dump("[DLCProc] init()\n");
	var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
	        						.getService(Components.interfaces.mozIJSSubScriptLoader);
	jsLoader.loadSubScript("chrome://dwhelper/content/dlproc-helper.js");
	this.helper=new DLProcHelper();
	this.core=Components.classes["@downloadhelper.net/core;1"].
		getService(Components.interfaces.dhICore);
	Components.utils['import']("resource://dwhelper/conversion-manager.jsm");
	this.cvMgr=ConversionManagerService.get();
	this.core.registerProcessor(this);
}

DLCProc.prototype.canHandle=function(desc) {
	//dump("[DLCProc] canHandle()\n");
	if(!this.helper.canHandle(desc))
		return false;
	return true;
	//return this.cvMgr.checkConverter(false);
}

DLCProc.prototype.requireDownload=function(desc) {
	//dump("[DLCProc] requireDownload()\n");
	return this.helper.requireDownload(desc);
}

DLCProc.prototype.preDownload=function(desc) {
	//dump("[DLCProc] preDownload()\n");
	return this.helper.preDownload(desc,true,true);
}

DLCProc.prototype.handle=function(desc) {
	//dump("[DLCProc] handle()\n");
	this.helper.handle(desc,true);
}

DLCProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

