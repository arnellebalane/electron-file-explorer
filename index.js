const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

// Keep a global reference to the window object, otherwise it will get closed
// once the object gets garbage collected.
let window;


// Emitted when Electron has finished initialization and is now ready to
// create windows.
app.on('ready', createWindow);

// Quit app when all windows are closed.
app.on('windows-all-closed', _ => {
  // On macOS it is common for the apps and their menu bar to stay active until
  // the user explicitly quits them.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS only, emitted when the app's dock icon is clicked. On macOS it is
// common to recreate the app window when the dock icon is clicked and there
// are no other windows open.
app.on('activate', _ => {
  if (!window) {
    createWindow();
  }
});


// Emitted when the renderer process requests for a path's contents to be read.
// Contents are sorted alphabetically, but placing directories first.
ipcMain.on('read-path', (e, path) => {
  readPathContents(path)
    .then(sortItemsDirectoriesFirst)
    .then(files => e.sender.send('fs-data', files));
});


/**
 *  Initialize the app's browser window and manages its lifecycle.
 **/
function createWindow() {
  window = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true
  });
  window.loadURL(`file://${__dirname}/index.html`);

  // Dereference the window object so that it may be garbage collected.
  window.on('closed', _ => window = null);
}


/**
 *  Read the contents of a given directory.
 *  @param {String} dirpath The path to the directory to be read.
 *  @return A Promise object that resolves to a list of items contained in the
 *    requested directory, including their properties.
 **/
function readPathContents(dirpath) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirpath, handled(files => {
      Promise.all(files.map(file => {
        const itempath = path.join(dirpath, file);
        return getItemProperties(itempath);
      })).then(resolve);
    }));
  });
}


/**
 *  Get the properties of an item at the given path using `fs.stat`.
 *
 *  @param {String} itempath The path to the item whose properties will be
 *    retrieved.
 *  @return An Promise object that resolves to a `fs.Stat` object representing
 *    the item's properties.
 **/
function getItemProperties(itempath) {
  return new Promise((resolve, reject) => {
    fs.stat(itempath, handled(stats => resolve({
      name: itempath.split('/').pop(),
      type: getItemType(stats),
      path: itempath,
      size: stats.size,
      mtime: stats.mtime
    })));
  });
}


/**
 *  Get the item type (directory, file, etc.) from a given `fs.Stat` object.
 *
 *  @param {fs.Stat} item The `fs.Stat` object corresponding to an item.
 *  @return A String representing what type the item is.
 **/
function getItemType(item) {
  if (item.isFile()) {
    return 'file';
  } else if (item.isDirectory()) {
    return 'directory';
  } else if (item.isBlockDevice()) {
    return 'blockdevice';
  } else if (item.isCharacterDevice()) {
    return 'characterdevice'
  } else if (item.isSymbolicLink()) {
    return 'symlink';
  } else if (item.isFIFO()) {
    return 'fifo';
  } else if (item.isSocket()) {
    return socket;
  }
  return '';
}


/**
 *  Sorts the items alphabetically, but placing the directories before the
 *  other types of items.
 *
 *  @param {Array} items The array of items to be sorted.
 *  @return The sorted array of items.
 **/
function sortItemsDirectoriesFirst(items) {
  return items.sort((a, b) => {
    if ((a.type === 'directory' && b.type === 'directory')
    || (a.type !== 'directory' && b.type !== 'directory')) {
      return compare(
        a.name.replace(/^\./, '').toLowerCase(),
        b.name.replace(/^\./, '').toLowerCase());
    } else if (a.type === 'directory') {
      return -1;
    } else if (b.type === 'directory') {
      return 1;
    }
    return 0;
  });
}


/**
 *  Compare the two given arguments, to be used as comparator for sorting.
 *
 *  @param {Number|String} a, b The objects to be compared.
 *  @return A Number (-1, 0, 1) representing the sort order of the arguments.
 **/
function compare(a, b) {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }
  return 0;
}


/**
 *  Wrap a given callback function and only call it when there are no errors
 *  passed to the error-first callback style.
 *  @param {Function} callback - The callback function to wrap with
 *    error-checking logic.
 *  @return A function that wraps the callback function with error-checking
 *    logic.
 **/
function handled(callback) {
  return function handledCallback(err) {
    if (err) {
      throw err;
    }
    const args = Array.prototype.slice.call(arguments, 1);
    callback.apply(null, args);
  };
}
