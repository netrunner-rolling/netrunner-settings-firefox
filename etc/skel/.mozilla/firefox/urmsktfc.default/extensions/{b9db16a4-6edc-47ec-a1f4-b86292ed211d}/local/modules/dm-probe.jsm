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
					var paramElements;
					try {
						paramElements=document.getElementsByTagName("param");
					} catch(e) {
						// in case the document does not exist anymore
						return;
					}
					for(var i=0;i<paramElements.length;i++) {
						var paramElement=paramElements[i];
						if(paramElement.getAttribute("name")=="flashvars") {
							var  params=paramElement.getAttribute("value").split("&");
							for(var j=0;j<params.length;j++) {
								var m=/^sequence=(.*)$/.exec(params[j]);
								if(m) {
									var seq=JSON.parse(decodeURIComponent(m[1]));
									for(var k=0;k<seq.sequence[0].layerList[0].sequenceList.length;k++) {
										var seqItem=seq.sequence[0].layerList[0].sequenceList[k];
										if(seqItem.name=="main") {
											
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
											
											for(var l=0;l<seqItem.layerList.length;l++) {
												var layer=seqItem.layerList[l];
												if(layer.name.toLowerCase()=="video") {
													//dump("video Layer "+JSON.stringify(layer,null,"    ")+"\n");
													var tags={
														"hd1080": {
															label: "HD1080",
														},
														"hd720": {
															label: "HD720",
														},
														"hq": {
															label: "HQ",
														},
														"sd": {
															label: "SD",
														},
														"ld": {
															label: "LD",
														},
													}
													var versions={};
													for(var n in tags) {
														//dump("  "+n+"URL"+": "+layer.param[n+"URL"]+"\n");
														if(layer.param[n+"URL"]) {
															var url=layer.param[n+"URL"];
															var label=tags[n].label;
															var extension="flv";
															var mExt=/\.([0-9a-zA-Z]+)(?:$|\?)/.exec(url);
															if(mExt)
																extension=mExt[1];
															AddMedia(url,"["+label+"] "+baseFileName+"."+extension,baseFileName,extension,icon);
														}
													}
												}
											}
											return true;																				
										}
									}
								}
							}
						}
					}
					return false;
				} catch(e) {
					dump("!!! [DMProbe] handleDocument/findMedia: "+e+"\n"+e.fileName+":"+e.lineNumber+"\n");
				}
			}
			var scanCount=0;
			var scanTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			scanTimer.initWithCallback({
				notify: function(timer) {
					if(++scanCount>=10 || FindMedia())
						scanTimer.cancel();
				},
			},1000,Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
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

