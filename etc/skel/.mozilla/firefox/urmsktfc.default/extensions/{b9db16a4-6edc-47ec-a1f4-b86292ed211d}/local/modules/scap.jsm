/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

var EXPORTED_SYMBOLS = ["Scap"];
 
Components.utils['import']("resource://dwhelper/util-service.jsm");
Components.utils['import']("resource://dwhelper/scap-manager.jsm");

var prefService=Components.classes["@mozilla.org/preferences-service;1"]
	.getService(Components.interfaces.nsIPrefService);
 
var Scap={
	util: Util,
	pref: prefService.getBranch("dwhelper.scap."),
	manager: ScapManagerService.get(),
}

Scap.getFlashElements=function(window) {
	var targets=[];
	var embs=window.content.document.getElementsByTagName('embed');
	for(var i=0; i<embs.length; i++) {
		var embed=embs.item(i);
		targets.push({element: embed, cr: embed.getBoundingClientRect() }); 
	}
	var objects=window.content.document.getElementsByTagName('object');
	for(var i=0; i<objects.length; i++) {
		var object=objects.item(i);
		var known=false;
		for(var j in targets) {
			if(targets[j].element.parentNode==object) {
				known=true;
				break;
			} 
		}
		if(!known)
			targets.push({ element: object, cr: object.getBoundingClientRect() });
	}
	return targets;
}

Scap.getCapturableRegions=function(window) {
	var targets=Scap.getFlashElements(window);
	var regions=[];
	for(var i in targets) {
		var target=targets[i];
		var cr=target.cr;
		var x=cr.left;
		var y=cr.top;
		var width=cr.width;
		var height=cr.height;
		var surface;
		var truncated=false;
	
		if(x>=window.content.innerWidth || y>=window.content.innerHeight) {
			surface=0;
		} else {
			if(x<0) {
				width+=x;
				x=0;
				truncated=true;
			}
			if(y<0) {
				height+=y;
				y=0;
				truncated=true;
			}
			if(width<=0||height<=0) {
				surface=0;
			} else {
				if(x+width>window.content.innerWidth) {
					width=window.content.innerWidth-x;
					truncated=true;
				}
				if(y+height>window.content.innerHeight) {
					height=window.content.innerHeight-y;
					truncated=true;
				}
				if(width<=0||height<=0) {
					surface=0;
				} else { 
					surface=width*height;
				}
			}
		}
		var likelyhood=0;
		var ratio=0;
		if(surface>0) {
			ratio=1/(1+(Math.abs((width/height)-1.2)));
			likelyhood=Math.log(surface)*ratio;
			if(truncated)
				likelyhood=likelyhood/2;
			regions.push({ element: target.element, x: x, y: y, width: width, height: height, likelyhood: likelyhood, index: i, cr: target.cr });
		}		
	}
	
	regions.sort(function(a,b) {
		if(a.likelyhood>b.likelyhood)
			return -1;
		else if(a.likelyhood<b.likelyhood)
			return 1;
		else
			return 0;
	});
	
	//dump("[Scap] getCapturableRegions(...): found "+regions.length+" region(s)\n");
	return regions;
}
 
Scap.highlightRegion=function(window,region,scapMask) {
	//dump("highlight "+region.x+" "+region.y+" "+region.width+"x"+region.height+"\n");
	var thickness=this.pref.getIntPref("border-thickness");
	if(!scapMask) {
		var mask=window.content.document.createElement("div");
		/*
		mask.setAttribute("style","position:absolute;top:0;left:0;z-index: 2147483647;"+
			"background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAAZiS0dEAAAAAAAA+UO7fwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9sDFBYXJXrac0cAAAANSURBVAjXY5jB8L8eAATiAhcATVLvAAAAAElFTkSuQmCC);"+
			"background-color: #888; background-repeat: repeat;");
		*/
		mask.setAttribute("style","position:absolute;top:0;left:0;z-index: 2147483647; border: "+thickness+"px solid #f0f;");
		var body=window.content.document.documentElement.lastChild;
		if(body) {
			body.appendChild(mask);
			scapMask=mask;
		}
	}
	
	if(scapMask) {
		scapMask.style.top=""+(region.y+window.content.scrollY-thickness)+"px";
		scapMask.style.left=""+(region.x+window.content.scrollX-thickness)+"px";
		scapMask.style.width=""+region.width+"px";
		scapMask.style.height=""+region.height+"px";
		scapMask.style.display="block";
	}
	return scapMask;
}

Scap.unhighlightRegion=function(scapMask,remove) {
	if(remove) {
		if(scapMask) {
			scapMask.parentNode.removeChild(scapMask);
			scapMask=null;
		}
	} else {
		scapMask.style.display="none";
	}
	return scapMask;
}

Scap.captureRegion=function(window,region) {
	var sx=window.content.mozInnerScreenX;
	var sy=window.content.mozInnerScreenY;
	var width=region.width;
	var height=region.height;
	var x=region.x+sx;
	if(x<0) {
		width+=x;
		x=0;
	}
	var y=region.y+sy;
	if(y<0) {
		height+=y;
		y=0;
	}
	if(width<=0||height<=0) {
		Scap.util.alertError(Scap.util.getText("error.scap.region-not-on-screen"));
		return;
	}
	var pxFactor=window.content.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils).screenPixelsPerCSSPixel;
	x=Math.round(x*pxFactor);
	y=Math.round(y*pxFactor);
	width=Math.round(width*pxFactor);
	height=Math.round(height*pxFactor);
	Scap.manager.startCapture(window,x,y,width,height);
}
