/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

var EXPORTED_SYMBOLS = ["ScapProcessor"];
 
Components.utils['import']("resource://dwhelper/util-service.jsm");
Components.utils['import']("resource://dwhelper/scap-manager.jsm");
Components.utils['import']("resource://dwhelper/download-manager.jsm");
Components.utils['import']("resource://dwhelper/conversion-manager.jsm");

var prefService=Components.classes["@mozilla.org/preferences-service;1"]
	.getService(Components.interfaces.nsIPrefService);

function ScapProcessor(data) {
	this.mData=data;
}

ScapProcessor.prototype={
	util: Util,
	pref: prefService.getBranch("dwhelper.scap."),
	manager: ScapManagerService.get(),
	dlMgr: DownloadManagerService.get(),
	cvMgr: ConversionManagerService.get(),
	get enabled() { return true; },
	get name() { return this.mData.name; },
	get title() { return this.mData.title; },
	get description() { return this.mData.description; },
	get provider() { return "DownloadHelper"; },
	get weight() { return this.mData.weight; }
}

ScapProcessor.prototype.canHandle=function(entry) {
	if(!entry.has("local-file"))
		return false;
	var file=null;
	try {
		file=entry.get("local-file",Components.interfaces.nsILocalFile);
	} catch(e) {}
	if(!file)
		return false;
	if(file.exists()==false || file.isFile()==false || file.isReadable()==false || file.fileSize<1024)
		return false;
	return true;
}

ScapProcessor.prototype.requireDownload=function(entry) {
	return false;
}

ScapProcessor.prototype.preDownload=function(entry) {
	try {
		var filename=this.util.getPropsString(entry,"file-name");
		var format=null;
		if(this.mData.doConversion) {
			try {
				format=this.pref.getCharPref("last-cv-format");
			} catch(e) {}
			if(this.mData.promptConversion) {
				var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				                                        .getService(Components.interfaces.nsIWindowMediator);
				var window = windowMediator.getMostRecentWindow("navigator:browser");
				var data={
						format: format
				};
				window.openDialog("chrome://dwhelper/content/convert-manual.xul",
						"dwhelper-convert-manual", "chrome,centerscreen,modal",data);
				format=data.format;
				this.pref.setCharPref("last-cv-format",format);
			}
			if(format) {
				this.util.setPropsString(entry,"format",format);
				var ext=/^(.*?)\//.exec(format)[1];
				filename=/^(.*?)(?:\.[^\.]{1,5})?$/.exec(filename)[1]+"."+ext;
			}
		}
		var file=this.dlMgr.getDownloadDirectory();
		file.append(filename);
		try {
			file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
		} catch(e) {
			this.util.alertError(this.util.getFText("error.cannot-create-target-file",[file.path],1));
			return false;
		}
	 	file.remove(true);
		if(this.mData.promptFile) {
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var filePicker = Components.classes["@mozilla.org/filepicker;1"]
			        .createInstance(nsIFilePicker);
	        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                                    .getService(Components.interfaces.nsIWindowMediator);
			var window = wm.getMostRecentWindow("navigator:browser");
			filePicker.init(window, this.util.getText("scap.output-file"), nsIFilePicker.modeSave);
			filePicker.displayDirectory=file.parent;
			filePicker.defaultString=file.leafName;
			filePicker.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
			if(filePicker.show()==nsIFilePicker.returnCancel) {
				return false;
			}
			file=filePicker.file;
			this.dlMgr.setDownloadDirectory(file.parent);
		}
		if(format) {
			if(this.cvMgr.checkConverter(true)==false) {
				if(file.exists())
					file.remove(true);
				return false;
			}
			entry.set("cv-file",file);
	 	} else {
		 	entry.set("dl-file",file);
	 	}
	
		return true;
	} catch(e) {
		dump("!!! [ScapProcessor] preDownload(): "+e+"\n");
	}
}

ScapProcessor.prototype.conversionFinished=function(status, entry, ctx) {
	//dump("[ScapProcessor] conversionFinished("+status+",...)\n");
	/*
	if(status) {
		var processor=ctx.QueryInterface(Components.interfaces.dhIProcessor);
		processor.handle(entry);
	}
	*/
}

ScapProcessor.prototype.handle=function(entry) {
	var srcFile=entry.get("local-file",Components.interfaces.nsILocalFile);
	if(entry.has("cv-file")) {
		var format=this.util.getPropsString(entry,"format");
		var dstFile=entry.get("cv-file",Components.interfaces.nsILocalFile);
		//dump(" Convert "+srcFile.path+" to "+dstFile.path+" format "+format+"\n");
		this.cvMgr.addConvert(srcFile,dstFile,format,true,this,entry,{});
	} else if(entry.has("dl-file")) {
		var dstFile=entry.get("dl-file",Components.interfaces.nsILocalFile);
		if(Components.interfaces.nsIWorkerFactory) { // Gecko < 8.0
			if(!this.workerFactory)
				this.workerFactory = Components.classes["@mozilla.org/threads/workerfactory;1"].createInstance(Components.interfaces.nsIWorkerFactory);
			var worker = this.workerFactory.newChromeWorker("chrome://dwhelper/content/scap-move-worker.js");
			worker.onmessage = function(event) {
				//dump("[ScapProcessor] handle()/worker: move finished "+event.data.exitValue+"\n");
			}
			worker.onerror = function(error) {
				dump("!!! [ScapProcessor] handle()/worker: "+error+"\n");
			}
			worker.postMessage({ 
				Components: Components,
				srcFilePath: srcFile.path,
				dstFilePath: dstFile.path
			});
		} else { // Gecko >= 8
			srcFile.moveTo(dstFile.parent,dstFile.leafName);
		}
	}
}
