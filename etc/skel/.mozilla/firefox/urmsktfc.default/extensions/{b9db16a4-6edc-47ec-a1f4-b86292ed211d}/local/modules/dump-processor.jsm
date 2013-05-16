/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperDumpProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperDumpProcService = {
	mProcessor: null,
	start: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new DumpProc();
			}
		} catch(e) {
			dump("!!! [DumpProcService] "+e+"\n");
		}
	}
}


/**
* Object constructor
*/
function DumpProc() {
	try {
		//dump("[DumpProc] constructor\n");

		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		var dpe=false;
		try {
			dpe=this.pref.getBoolPref("dump-processor-enable");
		} catch(e) {}
		if(dpe) {
			this.core=Components.classes["@downloadhelper.net/core;1"].
				getService(Components.interfaces.dhICore);
			this.core.registerProcessor(this);
		}
	} catch(e) {
		dump("[DumpProc] !!! constructor: "+e+"\n");
	}
}

DumpProc.prototype = {
		get name() { return "dump"; },
		get provider() { return "DownloadHelper"; },
		get title() { return Util.getText("processor.dump.title"); },
		get description() { return Util.getText("processor.dump.description"); },
		get enabled() { return true; },
		get weight() { return 600; },
}

DumpProc.prototype.canHandle=function(desc) {
	//dump("[DumpProc] canHandle()\n");
	return true;
}

DumpProc.prototype.requireDownload=function(desc) {
	//dump("[DumpProc] requireDownload()\n");
	return false;
}

DumpProc.prototype.preDownload=function(desc) {
	//dump("[DumpProc] preDownload()\n");
	return true;
}

DumpProc.prototype.handle=function(desc) {
	//dump("[DumpProc] handle()\n");
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator);
	var w = wm.getMostRecentWindow("navigator:browser");
	w.openDialog('chrome://dwhelper/content/dump-media.xul','_blank',"chrome,centerscreen",desc);
}

DumpProc.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
