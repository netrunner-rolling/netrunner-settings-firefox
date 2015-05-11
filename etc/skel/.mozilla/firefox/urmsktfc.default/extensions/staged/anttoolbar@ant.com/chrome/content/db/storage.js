//
// storage.js
// firefox
//
// Created by Dmitriy on 2011-02-15
// Copyright 2008-2012 Ant.com. All rights reserved.
//

var AntStorage = {
    
    connection: null,
    init: function() {
        
        try {
            
            var self = AntStorage;
            
            var storageService = Components.classes["@mozilla.org/storage/service;1"]
                                           .getService(Components.interfaces.mozIStorageService);
            
            self.connection = storageService.openDatabase( self.dbFile );
            
            self.beginTransaction();
            self.enableForeignKey();
            self.createTables();
        }
        catch (e) {
            
            AntLib.toLog( 'AntStorage.init error: ' + e );
        }
        finally {
            
            self.endTransaction();
        }
    },
    deinit: function() {
        
        var self = AntStorage;
        
        if ( self.connection )
            self.connection.close();
    },
    createTables: function() {
        
        var self = AntStorage;
        
        (new AntRecordSet( 'CREATE TABLE IF NOT EXISTS playlists (playlist TEXT PRIMARY KEY)' )).exec();
        
        (new AntRecordSet( 'CREATE TABLE IF NOT EXISTS videos\
                            (sha1 TEXT, title TEXT, path TEXT PRIMARY KEY, url TEXT,\
                            feed TEXT, domain TEXT, duration INTEGER, size INTEGER,\
                            playlist REFERENCES playlists(playlist), last_view INTEGER, nb_views INTEGER, created_at INTEGER)'
                          )).exec();
    },
    get dbFile() {
        
        var file = AntLib.CCSV("@mozilla.org/file/directory_service;1", "nsIProperties")
                         .get("ProfD", AntLib.CI("nsIFile"));
        file.append("ant_data.sqlite");
        
        return file;
    },
    removeDB: function() {
        
        var self = AntStorage;
        
        self.deinit();
        self.dbFile.remove( true );
    },
    recreateDB: function() {
        
        var self = AntStorage;
        
        try {
            
            self.beginTransaction();
            
            //SQLite not supports ALTER COLUMN, so just rewriting the data.
            //see http://www.sqlite.org/omitted.html for details
            var oldVideos = (new AntVideoList(true)).list;
            (new AntRecordSet('DROP TABLE IF EXISTS videos')).exec();
            self.createTables();
            
            for ( var i = 0; i < oldVideos.length; i++ ) {
                
                var item = oldVideos[i];
                self.addPlaylist( item.playlist );
                self.addVideoRecord( item.sha1,     item.title,     item.path,     item.url,
                                     item.feed,     item.domain,    item.duration, item.size,
                                     item.playlist, item.last_view, item.nb_views, item.created_at);
            }
        }
        finally {
            
            self.endTransaction();
        }
    },
    addVideoRecord: function(sha1, title, path, url, feed, domain, duration, size, playlist, last_view, nb_views, created_at) {
        (new AntRecordSet( 'INSERT OR REPLACE INTO videos VALUES(\
                          :sha1, :title, :path, :url,\
                          :feed, :domain, :duration, :size,\
                          :playlist, :last_view, :nb_views, :created_at)',
			   {
                               sha1:       sha1,
			       title:      title,
			       path:       path,
			       url:        url,
                               feed:       feed,
			       domain:     domain,
			       duration:   duration,
			       size:       size,
                               playlist:   playlist,
			       last_view:  last_view,
			       nb_views:   nb_views,
			       created_at: created_at
			   }
                        )).exec();
    },
    updateVideoPlaylist: function(sha1, playlist) {
        
        (new AntRecordSet( 'UPDATE videos SET playlist=:playlist WHERE sha1=:sha1',
			   {
			       playlist: playlist,
			       sha1: sha1
			   })).exec();
    },
    updateVideoViews: function(sha1, last_view, nb_views) {
        
        (new AntRecordSet( 'UPDATE videos SET last_view=:last_view, nb_views=:nb_views WHERE sha1=:sha1',
			   {
                               last_view: last_view,
			       nb_views: nb_views,
			       sha1: sha1
			   })).exec();
    },
    deleteVideoRecords: function(records, isDelete) {
        
        if ( !records.length )
            return;
        
        var args = [ 'DELETE FROM videos WHERE' ];
        var added = false;
        
        for ( var i = 0; i < records.length; i++ ) {
            
            var item = records[i];
            if ( isDelete(item) ) {
                
                args[0] += (added ? ' || ' : ' ') + 'path=:p' + (args.length - 1);
                args.push( item.path );
                added = true;
            }
        }
        
        if ( added ) {
            
            var rs = new AntRecordSet();
            rs.init(args);
            rs.exec();
        }
    },
    deleteVideoRecord: function(path) {
        
        (new AntRecordSet('DELETE FROM videos WHERE path=:path',
			  { path: path })).exec();        
    },
    getVideos: function() {
        return new AntRecordSet( 'SELECT * FROM videos' );
    },
    getPlaylists: function() {
        
        return new AntRecordSet( 'SELECT * FROM playlists' );
    },
    addPlaylist: function(playlist) {
        
        (new AntRecordSet('INSERT OR IGNORE INTO playlists VALUES(:playlist)',
			  { playlist: playlist })).exec();
    },
    deletePlaylist: function(playlist) {
        
        (new AntRecordSet('DELETE FROM playlists WHERE playlist=:playlist',
			  { playlist: playlist })).exec();
    },
    beginTransaction: function() {
        
        (new AntRecordSet('BEGIN TRANSACTION')).exec();
    },
    endTransaction: function() {
        
        (new AntRecordSet('COMMIT TRANSACTION')).exec();
    },
    enableForeignKey: function() {
        
        (new AntRecordSet('PRAGMA foreign_keys = ON;')).exec();
    }
};
