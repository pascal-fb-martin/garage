//  Garage - a web server to control garage doors.
//
//  Copyright (C) 2014  Pascal Martin.
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
// NAME
//
//   path - a central point where to decide the location of files.
//
// SYNOPSYS
//
//   This module provides a way to organize the configuration files.
//
//   The module searchs in the following locations:
//           1- local directory.
//           2- /var/lib/garage
//
//   If the file does not exists, but /var/lib/garage exists, then
//   /var/lib/garage is used. If /var/lib/garage does not exist,
//   the local directory is used.
//
//   A separate function is used for each file needed by the application.
//   This allows changing the search strategy for each file in the future.
//
//
// DESCRIPTION
//
//   var path = require('./path');
//
//   path.configure(options);
//
//       Take the command line options into consideration.
//
//   path.config();
//
//       Return a full path name for the user configuration file.
//
//   path.events();
//
//       Return a full path name for the event database file.
//
// --------------------------------------------------------------------------

var fs = require('graceful-fs');

var debugLog = function (text) {}

function verboseLog (text) {
   console.log ('[DEBUG] Path: '+text);
}

function searchFile (name) {
   debugLog ('searching for '+name+' ..');
   if (fs.existsSync('./'+name)) {
      debugLog ('found local file ./'+name);
      return './'+name;
   }
   if (fs.existsSync('/var/lib/garage')) {
      debugLog ('using file /var/lib/garage/'+name);
      return '/var/lib/garage/'+name;
   }
   debugLog ('defaulting to local file ./'+name);
   return './'+name;
}

exports.configure = function (options) {
   if (options && options.debug) {
      debugLog = verboseLog;
   }
}

exports.config = function () {
   return searchFile ('config.json');
}

exports.events = function () {
   return searchFile ('events');
}

