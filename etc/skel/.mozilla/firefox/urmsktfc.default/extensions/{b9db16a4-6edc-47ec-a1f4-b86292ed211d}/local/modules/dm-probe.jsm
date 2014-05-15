/******************************************************************************
 *            Copyright (c) 2006-2013 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperDMProbeService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperDMProbeService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new DMProbe();
			}
		} catch(e) {
			dump("!!! [DMProbeService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function DMProbe() {
	try {
		//dump("[YTProbe] constructor\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.core.registerProbe(this);
		try {
			Components.utils['import']("resource://gre/modules/PrivateBrowsingUtils.jsm");
			this.pbUtils=PrivateBrowsingUtils;
		} catch(e) {
			this.pbUtils=null;
		}
	} catch(e) {
		dump("[YTProbe] !!! constructor: "+e+"\n");
	}
}

DMProbe.prototype = {}

DMProbe.prototype.handleDocument=function(document,window) {
	try {
		var $this=this;
		if(/^https?:\/\/([^\.\/]+\.)?dailymotion(\.co)?\.([^\.\/]+)\//.test(document.URL)) {
			//dump("DMProbe handleDocument "+document.URL+"\n");
			function AddMedia(url,label,fileName,extension,icon) {
				//dump("AddMedia "+label+" "+url+"\n");
				var desc=Components.classes["@mozilla.org/properties;1"].
					createInstance(Components.interfaces.nsIProperties);
				Util.setPropsString(desc,"page-url",document.URL);
				Util.setPropsString(desc,"label",label);
				Util.setPropsString(desc,"base-name",fileName);
				Util.setPropsString(desc,"capture-method","dm");
				Util.setPropsString(desc,"icon-url",icon);
				Util.setPropsString(desc,"media-url",url);
				Util.setPropsString(desc,"file-name",fileName+"."+extension);
				Util.setPropsString(desc,"file-extension",extension);
				try {
					if($this.pbUtils) {
						if($this.pbUtils.privacyContextFromWindow)
							desc.set("loadContext", $this.pbUtils.privacyContextFromWindow(window));
						Util.setPropsString(desc,"private",$this.pbUtils.isWindowPrivate(window)?"yes":"no");
					}
				} catch(e) {
					dump("!!! [DMProbe] setting loadContext: "+e+"\n");
				}
				$this.core.addEntryForDocument(desc,document,window);
			}
			function FindMedia() {
				try {
					var metaElements;
					try {
						metaElements=document.head.getElementsByTagName("meta");
					} catch(e) {
						return false;
					}
					for(var i=0;i<metaElements.length;i++) {
						var metaElement=metaElements[i];
						var metaName=metaElement.getAttribute("name");
						if(metaName=="twitter:player") {
							try {
								var videoId=/([^\/]+)$/.exec(metaElement.getAttribute("value"))[1];
								RequestVideoInfo(videoId);
								return true;
							} catch(e) {}
						}
					}
					var m=/video=([^\?&\/#]+)/.exec(document.URL);
					if(m) {
						try {
							var videoId=m[1];
							RequestVideoInfo(videoId);
							return true;
						} catch(e) {}						
					}
				} catch(e) {
					dump("!!! [DMProbe] handleDocument/FindMedia: "+e+"\n"+e.fileName+":"+e.lineNumber+"\n");
				}
				return false;
			}
			function RequestVideoInfo(videoId) {
				var icon="";
				var baseFileName="video";
				var links=document.getElementsByTagName("link");
				for(var u=0;u<links.length;u++) {
					var link=links[u];
					if(link.getAttribute("rel")=="shortcut icon")
						icon=link.getAttribute("href");
					if(link.getAttribute("rel")=="canonical")
						baseFileName=/([^\/]*)$/.exec(link.getAttribute("href"))[1];
				}
				
				function StreamListener() {
				}
				StreamListener.prototype={
					QueryInterface: function(iid) {
					    if (!iid.equals(Components.interfaces.nsISupports) && 
					    	!iid.equals(Components.interfaces.nsIStreamListener)) {
					            throw Components.results.NS_ERROR_NO_INTERFACE;
					        }
					    return this;
					},
					onStartRequest: function(request,context) {
						this.httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
						this.responseStatus=this.httpChannel.responseStatus;
						this.data="";
					},
					onDataAvailable: function(request,context,inputStream,offset,count) {
						var sstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			                   .createInstance(Components.interfaces.nsIConverterInputStream);
						sstream.init(inputStream, "utf-8", 256, 
							Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
						var str={};
						var n=sstream.readString(128,str);
						while(n>0) {
							this.data+=str.value;
							str={};
							n=sstream.readString(128,str);
						}
					},
					onStopRequest: function(request,context,nsresult) {
						if(this.responseStatus==200) {
							try {
								var m=/var *info *= *(.*),/.exec(this.data);
								if(m) {
									var info=JSON.parse(m[1]);
									var tags={
										'': {
											label: "MEDIUM",
										},
										"_hd1080": {
											label: "HD1080",
										},
										"_hd720": {
											label: "HD720",
										},
										"_hq": {
											label: "HQ",
										},
										"_hd": {
											label: "HD",
										},
										"_sd": {
											label: "SD",
										},
										"_ld": {
											label: "LD",
										},
									}
									for(var tag in tags) {
										var url=info['stream_h264'+tag+'_url'];
										if(url) {
											var label=tags[tag].label;
											var extension="flv";
											var mExt=/\.([0-9a-zA-Z]+)(?:$|\?)/.exec(url);
											if(mExt)
												extension=mExt[1];
											AddMedia(url,"["+label+"] "+baseFileName+"."+extension,baseFileName,extension,icon);										
										}
									}
								
								} 
							} catch(e) {
								dump("!!! [DMProbe] handleDocument/RequestVideoInfo: "+e+"\n"+e.fileName+":"+e.lineNumber+"\n");
							}
						}
					}
				}
				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				                .getService(Components.interfaces.nsIIOService);
				var uri = ioService.newURI("http://www.dailymotion.com/embed/video/"+videoId, null, null);
				var channel = ioService.newChannelFromURI(uri);
				
				channel.asyncOpen(new StreamListener(), null);
			}
			FindMedia();
		}
	} catch(e) {
		dump("!!! [DMProbe] handleDocument: "+e+"\n");
	}
	return null;
}

DMProbe.prototype.handleRequest=function(request) {
}
	
DMProbe.prototype.handleResponse=function(request) {
}

DMProbe.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProbe)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

