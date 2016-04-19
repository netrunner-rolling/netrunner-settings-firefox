//
// wrappers.js
// firefox
//
// Created by Dmitriy on 2011-03-09
// Contributor Brian King
// Copyright 2008-2016 Ant.com. All rights reserved.
//
function AntVideoList(includeNotExist)
{
    var recordSet = AntStorage.getVideos();

    try
    {
        var columns = recordSet.getColumnList();
        var length = columns.length;
        var arr = [];
        var deletedArr = [];
        var row;

        while ((row = recordSet.getNext()))
        {
            var item = {};

            for (var i = 0; i < length; i++)
            {
                var prop = columns[i];
                item[prop] = row[prop];
            }

            if ( ! item.path )
            {
                AntLib.logWarning("function AntVideoList (wrappers.js)", "Playlist item has invalid path", null);
                continue;
            }

            var file;
            
            try
            {
                // requires Gecko 14
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                file.initWithPath(item.path);
            }
            catch (e)
            {
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                file.initWithPath(item.path);
            }
            
            var exists = file.exists();

            if ( ! exists )
            {
                deletedArr.push(item);
            }

            if (exists || includeNotExist)
            {
                arr.push(item);
            }
        }

        this.list = arr;
        this.deletedFiles = deletedArr;
    }
    finally
    {
        recordSet.close();
    }
}

AntVideoList.prototype =
{
    contain: function (prop, value, drop)
    {
        var length = this.list.length;

        for (var i = 0; i < length; i++)
        {
            var item = this.list[i];

            if (item[prop] == value)
            {
                if (drop)
                {
                    this.list.splice(i, 1);
                }
                
                return item;
            }
        }

        return null;
    }
}

function AntPlaylists()
{
    var recordSet = AntStorage.getPlaylists();

    try
    {
        this.list = {};

        var row;

        while ((row = recordSet.getNext()))
        {
            var name = row.playlist;

            if (!name)
            {
                name = AntPlaylists.defaultPlaylistName;
            }

            this.list[name] = true;
        }
    }
    finally
    {
        recordSet.close();
    }
}

AntPlaylists.__defineGetter__('defaultPlaylistName', function ()
{
    var self = AntPlaylists;

    if (!self._defaultPlaylistName)
    {
        self._defaultPlaylistName = '(' + antvd.AntLang.getString('AntPlayer.antFlvPlayerGeneralPlaylist') + ')';
    }

    return self._defaultPlaylistName;
});
