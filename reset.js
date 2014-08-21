//  reset - a tool to reset all door controls.
//
//  Copyrigth (C) Pascal Martin, 2014.
//
//  This program is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation; either version 2 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along
//  with this program; if not, write to the Free Software Foundation, Inc.,
//  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//
// --------------------------------------------------------------------------
//
// SYNOPSYS
//
//   This tools deactivates all door controls. It is intended to be run after
//   the garage software stop, either an intended stop or an unintended stop.
//
//   The goal is to avoid locking up doors.
//
// --------------------------------------------------------------------------

var os = require('os');
var fs = require('graceful-fs');

var path = require('./path');


var errorLog = function (text) {
    console.log ('[ERROR] '+text);
}

var infoLog = function (text) {
    console.log ('[INFO] '+text);
}

var options = new Object();

process.argv.forEach(function(val, index, array) {
    if ((val == '--debug') || (val == '-d')) {
        options.debug = true;
    }
});

var debugLog = function (text) {}

if (options.debug) {
    debugLog = function (text) {
        console.log ('[DEBUG] '+moment().format('YYYY/MM/DD HH:mm')+' '+text);
    }
}
infoLog ('system reset (all doors)');

// ----------------------------------------------------------------------------
// LOAD THE PROGRAM CONFIGURATION

var config = fs.readFileSync(path.config());
try {
    config = JSON.parse(config);
    debugLog("User configuration parsed");
}
catch (err) {
    errorLog('There has been an error parsing the user config: '+err.stack);
} 

var garageDoors = new Object();

function declareDoors () {
   for (door in config.doors) {
      garageDoors[door] = new Door(config.doors[door], options);
   }
}
declareDoors();
   
// ----------------------------------------------------------------------------
// RESET THE DOOR CONTROLS

// Deactivate all the doors.
//
for (door in config.doors) {
   try { garageDoors[door].reset() } catch (err) {}
}

// Give the program some time to flush out any pending action.
setTimeout(function(){process.exit(1)}, 1000);

