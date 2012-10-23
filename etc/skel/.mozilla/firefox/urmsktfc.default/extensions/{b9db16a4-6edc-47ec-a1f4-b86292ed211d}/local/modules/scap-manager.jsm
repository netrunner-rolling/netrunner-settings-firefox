/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["ScapManagerService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

const CIS = Components.interfaces.dhIScapMgr; 

var ScapManagerService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new Scap();
			}
		} catch(e) {
			dump("!!! [ScapManagerService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function Scap() {
	try {
		//dump("[Scap] constructor\n");
		this.mState=CIS.STATE_IDLE;
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.prefBranch2=this.pref.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefBranch2.addObserver("scap.enabled", this, false);
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		this.smartNamer = Components.classes["@downloadhelper.net/smart-namer;1"].getService(Components.interfaces.dhISmartNamer);
		this.profDir=Components.classes["@mozilla.org/file/directory_service;1"]
	                               		.getService(Components.interfaces.nsIProperties)
	                                	.get("ProfD", Components.interfaces.nsIFile);
		this.cfgFile=this.profDir.clone();
		this.cfgFile.append("cshelper.cfg");
		if(!this.cfgFile.exists() || this.cfgFile.fileSize==0)
			this.createInitialConfigFile();
		this.parseConfigFile();
		this.mCaptureLength=0;
		this.mObservers=[];
		this.mState=CIS.STATE_READY;
	} catch(e) {
		dump("[Scap] !!! constructor: "+e+"\n");
	}
}

Scap.prototype = {		
		get enabled() { return Util.priorTo20()==false && this.pref.getBoolPref("scap.enabled"); },
		get capturing() { return this.mState==CIS.STATE_CAPTURING || this.mState==CIS.STATE_FINALIZING; },
		get captureLength() { return this.mCaptureLength; },
		get usingCSHelper() { return Components.classes["@mozilla.org/windows-registry-key;1"] && !this.pref.getBoolPref("scap.ignore-cshelper"); },
		get state() { return this.mState; },
		set state(_state) {
			if(_state!=this.mState) {
				this.mState=_state;
				this.notifyObservers("scap-state",_state);
			}
		},
		get captureSize() {
			var size=0;
			if(this.file && this.file.exists()) {
				size=this.file.fileSize;
			}
			return size;
		}
}

Scap.prototype.startCapture=function(window,x,y,width,height) {
	//dump("[ScapMgr] startCapture("+x+","+y+","+width+","+height+")\n");
	try {
		if(this.capturing) {
			dump("!!! [ScapMgr] startCapture(): already capturing\n");
			return;
		}
		var validStartPgm=false;
		if(this.usingCSHelper) {
			this.getStartPgm();
			if(this.startPgm==null)
				return;
		} else {
			var startPath=this.pref.getCharPref("scap.start-pgm");
			try {
				this.startPgm=Components.classes["@mozilla.org/file/local;1"]
			                                .createInstance(Components.interfaces.nsILocalFile);
				this.startPgm.initWithPath(startPath);
				if(this.startPgm.exists() && this.startPgm.isFile() && this.startPgm.isExecutable()) 
					validStartPgm=true;
			} catch(e) {}
			if(!validStartPgm) {
				Util.alertError(Util.getFText("error.scap.no-start-pgm",[startPath],1));
				return;
			}
		}
		if(this.usingCSHelper) {
			this.stopPgm=Components.classes["@downloadhelper.net/cshelper;1"].getService(Components.interfaces.dhICSHelper).exeFile;
		} else {
			var validStopPgm=false;
			var stopPath=this.pref.getCharPref("scap.stop-pgm");
			try {
				this.stopPgm=Components.classes["@mozilla.org/file/local;1"]
			                                .createInstance(Components.interfaces.nsILocalFile);
				this.stopPgm.initWithPath(stopPath);
				if(this.stopPgm.exists() && this.stopPgm.isFile() && this.stopPgm.isExecutable()) 
					validStopPgm=true;
			} catch(e) {}
			if(!validStopPgm) {
				Util.alertError(Util.getFText("error.scap.no-stop-pgm",[stopPath],1));
				return;
			}
		}
			
		var fileExtension;
		if(this.usingCSHelper)
			fileExtension="avi";
		else
			fileExtension=this.pref.getCharPref("scap.file-ext");
	 	this.file=Components.classes["@mozilla.org/file/directory_service;1"]
	 	                        .getService(Components.interfaces.nsIProperties)
	 	                        .get("TmpD", Components.interfaces.nsILocalFile);
	 	this.file.append("dwhelper-scap."+fileExtension);
	 	try {
	 		this.file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);

		} catch(e) {
			Util.alertError(Util.getFText("error.cannot-create-target-file",[this.file.path],1));
			return;
		}
		
		this.file.remove(false);

		var filename=this.file.leafName;
		var title=Util.xpGetString(window.content.document.documentElement,
				"/html/head/meta[@name='title']/@content");
		if(title==null || title=="")
			title=Util.xpGetString(window.content.document.documentElement,"/html/head/title");
		if(title==null || title=="")
			title=this.file.leafName;
		if(title!=null && title.length>0) {
			title=title.replace(/&quot;/g,"\"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
			title=title.replace(/^[^a-zA-Z0-9]+/,"");
			title=title.replace(/[^a-zA-Z0-9]+$/,"");
			filename=title.replace(/[^a-zA-Z0-9-]+/g,"_")+"."+fileExtension;
		}

		this.entry=Components.classes["@mozilla.org/properties;1"].
			createInstance(Components.interfaces.nsIProperties);
		//Util.setPropsString(this.entry,"media-url",murl);
		Util.setPropsString(this.entry,"file-extension",fileExtension);
		Util.setPropsString(this.entry,"file-name",filename);
		this.entry.set("local-file",this.file);
		Util.setPropsString(this.entry,"label",title);
		Util.setPropsString(this.entry,"page-url",window.content.document.URL);
		Util.setPropsString(this.entry,"capture-method","scap");
		this.smartNamer.updateEntry(this.entry);

		var args=[];
		if(this.usingCSHelper) {
			args.push("-start","-x",x,"-y",y,"-width",width,"-height",height,"-outfile",this.file.path,"-cfgfile",this.cfgFile.path);
			if(this.pref.getBoolPref("scap.stealth"))
				args.push("-stealth");
		} else {
			var argsTab=this.pref.getCharPref("scap.start-args").split(" ");
			for(var i in argsTab) {
				var arg=argsTab[i];
				if(arg.length>0) {
					arg=arg.replace(/\{x\}/g,x);
					arg=arg.replace(/\{y\}/g,y);
					arg=arg.replace(/\{width\}/g,width);
					arg=arg.replace(/\{height\}/g,height);
					arg=arg.replace(/\{file\}/g,this.file.path);
					arg=arg.replace(/\{profd\}/g,this.profDir.path);
					if(arg.length>0)
						args.push(arg);
				}
			}
		}
		this.state=CIS.STATE_CAPTURING;
		this.run(this.startPgm,args,function(exitValue,_this) { _this.doneCapture(exitValue); },this);
		this.startTime=new Date().getTime();
	} catch(e) {
		dump("!!! [ScapMgr] startCapture(): "+e+"\n");		
	}
}

Scap.prototype.doneCapture=function(exitValue) {
	//dump("[ScapMgr] doneCapture("+exitValue+")\n");
	try {	
		this.state=CIS.STATE_READY;
	
		var srcFile=this.entry.get("local-file",Components.interfaces.nsILocalFile);
		if(this.usingCSHelper==false && this.pref.getBoolPref("scap.ignore-exit-value")==false && exitValue!=0) {
			Util.alertError(Util.getText("error.scap.failed-capture"));
			if(srcFile.exists())
				srcFile.remove(false);
			return;
		}
		if(!srcFile.exists() || srcFile.fileSize==0) {
			Util.alertError(Util.getText("error.scap.invalid-file"));
			if(srcFile.exists())
				srcFile.remove(false);
			return;
		}
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                                .getService(Components.interfaces.nsIWindowMediator);
		var window = wm.getMostRecentWindow("navigator:browser");
	    var options="chrome,centerscreen,toolbar,modal";
	    var data={
	    	entry: this.entry
	    }
	    window.openDialog("chrome://dwhelper/content/scap-processors.xul",'',options, data );
	} catch(e) {
		dump("!!! [ScapMgr] doneCapture("+exitValue+"): "+e+"\n");
	}
}

Scap.prototype.stopCapture=function() {
	if(this.state!=CIS.STATE_CAPTURING) {
		dump("!!! [ScapMgr] stopCapture(): not capturing\n");
		return;
	}
	var args=[];
	if(this.usingCSHelper) {
		args.push("-stop");
	} else {
		var argsTab=this.pref.getCharPref("scap.stop-args").split(" ");
		for(var i in argsTab) {
			var arg=argsTab[i];
			if(arg.length>0) {
				args.push(arg);
			}
		}
	}
	this.state=CIS.STATE_FINALIZING;
	this.run(this.stopPgm,args);
	this.mCaptureLength=Math.round((new Date().getTime()-this.startTime)/1000);
}

Scap.prototype.run=function(exeFile,exeArgs,cbFnt,cbArgs) {
	if(Components.interfaces.nsIWorkerFactory) { // Gecko < 8
		if(!this.workerFactory)
			this.workerFactory = Components.classes["@mozilla.org/threads/workerfactory;1"].createInstance(Components.interfaces.nsIWorkerFactory);
	
		var worker = this.workerFactory.newChromeWorker("chrome://dwhelper/content/scap-worker.js");
		worker.cbFnt=cbFnt;
		worker.cbArgs=cbArgs;
		worker.onmessage = function(event) {
			//dump("[ScapMgr] run()/worker: onmessage\n");
			//dump(JSON.stringify(event.data)+"\n");
			if(this.cbFnt) {
				try {
					this.cbFnt(event.data.exitValue,this.cbArgs);
				} catch(e) {}
			}
		}
		worker.onerror = function(error) {
			dump("!!! [ScapMgr] run()/worker: "+error+"\n");
		}
		worker.postMessage({ 
			Components: Components,
			exeFilePath: exeFile.path,
			args: exeArgs
		});
	} else { // Gecko >= 8
		function Processor() {
		}
		Processor.prototype={
			observe: function(subject, topic , data) {
				var success=false;
				if(topic=='process-finished')
					success=true;
				if(cbFnt) {
					try {
						cbFnt(success?0:-1,cbArgs);
					} catch(e) {}
				}
			},
			QueryInterface: function(iid) {
				if (iid.equals(Components.interfaces.nsIObserver) ||
					iid.equals(Components.interfaces.nsISupports))
					return this;
				throw Components.results.NS_ERROR_NO_INTERFACE;
			}
		}
		
		var process = Components.classes["@mozilla.org/process/util;1"]
					                        .createInstance(Components.interfaces.nsIProcess);
		process.init(exeFile);
		process.runwAsync(exeArgs, exeArgs.length, new Processor());
	}
}

Scap.prototype.addObserver=function(observer) {
	this.mObservers.push(observer);
}

Scap.prototype.removeObserver=function(observer) {
	for(var i in this.mObservers) {
		if(this.mObservers[i]==observer) {
			this.mObservers.splice(i,1);
			break;
		}
	}
}

Scap.prototype.notifyObservers=function(topic,value) {
	for(var i in this.mObservers) {
		try {
			this.mObservers[i].observe(this,topic,value);
		} catch(e) {}
	}
}

Scap.prototype.observe=function(subject, topic , data) {
	switch(topic) {
		case "nsPref:changed":
			this.notifyObservers("scap-enabled",this.enabled?"on":"off");
			break;
	}
}

Scap.prototype.loadProcessors=function() {
	Components.utils['import']("resource://dwhelper/scap-processor.jsm");
	this.core.registerProcessor(new ScapProcessor({
		name: "scap-save",
		title: Util.getText("scap.processor.save.title"),
		description: Util.getText("scap.processor.save.description"),
		weight: 200,
		promptConversion: false,
		doConversion: false,
		promptFile: true,
	}));
	this.core.registerProcessor(new ScapProcessor({
		name: "scap-convert",
		title: Util.getText("scap.processor.convert.title"),
		description: Util.getText("scap.processor.convert.description"),
		weight: 190,
		promptConversion: true,
		doConversion: true,
		promptFile: true,
	}));
}

Scap.prototype.createInitialConfigFile = function() {
	var refFile=Util.getExtensionDir("{b9db16a4-6edc-47ec-a1f4-b86292ed211d}");
	refFile.append("local");
	refFile.append("csref.cfg");
	if(this.cfgFile.exists())
		this.cfgFile.remove(false);
	refFile.copyTo(this.cfgFile.parent,this.cfgFile.leafName);
}

Scap.prototype.parseConfigFile = function() {
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].
	    createInstance(Components.interfaces.nsIFileInputStream);
	istream.init(this.cfgFile, 0x01, 0444, 0);

	istream.QueryInterface(Components.interfaces.nsILineInputStream);

	var reTrim=new RegExp("^\\s*(.*?)\\s*$");
	var reObject=new RegExp("^(.*?)\\s*:$");
	var reCloseObject=new RegExp("^\\};$");
	var reValue=new RegExp("^(.*?)\\s*=\\s*(.*?)\\s*;$");
	var reString=new RegExp("^\\\"(.*)\\\"$");
	var reNumber=new RegExp("^(\\-?[0-9]*(?:\\.[0-9]*)?)$");
	var reBoolean=new RegExp("^(true|false)$");
	var stack=[{}];
	var hasmore;
	var lineCont={};
	var line;
	var linenum=0;
	var m;
	do {
		hasmore = istream.readLine(lineCont);
		linenum++;
		m=reTrim.exec(lineCont.value);
		line=m[1];
		//dump(line+"\n");
		if(line.length==0) { // empty line: ignore
		} else if(line=="{") { // object start: ignore
		} else if(m=reObject.exec(line)) {
			stack[0][m[1]]={}
			stack.splice(0,0,stack[0][m[1]]);
		} else if(m=reCloseObject.exec(line)) {
			if(stack.length>0)
				stack.shift();
			else {
				dump("!!! [ScapManager] parseConfigFile: invlid object pop ("+linenum+")\n");
				return null;
			}
		} else if(m=reValue.exec(line)) {
			var m0;
			if(m0=reString.exec(m[2])) {
				var v=m0[1].replace(/\\"/g,'"');
				stack[0][m[1]]=v;
			} else if(m0=reNumber.exec(m[2])) {
				stack[0][m[1]]=parseFloat(m0[1]);				
			} else if(m0=reBoolean.exec(m[2])) {
				stack[0][m[1]]=(m0[1]=="true");
			} else {
				dump("!!! [ScapManager] parseConfigFile: invalid value '"+m[2]+" ("+linenum+")\n");
				return null;
			}
		} else {
			dump("!!! [ScapManager] parseConfigFile: invalid line '"+line+" ("+linenum+")\n");
			return null;
		}

	} while(hasmore);
	//dump("[ScapManager] parseConfigFile: "+JSON.stringify(stack[0])+"\n");
	istream.close();
	return stack[0];
}

Scap.prototype.writeConfigFile = function(config) {
	//dump("[Scap] writeConfigFile(...)\n");
	var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].
	               createInstance(Components.interfaces.nsIFileOutputStream);
	fos.init(this.cfgFile, 0x02 | 0x08 | 0x20, 0644, 0); 
	var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
	                createInstance(Components.interfaces.nsIConverterOutputStream);
	os.init(fos, "UTF-8", 0, 0);
	
	var writeSpaces = function(level, os) {
		for(var i=0;i<level;i++) {
			os.writeString("  ");
		}
	}
	var writeObject = function(obj, os, level) {
		for(var k in obj) {
			writeSpaces(level,os);
			switch(typeof(obj[k])) {
			case "object":
				os.writeString(k+" :\n");
				writeSpaces(level,os);
				os.writeString("{\n");
				writeObject(obj[k],os,level+1);
				writeSpaces(level,os);
				os.writeString("};\n");
				break;
			case "number":
			case "boolean":
				os.writeString(k+" = "+obj[k]+";\n");
				break;
			case "string":
				os.writeString(k+" = \""+obj[k].replace(/"/g,"\\\"")+"\";\n");
				break;
			default:
				//dump(k+" => "+typeof(obj[k])+"\n");
			}
		}
	}
	
	writeObject(config,os,0);
	
	os.close(); 
	fos.close();
	//dump("[Scap] -writeConfigFile(...)\n");
}

Scap.prototype.getCodecs = function(cbFnt,cbArgs) {
	//dump("[Scap] getCodecs(...)\n");
	this.getStartPgm();
	if(this.startPgm==null) {
		try {
			cbFnt([],cbArgs);
		} catch(e) {}
		return;
	}
	var codecsFile=Components.classes["@mozilla.org/file/directory_service;1"]
 	 	                        .getService(Components.interfaces.nsIProperties)
 	 	                        .get("TmpD", Components.interfaces.nsILocalFile);
	codecsFile.append("codecs.txt");
	codecsFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);

	var codecCallback=function(exitValue,args) {
		//dump("[Scap] getCodecs/codecsCallback(...)\n");
		if(exitValue==0) {
			var istream = Components.classes["@mozilla.org/network/file-input-stream;1"].
				createInstance(Components.interfaces.nsIFileInputStream);
			istream.init(args.file, 0x01, 0444, 0);
			istream.QueryInterface(Components.interfaces.nsILineInputStream);
			var lineCont={};
			var hasMore;
			var codecs=[];
			do {
				hasmore = istream.readLine(lineCont);
				var line = lineCont.value;
				var codec0=line.split("^");
				codecs.push({
					handler: parseInt(codec0[0]),
					name: codec0[1],
					description: codec0[2],
					driver: codec0[3],
				});
			} while(hasmore);
			istream.close();
			args.fnt(codecs,args.args);
		} else {
			args.fnt([],args.args);
		}
		args.file.remove(false);
		//dump("[Scap] -getCodecs/codecsCallback(...)\n");
	}
	this.run(this.startPgm,["-codecs","-outfile",codecsFile.path],codecCallback,{ fnt: cbFnt, args: cbArgs, file: codecsFile });
	//dump("[Scap] -getCodecs(...)\n");
}

Scap.prototype.getStartPgm = function() {
	this.startPrm=null;
	if(Components.classes["@downloadhelper.net/cshelper;1"]) {
		var cshelper=Components.classes["@downloadhelper.net/cshelper;1"].getService(Components.interfaces.dhICSHelper);
		this.startPgm=cshelper.exeFile;
		this.codecFile=cshelper.codecFile;
	} else {
		//dump("[ScapMgr] getStartPgm(): cshelper not found\n");
	    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                                .getService(Components.interfaces.nsIWindowMediator);
		var w = wm.getMostRecentWindow("navigator:browser");
		w.openDialog('chrome://dwhelper/content/scap-nocshelper.xul','_blank',"chrome,centerscreen");
	}
}

Scap.prototype.launchRecorder = function(cbFnt,cbArgs) {
	this.getStartPgm();
	if(this.startPgm==null)
		return;
	this.run(this.startPgm,["-cfgfile",this.cfgFile.path], cbFnt, cbArgs);
}

Scap.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIScapMgr) ||
       	iid.equals(Components.interfaces.nsIObserver)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
