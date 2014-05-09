/******************************************************************************
 *            Copyright (c) 2006-2009 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

/**
 * Constants.
 */

const NS_YTLCITEM_CID = Components.ID("{fc78d3e8-91f0-4ccd-a830-aefd00595f43}");
const NS_YTLCITEM_PROG_ID = "@downloadhelper.net/youtube-links-context-item;1";
const DHNS = "http://downloadhelper.net/1.0#";

var Util=null;
var Node=null;

/**
* Object constructor
*/
function YTLCItem() {
	try {
		//dump("[YTLCItem] constructor\n");
		Components.utils['import']("resource://dwhelper/util-service.jsm");
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		Components.utils['import']("resource://dwhelper/youtubeinfo-service.jsm");
		this.ytInfo=YouTubeInfoService.get();
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.currentPage=null;
		this.pageQueue=[];
	} catch(e) {
		dump("[YTLCItem] !!! constructor: "+e+"\n");
	}
}

YTLCItem.prototype = {}

YTLCItem.prototype.canHandle=function(document,window,item) {
	//dump("[YTLCItem] canHandle()\n");
	try {
		var popupNode=document.popupNode;
		if(popupNode==null)
			popupNode=this.getPopupNode(window);
		if(popupNode==null)
			return false;
		var links=this.getYTLinks(popupNode);
/*
		dump("=>Found "+links.length+" links\n");
		for(var i in links) {
			dump("  - "+links[i]+"\n");
		}
*/
		if(links.length>0)
			return true;
		return false;
	} catch(e) {
		dump("!!! [YTLCItem] canHandle(): "+e+"\n");
	}
}

YTLCItem.prototype.handle=function(document,window,item) {
	//dump("[YTLCItem] handle()\n");
	try {
		var popupNode=document.popupNode;
		if(popupNode==null)
			popupNode=this.getPopupNode(window);
		if(popupNode==null)
			return false;
		var links=this.getYTLinks(popupNode);
		for(var i=0;i<links.length;i++) {
			//this.queuePage(links[i]);
			var m=/(?:\?|&)v=([^&]+)/.exec(links[i]);
			if(m && m.length==2) {

				var videoId=m[1];
				
				function StreamListener(service,document,window) {
					this.service=service;
					this.document=document;
					this.window=window;
					var formats=this.service.pref.getCharPref("ythq-formats").split(",");
					this.formats=[];
					for(var i in formats) {
						if(formats[i].length>0) {
							this.formats.push(formats[i]);
						}
					}
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
							var p=this.data.split("&");
							var desc=Components.classes["@mozilla.org/properties;1"].
								createInstance(Components.interfaces.nsIProperties);
							Util.setPropsString(desc,"page-url",this.document.URL);

							var availFormats={};
							var fileName=null;
							
							for(var i in p) {
								var m=/^(.*?)=(.*)$/.exec(p[i]);
								if(m!=null && m.length==3) {
									if(m[1]=="fmt_url_map") {
										var fum=decodeURIComponent(m[2]);
										var fmts=fum.split(",");
										for(var j in fmts) {
											var m2=/^([0-9]+)\|(.*)/.exec(fmts[j]);
											if(m2 && m2.length==3) {
												availFormats[m2[1]]=m2[2];
											}
										}
									} else if(m[1]=="url_encoded_fmt_stream_map") {
										var fum=decodeURIComponent(m[2]);
										var fmts=fum.split(",");
										for(var j in fmts) {
											var parts=fmts[j].split("&");
											var fmts2={}
											var sig=null;
											for(var k in parts) {
												var pline=decodeURIComponent(parts[k]);
												var m=/^sig=(.*)/.exec(pline);
												if(m)
													sig=m[1];
												var match2=/^(.*?)=(.*)$/.exec(pline);
												if(match2 && match2.length==3) {
													fmts2[match2[1]]=match2[2];
												}
											}
											if(fmts2['itag'] && fmts2['url']) {
												if(sig)
													fmts2['url']+="&signature="+sig;
												availFormats[fmts2['itag']]=fmts2['url'];
											}
										}										
									} else if(m[1]=="title") {
										var unmodifiedFilename=false;
										try {
											unmodifiedFilename=this.service.pref.getBoolPref("yt-unmodified-filename");		
										} catch(e) {}
										fileName=decodeURIComponent(m[2]);
										fileName=fileName.replace(/\+/g," ");
										fileName=fileName.replace(/(?:[\/"\?\*:\|"'\\_]|&quot;|&amp;|&gt;|&lt;)+/g,"_");
										if(!unmodifiedFilename) {
											var keepSpaces=false;
											try {
												keepSpaces=this.service.pref.getBoolPref("yt-keep-spaces");
											} catch(e) {}
											if(keepSpaces)
												fileName=fileName.replace(/[^a-zA-Z0-9\.\- ]+/g,"_");
											else
												fileName=fileName.replace(/[^a-zA-Z0-9\.\-]+/g,"_");
											fileName=fileName.replace(/^[^a-zA-Z0-9]+/,"");
											fileName=fileName.replace(/[^a-zA-Z0-9]+$/,"");
										}
									}
								}
							}
							if(fileName!=null) {
								for(var j in this.formats) {
									if(typeof(availFormats[this.formats[j]])!="undefined") {
										var format=parseInt(this.formats[j]);
										var url=availFormats[this.formats[j]];
										Util.setPropsString(desc,"media-url",url);
										var extension=this.service.ytInfo.getExtension(format);
										Util.setPropsString(desc,"file-name",fileName+"."+extension);
										Util.setPropsString(desc,"file-extension",extension);
										this.service.core.quickProcess(desc);
										break;
									}
								} 
							}
						}
					}
				}

				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				                                   .getService(Components.interfaces.nsIIOService);
				var uri = ioService.newURI("http://www.youtube.com/get_video_info?video_id="+videoId, null, null);
				var channel = ioService.newChannelFromURI(uri);

				channel.asyncOpen(new StreamListener(this,document,window), null);
			}
		}
	} catch(e) {
		dump("!!! [YTLCItem] handle(): "+e+"\n");
	}
}

YTLCItem.prototype.cleanLinks=function(links) {
	var links0={};
	for(var i in links) {
		var link=links[i];
		var linkKey=link.replace(/&hd=1/g,'');
		if(links0[linkKey]==null || links0[linkKey].length<link.length)
			links0[linkKey]=link;
	}
	links=[];
	for(var i in links0) {
		links.push(links0[i]);
	}
	return links;
}

YTLCItem.prototype.getYTLinks=function(popupNode) {
	var doc=popupNode.ownerDocument;
	var baseUri=Components.classes["@mozilla.org/network/io-service;1"]
               .getService(Components.interfaces.nsIIOService)
               .newURI(doc.URL, null, null);
	var links=[];
	var seln=doc.defaultView.getSelection();
	if(seln.rangeCount>0) {
		var range=seln.getRangeAt(0);
		if(!range.collapsed) {
			var linksMap={};
			var firstLink=this.getLinkInAncestors(range.startContainer,baseUri);
			if(firstLink!=null)
				linksMap[firstLink]="";
			var ancestor=range.commonAncestorContainer;
			var url0=this.getLinkInAncestors(ancestor, baseUri);
			if(url0!=null) {
				links.push(url0);
			} else {
				this.getLinks(ancestor, linksMap, baseUri, { 
					inRange: false, 
					startContainer: range.startContainer,
					endContainer: range.endContainer
					});
				for(var url in linksMap) {
					links.push(url);
				}
			}
			return this.cleanLinks(links);
		}
	} 
	
	if(popupNode) {
		var url=this.getLinkInAncestors(popupNode, baseUri);
		if(url!=null)
			links.push(url);
	}

	return this.cleanLinks(links);
}

YTLCItem.prototype.getLinks=function(node,linksMap, baseUri, scanData) {
	if(scanData.inRange==false && node==scanData.startContainer)
		scanData.inRange=true;

	if(node.nodeType==Node.ELEMENT_NODE) {
		if(scanData.inRange==true) {
			if(node.tagName.toLowerCase()=="a") {
				var url=this.getURL(baseUri,node);
				if(url)
					linksMap[url]="";
			}
		}
		var node0=node.firstChild;
		while(node0) {
			this.getLinks(node0,linksMap,baseUri,scanData);
			node0=node0.nextSibling;
		}
	}

	if(scanData.inRange==true && node==scanData.endContainer)
		scanData.inRange=false;
}

YTLCItem.prototype.getLinkInAncestors=function(node,baseUri) {
	while(node!=null) {
		if(node.nodeType==Node.ELEMENT_NODE) {
			if(node.tagName.toLowerCase()=="a") {
				var url=this.getURL(baseUri,node);
				if(url)
					return url;
			}
		}
		node=node.parentNode;
	}
	return null;
}

YTLCItem.prototype.getURL=function(baseUri,node) {
	var href=node.getAttribute("href");
	if(href!=null && href.length>0) {
		var url=baseUri.resolve(href);
		if(url.match(/^https?\:\/\/(?:[^\/\.]+\.)?youtube\.com\/watch(?:_videos)?\?/))
			return url;
	}	
	if(node.hasAttribute("onclick")) {
		try {
			var videoId=/onPlayVideos\(\['([a-zA-Z0-9]*)'\]\)/.exec(node.getAttribute("onclick"))[1];
			if(videoId) {
				return "http://www.youtube.com/watch?v="+videoId;
			}
		} catch(e) {}
	}
	return null;
}

YTLCItem.prototype.getPopupNode=function(window) {
	//dump("[YTLCItem] getPopupNode("+window.document.URL+")\n");
	var popupNode=window.document.popupNode;
	return popupNode;
}

Node=Components.interfaces.nsIDOMNode;

Components.utils['import']("resource://gre/modules/XPCOMUtils.jsm");

YTLCItem.prototype.contractID="@downloadhelper.net/youtube-links-context-item;1";
YTLCItem.prototype.classID=Components.ID("{fc78d3e8-91f0-4ccd-a830-aefd00595f43}");
YTLCItem.prototype.QueryInterface=XPCOMUtils.generateQI([
                                       Components.interfaces.dhIContextItem,
                                       ]);


if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([YTLCItem]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([YTLCItem]);

