/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DownloadManagerService"];

/**
 * Constants.
 */
const DHNS = "http://downloadhelper.net/1.0#";

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DownloadManagerService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new DLMgr();
			}
		} catch(e) {
			dump("!!! [DownloadManagerService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function DLMgr() {
	try {
		//dump("[DLMgr] constructor\n");
		this.counters=[];
		this.currents=[];
		this.queuedEntries={};
		this.init();
	} catch(e) {
		dump("[DLMgr] !!! constructor: "+e+"\n");
	}
}

DLMgr.prototype = {
	get queueDatasource() { return this.qDatasource; },
	get downloadMode() { 
		var mode="onebyone";
		try { mode=this.pref.getCharPref("download-mode"); } catch(e) {}
		return mode;
	}
}

DLMgr.prototype.init=function() {
	try {
		//dump("[DLMgr] init()\n");
		var jsLoader=Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		        						.getService(Components.interfaces.mozIJSSubScriptLoader);
		jsLoader.loadSubScript("chrome://global/content/contentAreaUtils.js");
		this.qDatasource=Components.classes['@mozilla.org/rdf/datasource;1?name=in-memory-datasource'].
	      	createInstance(Components.interfaces.nsIRDFDataSource);
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.globalPref=prefService.getBranch("");
	} catch(e) {
		dump("[DLMgr] !!! constructor: "+e+"\n");
	}
}

DLMgr.prototype.download=function(listener,entry,ctx) {
	//dump("[DLMgr] download()\n");
	switch(this.downloadMode) {
		case "normal":
			this.doDownload(listener,entry,ctx);
			break;
		case "onebyone":
		case "controlled":
			this.queueDownload(listener,entry,ctx);
			break;
	}
}

DLMgr.prototype.doDownload=function(listener,entry,ctx) {
	
	try {
	
	//dump("[DLMgr] doDownload()\n");
	var file=null;
	if(entry.has("dl-file")) {
		file=entry.get("dl-file",Components.interfaces.nsIFile);
	} else {
	 	file=Components.classes["@mozilla.org/file/directory_service;1"]
	 	                        .getService(Components.interfaces.nsIProperties)
	 	                        .get("TmpD", Components.interfaces.nsIFile);
	 	if(entry.has("file-name"))
	 		file.append(Util.getPropsString(entry,"file-name"));
	 	else
	 		file.append("dwhelper-dl");
	 	file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
	 	entry.set("dl-file",file);
	}
	
	var url = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
	url.spec = Util.getPropsString(entry,"media-url");
	var fileURL = makeFileURI(file);
	var persist = makeWebBrowserPersist();
	
	const nsIWBP = Components.interfaces.nsIWebBrowserPersist;	
	persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES | nsIWBP.PERSIST_FLAGS_FROM_CACHE;
	persist.persistFlags |= nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
	
	var tr = Components.classes["@mozilla.org/transfer;1"].createInstance(Components.interfaces.nsITransfer);

	var progress=new Progress(tr,this,listener,entry,ctx);

	persist.progressListener = progress;
	
	var referrer=Util.getPropsString(entry,"referrer");
	if(referrer!=null) {
		var refStr=referrer;	
    	referrer = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
    	referrer.spec = refStr;
    }

	var loadContext=null;
	try {
		persist.saveURI(url,null, referrer, null, null,fileURL);
	} catch(e) {
		if(entry.has("loadContext"))
			loadContext=entry.get("loadContext",Components.interfaces.nsIInterfaceRequestor);
		persist.saveURI(url,null, referrer, null, null,fileURL, loadContext);		
	}
	try {
		tr.init(url,fileURL, "", null, null, null, persist);
	} catch(e) {
		var priv=Util.getPropsString(entry,"private");
		if(priv=="yes")
			tr.init(url,fileURL, "", null, null, null, persist, loadContext);
		else
			tr.init(url,fileURL, "", null, null, null, persist, null);
	}

	} catch(e) {
		dump("!!! [DLMgr] doDownload(): "+e+"\n");
	}
}

DLMgr.prototype.queueDownload=function(listener,entry,ctx) {
	//dump("[DLMgr] queueDownload()\n");
	try {
		var dEntry=Util.createAnonymousNodeS(this.qDatasource,"urn:root");
		Util.setPropsString(entry,"download-node-value",dEntry.Value);
		//dump("[DLMgr] queued "+dEntry.Value+"\n");
		var label;
		if(entry.has("cv-file")) {
			label=entry.get("cv-file",Components.interfaces.nsILocalFile).leafName;
		} else if(entry.has("dl-file")) {
			label=entry.get("dl-file",Components.interfaces.nsILocalFile).leafName;
		} else {
			label=Util.getPropsString(entry,"label")
		}
		Util.setPropertyValueRS(this.qDatasource,dEntry,DHNS+"label",label);
		Util.setPropertyValueRS(this.qDatasource,dEntry,DHNS+"status","queued");
		this.queuedEntries[dEntry.Value]={
				listener: listener,
				entry: entry,
				ctx: ctx
		}
		this.checkTransfer();	
	} catch(e) {
		dump("!!! [DLMgr] queueDownload(): "+e+"\n");
	}
}

DLMgr.prototype.checkTransfer=function() {
	//dump("[DLMgr] checkTransfer()\n");
	var maxDL=1;
	if(this.downloadMode=="controlled") {
		maxDL=this.pref.getIntPref("download.controlled.max");
		if(maxDL<1) {
			maxDL=1;
			this.pref.setIntPref("download.controlled.max",maxDL);
		}
	}
	var entries=Util.getChildResourcesS(this.qDatasource,"urn:root",{});
	while(this.currents.length<maxDL && entries.length>0) {
		var dEntry=null;
		for(var i in entries) {
			var status=Util.getPropertyValueRS(this.qDatasource,entries[i],DHNS+"status");
			if(status=="queued") {
				dEntry=entries[i];
				break;
			}
		}
		if(dEntry==null)
			break;
		var data=this.queuedEntries[dEntry.Value];
		Util.setPropertyValueRS(this.qDatasource,dEntry,DHNS+"status","downloading");
		//dump("[DLMgr] starting "+dEntry.Value+"\n");
		this.doDownload(data.listener,data.entry,data.ctx);
		this.currents.push(dEntry.Value);
	}
	var count=entries.length;
	for(var i in this.counters) {
		if(count==0) {
			this.counters[i].setAttribute("value","");
			this.counters[i].collapsed=true;
		} else {
			this.counters[i].setAttribute("value","("+count+")");
			this.counters[i].collapsed=false;
		}
	}
}

DLMgr.prototype.transferDone = function(status,request,listener,entry,ctx) {
	//dump("[DLMgr] transferDone()\n");

	var code=0;
	try {
		var hc=request.QueryInterface(Components.interfaces.nsIHttpChannel);
		code=hc.responseStatus;
	} catch(e) {}

	try {

		if(status==0 && code==200)
			this.incrementDownloadCount();
		else
			dump("!! [DLMgr] transferDone: "+code+" status "+status+"\n");
		
		var nodeValue=Util.getPropsString(entry,"download-node-value");
		
		//dump("[DLMgr] done "+nodeValue+"\n");
		delete this.queuedEntries[nodeValue];
	
		Util.removeChildSS(this.qDatasource,"urn:root",nodeValue);
		Util.removeReferenceS(this.qDatasource,nodeValue);			

		for(var i in this.currents) {
			if(this.currents[i]==nodeValue) {
				//dump("[DLMgr] purged "+nodeValue+"\n");
				this.currents.splice(i,1);
				break;
			}
		}
		
		if(status==0)
			this.checkYTTransfer(entry);

		this.checkTransfer();
	
	} catch(e) {
		dump("!!! [DLMgr] transferDone(): "+e+"\n");
	}

	try {
		if(listener)
			listener.downloadFinished(status,request,entry,ctx);
	} catch(e) {
		dump("!!! [DLMgr] transferDone()/downloadFinished(): "+e+"\n");
	}
}

DLMgr.prototype.checkYTTransfer = function(entry) {
	try {
		if(entry.has("dl-file")) {
			var file=entry.get("dl-file",Components.interfaces.nsIFile);
			if(file.exists()==false || file.fileSize==0) {
				var pageUrl=Util.getPropsString(entry,"page-url");
				if(pageUrl!=null && /http:\/\/[^\/]*youtube\./.test(pageUrl)) {
					var notAgain={value: false};
					var promptService=Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
					var fileName=Util.getPropsString(entry,"file-name");
					var cookieBehavior=this.globalPref.getIntPref("network.cookie.cookieBehavior");
					if(cookieBehavior==1 || cookieBehavior==2) {
						if(this.pref.getBoolPref("yt-cookies.warning")==false)
							return;
						promptService.alertCheck(null,
								Util.getText("error.yt-cookies.title"),
								Util.getFText("error.yt-cookies.text",[fileName],1),
								Util.getText("error.yt-cookies.not-again"),
								notAgain
								);
						if(notAgain.value==true)
							this.pref.setBoolPref("yt-cookies.warning",false);
					} else if(this.pref.getCharPref("yt-visitor-cookie")=="ask") {
						try {
							if(this.pref.getBoolPref("yt-cookies2.warning")==false)
								return;
							var domain=/https?:\/\/(?:[^\/\.]+\.)*(youtube\.[^\/]+)/.exec(pageUrl)[1];
							var clearCookie=promptService.confirmCheck(null,
									Util.getText("error.yt-cookies.title"),
									Util.getFText("error.yt-cookies2.text",[fileName,domain],2),
									Util.getText("error.yt-cookies.not-again"),
									notAgain
									);
							if(notAgain.value==true)
								this.pref.setBoolPref("yt-cookies2.warning",false);
							if(clearCookie) {
								var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
			                    	.getService(Components.interfaces.nsICookieManager);
								cookieManager.remove("."+domain,"VISITOR_INFO1_LIVE","/",false);
							}
						} catch(e) {
							dump("!!! [DLMgr] checkYTTransfer()/cookie2: "+e+"\n");
						}
					}
				}
			}
		}
	} catch(e) {
		dump("!!! [DLMgr] checkYTTransfer(): "+e+"\n");
	}	
}

DLMgr.prototype.incrementDownloadCount = function() {
	var dwcount=0;
	try {
		dwcount=this.pref.getIntPref("download-count");
	} catch(e) {
	}
	dwcount++;
	this.pref.setIntPref("download-count",dwcount);
	if(dwcount%100==0) {
		this.donate(dwcount);
	}
	if(this.pref.getBoolPref("disable-dwcount-cookie")==false) {
		try {
			var cMgr = Components.classes["@mozilla.org/cookiemanager;1"].
	           getService(Components.interfaces.nsICookieManager2);
	        try {
				cMgr.add(".downloadhelper.net","/","dwcount",""+dwcount,false,true,new Date().getTime()/1000+10000000);
				cMgr.add(".vidohe.com","/","dwcount",""+dwcount,false,true,new Date().getTime()/1000+10000000);
			} catch(e) {
				cMgr.add(".downloadhelper.net","/","dwcount",""+dwcount,false,true,false,new Date().getTime()/1000+10000000);
				cMgr.add(".vidohe.com","/","dwcount",""+dwcount,false,true,false,new Date().getTime()/1000+10000000);
			}
		} catch(e) {
			dump("!!! [DhDownloadMgr] incrementDownloadCount() "+e+"\n");
		}
	}
}

DLMgr.prototype.donate=function(count) {
	if(this.pref.getBoolPref("donate-not-again"))
		return;
	try {
		Components.utils['import']("resource://dwhelper/conversion-manager.jsm");
		var cvMgr=ConversionManagerService.get();
		var cvInfo=cvMgr.getInfo();
		if(cvInfo.get("windows",Components.interfaces.nsISupportsPRBool).data==true &&
				cvInfo.get("unregistered",Components.interfaces.nsISupportsPRBool).data==false)
			return; // don't request donation to those who have a license
	} catch(e) {}
    var options="chrome,centerscreen";
    try {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Components.interfaces.nsIWindowMediator);
		var w = wm.getMostRecentWindow("navigator:browser");
	    w.open('chrome://dwhelper/content/donate.xul','dwhelper-dialog',options);
	} catch(e) {
		dump("!!! [DhDownloadMgr] donate() "+e+"\n");
	}
}

DLMgr.prototype.getDefaultDir=function() {
	var file=null;
	try {
		file = Components.classes["@mozilla.org/file/directory_service;1"]
	                     .getService(Components.interfaces.nsIProperties)
	                     .get("Home", Components.interfaces.nsIFile);
	} catch(e) {
    	try {
			file=Components.classes["@mozilla.org/file/directory_service;1"]
		    	.getService(Components.interfaces.nsIProperties)
		        .get("TmpD", Components.interfaces.nsIFile);
		} catch(e) {
		}
	}
	if(!file.exists()) {
		throw(DWHUtil.getText("error.nohome"));
	}
	file.append("dwhelper");
	return file;
}

DLMgr.prototype.getDownloadDirectory=function() {

	var fileName=Util.getUnicharPref(this.pref,"storagedirectory",null);
	
	var file;
	if(fileName==null || fileName.length==0) {
		file=this.getDefaultDir();
	} else {
		try {
		    file=Components.classes["@mozilla.org/file/local;1"].
		        createInstance(Components.interfaces.nsILocalFile);
		    file.initWithPath(fileName);
		    if(file.exists()==false || file.isWritable()==false || file.isDirectory()==false)
		    	file=this.getDefaultDir();
		} catch(e) {
	    	file=this.getDefaultDir();
		}
	}
	if(!file.exists()) {
		file.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
	}
	Util.setUnicharPref(this.pref,"storagedirectory",file.path);
	return file;
}

DLMgr.prototype.setDownloadDirectory=function(fileDir) {
	if(!fileDir.isDirectory())
		fileDir=fileDir.parent;
	Util.setUnicharPref(this.pref,"storagedirectory",fileDir.path);
}

DLMgr.prototype.removeFromQueue=function(entries,length) {
	for(var i in entries) {
		var entry=entries[i];
		var status=Util.getPropertyValueRS(this.qDatasource,entry,DHNS+"status");
		if(status=="queued") {
			delete this.queuedEntries[entry.Value]
			Util.removeChildSR(this.qDatasource,"urn:root",entry);
			Util.removeReference(this.qDatasource,entry);			
		}
	}
}

DLMgr.prototype.registerCounter = function(counter) {
	//dump("[DLMgr] registerCounter()\n");
	this.counters.push(counter);
}

DLMgr.prototype.unregisterCounter = function(counter) {
	//dump("[DLMgr] unregisterCounter()\n");
	for(var i in this.counters) {
		if(this.counters[i]==counter) {
			this.counters.splice(i,1);
			break;
		}
	}
}

DLMgr.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIDownloadMgr)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

/*---------------------------------------------------------------------------------------*/

function Progress(tr,observer,listener,entry,ctx) {
	this.tr=tr;
	this.observer=observer;
	this.listener=listener;
	this.entry=entry;
	this.ctx=ctx;
}

Progress.prototype.onLocationChange=function(webProgress, request, location ) {
	this.tr.onLocationChange(webProgress, request, location);
}

Progress.prototype.onProgressChange=function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress ) {
	try {
		this.tr.onProgressChange(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress );
	} catch(e) {}
}

Progress.prototype.onSecurityChange=function(webProgress, request, state ) {
	this.tr.onSecurityChange(webProgress, request, state );
}

Progress.prototype.onStateChange=function(webProgress, request, stateFlags, status ) {
	this.tr.onStateChange(webProgress, request, stateFlags, status );
	if(stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
		this.observer.transferDone(status,request,this.listener,this.entry,this.ctx);
	}
}

Progress.prototype.onStatusChange=function(webProgress, request, status, message ) {
	this.tr.onStatusChange(webProgress, request, status, message );
}

