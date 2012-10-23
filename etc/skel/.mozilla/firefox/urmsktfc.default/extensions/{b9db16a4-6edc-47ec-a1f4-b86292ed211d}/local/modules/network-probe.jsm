/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperNetworkProbeService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperNetworkProbeService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new NetProbe();
			}
		} catch(e) {
			dump("!!! [NetworkProbeService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function NetProbe() {
	try {
		//dump("[NetProbe] constructor\n");
		this.init();
	} catch(e) {
		dump("[NetProbe] !!! constructor: "+e+"\n");
	}
}

NetProbe.prototype = {}

NetProbe.prototype.init=function() {
	try {
		//dump("[NetProbe] init\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		
		this.entries={};
		this.updateDone=false;
		this.prefBranch2=this.pref.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefBranch2.addObserver("", this, false);
		this.updateReqExtensions();
		this.updateMediaWeight();
		this.typePattern=new RegExp("^(audio|video)/");
		this.ytSigPattern=/^(http:\/\/(?:[^\/]*youtube\..*|.*origin=[^\/&]*youtube\..*))(?:&|&amp;)signature.*(?:&|&amp;)ip=.*$/;
		Components.utils['import']("resource://dwhelper/medialist-manager.jsm");
		this.listMgr=MediaListManagerService.get();
		this.cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
		                               		.getService(Components.interfaces.nsICacheService);
		this.httpCacheSession = this.cacheService.createSession("HTTP", 
			Components.interfaces.nsICache.STORE_ANYWHERE,
			Components.interfaces.nsICache.STREAM_BASED);
		this.httpCacheSession.doomEntriesIfExpired=false;
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProbe(this);
		this.cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
    		.getService(Components.interfaces.nsICookieManager);
		//cookieManager.remove("."+domain,"VISITOR_INFO1_LIVE","/",false);

	} catch(e) {
		dump("[NetProbe] !!! init: "+e+"\n");
	}
}
	
NetProbe.prototype.handleDocument=function(document,window) {
}

NetProbe.prototype.handleRequest=function(request) {
	//dump("[NetProbe] handleRequest("+request.name+")\n");
	var url=request.name;
	try {
		var cacheTracker=true;
		try {
			cacheTracker=this.pref.getBoolPref("cache-tracker");
		} catch(e) {}
		if(cacheTracker) {

		    var httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
			var wnd=null;
			if(httpChannel.notificationCallbacks) {
				try {
					var notif=httpChannel.notificationCallbacks.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
					wnd=notif.getInterface(Components.interfaces.nsIDOMWindow);
				} catch(e) { }
			}
			if(wnd==null && httpChannel.loadGroup && httpChannel.loadGroup.notificationCallbacks) {
				try {
					var lgNotif=httpChannel.loadGroup.notificationCallbacks.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
					wnd=lgNotif.getInterface(Components.interfaces.nsIDOMWindow);
				} catch(e) {}
			}

			/*
			function checkCacheTracker(url,mediaresp,wnd) {
				mediaresp.checkCacheTracker(url,wnd);			
			}
			setTimeout(checkCacheTracker,0,url,this,wnd);
			*/
			this.checkCacheTracker(url,wnd);
		}
			
	} catch(e) { 
		dump("!!! [NetProbe] handleRequest("+request.name+"): "+e+"\n");		
	}

}

NetProbe.prototype.handleResponse=function(request) {
	try {
		
		//dump("[NetProbe] handleResponse("+request.name+")\n");
	
		var murl=request.name;
	    var httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
	    
		var location=null;
		try {
			location=httpChannel.getResponseHeader("location");
		} catch(e) {}
		if(location) {
			if(this.entries[murl]) {
				delete this.entries[murl];
			}
			return;
		}
	    
		var contentType=null;
		try {
			contentType=httpChannel.getResponseHeader("content-type");
		} catch(e) {}
		var contentLength=null;
		try {
			contentLength=httpChannel.getResponseHeader("content-length");
		} catch(e) {}
		var contentDisp=null;
		try {
			contentDisp=httpChannel.getResponseHeader("content-disposition");
		} catch(e) {}
		
		if(contentLength!=null) {
		
			var tms="100";
			try {
				tms=this.pref.getCharPref("trigger-min-size");
			} catch(e) {}
			tms=parseFloat(tms);
			if(!isNaN(tms)) {
				if(contentLength<tms*1024)
					return;
			}
		}
	
		var wnd=null;
		if(httpChannel.loadGroup && httpChannel.loadGroup.notificationCallbacks) {
			try {
				var lgNotif=httpChannel.loadGroup.notificationCallbacks.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
				wnd=lgNotif.getInterface(Components.interfaces.nsIDOMWindow);
			} catch(e) {}
		}
		if(wnd==null && httpChannel.notificationCallbacks) {
			try {
				var notif=httpChannel.notificationCallbacks.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
				wnd=notif.getInterface(Components.interfaces.nsIDOMWindow);
			} catch(e) {}
		}
	
		var filename=this.analyzeMeta(murl,contentType,contentDisp,contentLength,wnd);
		if(filename!=null) {
	
			var forceCaching=true;
			try {
				forceCaching=this.pref.getBoolPref("force-cache");
			} catch(e) {}
			
			if(forceCaching) {
				httpChannel.setResponseHeader("Cache-Control","max-age="+24*60*60,false);
			}

/*
		    var referer=null;
			try {
				referer=request.getRequestHeader("referer");
			} catch(e) {
			}
*/
		}
	} catch(e) {
		dump("!!! [NetProbe] handleResponse("+request.name+"): "+e+"\n");
	}
}

NetProbe.prototype.checkCacheTracker=function(url,wnd) {
	try {
		var cacheEntryDescriptor=this.httpCacheSession.openCacheEntry(url, 
					Components.interfaces.nsICache.ACCESS_READ, false);
		if(cacheEntryDescriptor && (cacheEntryDescriptor.accessGranted & 1)) {			
				var headers=cacheEntryDescriptor.getMetaDataElement("response-head");
				if(/Location:/i.test(headers)) {
					cacheEntryDescriptor.close();
					return;
				}
	
				var contentType=null;
				try {
					contentType=/Content-Type: *(.*)/i.exec(headers)[1];
				} catch(e) {}
				var contentLength=null;
				try {
					contentLength=/Content-Length: *(.*)/i.exec(headers)[1];
				} catch(e) {}
				var contentDisp=null;
				try {
					contentDisp=/Content-Disposition: *(.*)/i.exec(headers)[1];
				} catch(e) {}
				
				var fn=this.analyzeMeta(url,contentType,contentDisp,contentLength,wnd);
				if(fn!=null) {
					//dump("[MediaResp] checkCacheTracker("+url+"): hit\n");
				}
				cacheEntryDescriptor.close();
			}
	} catch(e) {
		//dump("!!! [NetProbe] checkCacheTracker(): "+e+"\n");
	}		
}

NetProbe.prototype.analyzeMeta = function(murl,contentType,contentDisp,contentLength,wnd) {
    var hit=false;
    var filename=null;
  
	if(contentType!=null && this.typePattern.test(contentType)) {
		var excludeAsf=true;
		try {
			excludeAsf=this.pref.getBoolPref("exclude-ms-asf");
		} catch(e) {}
		if(excludeAsf) {
			if(!/ms-asf$/.test(contentType))
				hit=true;
		} else {
			hit=true;
		}
	}
	
	if(!hit) {
		if(this.reqPattern.test(murl)) {
			hit=true;
		}
	}
	
	if(hit==false && this.mediaWeightEnabled==true) {
		try {
			if(contentLength!=null && isNaN(contentLength)==false && contentLength>=this.mediaWeightThreshold) {
				hit=true;
			}	
		} catch(e) {
		}
	}

	if(hit) {
	
		var extra={};
		filename=this.guessFileName(murl,contentType,contentDisp,wnd,extra);
    
		try {
	
			if(filename.length>64) {
				var parts=/^(.*)(\..*?)$/.exec(filename);
				filename=parts[1].substr(0,64-parts[2].length)+parts[2];
			}
	
			this.entries[murl]={
				url: murl, filename: filename,
				time: new Date().getTime()
				};
	
			var pageUrl=null;
			if(wnd!=null && wnd.document) {
				while(wnd.parent!=null && wnd!=wnd.parent)
					wnd=wnd.parent;
				this.entries[murl].pageUrl=wnd.document.URL;
				pageUrl=wnd.document.URL;
	    	}
			var youtube=/^https?:\/\/(?:[^\/\.]+\.)*youtube\.[^\/]+\/videoplayback/.test(murl);
			if(/^https?:\/\/(?:[^\/\.]+\.)*youtube\.[^\/]+\/ptracking/.test(murl))
				return null;
			var murl1=murl.replace(/^(https?:\/\/(?:[^\/\.]+\.)*youtube\.[^\/]+\/videoplayback.*?)([&\?])?range=[0-9]+\-[0-9]+(&)?(.*)$/,function(match,p1,p2,p3,p4) {
				if(p2.length && p3.length)
					return p1+p2+p4;
				else
					return p1+p4;
			});
			murl1=murl1.replace(/^(https?:\/\/(?:[^\/\.]+\.)*youtube\.[^\/]+\/videoplayback.*?)([&\?])?begin=[0-9]+(&)?(.*)$/,function(match,p1,p2,p3,p4) {
				if(p2.length && p3.length)
					return p1+p2+p4;
				else
					return p1+p4;
			});
			// TODO remove this: test only to cause forbidden access
			/*
			murl1=murl1.replace(/^(https?:\/\/(?:[^\/\.]+\.)*youtube\.[^\/]+\/videoplayback.*?)([&\?])?signature=[^&]+(&)?(.*)$/,function(match,p1,p2,p3,p4) {
				if(p2.length && p3.length)
					return p1+p2+p4;
				else
					return p1+p4;
			});
			*/
			if(murl!=murl1) {
				//dump("Range removed from "+murl+" to "+murl1+"\n");
				murl=murl1;
			}
			var desc=Components.classes["@mozilla.org/properties;1"].
				createInstance(Components.interfaces.nsIProperties);
			Util.setPropsString(desc,"media-url",murl);
			Util.setPropsString(desc,"file-extension",extra.extension);
			Util.setPropsString(desc,"file-name",filename.replace(/[^a-zA-Z0-9\.\- ]/g,"_"));
			Util.setPropsString(desc,"label",filename);
			Util.setPropsString(desc,"page-url",pageUrl);
			Util.setPropsString(desc,"icon-url","chrome://dwhelper/skin/mediaresp.gif");
			Util.setPropsString(desc,"capture-method","network");
	
			if(wnd && wnd.document)
				desc.set("window-document",wnd);
			this.core.addEntry(desc);
	
			try {
				if(/\..{3}$/.test(filename)) {
					var extension=/\.(.{3})$/.exec(filename)[1];
					
					if(extension=="flv" || extension=="mp4") {
						var wnd=null;
						try {
							wnd=httpChannel.notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow);
						} catch(e) {
						}
						var url=null;
						if(wnd!=null && wnd.document!=null)
							url=wnd.document.URL;
						if(!/^http:\/\/[^\/]*downloadhelper.net\/watch\.php/.test(murl)) {
							this.listMgr.addToList("http://downloadhelper.net/1.0#history-list",
									Util.getPropsString(desc,"media-url"),
									Util.getPropsString(desc,"file-extension"),
									Util.getPropsString(desc,"page-url"),
									Util.getPropsString(desc,"file-name"),
									Util.getPropsString(desc,"page-url"));
						}
					}
				}
			} catch(e) {
			}
			
		
		} catch(e) {
			dump("!!! [NetProbe] analyzeMeta: "+e+"\n");
		}

		return filename;
	}
	return null;
}

NetProbe.prototype.updateReqExtensions=function() {
	var exts="flv|ram|mpg|mpeg|avi|rm|wmv|mov|asf|mp3|rar|movie|divx";
	try {
		exts=this.pref.getCharPref("mediareq-extensions");
	} catch(e) {
	}
	this.reqPattern=new RegExp("[/\\?&]([^/\\?&=]+\\.("+exts+"))(?:$|\\?|&|/)");
}

NetProbe.prototype.updateMediaWeight=function() {
	var mediaWeight=""
	try {
		mediaWeight=this.pref.getCharPref("mediaweight");
	} catch(e) {}
	if(mediaWeight.length==0 || isNaN(parseInt(mediaWeight))) {
		this.mediaWeightEnabled=false;		
	} else {
		this.mediaWeightEnabled=true;		
		this.mediaWeightThreshold=parseInt(mediaWeight)*1024;
	}
}

NetProbe.prototype.observe=function(subject,topic,data) {
	if(topic=="nsPref:changed") {
		if(data=="mediareq-extensions")
			this.updateReqExtensions();
		else if(data=="mediaweight")
			this.updateMediaWeight();
	} else if(topic=="quit-application") {
		this.prefBranch2.removeObserver("",this);
		this.observerService.removeObserver(this,"quit-application");
	}
}

NetProbe.prototype.guessFileName=function(murl,contentType,contentDisp,wnd,extra) {
	var filename=null;
	var extension=null;
	if(contentDisp!=null) {
		if(/filename=/.test(contentDisp)) {
			filename=/filename="?([^;"]*)/.exec(contentDisp)[1];
			try {
				extension=/.*\.(.*?)$/.exec(filename)[1];
			} catch(e) {
				extension="";
			}
		}
	}
	if(filename==null) {
		if(contentType!=null && /^video\/x-.*$/.test(contentType)) {
			extension=/video\/x-([^;]*)/.exec(contentType)[1];
		} else if(contentType!=null && /^video\/.+$/.test(contentType)) {
			extension=/video\/([^ ,]*).*$/.exec(contentType)[1];
		} else if(contentType!=null && /^audio\/.+$/.test(contentType)) {
			extension=/audio\/(?:x-)?([^ ,]*).*?$/.exec(contentType)[1];
		} else {
			if(/^[^\?]*\.[0-9a-zA-Z]{1,5}$/.test(murl))
				extension=/\.([0-9a-zA-Z]{1,5})$/.exec(murl)[1];
			else
				extension="flv";
		}

		if(this.pref.getBoolPref("prefer-page-title-as-video-name")) {
			try {
				var title0=null;
				if(wnd) {
					title0=Util.xpGetString(wnd.document.documentElement,
						"/html/head/meta[@name='title']/@content");
					if(title0==null || title0=="")
						title0=Util.xpGetString(wnd.document.documentElement,
							"/html/head/title");
				}
				if(title0!=null && title0.length>0) {
					title0=title0.replace(/&quot;/g,"\"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
					title0=title0.replace(/^[^a-zA-Z0-9]+/,"");
					title0=title0.replace(/[^a-zA-Z0-9]+$/,"");
					filename=title0.replace(/[^a-zA-Z0-9-]+/g,"_")+"."+extension;
				}
			} catch(e) {}
		}
			
		var re=new RegExp("([^/&\\?]+\\."+extension+")(?:$|&|\\?)");
		if(re.test(murl)) {
			var m=re.exec(murl);
			if(filename==null)
				filename=m[1];
		} else if(this.reqPattern.test(murl)) {
			var m=this.reqPattern.exec(murl);
			if(filename==null)
				filename=m[1];
			extension=m[2];
		} else {
			try {
				var title=null;
				if(wnd) {
					title=Util.xpGetString(wnd.document.documentElement,
						"/html/head/meta[@name='title']/@content");
					if(title==null || title=="")
						title=Util.xpGetString(wnd.document.documentElement,
							"/html/head/title");
				}
				if(title) 
					title=Util.resolveNumericalEntities(title);
				if(title==null || title=="")
					title="file-"+Math.floor(Math.random()*1000000000);
				title=title.replace(/&quot;/g,"\"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
				title=title.replace(/^[^a-zA-Z0-9]+/,"");
				title=title.replace(/[^a-zA-Z0-9]+$/,"");
				if(filename==null)
					filename=title.replace(/[^a-zA-Z0-9-]+/g,"_")+"."+extension;
			} catch(e) {
				filename="file-"+Math.floor(Math.random()*1000000000)+"."+extension;
			}
		}
	}
	extra.extension=extension;
	return filename;
}

NetProbe.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProbe) ||
    	iid.equals(Components.interfaces.nsIObserver)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}


