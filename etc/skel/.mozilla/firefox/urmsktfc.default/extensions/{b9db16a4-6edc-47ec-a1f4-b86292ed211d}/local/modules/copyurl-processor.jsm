/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperCopyUrlProcService"];

/**
 * Constants.
 */

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperCopyUrlProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new CopyUrl();
			}
		} catch(e) {
			dump("!!! [CopyUrlProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function CopyUrl() {
	try {
		//dump("[CopyUrl] constructor\n");
		this.init();
	} catch(e) {
		dump("[CopyUrl] !!! constructor: "+e+"\n");
	}
}

CopyUrl.prototype = {
		get name() { return "copyurl"; },
		get provider() { return "DownloadHelper"; },
		get title() { return Util.getText("processor.copyurl.title"); },
		get description() { return Util.getText("processor.copyurl.description"); },
		get enabled() { return true; },
		get weight() { return 200; },
}

CopyUrl.prototype.init=function() {
	try {
		//dump("[CopyUrl] init()\n");
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProcessor(this);
	} catch(e) {
		dump("[CopyUrl] !!! init(): "+e+"\n");
	}
}

CopyUrl.prototype.canHandle=function(desc) {
	//dump("[CopyUrl] canHandle()\n");
	var ch=desc.has("media-url");
	return ch;
}

CopyUrl.prototype.requireDownload=function(desc) {
	//dump("[CopyUrl] requireDownload()\n");
	return false;
}

CopyUrl.prototype.preDownload=function(desc) {
	return true;
}

CopyUrl.prototype.handle=function(desc) {
	//dump("[CopyUrl] handle()\n");
	var mediaUrl=Util.getPropsString(desc,"media-url");
	if(mediaUrl) {
		var str = Components.classes["@mozilla.org/supports-string;1"].
			createInstance(Components.interfaces.nsISupportsString); 
		if (!str) return; 
		str.data = mediaUrl; 
		var trans = Components.classes["@mozilla.org/widget/transferable;1"].
			createInstance(Components.interfaces.nsITransferable);
		if (!trans) return; 
		trans.addDataFlavor("text/unicode"); 
		trans.setTransferData("text/unicode",str,mediaUrl.length * 2); 
		var clipid = Components.interfaces.nsIClipboard; 
		var clip = Components.classes["@mozilla.org/widget/clipboard;1"].
			getService(clipid); 
		if (!clip) return; 
		clip.setData(trans,null,clipid.kGlobalClipboard);
		//dump("[CopyUrl] handle(): to clipboard "+mediaUrl+"\n");
	}
}

CopyUrl.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
