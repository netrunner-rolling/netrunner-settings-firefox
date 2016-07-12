/**
 * Converter.js, 2014
 * @author ICh
 * @namespace antvd
 */
var antvd = (function(antvd)
{
    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");

    if (!antvd.AntLib)
    {
        antvd.AntLib = AntLib;
    }

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;

    // @class MediaConverterError
    // @param {Number} code
    // @param {Object} cause
    function MediaConverterError(code, cause)
    {
        this.code = code;       // @type Number
        this.cause = cause;     // @type Object
    };

    MediaConverterError.prototype =
    {
        // @member toString
        // @returns {String}
        toString: function()
        {
            // @type String
            let message;
        
            if (this.code == MediaConverterError.E_JOIN_MISSING_INPUT)
            {
                message = "Missing input";
            }
            else if (this.code == MediaConverterError.E_CONV_FAILURE)
            {
                message = "Conversion failed";
            }
            else if (this.code == MediaConverterError.E_IO_FAILURE)
            {
                message = "IO failure";
            }
            else if (this.code == MediaConverterError.E_SETUP_FAILURE)
            {
                message = "Bad configuration";
            }
            else if (this.code == MediaConverterError.E_UNEXPECTED_ERROR)
            {
                message = "Runtime error";
            }
            else
            {
                message = "Unexpected error";
            }

            if (this.cause)
            {
                message = message + ". Caused by " + this.cause;
            }
            
            return message;
        }
    };

    MediaConverterError.E_JOIN_MISSING_INPUT    = 1;
    MediaConverterError.E_CONV_FAILURE          = 2;
    MediaConverterError.E_UNEXPECTED_ERROR      = 3;
    MediaConverterError.E_IO_FAILURE            = 4;
    MediaConverterError.E_SETUP_FAILURE         = 5;

    // Proxy to avconv (ffmpeg)
    //
    // @class Converter
    // @param {ConverterPackage} conf Configuration object
    function Converter(conf)
    {
        // @private
        // @name ctx
        // @type Converter
        var ctx = this;

        // @private
        // @name fileName
        // @type String
        var fileName = null;
        
        // @private
        // @name fileExtension
        // @type String
        // NOTE: This can be 'mkv' or 'mp4' depending from situation
        var fileExtension = null;

        // @private
        // @name output
        // @type nsIFile
        var output = null;
        var demuxer = null;

        // @member setName
        // @param {String} name
        this.setName = function(name)
        {
            fileName = name;
        };

        // Merge audio and video streams into a container. Used for YouTube videos mostly
        // Prior to the transcoding step the method ensures that the input files
        // exist on disk, otherwise the operation is rejected with the code
        // E_JOIN_MISSING_INPUT
        //
        // Target container depends from input streams
        //     video/vp90 + audio/opus -> webm
        //         video/vp90 + (audio/opus -> audio/vorbis) -> webm
        //     video/mp4 + audio/mp4 -> mp4
        //     video/* + audio/* -> mkv
        //
        // @member join
        //
        // @param String videoStreamPath Video stream source
        // @param String audioStreamPath Audio stream source
        // @param String videoMimeType Type of video stream
        // @param String audioMimeType Type of audio stream
        //
        // @returns {Promise} Async result of the conversion procedure
        //
        this.join = function(videoStreamPath, audioStreamPath, videoMimeType, audioMimeType)
        {
            try
            {
                // The both calls to FileUtils.File may throw if either video or audio contains an invalid path
                if (FileUtils.File(videoStreamPath).exists() == false)
                {
                    antvd.AntLib.logError("Converter.join (Converter.js)", "Video stream is missing on the disk: " + videoStreamPath, null);

                    return Promise.reject(new MediaConverterError(MediaConverterError.E_JOIN_MISSING_INPUT));
                }
                
                if (FileUtils.File(audioStreamPath).exists() == false)
                {
                    antvd.AntLib.logError("Converter.join (Converter.js)", "Audio stream is missing on the disk: " + audioStreamPath, null);

                    return Promise.reject(new MediaConverterError(MediaConverterError.E_JOIN_MISSING_INPUT));
                }
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.join (Converter.js)", "Failed to probe for input streams" + "\n    video: " + videoStreamPath + "\n    audio: " + audioStreamPath, ex);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            // @type nsIFile
            let file = null;
            let args = [
                "-y", "-i",
                videoStreamPath,
                "-i",
                audioStreamPath,
                "-map", "0:v", "-map", "1:a", "-codec", "copy"
            ];

            
            videoMimeType = videoMimeType.toLowerCase();
            audioMimeType = audioMimeType.toLowerCase();
            
            if (videoMimeType == "video/mp4" && audioMimeType == "audio/mp4")
            {
                fileExtension = Converter.EXT_MP4;
            }
            else if (videoMimeType == "video/webm" && audioMimeType == "audio/webm")
            {
                fileExtension = Converter.EXT_WEBM;
                args = [
                    "-y", "-i",
                    videoStreamPath,
                    "-i",
                    audioStreamPath,
                    "-map", "0:v", "-map", "1:a", "-codec", "copy", "-strict", "-2"
                ];
            }
            else
            {
                fileExtension = Converter.EXT_MKV;
            }
            
            try
            {
                file = FileUtils.getFile("TmpD", ["output." + fileExtension]);
                file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
                output = file;
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.join (Converter.js)", "Failed to create an output file " + (file ? file.path : ""), ex);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_IO_FAILURE, ex));
            }

            args.push(output.path);

            return run(args);
        };

        // Merge multiple audio/video MP4 chunks (pieces) into a single MP4 container. Used for Dailymotion videos mostly
        // Chunks are merged via separate demuxer file
        // Prior to the transcoding step the method ensures that the input files
        // exist on disk, otherwise the operation is rejected with the code
        // E_JOIN_MISSING_INPUT
        //
        // @member join
        // @param 'chunks' (Array) Array of filenames, each of them is pointing to a temporary MP4-file on disk
        // @param 'extraCmdOption' (Array) Additional command line options to be passed to FFMpeg tool
        // @returns {Promise} Async result of the conversion procedure
        this.joinChunks = function(chunks, extraCmdOption)
        {
            if (chunks.length == 0)
            {
                antvd.AntLib.logError("Converter.joinChunks (Converter.js)", "Empty chunks array", null);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_JOIN_MISSING_INPUT));
            }
            
            let output_file = null;     // @type nsIFile
            let demuxer_file = null;    // @type nsIFile
            let args = [];
            
            // Create demuxer file
            try
            {
                let _content = "";
                var charset = "UTF-8";
                var stream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
                var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
                
                demuxer_file = FileUtils.getFile("TmpD", [Converter.DEMUXER_FILENAME]);
                demuxer_file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
                
                stream.init(demuxer_file, -1, -1, 0);
                
                os.init(stream, null, 1024, 0x003F);

                for(let i = 0; i < chunks.length; i++)
                {
                    let _write_chunk = false;
                    
                    try
                    {
                        let _chunk_target_file = new FileUtils.File(chunks[i].target);
                        
                        if (_chunk_target_file)
                        {
                            if (_chunk_target_file.exists() && _chunk_target_file.fileSize > 0)
                            {
                                _write_chunk = true;
                            }
                        }
                    }
                    catch(ex)
                    {
                    }
                    
                    if (_write_chunk == false)
                    {
                        antvd.AntLib.toLog(
                            "Converter.joinChunks (Converter.js)",
                            "Skipping missing or empty chunk: " + chunks[i].target
                        );
                    }
                    else
                    {
                        os.writeString("file '" + chunks[i].target.replace(/\\/g, "\\\\") + "'\n");
                    }
                }

                if (stream instanceof Components.interfaces.nsISafeOutputStream)
                {
                    stream.finish();
                }
                else
                {
                    stream.close();
                }
                
                demuxer = demuxer_file;
            }
            catch(e)
            {
                antvd.AntLib.logError("Converter.joinChunks (Converter.js)", "Failed to create FFMpeg demuxer file " + (file ? file.path : ""), ex);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_IO_FAILURE, ex));
            }
            
            fileExtension = Converter.EXT_MP4;

            try
            {
                output_file = FileUtils.getFile("TmpD", ["output." + Converter.EXT_MP4]);
                output_file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
                output = output_file;
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.joinChunks (Converter.js)", "Failed to create an output file " + (file ? file.path : ""), ex);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_IO_FAILURE, ex));
            }

            // Command line like:
            // -y -f concat -i <demuxer path> -codec copy <output path>
            //   (Demuxer is a text file that contains links to video pieces to merge)
            args = ["-y", "-f", "concat", "-i", demuxer.path];
            
            if (extraCmdOption && extraCmdOption.length > 0)
            {
                for(let i = 0; i < extraCmdOption.length; i++)
                {
                    args.push(extraCmdOption[i]);
                }
            }
            
            args.push("-codec", "copy", output.path);

            return run(args);
        };
        
        // @member getUri
        // @returns {nsIURI} Uri of the converted file
        this.getUri = function()
        {
            if (!output)
            {
                antvd.AntLib.logError("Converter.getUri (Converter.js)", "Attempt to aquire the file URI out of order", null);

                throw new MediaConverterError(MediaConverterError.E_UNEXPECTED_ERROR);
            }

            return Services.io.newFileURI(output);
        };

        // @member getFileName
        // @returns {String} Name of the converted file
        //                   This one basically is the same as the value assigned
        //                   through a call to setName. Though it may differ in
        //                   extension
        this.getFileName = function()
        {
            return fileName + "." + fileExtension;
        };

        // @member finalize
        // Cleans-up temporary files
        this.finalize = function()
        {
            try
            {
                if (output)
                {
                    output.remove(false);
                }
                
            }
            catch (ex)
            {
                antvd.AntLib.toLog("Converter.finalize (Converter.js)", "Failed to remove output file " + output.path);
            }
            
            try
            {
                if (demuxer)
                {
                    demuxer.remove(this);
                }
                
            }
            catch (ex)
            {
                antvd.AntLib.toLog("Converter.finalize (Converter.js)", "Failed to remove demuxer file " + demuxer.path);
            }

            output = null;
            demuxer = null;
        };

        // Launches avconv (ffmpeg) with the given arguments
        //
        // @private
        // @member run
        // @param {Array.<String>} args Argument list
        // @returns {Promise} To be resolved when the application terminates
        var run = function(args)
        {
            // @type nsIFile
            let avconvFile = null;
            
            try
            {
                avconvFile = conf.getConvExecutable();
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.run (Converter.js)", "Failed to acquire the encoder path", ex);

                return Promise.reject(new MediaConverterError(MediaConverterError.E_SETUP_FAILURE, ex));
            }

            // @type nsIProcess
            let process = null;

            try
            {
                process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
                process.init(avconvFile);
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.run (Converter.js)", "Failed to initialize the process", ex);
                
                return Promise.reject(new MediaConverterError(MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            let deferred = Promise.defer();

            try
            {
                antvd.AntLib.toLog("Converter.run (Converter.js)", "Starting " + avconvFile.path + " " + args.join(" "));

                // @type nsIObserver
                let callback =
                {
                    observe: function(aSubject, aTopic, aData)
                    {
                        antvd.AntLib.toLog("Converter.run (Converter.js)", "   exited with code " + process.exitValue);

                        conf.updateSuccessRate(!process.exitValue);

                        if (!process.exitValue)
                        {
                            deferred.resolve();
                        }
                        else
                        {
                            deferred.reject(new MediaConverterError(MediaConverterError.E_CONV_FAILURE, process.exitValue));
                        }
                    }
                };

                process.runwAsync(args, args.length, callback, false);
            }
            catch (ex)
            {
                antvd.AntLib.logError("Converter.run (Converter.js)", "Failed to launch the process", ex);
                
                return Promise.reject(new MediaConverterError(MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            return deferred.promise;
        };
    };

    Converter.EXT_MKV           = "mkv";
    Converter.EXT_MP4           = "mp4";
    Converter.EXT_WEBM          = "webm";
    Converter.DEMUXER_FILENAME  = "demuxer.txt";

    antvd.Converter             = Converter;
    antvd.MediaConverterError   = MediaConverterError;

    return antvd;

})(antvd);
