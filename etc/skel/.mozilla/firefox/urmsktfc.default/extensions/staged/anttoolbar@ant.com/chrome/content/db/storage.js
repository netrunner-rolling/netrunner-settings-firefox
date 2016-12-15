//
// storage.js
// firefox
//
// Created by Dmitriy on 2011-02-15
// Copyright 2008-2016 Ant.com. All rights reserved.
//
var AntStorage =
{
    connection: null,

    init: function ()
    {
        try
        {
            var self = AntStorage;
            var storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);

            self.connection = storageService.openDatabase(self.dbFile);

            self.beginTransaction();
            self.enableForeignKey();
            self.createTables();
        }
        catch (e)
        {
            AntLib.logWarning("AntStorage.init (storage.js)", "Initialization error", e);
        }
        finally
        {
            self.endTransaction();
        }
    },

    deinit: function ()
    {
        var self = AntStorage;

        if (self.connection)
        {
            self.connection.close();
        }
    },
    
    createTables: function ()
    {
        var self = AntStorage;

        try
        {
            (new AntRecordSet('CREATE TABLE IF NOT EXISTS playlists (playlist TEXT PRIMARY KEY)')).exec();
    
            (new AntRecordSet('CREATE TABLE IF NOT EXISTS videos\
                                (sha1 TEXT, title TEXT, path TEXT PRIMARY KEY, url TEXT,\
                                feed TEXT, domain TEXT, duration INTEGER, size INTEGER,\
                                playlist REFERENCES playlists(playlist), last_view INTEGER, nb_views INTEGER, created_at INTEGER)'
                              )).exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.createTables (storage.js)", "Failed to create tables", e);
        }
    },

    get dbFile()
    {
        var file = AntLib.CCSV("@mozilla.org/file/directory_service;1", "nsIProperties").get("ProfD", AntLib.CI("nsIFile"));

        file.append("ant_data.sqlite");

        return file;
    },

    removeDB: function ()
    {
        var self = AntStorage;

        self.deinit();
        self.dbFile.remove(true);
    },

    recreateDB: function ()
    {
        var self = AntStorage;

        try
        {
            self.beginTransaction();

            // SQLite does not support ALTER COLUMN, so just rewriting the data.
            // see http://www.sqlite.org/omitted.html for details
            var oldVideos = (new AntVideoList(true)).list;

            (new AntRecordSet('DROP TABLE IF EXISTS videos')).exec();

            self.createTables();

            for (var i = 0; i < oldVideos.length; i++)
            {
                var item = oldVideos[i];

                self.addPlaylist(item.playlist);

                self.addVideoRecord(item.sha1, item.title, item.path, item.url,
                                    item.feed, item.domain, item.duration, item.size,
                                    item.playlist, item.last_view, item.nb_views, item.created_at);
            }
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.recreateDB (storage.js)", "Failed to re-create tables", e);
        }
        finally
        {
            self.endTransaction();
        }
    },
    
    addVideoRecord: function (sha1, title, path, url, feed, domain, duration, size, playlist, last_view, nb_views, created_at)
    {
        // ED: Temporary fix for .MKV files in embedded player (which are not supported by now)
        if (path.length > 0)
        {
            let _path = path.toLowerCase();
            
            if (_path.endsWith(".mkv") == true)
            {
                AntLib.toLog("AntStorage.addVideoRecord (storage.js)", "Skipping MKV file" + path);
                return;
            }
        }
        
        try
        {
            var _recordSet = new AntRecordSet('INSERT OR REPLACE INTO videos VALUES(\
                                              :sha1, :title, :path, :url,\
                                              :feed, :domain, :duration, :size,\
                                              :playlist, :last_view, :nb_views, :created_at)',
            {
                sha1: sha1,
                title: title,
                path: path,
                url: url,
                feed: url,
                domain: domain,
                duration: duration,
                size: size,
                playlist: playlist,
                last_view: last_view,
                nb_views: nb_views,
                created_at: created_at
            });
            
            _recordSet.exec();
            
        } catch(e)
        {
            AntLib.logWarning("AntStorage.addVideoRecord (storage.js)", "Failed to add video record", e);
        }
    },
    
    updateVideoPlaylist: function (sha1, playlist)
    {
        try
        {
            var _recordSet = new AntRecordSet('UPDATE videos SET playlist=:playlist WHERE sha1=:sha1',
            {
                playlist: playlist,
                sha1: sha1
            });
            
            _recordSet.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.updateVideoPlaylist (storage.js)", "Failed to update video playlist", e);
        }
    },

    updateVideoViews: function (sha1, last_view, nb_views)
    {
        try
        {
            var _recordSet = new AntRecordSet('UPDATE videos SET last_view=:last_view, nb_views=:nb_views WHERE sha1=:sha1',
            {
                last_view: last_view,
                nb_views: nb_views,
                sha1: sha1
            });
            
            _recordSet.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.updateVideoViews (storage.js)", "Failed to update video views", e);
        }
    },

    deleteVideoRecords: function (records, isDelete)
    {
        if ( ! records.length )
        {
            return;
        }

        var args = ['DELETE FROM videos WHERE'];
        var added = false;

        for (var i = 0; i < records.length; i++)
        {
            var item = records[i];

            if (isDelete(item))
            {

                args[0] += (added ? ' || ' : ' ') + 'path=:p' + (args.length - 1);
                args.push(item.path);
                added = true;
            }
        }

        if (added)
        {
            try
            {
                var rs = new AntRecordSet();
    
                rs.init(args);
                rs.exec();
            }
            catch(e)
            {
                AntLib.logWarning("AntStorage.deleteVideoRecords (storage.js)", "Failed to delete video records", e);
            }
        }
    },
    
    deleteVideoRecord: function (path)
    {
        try
        {
            var _recordSet = new AntRecordSet('DELETE FROM videos WHERE path=:path',
            {
                path: path
            });
    
            _recordSet.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.deleteVideoRecord (storage.js)", "Failed to delete video record", e);
        }
    },
    
    getVideos: function ()
    {
        return new AntRecordSet('SELECT * FROM videos');
    },
    
    getPlaylists: function ()
    {
        return new AntRecordSet('SELECT * FROM playlists');
    },
    
    addPlaylist: function (playlist)
    {
        try
        {
            var _recordSet = new AntRecordSet('INSERT OR IGNORE INTO playlists VALUES(:playlist)',
            {
                playlist: playlist
            });
        
            _recordSet.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.addPlaylist (storage.js)", "Failed to add playlist", e);
        }
    },
    
    deletePlaylist: function (playlist)
    {
        try
        {
            var _recordSet = new AntRecordSet('DELETE FROM playlists WHERE playlist=:playlist',
            {
                playlist: playlist
            });
        
            _recordSet.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.deletePlaylist (storage.js)", "Failed to delete playlist", e);
        }
    },
    
    beginTransaction: function ()
    {
        try
        {
            var _beginTransaction = new AntRecordSet('BEGIN TRANSACTION');
            
            _beginTransaction.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.beginTransaction (storage.js)", "Failed to begin transaction", e);
        }
    },

    endTransaction: function ()
    {
        try
        {
            var _endTransaction = new AntRecordSet('COMMIT TRANSACTION');
    
            _endTransaction.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.endTransaction (storage.js)", "Failed to commit transaction", e);
        }
    },

    enableForeignKey: function ()
    {
        try
        {
            var _enableFK = new AntRecordSet('PRAGMA foreign_keys = ON;');
            
            _enableFK.exec();
        }
        catch(e)
        {
            AntLib.logWarning("AntStorage.enableForeignKey (storage.js)", "Failed to enable foreign keys", e);
        }
    }
};
