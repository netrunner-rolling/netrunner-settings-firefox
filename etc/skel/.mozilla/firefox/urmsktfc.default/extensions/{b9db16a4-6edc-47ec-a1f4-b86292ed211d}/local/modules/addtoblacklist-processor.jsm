/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperAdd2BLProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperAdd2BLProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new Add2BL();
			}
		} catch(e) {
			dump("!!! [Add2BLProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function Add2BL() {
	try {
		//dump("[Add2BL] constructor\n");
		this.init();
	} catch(e) {
		dump("[Add2BL] !!! constructor: "+e+"\n");
	}
}

Add2BL.prototype = {
		get name() { return "add-to-blacklist"; },
		get provider() { return "DownloadHelper"; },
		get title() { return Util.getText("processor.add2bl.title"); },
		get description() { return Util.getText("processor.add2bl.description"); },
		get enabled() { return true; },
		get weight() { return 150; },
}

Add2BL.prototype.init=function() {
	try {
		//dump("[Add2BL] init()\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProcessor(this);
	} catch(e) {
		dump("[Add2BL] !!! init(): "+e+"\n");
	}
}

Add2BL.prototype.canHandle=function(desc) {
	//dump("[Add2BL] canHandle()\n");
	if(!desc.has("media-url"))
		return false;
	var mediaUrl=Util.getPropsString(desc,"media-url");
	return true;
}

Add2BL.prototype.requireDownload=function(desc) {
	//dump("[Add2BL] requireDownload()\n");
	return false;
}

Add2BL.prototype.preDownload=function(desc) {
	//dump("[Add2BL] preDownload()\n");
	return true;
}

Add2BL.prototype.handle=function(desc) {
	//dump("[Add2BL] handle()\n");
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator);
	var w = wm.getMostRecentWindow("navigator:browser");
	w.openDialog('chrome://dwhelper/content/add-to-blacklist.xul','_blank',"chrome,centerscreen",desc);
}

Add2BL.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

