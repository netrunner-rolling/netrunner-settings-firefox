/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperFDLProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperFDLProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new FDLProc();
			}
		} catch(e) {
			dump("!!! [FDLProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function FDLProc() {
	try {
		//dump("[FDLProc] constructor\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		        						.getService(Components.interfaces.mozIJSSubScriptLoader);
		jsLoader.loadSubScript("chrome://dwhelper/content/dlproc-helper.js");
		this.flashGot=null;
		try {
			this.flashGot=Components.classes["@maone.net/flashgot-service;1"].
				getService(Components.interfaces.nsISupports).wrappedJSObject;
			this.core=Components.classes["@downloadhelper.net/core;1"].
				getService(Components.interfaces.dhICore);
			this.core.registerProcessor(this);
		} catch(e) {}

	} catch(e) {
		dump("[FDLProc] !!! constructor: "+e+"\n");
	}
}

FDLProc.prototype = {
	get name() { return "flashgot-download"; },
	get provider() { return "DownloadHelper"; },
	get title() { return Util.getText("processor.flashgot-download.title"); },
	get description() { return Util.getText("processor.flashgot-download.description"); },
	get enabled() { return true; },
}

FDLProc.prototype.canHandle=function(desc) {
	//dump("[FDLProc] canHandle()\n");
	return desc.has("media-url");
}

FDLProc.prototype.requireDownload=function(desc) {
	//dump("[FDLProc] requireDownload()\n");
	return false;
}

FDLProc.prototype.preDownload=function(desc) {
	//dump("[FDLProc] preDownload()\n");
	return false;
}

FDLProc.prototype.handle=function(desc) {
	//dump("[FDLProc] handle()\n");
	var mediaUrl=Util.getPropsString(desc,"media-url");
	var link={
			href: mediaUrl,
			description: "",
			fname: Util.getPropsString(desc,"file-name")
	}
    var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
    		                                .getService(Components.interfaces.nsIWindowMediator);
	var window = windowMediator.getMostRecentWindow("navigator:browser");
	window.gFlashGot.download([link],window.gFlashGotService.OP_ONE,null);
}

FDLProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
